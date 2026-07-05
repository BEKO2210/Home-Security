"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { IconCamera, IconPlus, IconX } from "@/components/icons";

interface Cam {
  id: string;
  name: string;
}

export default function Cameras() {
  const router = useRouter();
  const [isParent, setIsParent] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [cams, setCams] = useState<Cam[]>([]);
  const [live, setLive] = useState<Cam | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => {
        setOnline(d.online);
        setCams(d.cameras ?? []);
      })
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    const p = store.activeProfile();
    if (!p) {
      router.replace("/app");
      return;
    }
    setIsParent(p.role === "eltern");
    load();
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, [router, load]);

  async function add() {
    setError("");
    const res = await fetch("/api/cameras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, src }),
    });
    if (res.ok) {
      setAdding(false);
      setName("");
      setSrc("");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Konnte Kamera nicht hinzufügen");
    }
  }

  async function remove(id: string) {
    await fetch(`/api/cameras?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setLive(null);
    load();
  }

  return (
    <main>
      <h1 className="rise rise-1 font-display text-3xl font-semibold">
        Ka<span className="text-ember-400">meras</span>
      </h1>
      <p className="rise rise-2 mt-2 flex items-center gap-2 text-sm text-mist-300">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            online === null
              ? "animate-pulse bg-mist-500"
              : online
                ? "bg-sage-400"
                : "bg-red-400"
          }`}
        />
        {online === null
          ? "Prüfe Kamera-Server …"
          : online
            ? "Kamera-Server läuft — Streams bleiben im Haus"
            : "Kamera-Server offline (deploy/: docker compose up -d)"}
      </p>

      {live && (
        <div className="rise mt-6">
          <div className="glass overflow-hidden rounded-2xl p-1.5">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Live-Kamerastream ohne Tonspur-Untertitel */}
            <video
              key={live.id}
              src={`/api/cameras/stream?id=${encodeURIComponent(live.id)}`}
              autoPlay
              muted
              playsInline
              controls
              className="aspect-video w-full rounded-xl bg-night-950 object-contain"
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <p className="font-display text-lg font-semibold">
              {live.name} <span className="font-mono text-xs text-red-400">● LIVE</span>
            </p>
            <button
              onClick={() => setLive(null)}
              className="rounded-full border border-night-600 px-4 py-1.5 text-xs text-mist-300 hover:border-mist-500"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      <div className="rise rise-3 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cams.map((c) => (
          <div key={c.id} className="relative">
            <button
              onClick={() => setLive(c)}
              className="glass w-full overflow-hidden rounded-2xl text-left transition hover:-translate-y-1 hover:border-ember-500/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied JPEG, cache-busted */}
              <img
                src={`/api/cameras/snapshot?id=${encodeURIComponent(c.id)}&t=${tick}`}
                alt={`Vorschau ${c.name}`}
                className="aspect-video w-full bg-night-950 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0.15";
                }}
              />
              <div className="flex items-center gap-2 px-4 py-3">
                <IconCamera width={16} height={16} className="text-ember-400" />
                <span className="font-display font-semibold">{c.name}</span>
                <span className="ml-auto font-mono text-[10px] text-mist-500">
                  Tippen für Live
                </span>
              </div>
            </button>
            {isParent && (
              <button
                onClick={() => remove(c.id)}
                aria-label={`${c.name} entfernen`}
                className="absolute right-2 top-2 rounded-full bg-night-950/70 p-2 text-mist-300 hover:text-red-400"
              >
                <IconX width={14} height={14} />
              </button>
            )}
          </div>
        ))}

        {isParent && (
          <button
            onClick={() => setAdding(true)}
            className="flex aspect-video flex-col items-center justify-center rounded-2xl border-2 border-dashed border-night-600 text-mist-500 transition hover:border-ember-500/50 hover:text-ember-400"
          >
            <IconPlus width={26} height={26} />
            <p className="mt-2 text-sm">Kamera hinzufügen</p>
          </button>
        )}
      </div>

      {cams.length === 0 && !adding && (
        <div className="glass rise mt-6 rounded-2xl p-6 text-sm leading-relaxed text-mist-300">
          <p className="font-display text-lg font-semibold text-mist-100">
            So kommen Kameras dazu
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-mist-100">IP-Kamera:</strong> RTSP-Adresse
              eintragen, z. B.{" "}
              <code className="font-mono text-xs">rtsp://user:passwort@192.168.2.50/stream1</code>
            </li>
            <li>
              <strong className="text-mist-100">Altes Handy als Kamera:</strong>{" "}
              App „IP Webcam“ (Android) installieren, Server starten, dann{" "}
              <code className="font-mono text-xs">http://HANDY-IP:8080/video</code>{" "}
              eintragen — fertig ist die Live-Überwachung.
            </li>
            <li>
              <strong className="text-mist-100">USB-Webcam am PC:</strong>{" "}
              <code className="font-mono text-xs">
                ffmpeg:device?video=/dev/video0
              </code>
            </li>
          </ul>
          <p className="mt-3">
            Im Chat kannst du dann fragen: „Was siehst du auf der
            Wohnzimmer-Kamera?“ — HeimGeist schaut mit KI-Augen nach.
          </p>
        </div>
      )}

      {adding && (
        <div className="glass rise mt-6 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Kamera hinzufügen</h2>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, z. B. Wohnzimmer"
            className="mt-4 w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 outline-none placeholder:text-mist-500 focus:border-ember-500"
          />
          <input
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="rtsp://… oder http://HANDY-IP:8080/video"
            className="mt-3 w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-mist-500 focus:border-ember-500"
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button
              onClick={add}
              disabled={!name.trim() || !src.trim()}
              className="rounded-full bg-ember-500 px-6 py-2.5 font-medium text-night-950 transition hover:bg-ember-400 disabled:opacity-40"
            >
              Hinzufügen
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-full border border-night-600 px-6 py-2.5 text-mist-300 hover:border-mist-500"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
