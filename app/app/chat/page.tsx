"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  store,
  Profile,
  ChatMessage,
  systemPrompt,
  profileColor,
} from "@/lib/store";
import { pickBestModel } from "@/lib/models";
import { createVoiceAdapter, VoiceAdapter } from "@/lib/voice";
import {
  IconMic,
  IconSend,
  IconStop,
  IconCopy,
  IconRefresh,
  IconCheck,
  IconLogo,
  IconTrash,
  IconSpeaker,
  IconShare,
} from "@/components/icons";

const STARTERS: Record<string, string[]> = {
  kind: [
    "Erzähl mir einen Witz",
    "Quiz mich in Erdkunde",
    "Hilf mir bei den Hausaufgaben",
    "Erzähl eine Gute-Nacht-Geschichte",
  ],
  grosseltern: [
    "Erklär mir mein Handy",
    "Was kann ich heute kochen?",
    "Erklär mir die Nachrichten einfach",
    "Erzähl mir etwas Interessantes",
  ],
  eltern: [
    "Was kochen wir heute Abend?",
    "Plane unser Wochenende",
    "Schreib eine Einkaufsliste",
    "Fass mir kurz die Nachrichten zusammen",
  ],
  gast: [
    "Was kannst du alles?",
    "Erzähl uns einen Witz",
    "Empfiehl uns einen Film",
    "Was kochen wir heute Abend?",
  ],
};

export default function Chat() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [model, setModel] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
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
    createVoiceAdapter().then((v) => {
      voiceRef.current = v;
      setVoiceOk(v.available());
    });

    const settings = store.settings();
    if (settings.model) {
      setModel(settings.model);
    } else {
      const url = encodeURIComponent(settings.ollamaUrl);
      fetch(`/api/models?ollamaUrl=${url}`)
        .then((r) => r.json())
        .then((d) => setModel(pickBestModel(d.models) ?? "llama3.1:8b"))
        .catch(() => setModel("llama3.1:8b"));
    }
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function run(history: ChatMessage[]) {
    if (!profile) return;
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
          model: model || "llama3.1:8b",
          system: systemPrompt(profile),
          messages: history,
          ollamaUrl: settings.ollamaUrl,
          profileId: profile.id,
          tools: settings.tools !== false,
          allowDownload: profile.role === "eltern" && settings.tools !== false,
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
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted && !assistantText) {
        assistantText =
          "Da ist etwas schiefgelaufen. Ist der Ollama-Server erreichbar? (Einstellungen → Testen)";
      }
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

  function send(text: string) {
    if (!profile || !text.trim() || busy) return;
    const history = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(history);
    setInput("");
    run(history);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function regenerate() {
    if (busy || !messages.length) return;
    const history = [...messages];
    if (history[history.length - 1]?.role === "assistant") history.pop();
    setMessages(history);
    run(history);
  }

  function copy(i: number, text: string) {
    const done = () => {
      setCopied(i);
      setTimeout(() => setCopied(null), 1200);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      // HTTP-Fallback (Clipboard-API nur im Secure Context)
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    }
  }

  function removeMessage(i: number) {
    if (!profile || busy) return;
    const next = messages.filter((_, idx) => idx !== i);
    setMessages(next);
    store.saveChat(profile.id, next);
  }

  function speak(i: number, text: string) {
    if (typeof speechSynthesis === "undefined") return;
    if (speaking === i) {
      speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      text.replace(/[*_#`>]/g, "").slice(0, 2000),
    );
    utter.lang = "de-DE";
    utter.onend = () => setSpeaking(null);
    utter.onerror = () => setSpeaking(null);
    setSpeaking(i);
    speechSynthesis.speak(utter);
  }

  function share(text: string) {
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
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
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-semibold text-night-950"
            style={{ background: profileColor(profile) }}
          >
            {profile.name[0]?.toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">
              Familien-Chat
            </h1>
            <p className="font-mono text-[11px] text-mist-500">
              {profile.name} · {model || "Modell wird gewählt …"}
            </p>
          </div>
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
          <div className="rise mx-auto mt-8 max-w-md text-center">
            <div className="glass mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-ember-400">
              <IconLogo width={30} height={30} />
            </div>
            <p className="mt-4 font-display text-lg font-semibold">
              Hallo {profile.name}!
            </p>
            <p className="mt-1 text-sm text-mist-300">Womit kann ich helfen?</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(STARTERS[profile.role] ?? STARTERS.gast).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="glass rounded-full px-4 py-2 text-sm text-mist-300 transition hover:border-ember-500/40 hover:text-mist-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "user" ? (
              <div className="group flex items-center gap-1.5">
                {!busy && (
                  <button
                    onClick={() => removeMessage(i)}
                    aria-label="Nachricht löschen"
                    className="rounded-lg p-1.5 text-mist-500 opacity-0 transition group-hover:opacity-100 hover:bg-night-700 hover:text-red-400"
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                )}
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ember-500 px-4 py-3 text-[15px] leading-relaxed text-night-950">
                  {m.content}
                </div>
              </div>
            ) : (
              <div className="group max-w-[85%]">
                <div className="prose-chat glass rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
                {!busy && m.content && (
                  <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => speak(i, m.content)}
                      aria-label={speaking === i ? "Vorlesen stoppen" : "Vorlesen"}
                      className={`rounded-lg p-1.5 hover:bg-night-700 ${
                        speaking === i
                          ? "text-ember-400"
                          : "text-mist-500 hover:text-mist-300"
                      }`}
                    >
                      <IconSpeaker width={15} height={15} />
                    </button>
                    <button
                      onClick={() => copy(i, m.content)}
                      aria-label="Kopieren"
                      className="rounded-lg p-1.5 text-mist-500 hover:bg-night-700 hover:text-mist-300"
                    >
                      {copied === i ? (
                        <IconCheck width={15} height={15} />
                      ) : (
                        <IconCopy width={15} height={15} />
                      )}
                    </button>
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <button
                        onClick={() => share(m.content)}
                        aria-label="Teilen"
                        className="rounded-lg p-1.5 text-mist-500 hover:bg-night-700 hover:text-mist-300"
                      >
                        <IconShare width={15} height={15} />
                      </button>
                    )}
                    <button
                      onClick={() => removeMessage(i)}
                      aria-label="Nachricht löschen"
                      className="rounded-lg p-1.5 text-mist-500 hover:bg-night-700 hover:text-red-400"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                    {i === messages.length - 1 && (
                      <button
                        onClick={regenerate}
                        aria-label="Neu generieren"
                        className="rounded-lg p-1.5 text-mist-500 hover:bg-night-700 hover:text-mist-300"
                      >
                        <IconRefresh width={15} height={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
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
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? "mic-live bg-ember-500 text-night-950"
                : "bg-night-700 text-mist-300 hover:bg-night-600"
            }`}
          >
            <IconMic />
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
        {busy ? (
          <button
            onClick={stop}
            aria-label="Stopp"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-night-700 text-mist-300 transition hover:bg-night-600"
          >
            <IconStop />
          </button>
        ) : (
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            aria-label="Senden"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-500 text-night-950 transition hover:bg-ember-400 disabled:opacity-40"
          >
            <IconSend />
          </button>
        )}
      </div>
    </main>
  );
}
