'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getToken } from '@/lib/session';
import { LIMITS } from '@/lib/constants';
import { useTtsMode } from '@/components/useTtsMode';

interface SpeechButtonProps {
  text: string;
  label?: string;
}

export default function SpeechButton({ text, label = 'Nghe nội dung' }: SpeechButtonProps) {
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

  const handleClick = async () => {
    if (state === 'error') return;

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
        if (e.error !== 'interrupted') {
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
          body: JSON.stringify({ text: text.slice(0, LIMITS.TTS_CLIENT_MAX) }),
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

  const renderIcon = () => {
    switch (state) {
      case 'loading':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'playing':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        );
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        );
      case 'idle':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        );
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === 'error'}
      title={state === 'error' ? 'Thiết bị không hỗ trợ đọc' : undefined}
      aria-pressed={state === 'playing'}
      className={`btn flex items-center gap-2 border px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
        state === 'playing'
          ? 'bg-amber-100 border-amber-300 text-amber-900 focus:ring-amber-500'
          : state === 'error'
          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      {renderIcon()}
      <span>{label}</span>
    </button>
  );
}