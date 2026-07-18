'use client';

import type { FormEvent } from 'react';
import { DISCLAIMER } from '@/lib/constants';

type ChatComposerProps = {
  input: string;
  busy: boolean;
  isInputEnabled: boolean;
  recording: boolean;
  recordingDuration: number;
  onInputChange: (value: string) => void;
  onSend: (e: FormEvent) => void;
  onToggleVoice: () => void;
  placeholder: string;
};

export default function ChatComposer({
  input,
  busy,
  isInputEnabled,
  recording,
  recordingDuration,
  onInputChange,
  onSend,
  onToggleVoice,
  placeholder,
}: ChatComposerProps) {
  return (
    <div className="shrink-0">
      <form
        onSubmit={onSend}
        className="border-t border-white/60 bg-white/80 p-3 backdrop-blur-glass sm:p-4"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-full border-2 border-brand-100 bg-white px-2 py-1.5 shadow-shell focus-within:border-brand-400 focus-within:shadow-glow motion-safe:transition-shadow motion-safe:duration-300">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[48px] flex-1 rounded-full border-0 bg-transparent px-4 text-body-lg tracking-snugish text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={busy || !isInputEnabled}
            aria-disabled={busy || !isInputEnabled}
            aria-label="Nội dung tin nhắn"
          />
          <button
            type="button"
            onClick={onToggleVoice}
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
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
            )}
          </button>
          <button
            type="submit"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-brand-600 font-bold text-white shadow-md motion-safe:transition-all motion-safe:duration-200 hover:bg-brand-700 hover:shadow-glow active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:active:scale-100"
            disabled={busy || !input.trim()}
            aria-label="Gửi tin nhắn"
          >
            <svg
              className="h-5 w-5 rotate-90 transform"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
  );
}
