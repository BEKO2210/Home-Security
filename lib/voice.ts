"use client";

/**
 * Voice input abstraction.
 *
 * Two adapters, chosen at runtime by probing /api/transcribe:
 * - WhisperAdapter (Phase 2, aktiv): MediaRecorder → POST /api/transcribe
 *   → lokaler faster-whisper-Server. Beste Qualität, komplett privat.
 * - BrowserSpeechAdapter (Fallback): Web Speech API (Chrome/Edge).
 *
 * Beide brauchen einen Secure Context (HTTPS) für Mikrofonzugriff —
 * im Heimnetz liefert das der Caddy-Proxy (deploy/).
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

function hasMic(): boolean {
  return (
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
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

/** Phase 2: lokale Whisper-Transkription über den Server-Proxy. */
export class WhisperAdapter implements VoiceAdapter {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private cancelled = false;

  available(): boolean {
    return hasMic() && typeof MediaRecorder !== "undefined";
  }

  start(onResult: (text: string, final: boolean) => void, onEnd: () => void) {
    this.cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.stream = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined;
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
          if (this.cancelled || !chunks.length) return onEnd();
          onResult("… wird transkribiert …", false);
          try {
            const res = await fetch("/api/transcribe", {
              method: "POST",
              body: new Blob(chunks, { type: chunks[0].type }),
            });
            const data = await res.json();
            const text = String(data.text ?? "").trim();
            if (text) onResult(text, true);
            else onResult("", false);
          } catch {
            onResult("", false);
          }
          onEnd();
        };
        rec.start();
        this.recorder = rec;
        // Sicherheitsnetz: nach 30 s automatisch stoppen
        setTimeout(() => {
          if (this.recorder === rec && rec.state === "recording") rec.stop();
        }, 30_000);
      })
      .catch(() => onEnd());
  }

  /** Zweiter Tipp auf den Mikrofon-Button beendet die Aufnahme → Transkription. */
  stop() {
    if (this.recorder?.state === "recording") {
      this.recorder.stop();
    } else {
      this.cancelled = true;
      this.stream?.getTracks().forEach((t) => t.stop());
    }
    this.recorder = null;
  }
}

/** Whisper bevorzugen, wenn der lokale Server läuft; sonst Browser-Fallback. */
export async function createVoiceAdapter(): Promise<VoiceAdapter> {
  try {
    const res = await fetch("/api/transcribe", {
      signal: AbortSignal.timeout(2_500),
    });
    const data = await res.json();
    if (data.online) {
      const whisper = new WhisperAdapter();
      if (whisper.available()) return whisper;
    }
  } catch {
    /* Whisper-Server nicht da — Fallback */
  }
  return new BrowserSpeechAdapter();
}
