"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  store,
  Profile,
  ChatMessage,
  systemPrompt,
} from "@/lib/store";
import { createVoiceAdapter, VoiceAdapter } from "@/lib/voice";

export default function Chat() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const voiceRef = useRef<VoiceAdapter | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const p = store.activeProfile();
    if (!p) {
      router.replace("/app");
      return;
    }
    setProfile(p);
    setMessages(store.chat(p.id));
    voiceRef.current = createVoiceAdapter();
    setVoiceOk(voiceRef.current.available());
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    if (!profile || !text.trim() || busy) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setBusy(true);

    const settings = store.settings();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantText = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model || "llama3.1:8b",
          system: systemPrompt(profile),
          messages: history,
          ollamaUrl: settings.ollamaUrl,
        }),
        signal: controller.signal,
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("kein Stream");
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: assistantText }]);
      }
    } catch {
      assistantText =
        assistantText ||
        "Uups — da ist etwas schiefgelaufen. Ist der Ollama-Server erreichbar? (Einstellungen → Testen)";
      setMessages([...history, { role: "assistant", content: assistantText }]);
    } finally {
      const final: ChatMessage[] = [
        ...history,
        { role: "assistant", content: assistantText },
      ];
      store.saveChat(profile.id, final);
      setBusy(false);
      abortRef.current = null;
    }
  }

  function toggleVoice() {
    const voice = voiceRef.current;
    if (!voice) return;
    if (listening) {
      voice.stop();
      setListening(false);
      return;
    }
    setListening(true);
    voice.start(
      (text, final) => {
        setInput(text);
        if (final) {
          setListening(false);
          send(text);
        }
      },
      () => setListening(false),
    );
  }

  if (!profile) return null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Familien-<span className="text-ember-400">Chat</span>
          </h1>
          <p className="font-mono text-xs text-mist-500">
            {profile.emoji} {profile.name}
          </p>
        </div>
        <button
          onClick={() => {
            store.clearChat(profile.id);
            setMessages([]);
          }}
          className="rounded-full border border-night-600 px-4 py-1.5 text-xs text-mist-500 transition hover:border-mist-500 hover:text-mist-300"
        >
          Neu starten
        </button>
      </header>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="glass rise mx-auto mt-10 max-w-sm rounded-2xl p-6 text-center">
            <span className="text-4xl">🏠</span>
            <p className="mt-3 font-display text-lg font-semibold">
              Hallo {profile.name}!
            </p>
            <p className="mt-1 text-sm text-mist-300">
              Frag mich was — Hausaufgaben, Rezepte, Wetter-Plausch oder
              Familienplanung.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-ember-500 text-night-950"
                  : "glass rounded-bl-md text-mist-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="thinking glass inline-flex rounded-2xl rounded-bl-md px-4 py-3">
            <span /><span /><span />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="glass sticky bottom-20 mt-4 flex items-end gap-2 rounded-2xl p-2">
        {voiceOk && (
          <button
            onClick={toggleVoice}
            aria-label="Spracheingabe"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition ${
              listening
                ? "mic-live bg-ember-500 text-night-950"
                : "bg-night-700 hover:bg-night-600"
            }`}
          >
            🎙️
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={listening ? "Ich höre zu …" : "Nachricht an HeimGeist …"}
          className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-mist-500"
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="Senden"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-500 text-lg text-night-950 transition hover:bg-ember-400 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </main>
  );
}
