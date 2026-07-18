'use client';

/**
 * Records a MediaStream to 16-bit mono 16 kHz WAV entirely client-side.
 *
 * Exists because the upstream STT provider (FPT.AI whisper) rejects the
 * webm/opus and ogg/opus containers that MediaRecorder produces in
 * Chrome/Firefox — WAV is accepted everywhere. Mirrors the minimal
 * MediaRecorder surface the callers use: start(), stop(), state, onstop.
 */
export class WavRecorder {
  onstop: ((blob: Blob) => void) | null = null;
  state: 'inactive' | 'recording' = 'inactive';

  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private inputSampleRate = 48000;

  constructor(private readonly stream: MediaStream) {}

  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).AudioContext || (window as any).webkitAudioContext)
    );
  }

  start(): void {
    if (this.state === 'recording') return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    if (!this.ctx) return;
    this.inputSampleRate = this.ctx.sampleRate;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but universally available; output stays
    // silent because the callback never writes to the output buffer.
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
    this.state = 'recording';
  }

  stop(): void {
    if (this.state !== 'recording') return;
    this.state = 'inactive';
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
    } catch (_) {}
    const ctx = this.ctx;
    this.ctx = null;
    this.processor = null;
    this.source = null;
    if (ctx) {
      ctx.close().catch(() => {});
    }

    const blob = encodeWav16kMono(this.chunks, this.inputSampleRate);
    this.chunks = [];
    if (this.onstop) {
      this.onstop(blob);
    }
  }
}

const TARGET_SAMPLE_RATE = 16000;

/**
 * Merges Float32 chunks, downsamples to 16 kHz by block averaging, and wraps
 * the result in a 16-bit PCM WAV container. Returns an empty Blob when no
 * audio frames were captured so callers can keep their `size === 0` guard.
 */
export function encodeWav16kMono(chunks: Float32Array[], inputSampleRate: number): Blob {
  let totalLength = 0;
  for (const c of chunks) totalLength += c.length;
  if (totalLength === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  let samples: Float32Array;
  if (inputSampleRate > TARGET_SAMPLE_RATE) {
    const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
    const outLength = Math.floor(merged.length / ratio);
    samples = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), merged.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += merged[j];
      samples[i] = end > start ? sum / (end - start) : 0;
    }
  } else {
    samples = merged;
  }
  const sampleRate = inputSampleRate > TARGET_SAMPLE_RATE ? TARGET_SAMPLE_RATE : inputSampleRate;

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
