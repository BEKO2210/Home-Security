"use client";

/**
 * Voice input abstraction.
 *
 * Today: Web Speech API (works in Chrome/Edge, incl. Android).
 * Later: swap in a WhisperAdapter that records audio and POSTs it to a
 * local faster-whisper server — same interface, no UI changes needed.
 * See ARCHITECTURE.md → "Voice-Adapter".
 */

export interface VoiceAdapter {
  available(): boolean;
  start(onResult: (text: string, final: boolean) => void, onEnd: () => void): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

export class BrowserSpeechAdapter implements VoiceAdapter {
  private recognition: InstanceType<SpeechRecognitionCtor> | null = null;

  available(): boolean {
    return getRecognition() !== null;
  }

  start(onResult: (text: string, final: boolean) => void, onEnd: () => void) {
    const Ctor = getRecognition();
    if (!Ctor) return onEnd();
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      const e = event as {
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      };
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      onResult(text.trim(), final);
    };
    rec.onend = onEnd;
    rec.onerror = onEnd;
    rec.start();
    this.recognition = rec;
  }

  stop() {
    this.recognition?.stop();
    this.recognition = null;
  }
}

/** Placeholder for Phase 2 — local Whisper STT. */
export class WhisperAdapter implements VoiceAdapter {
  constructor(private endpoint: string) {}
  available(): boolean {
    return false; // enabled once a faster-whisper server is configured
  }
  start(_onResult: (text: string, final: boolean) => void, onEnd: () => void) {
    onEnd();
  }
  stop() {}
}

export function createVoiceAdapter(): VoiceAdapter {
  return new BrowserSpeechAdapter();
}
