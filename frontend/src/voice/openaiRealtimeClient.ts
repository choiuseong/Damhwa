import { createRealtimeSession, createSchedule } from '../api';
import type { RealtimeClient, VoiceEvents } from './types';


const GREETING_INSTRUCTIONS =
  '어르신께 먼저 따뜻하고 짧은 존댓말로 인사하고, 오늘 하루가 어땠는지 부담 없이 한 가지만 물어보세요.';

type ServerEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };

  name?: string;
  call_id?: string;
  arguments?: string;

  item?: {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
  };
};

export class OpenAIRealtimeClient implements RealtimeClient {
  private pc: any = null;
  private dc: any = null;
  private localStream: any = null;
  private inCall: any = null;
  private assistantBuffer = '';
  private stopped = false;

  constructor(private ev: VoiceEvents) {}

  async start(): Promise<void> {
    this.stopped = false;
    this.ev.onState('connecting');

    const {
      RTCPeerConnection,
      mediaDevices,
    } = require('react-native-webrtc') as typeof import('react-native-webrtc');

    try {
      this.inCall = require('react-native-incall-manager').default;

      this.inCall.start({
        media: 'audio',
      });

      this.inCall.setForceSpeakerphoneOn(true);
    } catch {
      this.inCall = null;
    }

    try {
      // --------------------------------------------------
      // 1. WebRTC PeerConnection 생성
      // --------------------------------------------------
      const pc = new RTCPeerConnection();
      this.pc = pc;

      // --------------------------------------------------
      // 2. 마이크 권한 및 오디오 스트림 획득
      // --------------------------------------------------
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.localStream = stream;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // --------------------------------------------------
      // 3. OpenAI Realtime 이벤트용 DataChannel
      // --------------------------------------------------
      const dc = pc.createDataChannel('oai-events');

      this.dc = dc;

      dc.onopen = () => {
        this.onOpen();
      };

      dc.onmessage = (event: any) => {
        this.onMessage(String(event.data));
      };

      // --------------------------------------------------
      // 4. SDP Offer 생성
      // --------------------------------------------------
      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      if (!offer.sdp) {
        throw new Error('WebRTC SDP offer 생성에 실패했습니다.');
      }

      // --------------------------------------------------
      // 5. 백엔드에 SDP Offer 전달
      //
      // 프론트 → 우리 백엔드
      //             ↓
      //          OpenAI
      //             ↓
      // 프론트 ← SDP Answer
      // --------------------------------------------------
      const answerSdp = await createRealtimeSession(offer.sdp);

      // --------------------------------------------------
      // 6. OpenAI가 반환한 SDP Answer 적용
      // --------------------------------------------------
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * WebRTC DataChannel 연결 완료
   */
  private onOpen() {
    // 사용자 음성 전사 설정
    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            transcription: {
              model: 'gpt-4o-mini-transcribe',
              language: 'ko',
            },
          },
        },
      },
    });

    // 연결되면 AI가 먼저 인사
    this.send({
      type: 'response.create',
      response: {
        instructions: GREETING_INSTRUCTIONS,
      },
    });

    this.ev.onState('listening');
  }

  /**
   * OpenAI Realtime 서버 이벤트 처리
   */
  private onMessage(raw: string) {
    let event: ServerEvent;

    try {
      event = JSON.parse(raw) as ServerEvent;
    } catch {
      return;
    }

    switch (event.type) {
      // --------------------------------------------------
      // 사용자가 말하기 시작
      // --------------------------------------------------
      case 'input_audio_buffer.speech_started':
        this.ev.onState('listening');
        break;

      // --------------------------------------------------
      // 사용자가 말하기 종료
      // --------------------------------------------------
      case 'input_audio_buffer.speech_stopped':
        this.ev.onState('thinking');
        break;

      // --------------------------------------------------
      // 사용자 음성 → 텍스트
      // --------------------------------------------------
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) {
          this.ev.onUserTranscript(event.transcript.trim());
        }
        break;

      // --------------------------------------------------
      // AI 음성 → 텍스트 스트리밍
      // --------------------------------------------------
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        this.ev.onState('speaking');

        this.assistantBuffer += event.delta ?? '';

        this.ev.onAssistantDelta(event.delta ?? '');

        break;

      // --------------------------------------------------
      // AI 응답 완료
      // --------------------------------------------------
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const full = (
          event.transcript ?? this.assistantBuffer
        ).trim();

        this.assistantBuffer = '';

        if (full) {
          this.ev.onAssistantDone(full);
        }

        break;
      }

      // --------------------------------------------------
      // Response 전체 완료
      // --------------------------------------------------
      case 'response.done':
        if (!this.stopped) {
          this.ev.onState('listening');
        }

        break;

      case 'response.function_call_arguments.done':
        void this.handleFunctionCall(event);
        
        break;

      // --------------------------------------------------
      // OpenAI 오류
      // --------------------------------------------------
      case 'error':
        this.ev.onError(
          event.error?.message ??
            '알 수 없는 오류가 발생했습니다.',
        );

        break;
    }
  }
  private async handleFunctionCall(event: ServerEvent) {
  const name = event.name ?? event.item?.name;
  const callId = event.call_id ?? event.item?.call_id;
  const rawArguments = event.arguments ?? event.item?.arguments;

  if (!callId || !name) {
    this.ev.onError('일정 도구 호출 정보를 확인할 수 없습니다.');
    return;
  }

  if (name !== 'create_schedule') {
    this.sendFunctionOutput(callId, {
      success: false,
      message: '지원하지 않는 도구입니다.',
    });
    return;
  }

  try {
    if (!rawArguments) {
      throw new Error('일정 정보가 비어 있습니다.');
    }

    const args = JSON.parse(rawArguments) as {
      title?: unknown;
      scheduleTime?: unknown;
      rawMessage?: unknown;
    };

    if (
      typeof args.title !== 'string' ||
      !args.title.trim() ||
      args.title.length > 100 ||
      typeof args.scheduleTime !== 'string' ||
      typeof args.rawMessage !== 'string' ||
      !args.rawMessage.trim()
    ) {
      throw new Error('일정 정보가 올바르지 않습니다.');
    }

    const parsedTime = new Date(args.scheduleTime);

    if (
      !Number.isFinite(parsedTime.getTime()) ||
      !/[+-]\d{2}:\d{2}$/.test(args.scheduleTime)
    ) {
      throw new Error('일정 날짜와 시간 형식이 올바르지 않습니다.');
    }

    if (parsedTime.getTime() <= Date.now()) {
      throw new Error('현재보다 미래의 일정을 등록해야 합니다.');
    }

    const schedule = await createSchedule('1', {
      title: args.title.trim(),
      scheduleTime: parsedTime.toISOString(),
      rawMessage: args.rawMessage.trim(),
    });

    this.sendFunctionOutput(callId, {
      success: true,
      schedule: {
        id: schedule.id,
        title: schedule.title,
        scheduleTime: schedule.scheduleTime,
      },
    });
  } catch (error) {
    console.error('일정 도구 실행 오류:', error);

    this.sendFunctionOutput(callId, {
      success: false,
      message: '일정을 등록하지 못했습니다. 사용자에게 다시 안내해 주세요.',
    });
  }
}

  private sendFunctionOutput(callId: string, result: unknown) {
  this.send({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: JSON.stringify(result),
    },
  });

  this.send({ type: 'response.create' });
}
  /**
   * OpenAI Realtime DataChannel로 이벤트 전송
   */
  private send(payload: unknown) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(payload));
    }
  }

  /**
   * 현재 음성 입력을 하나의 발화로 확정하고
   * AI 응답을 요청
   */
  commitTurn() {
    this.send({
      type: 'input_audio_buffer.commit',
    });

    this.send({
      type: 'response.create',
    });

    this.ev.onState('thinking');
  }

  /**
   * AI 응답 중단
   */
  interrupt() {
    this.send({
      type: 'response.cancel',
    });

    this.send({
      type: 'output_audio_buffer.clear',
    });

    this.assistantBuffer = '';

    this.ev.onState('listening');
  }

  /**
   * 텍스트 입력을 Realtime 대화에 전달
   */
  sendText(text: string) {
    this.ev.onUserTranscript(text);

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    });

    this.send({
      type: 'response.create',
    });

    this.ev.onState('thinking');
  }

  /**
   * 음성 세션 종료
   */
  stop() {
    this.stopped = true;

    this.cleanup();

    this.ev.onState('idle');
  }

  /**
   * WebRTC / 오디오 리소스 정리
   */
  private cleanup() {
    try {
      this.dc?.close();
    } catch {}

    try {
      this.localStream
        ?.getTracks()
        .forEach((track: { stop: () => void }) => track.stop());
    } catch {}

    try {
      this.pc?.close();
    } catch {}

    try {
      this.inCall?.stop();
    } catch {}

    this.dc = null;
    this.pc = null;
    this.localStream = null;
    this.inCall = null;
  }
}