'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionId, getToken, setSession, clearSession } from '@/lib/session';
import SpeechButton from '@/components/SpeechButton';
import ChatWelcome from '@/components/chat/ChatWelcome';
import ChatComposer from '@/components/chat/ChatComposer';
import {
  ChatOptionButtons,
  ChatProvinceSelect,
  ChatProcedureCard,
  ChatSupportedProcedures,
} from '@/components/chat/ChatControls';
import type { Phase, ChatMsg, Question, Flow } from '@/components/chat/chat-types';
import {
  toFlow,
  randomUUID,
  chatApi as api,
} from '@/components/chat/chat-utils';

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
  const audioChunksRef = useRef<Blob[]>([]);
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
      recognitionRef.current.abort();
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

  const renderOptions = (q: Question) => (
    <ChatOptionButtons
      question={q}
      busy={busy}
      onSelect={(value, label) => submitAnswer(q.questionCode, value, label)}
    />
  );

  const renderProvinceSelect = (q: Question) => (
    <ChatProvinceSelect
      question={q}
      busy={busy}
      value={provinceSelectVal}
      onChange={setProvinceSelectVal}
      onConfirm={(v) => {
        setKnownProvince(v);
        submitAnswer(q.questionCode, v, v);
      }}
    />
  );

  const renderProcedureCard = (attachment: any) => (
    <ChatProcedureCard
      attachment={attachment}
      busy={busy}
      onStart={(code, name) => startIntake(code, name)}
    />
  );

  const renderSupportedProcedures = (attachment: any) => (
    <ChatSupportedProcedures
      attachment={attachment}
      busy={busy}
      onStart={(code, original) => startIntake(code, original)}
    />
  );

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
          <ChatWelcome
            busy={busy}
            onStartMarriage={() => startIntake('MARRIAGE_REGISTRATION', 'Tôi muốn đăng ký kết hôn')}
            onStartBirth={() => startIntake('BIRTH_REGISTRATION', 'Tôi muốn đăng ký khai sinh')}
            onDescribeNeed={() => handleSearch('Tôi cần hỗ trợ thủ tục hành chính')}
          />
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
          <button
            type="button"
            onClick={handleCreateApplication}
            disabled={busy}
            className="btn min-h-[48px] flex-1 rounded-xl bg-accent-500 px-6 py-3 text-center font-bold text-slate-950 transition-all duration-200 hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Điền biểu mẫu ngay
          </button>
        </div>
      )}

      <ChatComposer
        input={input}
        busy={busy}
        isInputEnabled={isInputEnabled}
        recording={recording}
        recordingDuration={recordingDuration}
        onInputChange={setInput}
        onSend={handleSend}
        onToggleVoice={startVoice}
        placeholder={
          phase === 'intake' && activeQuestion?.fieldType === 'text'
            ? 'Nhập câu trả lời...'
            : 'Nhập câu hỏi tại đây...'
        }
      />
    </div>
  );
}