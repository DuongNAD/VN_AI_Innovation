'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionId, getToken, setSession, clearSession } from '@/lib/session';

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

const randomUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

function SpeechButton({ text, label = 'Nghe' }: { text: string; label?: string }) {
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasSpeech = typeof window !== 'undefined' && ('speechSynthesis' in window || 'webkitSpeechSynthesis' in window);
  if (!hasSpeech) return null;

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      onClick={handleSpeak}
      type="button"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md border transition-colors ${
        playing
          ? 'bg-amber-100 border-amber-300 text-amber-800 focus:ring-amber-500'
          : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200'
      }`}
      aria-pressed={playing}
      aria-label={playing ? 'Dừng phát âm thanh' : 'Nghe đọc nội dung'}
    >
      <span>🔊 {playing ? 'Dừng' : label}</span>
    </button>
  );
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
  const [flow, setFlow] = useState<Flow | null>(null);
  const [answeredList, setAnsweredList] = useState<{ questionCode: string; label: string; value: string; displayValue: string }[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [knownProvince, setKnownProvince] = useState<string | null>(null);
  const [ecoBadge, setEcoBadge] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showEditList, setShowEditList] = useState(false);

  // Active question schema tracking map
  const [questionSchemaMap, setQuestionSchemaMap] = useState<Record<string, Question>>({});

  // Province UI state
  const [provinceSelectVal, setProvinceSelectVal] = useState('');

  // Refs for Voice Recording
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          text: 'Chưa nhận diện được thủ tục yêu cầu. Hiện tại hệ thống chỉ hỗ trợ hai thủ tục sau. Vui lòng chọn một thủ tục để bắt đầu:',
          attachment: {
            type: 'supported_procedures',
            procedures: [
              { code: 'MARRIAGE_REGISTRATION', name: 'Đăng ký kết hôn' },
              { code: 'BIRTH_REGISTRATION', name: 'Đăng ký khai sinh' },
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

    const body: any = {
      procedureCode,
      intentMessage,
    };
    if (knownProvince) {
      body.presetAnswers = { province: knownProvince };
    }

    const res = await api<any>('/api/v1/guided-intake/start', {
      method: 'POST',
      body,
    });

    setBusy(false);

    if (res.ok) {
      const data = res.data;
      if (data.aiMode === 'mock' || data.degraded) {
        setEcoBadge(true);
      }
      const newSessionId = data.sessionId;
      const token = data.accessToken;

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

    setBusy(false);

    if (res.ok) {
      const data = res.data;
      if (data.aiMode === 'mock' || data.degraded) {
        setEcoBadge(true);
      }

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
      router.push(`/form/${res.data.applicationId}`);
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

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = 'vi-VN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          setRecording(true);
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
        };

        rec.onend = () => {
          setRecording(false);
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e) {
        appendBotMessage('Không sử dụng được micro trên thiết bị này. Bạn có thể gõ nội dung vào ô bên dưới.');
        setRecording(false);
      }
    } else if (typeof navigator !== 'undefined' && navigator.mediaDevices && (window as any).MediaRecorder) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const mediaRecorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());

          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          if (audioBlob.size === 0) return;

          setBusy(true);
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice.webm');

          const res = await api<{ text: string }>('/api/v1/speech/transcribe', {
            method: 'POST',
            form: formData,
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

        timerRef.current = setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          setRecording(false);
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

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setRecording(false);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full my-4">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            disabled={busy}
            onClick={() => submitAnswer(q.questionCode, opt.value, opt.label)}
            className="w-full text-left p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-100 font-semibold shadow-sm transition-all duration-200 focus:ring-2 focus:ring-amber-500 hover:scale-[1.01] min-h-[48px]"
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  // RENDER PROVINCE SELECT
  const renderProvinceSelect = (q: Question) => {
    return (
      <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto w-full my-4 items-center">
        <select
          value={provinceSelectVal}
          onChange={(e) => setProvinceSelectVal(e.target.value)}
          disabled={busy}
          className="flex-1 w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 min-h-[48px] focus:outline-none"
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
          className="btn bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-650 text-slate-950 font-bold rounded-xl px-6 py-3 w-full sm:w-auto min-h-[48px] transition-all"
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
      <div className="mt-3 p-4 bg-slate-900 border border-slate-700/60 rounded-xl space-y-3">
        <h4 className="font-bold text-base text-white">{attachment.procedure?.name}</h4>
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Độ tin cậy {attachment.procedure ? Math.round(attachment.procedure.confidence * 100) : 0}%</span>
          {validatedLink ? (
            <a
              href={validatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 hover:text-amber-400 underline font-medium"
            >
              Nguồn
            </a>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => attachment.procedure && startIntake(attachment.procedure.code, attachment.procedure.name)}
          className="w-full btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-lg text-sm transition-all min-h-[44px]"
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
            className="w-full text-left p-3 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700/50 text-slate-200 text-sm font-semibold transition-all min-h-[44px]"
          >
            {proc.name}
          </button>
        ))}
      </div>
    );
  };

  const isInputEnabled = phase === 'search' || (activeQuestion?.fieldType === 'text' && (phase === 'intake' || editingCode !== null));

  return (
    <div className={`flex flex-col h-full bg-slate-900 text-slate-100 font-sans ${embed ? 'w-full h-full' : 'max-w-4xl mx-auto w-full h-[85vh] rounded-2xl shadow-xl border border-slate-800'}`}>
      
      {/* Header */}
      {!embed && (
        <header className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <h1 className="text-lg font-bold text-slate-200">Trợ lý Hướng dẫn Thủ tục Hành chính</h1>
          </div>
          {ecoBadge && <span className="badge-eco" />}
        </header>
      )}

      {/* Message scroll thread */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {embed && ecoBadge && (
          <div className="flex justify-end my-2">
            <span className="badge-eco" />
          </div>
        )}

        {messages.map((message) => {
          const isBot = message.role === 'bot';
          return (
            <div key={message.id} className={`flex items-start gap-2 ${isBot ? '' : 'justify-end'}`}>
              {isBot ? (
                <div className="bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-2xl rounded-tl-none p-4 max-w-[85%] text-slate-200 shadow-md transition-all duration-200 hover:border-slate-650 w-full md:w-auto">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-lg leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    <SpeechButton text={message.text} label="Nghe" />
                  </div>
                  {message.attachment?.type === 'procedure_card' && renderProcedureCard(message.attachment)}
                  {message.attachment?.type === 'supported_procedures' && renderSupportedProcedures(message.attachment)}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl rounded-tr-none p-4 max-w-[85%] ml-auto shadow-md transition-all duration-200 font-medium text-lg">
                  <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Answered / Edit controls area */}
      {answeredList.length > 0 && (
        <div className="px-4 shrink-0">
          <div className="flex justify-center my-2">
            <button
              onClick={() => setShowEditList(!showEditList)}
              className="px-4 py-2 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-all duration-200"
            >
              {showEditList ? 'Ẩn danh sách câu trả lời' : '✍️ Sửa câu trả lời'}
            </button>
          </div>
          {showEditList && (
            <div className="max-w-2xl mx-auto w-full bg-slate-800/95 border border-slate-700/50 rounded-2xl p-4 my-2 space-y-2 shadow-lg">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Chọn câu hỏi cần sửa:</h4>
              {answeredList.map((item) => (
                <button
                  key={item.questionCode}
                  onClick={() => {
                    setEditingCode(item.questionCode);
                    setShowEditList(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-700/50 text-left transition-all border border-transparent hover:border-slate-600"
                >
                  <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  <span className="text-sm font-semibold text-amber-500 font-mono">{item.displayValue}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editing question controls container */}
      {editingCode && activeQuestion && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
          <div className="max-w-2xl mx-auto w-full bg-slate-800/90 border border-slate-700/50 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
              <span className="text-sm font-bold text-amber-400">✍️ Chỉnh sửa: {activeQuestion.label}</span>
              <button
                onClick={() => setEditingCode(null)}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Hủy bỏ
              </button>
            </div>
            {activeQuestion.fieldType === 'radio' && renderOptions(activeQuestion)}
            {activeQuestion.fieldType === 'select' && renderOptions(activeQuestion)}
            {activeQuestion.fieldType === 'province' && renderProvinceSelect(activeQuestion)}
            {activeQuestion.fieldType === 'text' && (
              <p className="text-sm text-slate-400 italic">Vui lòng sử dụng ô nhập tin nhắn bên dưới để sửa câu trả lời.</p>
            )}
          </div>
        </div>
      )}

      {/* Intake phase controls (rendered inline if not editing) */}
      {phase === 'intake' && activeQuestion && !editingCode && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
          {activeQuestion.fieldType === 'radio' && renderOptions(activeQuestion)}
          {activeQuestion.fieldType === 'select' && renderOptions(activeQuestion)}
          {activeQuestion.fieldType === 'province' && renderProvinceSelect(activeQuestion)}
        </div>
      )}

      {/* Done phase controls */}
      {phase === 'done' && sessionId && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto w-full my-2 shrink-0">
          <button
            onClick={() => router.push(`/checklist?sessionId=${sessionId}`)}
            disabled={busy}
            className="flex-1 btn bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-100 font-bold py-3 px-6 rounded-xl transition-all duration-200 text-center min-h-[48px]"
          >
            Xem danh sách giấy tờ
          </button>
          <button
            onClick={handleCreateApplication}
            disabled={busy}
            className="flex-1 btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-6 rounded-xl transition-all duration-200 text-center min-h-[48px]"
          >
            Điền biểu mẫu ngay
          </button>
        </div>
      )}

      {/* Sticky Bottom Input Bar & Disclaimer */}
      <div className="shrink-0">
        <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="flex gap-2 max-w-4xl mx-auto items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={phase === 'intake' && activeQuestion?.fieldType === 'text' ? 'Nhập câu trả lời...' : 'Nhập câu hỏi tại đây...'}
              className="flex-1 bg-slate-800/90 text-white placeholder-slate-400 border border-slate-700/60 rounded-full px-5 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px]"
              disabled={busy || !isInputEnabled}
              aria-label="Nội dung tin nhắn"
            />
            {/* Microphone Button */}
            <button
              type="button"
              onClick={startVoice}
              className={`flex items-center justify-center rounded-full transition-all min-w-[48px] min-h-[48px] ${
                recording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              disabled={busy}
              aria-pressed={recording}
              aria-label={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm bằng giọng nói'}
            >
              {recording ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              )}
            </button>
            {/* Send Button */}
            <button
              type="submit"
              className="flex items-center justify-center bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-650 text-slate-950 font-bold rounded-full min-w-[48px] min-h-[48px] transition-all"
              disabled={busy || !input.trim()}
              aria-label="Gửi tin nhắn"
            >
              <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Disclaimer Footer */}
        <div className="bg-slate-950/40 border-t border-slate-950">
          <p className="text-center text-[11px] text-slate-500 px-4 py-2.5 max-w-2xl mx-auto leading-relaxed">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}