"use client";

import { useCallback, useEffect, useState } from "react";
import { store, Settings, DEFAULT_SETTINGS, Profile } from "@/lib/store";
import { pickBestModel } from "@/lib/models";
import { IconX } from "@/components/icons";

interface Fact {
  id: string;
  text: string;
  createdAt: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);

  const loadFacts = useCallback((profileId: string) => {
    fetch(`/api/memory?profileId=${encodeURIComponent(profileId)}`)
      .then((r) => r.json())
      .then((d) => setFacts(d.facts ?? []))
      .catch(() => setFacts([]));
  }, []);

  const checkConnection = useCallback((url: string) => {
    setOnline(null);
    fetch(`/api/models?ollamaUrl=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        setOnline(d.online);
        setModels(d.models);
      })
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    const s = store.settings();
    setSettings(s);
    checkConnection(s.ollamaUrl);
    const p = store.activeProfile();
    setProfile(p);
    if (p) loadFacts(p.id);
  }, [checkConnection, loadFacts]);

  function removeFact(id: string) {
    if (!profile) return;
    setFacts(facts.filter((f) => f.id !== id));
    fetch(
      `/api/memory?profileId=${encodeURIComponent(profile.id)}&factId=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ).catch(() => loadFacts(profile.id));
  }

  function save(next: Settings) {
    setSettings(next);
    store.saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const best = pickBestModel(models);

  return (
    <main>
      <h1 className="rise rise-1 font-display text-3xl font-semibold">
        Ein<span className="text-ember-400">stellungen</span>
      </h1>

      <div className="glass rise rise-2 mt-8 rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold">Lokale KI (Ollama)</h2>
        <p className="mt-1 text-sm text-mist-300">
          Adresse eures Ollama-Servers im Heimnetz.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={settings.ollamaUrl}
            onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
            onBlur={(e) => save({ ...settings, ollamaUrl: e.target.value })}
            placeholder="leer = Server-Standard (127.0.0.1:11434)"
            className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 font-mono text-sm outline-none focus:border-ember-500"
          />
          <button
            onClick={() => {
              save(settings);
              checkConnection(settings.ollamaUrl);
            }}
            className="shrink-0 rounded-xl bg-ember-500 px-5 font-medium text-night-950 transition hover:bg-ember-400"
          >
            Testen
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 font-mono text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              online === null
                ? "animate-pulse bg-mist-500"
                : online
                  ? "bg-sage-400"
                  : "bg-red-400"
            }`}
          />
          <span className="text-mist-300">
            {online === null ? "Prüfe …" : online ? "Verbunden" : "Nicht erreichbar"}
          </span>
          {saved && <span className="text-sage-400">· gespeichert</span>}
        </p>
      </div>

      <div className="glass rise rise-3 mt-5 rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold">Modell</h2>
        <p className="mt-1 text-sm text-mist-300">
          Standard: HeimGeist wählt automatisch das beste verfügbare Modell.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save({ ...settings, model: "" })}
            className={`rounded-full px-4 py-2 text-sm transition ${
              !settings.model
                ? "bg-ember-500 font-medium text-night-950"
                : "border border-night-600 text-mist-300 hover:border-mist-500"
            }`}
          >
            Automatisch{best ? ` (${best})` : ""}
          </button>
          {models.map((m) => (
            <button
              key={m}
              onClick={() => save({ ...settings, model: m })}
              className={`rounded-full px-4 py-2 font-mono text-xs transition ${
                settings.model === m
                  ? "bg-ember-500 font-medium text-night-950"
                  : "border border-night-600 text-mist-300 hover:border-mist-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {models.length === 0 && (
          <input
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            onBlur={(e) => save({ ...settings, model: e.target.value })}
            placeholder="leer = automatisch, oder z. B. llama3.1:8b"
            className="mt-3 w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 font-mono text-sm outline-none focus:border-ember-500"
          />
        )}
      </div>

      <div className="glass rise rise-3 mt-5 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Internet & Werkzeuge
            </h2>
            <p className="mt-1 text-sm text-mist-300">
              Websuche, Webseiten lesen, Downloads (nur Eltern) und Gedächtnis.
            </p>
          </div>
          <button
            onClick={() => save({ ...settings, tools: settings.tools === false })}
            aria-label="Internet & Werkzeuge umschalten"
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              settings.tools !== false ? "bg-ember-500" : "bg-night-600"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-mist-100 transition-all ${
                settings.tools !== false ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {profile && (
        <div className="glass rise rise-4 mt-5 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">
            Gedächtnis von {profile.name}
          </h2>
          <p className="mt-1 text-sm text-mist-300">
            Was sich HeimGeist dauerhaft gemerkt hat. Sag im Chat „Merk dir …“,
            um etwas hinzuzufügen.
          </p>
          {facts.length === 0 ? (
            <p className="mt-4 font-mono text-xs text-mist-500">
              Noch keine Erinnerungen.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {facts.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-night-800 px-4 py-2.5 text-sm"
                >
                  <span className="text-mist-100">{f.text}</span>
                  <button
                    onClick={() => removeFact(f.id)}
                    aria-label="Erinnerung löschen"
                    className="mt-0.5 shrink-0 text-mist-500 transition hover:text-red-400"
                  >
                    <IconX width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="glass rise rise-5 mt-5 rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold">Als App installieren</h2>
        <p className="mt-1 text-sm leading-relaxed text-mist-300">
          Auf dem Handy im Browser-Menü{" "}
          <strong className="text-mist-100">„Zum Startbildschirm hinzufügen“</strong>{" "}
          wählen — HeimGeist verhält sich dann wie eine native App.
        </p>
      </div>

      <p className="rise rise-5 mt-8 text-center font-mono text-xs text-mist-500">
        HeimGeist · Chat, Internet & Gedächtnis aktiv · Whisper & Kameras folgen
      </p>
    </main>
  );
}
