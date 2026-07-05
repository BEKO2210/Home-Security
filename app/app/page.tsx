"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  store,
  uid,
  hashPin,
  Profile,
  Role,
  ROLE_LABEL,
  PROFILE_COLORS,
  profileColor,
} from "@/lib/store";
import { IconPlus, IconX } from "@/components/icons";
import PinPad from "@/components/pinpad";

const ROLES: Role[] = ["eltern", "kind", "grosseltern", "gast"];

export default function Profiles() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [role, setRole] = useState<Role>("eltern");
  const [pin, setPin] = useState("");
  const [locked, setLocked] = useState<Profile | null>(null);

  useEffect(() => {
    setProfiles(store.profiles());
    setActiveId(store.activeProfileId());
  }, []);

  function unlock(p: Profile) {
    store.setActiveProfile(p.id);
    router.push("/app/home");
  }

  function selectProfile(p: Profile) {
    if (p.pinHash) setLocked(p);
    else unlock(p);
  }

  function addProfile() {
    if (!name.trim()) return;
    if (pin && pin.length !== 4) return;
    const p: Profile = {
      id: uid(),
      name: name.trim(),
      color,
      role,
      ...(pin ? { pinHash: hashPin(pin) } : {}),
      createdAt: Date.now(),
    };
    const next = [...profiles, p];
    setProfiles(next);
    store.saveProfiles(next);
    setCreating(false);
    setName("");
    setPin("");
    unlock(p);
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
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-semibold text-night-950"
                style={{ background: profileColor(p) }}
              >
                {p.name[0]?.toUpperCase()}
              </span>
              <p className="mt-3 font-display text-lg font-semibold">{p.name}</p>
              <p className="font-mono text-[10px] tracking-wider text-mist-500 uppercase">
                {ROLE_LABEL[p.role]}
              </p>
            </button>
            <button
              onClick={() => removeProfile(p.id)}
              aria-label={`${p.name} löschen`}
              className="absolute -right-1.5 -top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-night-700 text-mist-500 hover:bg-red-500/80 hover:text-white sm:flex"
            >
              <IconX width={12} height={12} />
            </button>
          </div>
        ))}

        <button
          onClick={() => setCreating(true)}
          className="flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-night-600 p-5 text-mist-500 transition hover:border-ember-500/50 hover:text-ember-400"
        >
          <IconPlus width={26} height={26} />
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
          <div className="mt-4 flex flex-wrap gap-2.5">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
                className={`h-9 w-9 rounded-full transition ${
                  color === c
                    ? "scale-110 ring-2 ring-mist-100 ring-offset-2 ring-offset-night-900"
                    : "hover:scale-105"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="PIN (optional, 4 Ziffern)"
            className="mt-3 w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 font-mono tracking-[0.5em] outline-none placeholder:tracking-normal placeholder:text-mist-500 focus:border-ember-500"
          />
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
              disabled={!name.trim() || (pin.length > 0 && pin.length !== 4)}
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

      {locked && (
        <PinPad
          title={locked.name}
          color={profileColor(locked)}
          verify={(p) => hashPin(p) === locked.pinHash}
          onSuccess={() => unlock(locked)}
          onCancel={() => setLocked(null)}
        />
      )}
    </main>
  );
}
