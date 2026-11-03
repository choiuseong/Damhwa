import {
  createRealtimeSession,
  createSchedule,
  getSchedules,
  getConversations,
} from '../api';
import { scheduleAlarm } from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { setActiveAnnouncer } from './activeSession';
import type {
  RealtimeClient,
  VoiceEvents,
  VoiceReminder,
  VoiceTopic,
} from './types';
import { PermissionsAndroid, Platform } from 'react-native';

const GREETING_INSTRUCTIONS =
  '반가운 어르신께 전화 드린 손주처럼 밝고 다정한 해요체로 짧게 인사하고, 오늘 하루 어떻게 보내셨는지 한 가지만 가볍게 여쭤보세요. 반말과 상담원 같은 인사말은 쓰지 마세요.';

const MEAL_GREETING_INSTRUCTIONS =
  '반가운 어르신께 전화 드린 손주처럼 밝고 다정한 해요체로 짧게 인사하고, 식사는 하셨는지, 뭐 맛있는 거 드셨는지 가볍게 여쭤보세요. 반말과 상담원 같은 인사말은 쓰지 마세요.';

const alarmGreetingInstructions = (r: VoiceReminder) =>
  `어르신이 등록해 두신 '${r.title}' 시간이 됐어요. 손주처럼 다정한 해요체로 "${r.message}" 같은 느낌으로 먼저 알려 드리고, 챙기셨는지 가볍게 하나만 여쭤보세요. 반말과 상담원 같은 말투는 쓰지 마세요.`;

const alarmNotice = (title: string, message: string) =>
  `[일정 알림] 지금은 어르신이 등록하신 '${title}' 시간이에요. 하던 이야기를 잠깐 멈추고 "${message}" 같은 느낌으로 다정하게 알려 드리세요.`;

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

  /** 다마가 응답하는 중에는 새 응답을 만들 수 없어서, 알림을 잠깐 미뤄 둔다 */
  private responding = false;
  private pendingNotices: string[] = [];

  constructor(
    private ev: VoiceEvents,
    private topic?: VoiceTopic,
    private reminder?: VoiceReminder,
  ) {}

  async start(): Promise<void> {
    console.log('[VOICE] start 호출', Date.now());

    this.stopped = false;
    this.ev.onState('connecting');

    try {
      // --------------------------------------------------
      // 0. WebRTC 모듈 로딩
      // --------------------------------------------------
      console.log('[VOICE] react-native-webrtc 모듈 로딩');

      const {
        RTCPeerConnection,
        mediaDevices,
      } = require('react-native-webrtc') as typeof import('react-native-webrtc');

      console.log('[VOICE] react-native-webrtc 모듈 로딩 성공');

      // --------------------------------------------------
      // 0-1. 통화 오디오 설정
      // --------------------------------------------------
      try {
        this.inCall = require('react-native-incall-manager').default;

        this.inCall.start({
          media: 'audio',
        });

        this.inCall.setForceSpeakerphoneOn(true);

        console.log('[VOICE] InCallManager 시작 성공');
      } catch (error) {
        console.warn('[VOICE] InCallManager 실행 실패:', error);
        this.inCall = null;
      }

      // --------------------------------------------------
      // 1. WebRTC PeerConnection 생성
      // --------------------------------------------------
      console.log('[VOICE] PeerConnection 생성 시작');

      const pc = new RTCPeerConnection();
      this.pc = pc;

      console.log('[VOICE] PeerConnection 생성 성공');

      pc.onconnectionstatechange = () => {
        console.log(
          '[VOICE] connectionState:',
          pc.connectionState,
        );
      };

      pc.oniceconnectionstatechange = () => {
        console.log(
          '[VOICE] iceConnectionState:',
          pc.iceConnectionState,
        );
      };

      pc.onsignalingstatechange = () => {
        console.log(
          '[VOICE] signalingState:',
          pc.signalingState,
        );
      };

      // --------------------------------------------------
      // 2. 마이크 권한 및 오디오 스트림 획득
      // --------------------------------------------------
      console.log('[VOICE] getUserMedia 시작');

// Android 마이크 런타임 권한 요청
if (Platform.OS === 'android') {
  const permission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: '마이크 권한 요청',
      message: '담화에서 음성 대화를 진행하려면 마이크 권한이 필요합니다.',
      buttonPositive: '허용',
      buttonNegative: '거부',
    },
  );

  console.log('[VOICE] 마이크 권한 결과:', permission);

  if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('마이크 권한이 허용되지 않았습니다.');
  }
}

const stream = await mediaDevices.getUserMedia({
  audio: true,
  video: false,
});

console.log('[VOICE] getUserMedia 성공');

this.localStream = stream;

const tracks = stream.getTracks();

console.log('[VOICE] 오디오 트랙 개수:', tracks.length);

tracks.forEach((track) => {
  console.log('[VOICE] 오디오 트랙 등록:', track.kind);
  pc.addTrack(track, stream);
});

console.log('[VOICE] 오디오 트랙 등록 완료');

      // --------------------------------------------------
      // 3. OpenAI Realtime 이벤트용 DataChannel
      // --------------------------------------------------
      console.log('[VOICE] DataChannel 생성 시작');

      const dc = pc.createDataChannel('oai-events');

      this.dc = dc;

      console.log('[VOICE] DataChannel 생성 완료');

      dc.onopen = () => {
        console.log('[Realtime] DataChannel OPEN');
        this.onOpen();
      };

      dc.onclose = () => {
        console.log('[Realtime] DataChannel CLOSED');
      };

      dc.onerror = (event: any) => {
        console.error('[Realtime] DataChannel ERROR:', event);
      };

      dc.onmessage = (event: any) => {
        this.onMessage(String(event.data));
      };

      // --------------------------------------------------
      // 4. SDP Offer 생성
      // --------------------------------------------------
      console.log('[VOICE] SDP Offer 생성 시작');

      const offer = await pc.createOffer();

      console.log('[VOICE] SDP Offer 생성 완료');

      await pc.setLocalDescription(offer);

      console.log('[VOICE] LocalDescription 설정 완료');

      if (!offer.sdp) {
        throw new Error('WebRTC SDP offer 생성에 실패했습니다.');
      }

      console.log('[VOICE] SDP Offer 길이:', offer.sdp.length);

      // --------------------------------------------------
      // 5. 백엔드에 SDP Offer 전달
      //
      // 프론트 → 우리 백엔드
      //             ↓
      //          OpenAI
      //             ↓
      // 프론트 ← SDP Answer
      // --------------------------------------------------
      console.log('[VOICE] Realtime API 요청 시작');

      const answerSdp = await createRealtimeSession(offer.sdp);

      console.log('[VOICE] Realtime API 응답 수신');
      console.log('[VOICE] SDP Answer 길이:', answerSdp?.length);

      // --------------------------------------------------
      // 6. OpenAI가 반환한 SDP Answer 적용
      // --------------------------------------------------
      console.log('[VOICE] RemoteDescription 설정 시작');

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('[VOICE] RemoteDescription 설정 완료');
      console.log(
        '[VOICE] 현재 signalingState:',
        pc.signalingState,
      );

    } catch (error) {
      console.error('[VOICE] start 실패:', error);
      console.trace('[VOICE] start 실패 위치');

      console.log('[VOICE] cleanup 시작');

      this.cleanup();

      console.log('[VOICE] cleanup 완료');

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
        instructions:
          this.topic === 'alarm' && this.reminder
            ? alarmGreetingInstructions(this.reminder)
            : this.topic === 'meal'
              ? MEAL_GREETING_INSTRUCTIONS
              : GREETING_INSTRUCTIONS,
      },
    });

    this.responding = true;

    setActiveAnnouncer((title, message) =>
      this.announce(alarmNotice(title, message)),
    );

    this.ev.onState('listening');
  }

  /** 대화 중에 일정 시간이 되면 다마가 직접 말로 알려 준다 */
  private announce(notice: string) {
    if (this.responding) {
      this.pendingNotices.push(notice);
      return;
    }

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: notice }],
      },
    });

    this.send({ type: 'response.create' });
    this.responding = true;
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
      case 'response.created':
        this.responding = true;
        break;

      case 'response.done': {
        this.responding = false;

        if (!this.stopped) {
          this.ev.onState('listening');
        }

        const notice = this.pendingNotices.shift();
        if (notice) this.announce(notice);

        break;
      }

      case 'response.function_call_arguments.done':
        void this.handleFunctionCall(event);
        break;

      // --------------------------------------------------
      // OpenAI 오류
      // --------------------------------------------------
      case 'error':
        console.error(
          '[Realtime] OpenAI 서버 오류:',
          event.error?.message,
        );

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

    if (name === 'get_schedules') {
      try {
        const schedules = await getSchedules('1');

        const now = Date.now();

        const upcoming = schedules
          .filter((schedule) => {
            const time = new Date(schedule.scheduleTime).getTime();
            return Number.isFinite(time) && time >= now;
          })
          .sort(
            (a, b) =>
              new Date(a.scheduleTime).getTime() -
              new Date(b.scheduleTime).getTime(),
          )
          .slice(0, 20)
          .map((schedule) => ({
            id: schedule.id,
            title: schedule.title,
            scheduleTime: schedule.scheduleTime,
          }));

        this.sendFunctionOutput(callId, {
          success: true,
          schedules: upcoming,
        });
      } catch (error) {
        console.error('일정 조회 도구 실행 오류:', error);

        this.sendFunctionOutput(callId, {
          success: false,
          message: '일정을 조회하지 못했습니다.',
        });
      }

      return;
    }

    if (name === 'get_conversation_history') {
      try {
        if (!rawArguments) {
          throw new Error('대화 조회 인자가 비어 있습니다.');
        }

        const parsed = JSON.parse(rawArguments) as {
          query: string;
        };

        const query = parsed.query?.trim() ?? '';
        const conversations = await getConversations('1');

        // 최신 대화부터 최대 5개 선택
        const recentConversations = [...conversations]
          .sort(
            (a, b) =>
              new Date(b.startedAt).getTime() -
              new Date(a.startedAt).getTime(),
          )
          .slice(0, 5);

        const keywords = query
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length >= 2);

        const messages = recentConversations.flatMap(
          (conversation) =>
            conversation.messages.map((message) => ({
              conversationId: conversation.id,
              title: conversation.title,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),
        );

        // 검색어가 없으면 최근 메시지 조회
        // 검색어가 있으면 내용 또는 대화 제목으로 검색
        const matchedMessages =
          keywords.length === 0
            ? messages
            : messages.filter((message) => {
                const text =
                  `${message.title ?? ''} ${message.content}`
                    .toLowerCase();

                return keywords.some((keyword) =>
                  text.includes(keyword),
                );
              });

        const resultMessages = matchedMessages
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          )
          .slice(-30);

        this.sendFunctionOutput(callId, {
          success: true,
          query,
          found: resultMessages.length > 0,
          messages: resultMessages,
        });
      } catch (error) {
        console.error('대화 기록 조회 실패:', error);

        this.sendFunctionOutput(callId, {
          success: false,
          error: '과거 대화 기록을 조회하지 못했습니다.',
        });
      }

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
        reminderMessage?: unknown;
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

      // 일정 시각이 되면 다마 목소리로 알림
      if (useAppStore.getState().notificationsEnabled) {
        const message =
          typeof args.reminderMessage === 'string' &&
          args.reminderMessage.trim()
            ? args.reminderMessage.trim()
            : `어르신, '${schedule.title}' 하실 시간이에요~`;

        scheduleAlarm({
          id: schedule.id,
          title: schedule.title,
          date: schedule.scheduleTime,
          message,
        }).catch((error) =>
          console.warn('일정 알림 예약 실패:', error),
        );
      }

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
    setActiveAnnouncer(null);
    this.pendingNotices = [];
    this.responding = false;

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