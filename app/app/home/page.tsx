"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { store, Profile } from "@/lib/store";
import Avatar from "@/components/avatar";
import { pickBestModel } from "@/lib/models";
import {
  IconChat,
  IconWave,
  IconCamera,
  IconZap,
  IconCpu,
} from "@/components/icons";

const ICON = {
  chat: IconChat,
  wave: IconWave,
  camera: IconCamera,
  zap: IconZap,
};

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [autoModel, setAutoModel] = useState<string>("");

  useEffect(() => {
    const p = store.activeProfile();
    if (!p) {
      router.replace("/app");
      return;
    }
    setProfile(p);
    const settings = store.settings();
    const url = encodeURIComponent(settings.ollamaUrl);
    fetch(`/api/models?ollamaUrl=${url}`)
      .then((r) => r.json())
      .then((d) => {
        setOnline(d.online);
        setAutoModel(settings.model || pickBestModel(d.models) || "");
      })
      .catch(() => setOnline(false));
  }, [router]);

  if (!profile) return null;

  const greeting =
    new Date().getHours() < 11
      ? "Guten Morgen"
      : new Date().getHours() < 18
        ? "Hallo"
        : "Guten Abend";

  return (
    <main>
      <div className="rise rise-1 flex items-center gap-3">
        <Avatar profile={profile} size={44} />
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            {greeting}, <span className="text-ember-400">{profile.name}</span>
          </h1>
          <p className="text-sm text-mist-300">Euer Zuhause auf einen Blick.</p>
        </div>
      </div>

      <div className="glass rise rise-2 mt-6 flex items-center gap-3 rounded-2xl px-5 py-4">
        <span className="text-mist-500">
          <IconCpu width={18} height={18} />
        </span>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            online === null
              ? "animate-pulse bg-mist-500"
              : online
                ? "bg-sage-400"
                : "bg-red-400"
          }`}
        />
        <span className="font-mono text-xs text-mist-300">
          {online === null
            ? "Prüfe lokale KI …"
            : online
              ? `Lokale KI verbunden${autoModel ? ` · ${autoModel}` : ""} · alles bleibt im Haus`
              : "KI offline — Demo-Modus aktiv (Einstellungen prüfen)"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {MODULES.map((m, i) => {
          const Icon = ICON[m.icon];
          const inner = (
            <div
              className={`glass h-full rounded-2xl p-5 transition ${
                m.href ? "hover:-translate-y-1 hover:border-ember-500/40" : "opacity-70"
              } rise rise-${Math.min(i + 3, 5)}`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-night-700 text-ember-400">
                  <Icon width={22} height={22} />
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-wider uppercase ${
                    m.status === "aktiv"
                      ? "bg-sage-400/15 text-sage-400"
                      : "bg-night-700 text-mist-500"
                  }`}
                >
                  {m.status === "aktiv" ? "aktiv" : `Phase ${m.phase}`}
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl font-semibold">{m.name}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                {m.description}
              </p>
            </div>
          );
          return m.href ? (
            <Link key={m.id} href={m.href}>
              {inner}
            </Link>
          ) : (
            <div key={m.id}>{inner}</div>
          );
        })}
      </div>
    </main>
  );
}
