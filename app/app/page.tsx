"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { store, uid, Profile, Role, ROLE_LABEL } from "@/lib/store";

const EMOJIS = ["🦊", "🐻", "🦉", "🐨", "🦁", "🐰", "🐸", "🦄", "🐙", "🐝"];
const ROLES: Role[] = ["eltern", "kind", "grosseltern", "gast"];

export default function Profiles() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [role, setRole] = useState<Role>("eltern");

  useEffect(() => {
    setProfiles(store.profiles());
    setActiveId(store.activeProfileId());
  }, []);

  function selectProfile(p: Profile) {
    store.setActiveProfile(p.id);
    router.push("/app/home");
  }

  function addProfile() {
    if (!name.trim()) return;
    const p: Profile = {
      id: uid(),
      name: name.trim(),
      emoji,
      role,
      createdAt: Date.now(),
    };
    const next = [...profiles, p];
    setProfiles(next);
    store.saveProfiles(next);
    setCreating(false);
    setName("");
    selectProfile(p);
  }

  function removeProfile(id: string) {
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    store.saveProfiles(next);
    store.clearChat(id);
    if (activeId === id) {
      store.setActiveProfile(null);
      setActiveId(null);
    }
  }

  return (
    <main>
      <h1 className="rise rise-1 font-display text-3xl font-semibold">
        Wer bist <span className="text-ember-400">du?</span>
      </h1>
      <p className="rise rise-2 mt-2 text-sm text-mist-300">
        HeimGeist merkt sich, mit wem er spricht — und passt sich an.
      </p>

      <div className="rise rise-3 mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {profiles.map((p) => (
          <div key={p.id} className="relative">
            <button
              onClick={() => selectProfile(p)}
              className={`glass w-full rounded-2xl p-5 text-center transition hover:-translate-y-1 ${
                activeId === p.id ? "glow-ring" : ""
              }`}
            >
              <span className="text-4xl">{p.emoji}</span>
              <p className="mt-2 font-display text-lg font-semibold">{p.name}</p>
              <p className="font-mono text-[10px] tracking-wider text-mist-500 uppercase">
                {ROLE_LABEL[p.role]}
              </p>
            </button>
            <button
              onClick={() => removeProfile(p.id)}
              aria-label={`${p.name} löschen`}
              className="absolute -right-1.5 -top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-night-700 text-xs text-mist-500 hover:bg-red-500/80 hover:text-white sm:flex"
            >
              ×
            </button>
          </div>
        ))}

        <button
          onClick={() => setCreating(true)}
          className="rounded-2xl border-2 border-dashed border-night-600 p-5 text-mist-500 transition hover:border-ember-500/50 hover:text-ember-400"
        >
          <span className="text-3xl">＋</span>
          <p className="mt-2 text-sm">Neues Profil</p>
        </button>
      </div>

      {creating && (
        <div className="glass rise mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Neues Familienmitglied</h2>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProfile()}
            placeholder="Name"
            className="mt-4 w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 outline-none placeholder:text-mist-500 focus:border-ember-500"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`rounded-xl p-2 text-2xl transition ${
                  emoji === e ? "bg-ember-500/20 glow-ring" : "hover:bg-night-700"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  role === r
                    ? "bg-ember-500 font-medium text-night-950"
                    : "border border-night-600 text-mist-300 hover:border-mist-500"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={addProfile}
              disabled={!name.trim()}
              className="rounded-full bg-ember-500 px-6 py-2.5 font-medium text-night-950 transition hover:bg-ember-400 disabled:opacity-40"
            >
              Loslegen
            </button>
            <button
              onClick={() => setCreating(false)}
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
