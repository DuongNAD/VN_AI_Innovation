'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionId, getToken, setSession, clearSession } from '@/lib/session';
import { randomUUID } from '@/lib/uuid';
import { WavRecorder } from '@/lib/wav-recorder';
import SpeechButton from '@/components/SpeechButton';
import BrandLogo from '@/components/BrandLogo';

type Phase = 'search' | 'intake' | 'done';

interface ChatMsg {
  id: string;
  role: 'bot' | 'user';
  text: string;
  attachment?: {
    type: 'procedure_card' | 'supported_procedures';
    procedure?: {
      code: string;
      name: string;
      confidence: number;
      sourceUrl?: string;
    };
    procedures?: { code: string; name: string }[];
    originalMessage?: string;
  };
}

interface Question {
  questionCode: string;
  label: string;
  fieldType: 'radio' | 'select' | 'province' | 'text';
  options?: { value: string; label: string }[];
  helpText?: string;
  examples?: string[];
  originalQuestionText?: string;
}

interface Flow {
  next: Question | null;
  answered: number;
  total: number;
}

// The intake API returns questions in their stored shape ({code, questionText,
// fieldType, options}); normalize once at the boundary so the rest of the
// component can rely on the local Question shape.
function toQuestion(raw: any): Question | null {
  if (!raw) return null;
  return {
    questionCode: raw.questionCode ?? raw.code ?? '',
    label: raw.label ?? raw.questionText ?? '',
    fieldType: raw.fieldType,
    options: raw.options ?? undefined,
    helpText: typeof raw.helpText === 'string' ? raw.helpText : undefined,
    examples: Array.isArray(raw.examples)
      ? raw.examples.filter((item: unknown) => typeof item === 'string')
      : undefined,
    originalQuestionText:
      typeof raw.originalQuestionText === 'string' ? raw.originalQuestionText : undefined,
  };
}

function toFlow(data: any): Flow {
  if (data.flow) {
    return {
      next: toQuestion(data.flow.next),
      answered: data.flow.answered || 0,
      total: data.flow.total || 0,
    };
  }
  return {
    next: toQuestion(data.question),
    answered: data.progress?.answered || 0,
    total: data.progress?.total || 0,
  };
}

const PROVINCES = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ', 'Huế', 'Lai Châu', 'Điện Biên',
  'Sơn La', 'Lạng Sơn', 'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh',
  'Hưng Yên', 'Ninh Bình', 'Quảng Ninh', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Trị', 'Quảng Ngãi',
  'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'Đồng Nai', 'Tây Ninh', 'Vĩnh Long', 'Đồng Tháp',
  'An Giang', 'Cà Mau'
] as const;

const DISCLAIMER = 'Thông tin do trợ lý cung cấp chỉ mang tính tham khảo, vui lòng đối chiếu với cơ quan có thẩm quyền trước khi nộp hồ sơ.';

function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') {
      return url.href;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function api<T>(
  path: string,
  opts?: { method?: string; body?: unknown; form?: FormData; token?: string }
): Promise<{ ok: true; data: T; status: number } | { ok: false; message: string; status: number }> {
  try {
    const headers: Record<string, string> = {};
    if (opts?.token && opts.token.trim() !== '') {
      headers['X-Session-Token'] = opts.token;
    }

    let requestBody: any = undefined;
    if (opts?.form) {
      requestBody = opts.form;
    } else if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(opts.body);
    }

    const res = await fetch(path, {
      method: opts?.method || 'POST',
      headers,
      body: requestBody,
    });

    if (res.ok) {
      try {
        const data = await res.json();
        return { ok: true, data: data as T, status: res.status };
      } catch (err) {
        return { ok: false, message: 'Dữ liệu phản hồi không hợp lệ.', status: res.status };
      }
    } else {
      let message = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
      if (res.status === 429) {
        message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
      } else {
        try {
          const body = await res.json();
          if (body && body.error && typeof body.error.message === 'string') {
            message = body.error.message;
          } else if (body && typeof body.message === 'string') {
            message = body.message;
          }
        } catch (_) {
          // Ignored
        }
      }
      return { ok: false, message, status: res.status };
    }
  } catch (err) {
    return {
      ok: false,
      message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      status: 0,
    };
  }
}

export default function ChatIntake({
  initialQuery,
  initialProcedure,
  embed = false,
}: {
  initialQuery?: string;
  initialProcedure?: string;
  embed?: boolean;
}) {
  const router = useRouter();

  // STATE
  const [phase, setPhase] = useState<Phase>('search');
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Chào mừng bạn đến với Trợ lý Hướng dẫn Thủ tục Hành chính. Bạn cần trợ giúp thủ tục nào hôm nay? (Ví dụ: Tôi muốn đăng ký kết hôn)',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Whether the resolved procedure has a dynamic form (guidance-only imports do not).
  const [formAvailable, setFormAvailable] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [answeredList, setAnsweredList] = useState<{ questionCode: string; label: string; value: string; displayValue: string }[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [knownProvince, setKnownProvince] = useState<string | null>(null);
  const [ecoBadge, setEcoBadge] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showEditList, setShowEditList] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Active question schema tracking map
  const [questionSchemaMap, setQuestionSchemaMap] = useState<Record<string, Question>>({});

  // Province UI state
  const [provinceSelectVal, setProvinceSelectVal] = useState('');

  // Refs for Voice Recording
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sentinel ref for auto scroll
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef(false);

  // Auto scroll effect
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Save encountered questions to schema map
  useEffect(() => {
    if (flow?.next) {
      setQuestionSchemaMap((prev) => ({
        ...prev,
        [flow.next!.questionCode]: flow.next!,
      }));
    }
  }, [flow?.next]);

  // Speech Recognition check/cast
  const SpeechRecognition = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

  // Helper to append a bot message
  const appendBotMessage = (text: string, attachment?: any) => {
    setMessages((prev) => [
      ...prev,
      {
        id: randomUUID(),
        role: 'bot',
        text,
        attachment,
      },
    ]);
  };

  const handleExpiry = () => {
    clearSession();
    setSessionId(null);
    setPhase('search');
    setFlow(null);
    setAnsweredList([]);
    setEditingCode(null);
    setMessages((prev) => [
      ...prev,
      {
        id: randomUUID(),
        role: 'bot',
        text: 'Phiên làm việc đã hết hạn. Vui lòng thực hiện tìm kiếm và bắt đầu lại.',
      },
    ]);
  };

  // Mount check and resume
  useEffect(() => {
    const storedId = getSessionId();
    const token = getToken();
    if (storedId && !token) {
      handleExpiry();
    } else if (storedId && token) {
      setSessionId(storedId);
    }
  }, []);

  // Cleanup voice refs on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // SEARCH PHASE HANDLER
  const handleSearch = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setIsTyping(true);

    setMessages((prev) => [
      ...prev,
      { id: randomUUID(), role: 'user', text: message },
    ]);

    const body: any = { message };
    if (knownProvince) {
      body.province = knownProvince;
    }

    const res = await api<any>('/api/v1/procedures/search', {
      method: 'POST',
      body,
    });

    setIsTyping(false);
    setBusy(false);

    if (res.ok) {
      const data = res.data;
      if (data.aiMode === 'mock' || data.degraded) {
        setEcoBadge(true);
      }
      const procedure = data.procedure;
      const confidence = data.confidence;

      setMessages((prev) => [
        ...prev,
        {
          id: randomUUID(),
          role: 'bot',
          text: `Tôi tìm thấy thủ tục: ${procedure.name}.`,
          attachment: {
            type: 'procedure_card',
            procedure: {
              code: procedure.code,
              name: procedure.name,
              confidence: confidence,
              sourceUrl: procedure.sourceUrl,
            },
          },
        },
      ]);
    } else if (res.status === 404) {
      setMessages((prev) => [
        ...prev,
        {
          id: randomUUID(),
          role: 'bot',
          text: 'Mình chưa nhận diện chính xác thủ tục bạn cần. Bạn thử mô tả cụ thể hơn (ví dụ: “đăng ký khai tử”, “cấp phiếu lý lịch tư pháp”, “xác nhận tình trạng hôn nhân”), hoặc chọn một trong các thủ tục phổ biến sau để bắt đầu:',
          attachment: {
            type: 'supported_procedures',
            procedures: [
              { code: 'DIVORCE_RESOLUTION', name: 'Giải quyết ly hôn' },
              { code: 'MARRIAGE_REGISTRATION', name: 'Đăng ký kết hôn' },
              { code: 'BIRTH_REGISTRATION', name: 'Đăng ký khai sinh' },
              { code: 'TEMP_RESIDENCE_REGISTRATION', name: 'Đăng ký tạm trú' },
              { code: 'CITIZEN_ID_ISSUANCE', name: 'Cấp thẻ căn cước' },
              { code: 'PASSPORT_ISSUANCE', name: 'Cấp hộ chiếu phổ thông trong nước' },
              { code: 'HOUSEHOLD_BUSINESS_REGISTRATION', name: 'Đăng ký thành lập hộ kinh doanh' },
            ],
            originalMessage: message,
          },
        },
      ]);
    } else {
      appendBotMessage(res.message);
    }
  };

  // START INTAKE HANDLER
  const startIntake = async (procedureCode: string, intentMessage: string) => {
    setBusy(true);
    setIsTyping(true);

    const body: any = {
      procedureCode,
    };
    if (intentMessage && intentMessage.trim()) {
      body.intentMessage = intentMessage.trim();
    }
    if (knownProvince) {
      body.presetAnswers = { province: knownProvince };
    }

    const res = await api<any>('/api/v1/guided-intake/start', {
      method: 'POST',
      body,
    });

    setIsTyping(false);
    setBusy(false);

    if (res.ok) {
      const data = res.data;
      if (data.aiMode === 'mock' || data.degraded) {
        setEcoBadge(true);
      }
      const newSessionId = data.sessionId;
      const token = data.accessToken;
      setFormAvailable(!!data.formAvailable);

      const startFlow: Flow = toFlow(data);

      setSession(newSessionId, token);
      setSessionId(newSessionId);
      setFlow(startFlow);
      setPhase('intake');

      if (startFlow.next) {
        appendBotMessage(`Câu ${startFlow.answered + 1}/${startFlow.total}: ${startFlow.next.label}`);
      } else {
        setPhase('done');
        appendBotMessage('Đã thu thập đủ thông tin!');
      }
    } else {
      appendBotMessage(res.message);
    }
  };

  // SUBMIT ANSWER HANDLER
  const submitAnswer = async (questionCode: string, value: any, displayLabel?: string) => {
    const token = getToken();
    if (!token || !sessionId) {
      handleExpiry();
      return;
    }
    setBusy(true);
    setIsTyping(true);

    const displayVal = displayLabel || String(value);

    // Append user bubble
    setMessages((prev) => [
      ...prev,
      { id: randomUUID(), role: 'user', text: displayVal },
    ]);

    const res = await api<any>(`/api/v1/guided-intake/${sessionId}/answer`, {
      method: 'POST',
      body: {
        questionCode,
        value,
        messageId: randomUUID(),
      },
      token: token,
    });

    setIsTyping(false);
    setBusy(false);

    if (res.ok) {
      const data = res.data;
      if (data.aiMode === 'mock' || data.degraded) {
        setEcoBadge(true);
      }

      setFormAvailable(!!data.formAvailable);
      const newFlow: Flow = toFlow(data);

      const currentQuestion = editingCode
        ? questionSchemaMap[editingCode]
        : flow?.next;
      const questionLabel = currentQuestion?.label || questionCode;

      let updatedAnsweredList = [...answeredList];
      const existingIndex = updatedAnsweredList.findIndex((item) => item.questionCode === questionCode);
      const answeredItem = {
        questionCode,
        label: questionLabel,
        value: String(value),
        displayValue: displayVal,
      };

      if (existingIndex > -1) {
        updatedAnsweredList[existingIndex] = answeredItem;
      } else {
        updatedAnsweredList.push(answeredItem);
      }

      // Handle removedAnswers
      if (data.removedAnswers && data.removedAnswers.length > 0) {
        const removedCodes = data.removedAnswers;
        const removedLabels = removedCodes.map((code: string) => {
          const item = updatedAnsweredList.find((x) => x.questionCode === code);
          return item ? item.label : code;
        });
        const botNote = 'Các câu trả lời sau đã được xoá vì bạn thay đổi câu trước: ' + removedLabels.join(', ');
        
        updatedAnsweredList = updatedAnsweredList.filter((item) => !removedCodes.includes(item.questionCode));
        appendBotMessage(botNote);
      }

      setAnsweredList(updatedAnsweredList);
      setFlow(newFlow);

      if (editingCode) {
        setEditingCode(null);
      }

      if (!newFlow.next) {
        setPhase('done');
        appendBotMessage('Đã thu thập đủ thông tin!');
      } else {
        setPhase('intake');
        appendBotMessage(`Câu ${newFlow.answered + 1}/${newFlow.total}: ${newFlow.next.label}`);
      }
    } else {
      appendBotMessage(res.message);
    }
  };

  // DONE PHASE CTA - CREATE APPLICATION
  const handleCreateApplication = async () => {
    const token = getToken();
    if (!token || !sessionId) {
      handleExpiry();
      return;
    }
    setBusy(true);

    const res = await api<{ applicationId: string }>('/api/v1/applications', {
      method: 'POST',
      body: {
        sessionId: sessionId,
        messageId: randomUUID(),
      },
      token: token,
    });

    setBusy(false);

    if (res.ok) {
      router.push(`/user/form/${res.data.applicationId}`);
    } else {
      appendBotMessage(res.message);
    }
  };

  // VOICE RECORDING CONTROLS
  const startVoice = async () => {
    if (recording) {
      stopVoice();
      return;
    }

    setRecordingDuration(0);

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = 'vi-VN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          setRecording(true);
          // Start timer
          recordingTimerRef.current = setInterval(() => {
            setRecordingDuration((prev) => prev + 1);
          }, 1000);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(transcript);
          }
        };

        rec.onerror = (event: any) => {
          console.error(event);
          appendBotMessage('Không sử dụng được micro trên thiết bị này. Bạn có thể gõ nội dung vào ô bên dưới.');
          setRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
          }
        };

        rec.onend = () => {
          setRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e) {
        appendBotMessage('Không sử dụng được micro trên thiết bị này. Bạn có thể gõ nội dung vào ô bên dưới.');
        setRecording(false);
      }
    } else if (typeof navigator !== 'undefined' && navigator.mediaDevices && WavRecorder.isSupported()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // WAV (not MediaRecorder webm/ogg): the FPT.AI whisper upstream
        // rejects opus containers, so we capture PCM and ship 16 kHz WAV.
        const mediaRecorder = new WavRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.onstop = async (audioBlob: Blob) => {
          stream.getTracks().forEach((track) => track.stop());

          if (audioBlob.size === 0) return;

          setBusy(true);
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice.wav');

          const res = await api<{ text: string }>('/api/v1/speech/transcribe', {
            method: 'POST',
            form: formData,
            token: getToken() || undefined,
          });

          setBusy(false);

          if (res.ok) {
            if (res.data && res.data.text) {
              setInput(res.data.text);
            }
          } else {
            appendBotMessage(res.message);
          }
        };

        mediaRecorder.start();
        setRecording(true);

        // Start timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);

        timerRef.current = setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          setRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
          }
        }, 10000);

      } catch (err) {
        console.error(err);
        appendBotMessage('Không sử dụng được micro trên thiết bị này. Bạn có thể gõ nội dung vào ô bên dưới.');
        setRecording(false);
      }
    } else {
      appendBotMessage('Không sử dụng được micro trên thiết bị này. Bạn có thể gõ nội dung vào ô bên dưới.');
    }
  };

  const stopVoice = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      // stop() (not abort()) so the pending recognition result is still delivered
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setRecording(false);
    setRecordingDuration(0);
  };

  // ONE-SHOT INITIAL PROPS EFFECT
  useEffect(() => {
    if (initialRef.current) return;
    initialRef.current = true;

    if (initialProcedure) {
      startIntake(initialProcedure, initialQuery || '');
    } else if (initialQuery) {
      setInput(initialQuery);
      handleSearch(initialQuery);
    }
  }, [initialQuery, initialProcedure]);

  // BOTTOM INPUT SUBMIT
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;

    const message = input.trim();
    setInput('');

    if (phase === 'search') {
      handleSearch(message);
    } else if (activeQuestion?.fieldType === 'text') {
      submitAnswer(activeQuestion.questionCode, message, message);
    }
  };

  // Resolve active question details for the intake controls
  const activeQuestion = editingCode
    ? questionSchemaMap[editingCode]
    : flow?.next;

  // Prefill province select if needed
  useEffect(() => {
    if (activeQuestion?.fieldType === 'province') {
      const answeredVal = answeredList.find((x) => x.questionCode === activeQuestion.questionCode)?.value || '';
      setProvinceSelectVal(answeredVal || knownProvince || '');
    }
  }, [activeQuestion, editingCode, answeredList, knownProvince]);

  // RENDER OPTION BUTTONS (Radio / Select)
  const renderOptions = (q: Question) => {
    const options = q.options || [];
    return (
      <div className="mx-auto my-4 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            disabled={busy}
            onClick={() => submitAnswer(q.questionCode, opt.value, opt.label)}
            className="min-h-[48px] w-full rounded-xl border border-surface-border bg-surface p-4 text-left font-semibold text-slate-900 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:active:scale-[0.99] hover:border-brand-400 hover:bg-brand-50 hover:shadow-md focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  const renderQuestionHelp = (q: Question) => {
    if (!q.helpText) {
      return null;
    }
    const speechText = [
      q.label,
      q.helpText,
      ...(q.examples ?? []),
    ].join('. ');
    return (
      <div className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-black text-white shadow-md"
            aria-hidden="true"
          >
            AI
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-indigo-950">AI giải thích câu hỏi dễ hiểu</p>
              <SpeechButton text={speechText} label="Nghe giải thích" compact />
            </div>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">
              {q.helpText}
            </p>
            {q.examples && q.examples.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-indigo-900">
                {q.examples.map((example, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="font-black text-indigo-500" aria-hidden="true">•</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              AI chỉ diễn giải câu hỏi chính thức, không thay đổi điều kiện của thủ tục.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // RENDER PROVINCE SELECT
  const renderProvinceSelect = (q: Question) => {
    return (
      <div className="mx-auto my-4 flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row">
        <select
          value={provinceSelectVal}
          onChange={(e) => setProvinceSelectVal(e.target.value)}
          disabled={busy}
          className="min-h-[48px] w-full flex-1 rounded-xl border border-surface-border bg-surface px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
          aria-label="Chọn tỉnh thành"
        >
          <option value="">-- Chọn Tỉnh/Thành phố --</option>
          {PROVINCES.map((prov) => (
            <option key={prov} value={prov}>
              {prov}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !provinceSelectVal}
          onClick={() => {
            setKnownProvince(provinceSelectVal);
            submitAnswer(q.questionCode, provinceSelectVal, provinceSelectVal);
          }}
          className="btn min-h-[48px] w-full rounded-xl bg-accent-500 px-6 py-3 font-bold text-slate-950 transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
        >
          Xác nhận
        </button>
      </div>
    );
  };

  // RENDER PROCEDURE CARD IN THREAD
  const renderProcedureCard = (attachment: any) => {
    const validatedLink = safeHttpsUrl(attachment.procedure?.sourceUrl);
    return (
      <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <h4 className="text-base font-bold text-brand-900">{attachment.procedure?.name}</h4>
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>
            Độ tin cậy {attachment.procedure ? Math.round(attachment.procedure.confidence * 100) : 0}%
          </span>
          {validatedLink ? (
            <a
              href={validatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-700 underline hover:text-brand-800"
            >
              Nguồn
            </a>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => attachment.procedure && startIntake(attachment.procedure.code, attachment.procedure.name)}
          className="btn min-h-[44px] w-full rounded-lg bg-accent-500 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          Đúng, bắt đầu thủ tục này
        </button>
      </div>
    );
  };

  // RENDER SUPPORTED PROCEDURES FALLBACK IN THREAD
  const renderSupportedProcedures = (attachment: any) => {
    return (
      <div className="mt-3 space-y-2">
        {attachment.procedures.map((proc: any) => (
          <button
            key={proc.code}
            type="button"
            disabled={busy}
            onClick={() => startIntake(proc.code, attachment.originalMessage || '')}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface p-3 text-left text-sm font-semibold text-slate-900 transition-all hover:border-brand-400 hover:bg-brand-50"
          >
            {proc.name}
          </button>
        ))}
      </div>
    );
  };

  const isInputEnabled = phase === 'search' || (activeQuestion?.fieldType === 'text' && (phase === 'intake' || editingCode !== null));

  // Chỉ dùng để quyết định render UI chào mừng — không đổi state
  const showBrandedWelcome =
    phase === 'search' &&
    !isTyping &&
    messages.length === 1 &&
    messages[0]?.id === 'welcome';

  return (
    <div
      className={`flex h-full min-h-0 flex-col font-sans text-slate-900 ${
        embed
          ? 'h-full w-full bg-surface-muted'
          : 'mx-auto h-full min-h-[min(100dvh,720px)] w-full max-w-4xl rounded-3xl border-2 border-brand-200/80 bg-white/90 shadow-shell-lg ring-1 ring-brand-100 backdrop-blur-sm sm:min-h-[min(85dvh,800px)]'
      }`}
    >
      {ecoBadge && (
        <div className="flex shrink-0 justify-end border-b border-surface-border bg-brand-50/80 px-4 py-2">
          <span className="badge-eco" aria-label="Chế độ tiết kiệm" />
        </div>
      )}

      {/* Message scroll thread — live region cho trình đọc màn hình */}
      <div
        className="flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-brand-50/80 to-slate-100 p-4 md:p-6 [background-image:radial-gradient(circle_at_1px_1px,rgb(148_163_184/0.22)_1px,transparent_0)] [background-size:18px_18px]"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Hội thoại với trợ lý"
      >
        {showBrandedWelcome && (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 py-4 text-center">
            <BrandLogo size="lg" href={null} />
            {/* Minh họa chào mừng gọn (inline SVG) */}
            <svg
              viewBox="0 0 200 120"
              className="h-28 w-full max-w-[220px]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="20" y="24" width="100" height="72" rx="10" fill="white" stroke="#bfdbfe" strokeWidth="2" />
              <rect x="20" y="24" width="100" height="18" rx="10" fill="#2563eb" />
              <rect x="20" y="34" width="100" height="8" fill="#2563eb" />
              <rect x="34" y="54" width="72" height="6" rx="3" fill="#dbeafe" />
              <rect x="34" y="68" width="56" height="6" rx="3" fill="#e2e8f0" />
              <rect x="34" y="82" width="40" height="6" rx="3" fill="#e2e8f0" />
              <circle cx="150" cy="52" r="28" fill="#1d4ed8" />
              <circle cx="140" cy="48" r="3" fill="#93c5fd" />
              <circle cx="160" cy="48" r="3" fill="#93c5fd" />
              <circle cx="150" cy="62" r="3" fill="#fbbf24" />
              <path d="M140 48l10 14M160 48l-10 14M140 48h20" stroke="#bfdbfe" strokeWidth="1.5" />
              <rect x="128" y="88" width="52" height="18" rx="9" fill="#f59e0b" />
              <path d="M140 97h28" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="space-y-2">
              <h2 className="text-title text-brand-900 sm:text-xl">
                Chào mừng đến Trợ lý Thủ tục Hành chính
              </h2>
              <p className="text-body text-slate-600">
                VN AI Innovation — chọn lối tắt bên dưới hoặc gõ nhu cầu của bạn.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => startIntake('MARRIAGE_REGISTRATION', 'Tôi muốn đăng ký kết hôn')}
                className="card-premium p-4 text-left hover:shadow-glow disabled:opacity-60"
              >
                <span className="block text-sm font-bold text-brand-800">Đăng ký kết hôn</span>
                <span className="mt-1 block text-xs text-slate-500">Bắt đầu ngay</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startIntake('BIRTH_REGISTRATION', 'Tôi muốn đăng ký khai sinh')}
                className="card-premium p-4 text-left hover:shadow-glow-accent disabled:opacity-60"
              >
                <span className="block text-sm font-bold text-accent-800">Đăng ký khai sinh</span>
                <span className="mt-1 block text-xs text-slate-500">Bắt đầu ngay</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSearch('Tôi cần hỗ trợ thủ tục hành chính')}
                className="card-premium p-4 text-left hover:border-brand-300 disabled:opacity-60"
              >
                <span className="block text-sm font-bold text-slate-800">Mô tả nhu cầu</span>
                <span className="mt-1 block text-xs text-slate-500">AI nhận diện thủ tục</span>
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => {
          // Ẩn bubble welcome khi đã hiển thị branded empty state (chỉ UI)
          if (showBrandedWelcome && message.id === 'welcome') {
            return null;
          }
          const isBot = message.role === 'bot';
          return (
            <div key={message.id} className={`flex items-start gap-2 ${isBot ? '' : 'justify-end'}`}>
              {isBot ? (
                <div className="w-full max-w-[85%] rounded-2xl rounded-tl-sm border border-white bg-gradient-to-b from-white to-slate-50 p-4 text-slate-900 shadow-shell ring-1 ring-slate-900/5 motion-safe:transition-all motion-safe:duration-200 md:w-auto">
                  <div className="flex items-start justify-between gap-4">
                    <p className="whitespace-pre-wrap text-body-lg leading-[1.7] tracking-snugish text-slate-800">
                      {message.text}
                    </p>
                    <SpeechButton text={message.text} label="Nghe" compact />
                  </div>
                  {message.attachment?.type === 'procedure_card' && renderProcedureCard(message.attachment)}
                  {message.attachment?.type === 'supported_procedures' && renderSupportedProcedures(message.attachment)}
                </div>
              ) : (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-4 text-lg font-medium tracking-snugish text-white shadow-glow ring-1 ring-white/25 motion-safe:transition-transform motion-safe:duration-200 motion-safe:active:scale-[0.99]">
                  <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-start gap-2" aria-live="polite">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white bg-white p-4 shadow-shell">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500 motion-safe:animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500 motion-safe:animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500 motion-safe:animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm font-medium text-slate-600">Đang suy nghĩ...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {answeredList.length > 0 && (
        <div className="shrink-0 bg-surface px-4">
          <div className="my-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowEditList(!showEditList)}
              className="min-h-touch rounded-full border border-surface-border bg-surface-muted px-4 py-2 text-sm font-semibold text-slate-800 transition-all duration-200 hover:bg-brand-50 hover:text-brand-800"
              aria-expanded={showEditList}
            >
              {showEditList ? 'Ẩn danh sách câu trả lời' : 'Sửa câu trả lời'}
            </button>
          </div>
          {showEditList && (
            <div className="mx-auto my-2 w-full max-w-2xl space-y-2 rounded-2xl border border-surface-border bg-surface p-4 shadow-sm">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                Chọn câu hỏi cần sửa:
              </h4>
              {answeredList.map((item) => (
                <button
                  key={item.questionCode}
                  type="button"
                  onClick={() => {
                    setEditingCode(item.questionCode);
                    setShowEditList(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-transparent p-3 text-left transition-all hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  <span className="font-mono text-sm font-semibold text-brand-700">{item.displayValue}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {editingCode && activeQuestion && (
        <div className="shrink-0 border-t border-surface-border bg-surface p-4">
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-surface-border bg-surface-muted p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-surface-border pb-2">
              <span className="text-sm font-bold text-brand-800">Chỉnh sửa: {activeQuestion.label}</span>
              <button
                type="button"
                onClick={() => setEditingCode(null)}
                className="min-h-touch text-sm font-medium text-slate-600 underline hover:text-slate-900"
              >
                Hủy bỏ
              </button>
            </div>
            {renderQuestionHelp(activeQuestion)}
            {activeQuestion.fieldType === 'radio' && renderOptions(activeQuestion)}
            {activeQuestion.fieldType === 'select' && renderOptions(activeQuestion)}
            {activeQuestion.fieldType === 'province' && renderProvinceSelect(activeQuestion)}
            {activeQuestion.fieldType === 'text' && (
              <p className="text-sm italic text-slate-600">
                Vui lòng sử dụng ô nhập tin nhắn bên dưới để sửa câu trả lời.
              </p>
            )}
          </div>
        </div>
      )}

      {phase === 'intake' && activeQuestion && !editingCode && (
        <div className="shrink-0 border-t border-surface-border bg-surface p-4">
          {renderQuestionHelp(activeQuestion)}
          {activeQuestion.fieldType === 'radio' && renderOptions(activeQuestion)}
          {activeQuestion.fieldType === 'select' && renderOptions(activeQuestion)}
          {activeQuestion.fieldType === 'province' && renderProvinceSelect(activeQuestion)}
        </div>
      )}

      {phase === 'done' && sessionId && (
        <div className="mx-auto my-2 flex w-full max-w-2xl shrink-0 flex-col gap-4 border-t border-surface-border bg-surface p-4 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push(`/user/checklist?sessionId=${sessionId}`)}
            disabled={busy}
            className="btn min-h-[48px] flex-1 rounded-xl border border-surface-border bg-surface-muted px-6 py-3 text-center font-bold text-slate-800 transition-all duration-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Xem danh sách giấy tờ
          </button>
          {formAvailable && (
            <button
              type="button"
              onClick={handleCreateApplication}
              disabled={busy}
              className="btn min-h-[48px] flex-1 rounded-xl bg-accent-500 px-6 py-3 text-center font-bold text-slate-950 transition-all duration-200 hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              Điền biểu mẫu ngay
            </button>
          )}
        </div>
      )}

      <div className="shrink-0">
        <form onSubmit={handleSend} className="border-t border-white/60 bg-white/80 p-3 backdrop-blur-glass sm:p-4">
          <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-full border-2 border-brand-100 bg-white px-2 py-1.5 shadow-shell focus-within:border-brand-400 focus-within:shadow-glow motion-safe:transition-shadow motion-safe:duration-300">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                phase === 'intake' && activeQuestion?.fieldType === 'text'
                  ? 'Nhập câu trả lời...'
                  : 'Nhập câu hỏi tại đây...'
              }
              className="min-h-[48px] flex-1 rounded-full border-0 bg-transparent px-4 text-body-lg tracking-snugish text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-500"
              disabled={busy || !isInputEnabled}
              aria-disabled={busy || !isInputEnabled}
              aria-label="Nội dung tin nhắn"
            />
            <button
              type="button"
              onClick={startVoice}
              className={`relative flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full motion-safe:transition-all ${
                recording
                  ? 'bg-rose-600 text-white motion-safe:animate-pulse'
                  : 'border border-surface-border bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-800'
              }`}
              disabled={busy}
              aria-pressed={recording}
              aria-label={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm bằng giọng nói'}
            >
              {recording ? (
                <>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                  </svg>
                  {recordingDuration > 0 && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-700 px-2 py-1 font-mono text-xs text-white">
                      {Math.floor(recordingDuration / 60)}:
                      {String(recordingDuration % 60).padStart(2, '0')}
                    </span>
                  )}
                </>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              )}
            </button>
            <button
              type="submit"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-brand-600 font-bold text-white shadow-md motion-safe:transition-all motion-safe:duration-200 hover:bg-brand-700 hover:shadow-glow active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:active:scale-100"
              disabled={busy || !input.trim()}
              aria-label="Gửi tin nhắn"
            >
              <svg className="h-5 w-5 rotate-90 transform" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>

        <div className="border-t border-surface-border bg-brand-50/50">
          <p className="mx-auto max-w-2xl px-4 py-3 text-center text-xs leading-relaxed text-slate-600 sm:text-sm">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}
