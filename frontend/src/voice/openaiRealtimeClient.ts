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
  error?: {
    message?: string;
  };

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

  /** AI 응답 진행 여부 */
  private responding = false;

  /** 응답 진행 중 추가로 실행해야 할 응답이 있는지 */
  private queuedResponse = false;

  /** 커밋 확인을 기다리는지 */
  private waitingForCommit = false;

  /** 마이크 활성화 여부 */
  private micEnabled = false;

  /** 비동기 도구 실행 중인 개수 */
  private pendingToolCalls = 0;

  /** 일정 알림 대기열 */
  private pendingNotices: string[] = [];

  constructor(
    private ev: VoiceEvents,
    private topic?: VoiceTopic,
    private reminder?: VoiceReminder,
  ) {}

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

      // AI가 먼저 인사하는 동안에는 마이크 비활성화
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        pc.addTrack(track, stream);
      });

      this.micEnabled = false;

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
      // --------------------------------------------------

      const answerSdp = await createRealtimeSession(offer.sdp);

      // --------------------------------------------------
      // 6. OpenAI SDP Answer 적용
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
   * 마이크 활성화 / 비활성화
   */
  private setMicEnabled(enabled: boolean) {
    if (this.stopped) return;

    this.localStream?.getAudioTracks().forEach((track: any) => {
      track.enabled = enabled;
    });

    this.micEnabled = enabled;

    console.log(
      '[VOICE] 마이크 상태:',
      enabled ? '활성화' : '비활성화',
    );
  }

  /**
   * WebRTC DataChannel 연결 완료
   */
  private onOpen() {
    // 수동 발화 모드 설정
    // 서버 VAD가 자동으로 발화를 종료하거나 응답을 생성하지 않도록 한다.
    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: null,
            transcription: {
              model: 'gpt-4o-mini-transcribe',
              language: 'ko',
            },
          },
        },
      },
    });

    setActiveAnnouncer((title, message) =>
      this.announce(alarmNotice(title, message)),
    );
  }

  /**
   * 세션 설정 완료 후 첫 인사
   */
  private startGreeting() {
    if (this.stopped || this.responding) return;

    this.responding = true;

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

    this.ev.onState('thinking');
  }

  /**
   * 응답 생성 요청
   * 이미 응답 중이라면 중복 생성하지 않고 대기시킨다.
   */
  private requestResponse() {
    if (this.stopped) return;

    if (this.responding) {
      this.queuedResponse = true;
      return;
    }

    this.responding = true;

    this.send({
      type: 'response.create',
    });

    this.ev.onState('thinking');
  }

  /**
   * 대화 중에 일정 시간이 되면 다마가 직접 말로 알려 준다.
   */
  private announce(notice: string) {
    if (this.responding || this.pendingToolCalls > 0) {
      this.pendingNotices.push(notice);
      return;
    }

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: notice,
          },
        ],
      },
    });

    this.requestResponse();
  }

  /**
   * 대기 중인 일정 알림 및 응답 처리
   */
  private drainPendingWork() {
    if (this.stopped || this.responding) return;

    // 비동기 도구 실행이 끝날 때까지 기다린다.
    if (this.pendingToolCalls > 0) {
      this.ev.onState('thinking');
      return;
    }

    // 일정 알림 우선 처리
    const notice = this.pendingNotices.shift();

    if (notice) {
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: notice,
            },
          ],
        },
      });

      this.requestResponse();
      return;
    }

    // 대기 중인 도구 응답 등 처리
    if (this.queuedResponse) {
      this.queuedResponse = false;
      this.requestResponse();
      return;
    }

    // 처리할 작업이 없으면 사용자 음성 입력 허용
    this.setMicEnabled(true);
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
      // 세션 설정 완료
      // --------------------------------------------------

      case 'session.updated':
        console.log('[VOICE] Realtime 세션 설정 완료');
        this.startGreeting();
        break;

      // --------------------------------------------------
      // 사용자 음성 입력 커밋 완료
      // --------------------------------------------------

      case 'input_audio_buffer.committed':
        if (this.waitingForCommit) {
          console.log('[VOICE] 오디오 커밋 완료');

          this.waitingForCommit = false;
          this.requestResponse();
        }
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
      // AI 응답 자막 완료
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
      // Response 전체 생성
      // --------------------------------------------------

      case 'response.created':
        this.responding = true;
        break;

      // --------------------------------------------------
      // Response 전체 완료
      // --------------------------------------------------

      case 'response.done':
        console.log('[VOICE] AI 응답 완료');

        this.responding = false;
        this.assistantBuffer = '';

        if (!this.stopped) {
          this.drainPendingWork();
        }

        break;

      // --------------------------------------------------
      // Function Calling
      // --------------------------------------------------

      case 'response.function_call_arguments.done':
        this.pendingToolCalls += 1;
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

        if (this.waitingForCommit) {
          this.waitingForCommit = false;

          if (!this.stopped) {
            this.setMicEnabled(true);
            this.ev.onState('listening');
          }
        }

        this.ev.onError(
          event.error?.message ??
            '알 수 없는 오류가 발생했습니다.',
        );

        break;
    }
  }

  /**
   * Function Calling 처리
   */
  private async handleFunctionCall(event: ServerEvent) {
    const name = event.name ?? event.item?.name;
    const callId = event.call_id ?? event.item?.call_id;
    const rawArguments = event.arguments ?? event.item?.arguments;

    if (!callId || !name) {
      this.pendingToolCalls = Math.max(0, this.pendingToolCalls - 1);
      this.ev.onError('일정 도구 호출 정보를 확인할 수 없습니다.');
      this.drainPendingWork();
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

  /**
   * Function Calling 결과 전달
   */
  private sendFunctionOutput(callId: string, result: unknown) {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    });

    this.pendingToolCalls = Math.max(0, this.pendingToolCalls - 1);

    this.requestResponse();
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
   * 사용자의 발화를 종료하고 AI 응답 요청
   */
  commitTurn() {
    if (
      this.stopped ||
      !this.micEnabled ||
      this.responding ||
      this.waitingForCommit
    ) {
      return;
    }

    console.log('[VOICE] 사용자 발화 종료');

    // 먼저 마이크 입력 중단
    this.setMicEnabled(false);

    this.waitingForCommit = true;
    this.ev.onState('thinking');

    // WebRTC 오디오 전송이 정리될 시간을 확보한 뒤 커밋한다.
    // 이후 response.create는 서버의 committed 이벤트를 받은 뒤 실행한다.
    void (async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));

      if (this.stopped || !this.waitingForCommit) return;

      console.log('[VOICE] 오디오 버퍼 커밋 요청');

      this.send({
        type: 'input_audio_buffer.commit',
      });
    })();
  }

  /**
   * AI 응답 중단
   */
  interrupt() {
    if (this.stopped) return;

    this.send({
      type: 'response.cancel',
    });

    this.send({
      type: 'output_audio_buffer.clear',
    });

    this.assistantBuffer = '';
    this.responding = false;
    this.queuedResponse = false;

    this.setMicEnabled(true);
    this.ev.onState('listening');
  }

  /**
   * 텍스트 입력을 Realtime 대화에 전달
   */
  sendText(text: string) {
    const trimmed = text.trim();

    if (!trimmed || this.stopped || this.responding) return;

    this.setMicEnabled(false);

    this.ev.onUserTranscript(trimmed);

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: trimmed,
          },
        ],
      },
    });

    this.requestResponse();
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
    this.queuedResponse = false;
    this.waitingForCommit = false;
    this.pendingToolCalls = 0;
    this.micEnabled = false;

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
