'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getToken } from '@/lib/session';
import { LIMITS } from '@/lib/constants';
import { useTtsMode } from '@/components/useTtsMode';

interface SpeechButtonProps {
  text: string;
  label?: string;
  /** Biến thể gọn cho bubble chat / inline */
  compact?: boolean;
}

export default function SpeechButton({
  text,
  label = 'Nghe nội dung',
  compact = false,
}: SpeechButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelFetchRef = useRef<(() => void) | null>(null);
  const ttsMode = useTtsMode();

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Cắt tại ranh giới câu thay vì giữa chừng khi vượt hạn mức TTS phía server.
  const ttsClientText = (raw: string): string => {
    if (raw.length <= LIMITS.TTS_CLIENT_MAX) return raw;
    const slice = raw.slice(0, LIMITS.TTS_CLIENT_MAX);
    const cut = Math.max(
      slice.lastIndexOf('.'),
      slice.lastIndexOf('!'),
      slice.lastIndexOf('?'),
      slice.lastIndexOf(';'),
      slice.lastIndexOf('\n')
    );
    return cut > 200 ? slice.slice(0, cut + 1) : slice;
  };

  const handleClick = async () => {
    if (state === 'playing' || state === 'loading') {
      if (cancelFetchRef.current) {
        cancelFetchRef.current();
        cancelFetchRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setState('idle');
      return;
    }

    // 'fpt' mode always uses the server (premium) voice; 'browser' mode prefers
    // the free built-in voice and only reaches the API when the browser has none.
    const useBrowserTts =
      ttsMode === 'browser' && typeof window !== 'undefined' && !!window.speechSynthesis;

    if (useBrowserTts) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';

      utterance.onstart = () => setState('playing');
      utterance.onend = () => setState('idle');
      utterance.onerror = (e) => {
        // 'interrupted'/'canceled' = người dùng chủ động dừng — không phải lỗi.
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          setState('error');
        } else {
          setState('idle');
        }
      };

      setState('loading');
      window.speechSynthesis.speak(utterance);
    } else {
      setState('loading');
      let active = true;
      cancelFetchRef.current = () => {
        active = false;
      };

      try {
        const token = getToken();
        const res = await fetch('/api/v1/speech/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {}),
          },
          body: JSON.stringify({ text: ttsClientText(text) }),
        });

        if (!active) return;

        if (!res.ok) {
          throw new Error('TTS request failed');
        }

        const blob = await res.blob();
        if (!active) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          if (active) setState('playing');
        };
        audio.onended = () => {
          setState('idle');
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setState('error');
          URL.revokeObjectURL(url);
        };

        if (active) {
          await audio.play();
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        if (active) {
          setState('error');
        }
      } finally {
        if (cancelFetchRef.current === cancelFetchRef.current) {
          cancelFetchRef.current = null;
        }
      }
    }
  };

  const iconClass = compact ? 'h-3.5 w-3.5 shrink-0' : 'h-5 w-5 shrink-0';

  const renderIcon = () => {
    switch (state) {
      case 'loading':
        return (
          <svg
            className={`${iconClass} motion-safe:animate-spin`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      case 'playing':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={iconClass}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={iconClass}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
            />
          </svg>
        );
      case 'idle':
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={iconClass}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
            />
          </svg>
        );
    }
  };

  const displayLabel =
    state === 'playing' ? 'Dừng' : state === 'loading' ? 'Đang tải…' : state === 'error' ? 'Thử lại' : label;

  const ariaLabel =
    state === 'playing'
      ? 'Dừng phát âm thanh'
      : state === 'loading'
      ? 'Đang tải âm thanh'
      : state === 'error'
      ? 'Đọc chưa thành công — bấm để thử lại'
      : 'Nghe đọc nội dung';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={ariaLabel}
      aria-pressed={state === 'playing'}
      aria-label={ariaLabel}
      className={
        compact
          ? `inline-flex h-7 min-w-[3.5rem] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              state === 'playing'
                ? 'border-accent-400 bg-accent-100 text-accent-900'
                : state === 'error'
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-surface-border bg-surface text-brand-800 hover:bg-brand-50'
            }`
          : `btn inline-flex min-h-touch min-w-[8.5rem] items-center justify-center gap-2 rounded-lg border px-4 py-2 font-semibold transition-all duration-200 ${
              state === 'playing'
                ? 'border-accent-300 bg-accent-100 text-accent-900'
                : state === 'error'
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-surface-border bg-surface text-slate-700 hover:bg-surface-muted'
            }`
      }
    >
      {/* Khung icon cố định → không layout shift khi đổi state */}
      <span className={`inline-flex items-center justify-center ${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'}`}>
        {renderIcon()}
      </span>
      <span className={compact ? 'leading-none' : ''}>{displayLabel}</span>
    </button>
  );
}
