"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  store,
  uid,
  hashPin,
  Profile,
  Role,
  ROLE_LABEL,
  RELATION_LABELS,
  PROFILE_COLORS,
} from "@/lib/store";
import { IconPlus, IconX, IconSettings } from "@/components/icons";
import Avatar, { readPhoto } from "@/components/avatar";
import PinPad from "@/components/pinpad";

const ROLES: Role[] = ["eltern", "kind", "grosseltern", "gast"];

export default function Profiles() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [locked, setLocked] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Formular (Anlegen + Bearbeiten)
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [role, setRole] = useState<Role>("eltern");
  const [pin, setPin] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [relations, setRelations] = useState<{ toId: string; label: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfiles(store.profiles());
    setActiveId(store.activeProfileId());
  }, []);

  function resetForm() {
    setName("");
    setColor(PROFILE_COLORS[0]);
    setRole("eltern");
    setPin("");
    setRemovePin(false);
    setPhoto(undefined);
    setRelations([]);
    setConfirmDelete(false);
  }

  function openCreate() {
    resetForm();
    setEditing(null);
    setCreating(true);
  }

  function openEdit(p: Profile) {
    resetForm();
    setName(p.name);
    setColor(p.color ?? PROFILE_COLORS[0]);
    setRole(p.role);
    setPhoto(p.photo);
    setRelations(p.relations ?? []);
    setEditing(p);
    setCreating(false);
  }

  function unlock(p: Profile) {
    store.setActiveProfile(p.id);
    router.push("/app/home");
  }

  function selectProfile(p: Profile) {
    if (p.pinHash) setLocked(p);
    else unlock(p);
  }

  function saveProfile() {
    if (!name.trim() || (pin && pin.length !== 4)) return;
    if (editing) {
      const updated: Profile = {
        ...editing,
        name: name.trim(),
        color,
        role,
        photo,
        relations: relations.filter((r) => r.label),
        pinHash: removePin
          ? undefined
          : pin
            ? hashPin(pin)
            : editing.pinHash,
      };
      const next = profiles.map((p) => (p.id === editing.id ? updated : p));
      setProfiles(next);
      store.saveProfiles(next);
      setEditing(null);
    } else {
      const p: Profile = {
        id: uid(),
        name: name.trim(),
        color,
        role,
        photo,
        relations: relations.filter((r) => r.label),
        ...(pin ? { pinHash: hashPin(pin) } : {}),
        createdAt: Date.now(),
      };
      const next = [...profiles, p];
      setProfiles(next);
      store.saveProfiles(next);
      setCreating(false);
      unlock(p);
    }
  }

  function deleteProfile() {
    if (!editing) return;
    const next = profiles.filter((p) => p.id !== editing.id);
    setProfiles(next);
    store.saveProfiles(next);
    store.clearChat(editing.id);
    fetch(`/api/memory?profileId=${encodeURIComponent(editing.id)}&all=1`, {
      method: "DELETE",
    }).catch(() => {});
    if (activeId === editing.id) {
      store.setActiveProfile(null);
      setActiveId(null);
    }
    setEditing(null);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await readPhoto(file));
    } catch {
      /* ungültiges Bild — ignorieren */
    }
  }

  function setRelation(toId: string, label: string) {
    setRelations((rs) => {
      const rest = rs.filter((r) => r.toId !== toId);
      return label ? [...rest, { toId, label }] : rest;
    });
  }

  const formOpen = creating || editing !== null;
  const others = editing
    ? profiles.filter((p) => p.id !== editing.id)
    : profiles;

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
              <Avatar profile={p} size={56} className="mx-auto" />
              <p className="mt-3 font-display text-lg font-semibold">{p.name}</p>
              <p className="font-mono text-[10px] tracking-wider text-mist-500 uppercase">
                {ROLE_LABEL[p.role]}
                {p.pinHash ? " · PIN" : ""}
              </p>
            </button>
            <button
              onClick={() => openEdit(p)}
              aria-label={`${p.name} bearbeiten`}
              className="absolute right-2 top-2 rounded-full bg-night-800/80 p-2 text-mist-500 transition hover:text-ember-400"
            >
              <IconSettings width={15} height={15} />
            </button>
          </div>
        ))}

        <button
          onClick={openCreate}
          className="flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-night-600 p-5 text-mist-500 transition hover:border-ember-500/50 hover:text-ember-400"
        >
          <IconPlus width={26} height={26} />
          <p className="mt-2 text-sm">Neues Profil</p>
        </button>
      </div>

      {formOpen && (
        <div className="glass rise mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">
            {editing ? `${editing.name} bearbeiten` : "Neues Familienmitglied"}
          </h2>

          {/* Foto */}
          <div className="mt-4 flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Profilbild"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-semibold text-night-950"
                style={{ background: color }}
              >
                {(name || "?")[0]?.toUpperCase()}
              </span>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-night-600 px-4 py-2 text-sm text-mist-300 hover:border-mist-500"
              >
                {photo ? "Foto ändern" : "Foto wählen"}
              </button>
              {photo && (
                <button
                  onClick={() => setPhoto(undefined)}
                  className="rounded-full border border-night-600 px-4 py-2 text-sm text-mist-500 hover:border-red-400 hover:text-red-400"
                >
                  Entfernen
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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

          {/* PIN */}
          <div className="mt-4">
            <input
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setRemovePin(false);
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder={
                editing?.pinHash && !removePin
                  ? "Neue PIN (leer = behalten)"
                  : "PIN (optional, 4 Ziffern)"
              }
              className="w-full rounded-xl border border-night-600 bg-night-800 px-4 py-3 font-mono tracking-[0.5em] outline-none placeholder:tracking-normal placeholder:text-mist-500 focus:border-ember-500"
            />
            {editing?.pinHash && (
              <label className="mt-2 flex items-center gap-2 text-sm text-mist-300">
                <input
                  type="checkbox"
                  checked={removePin}
                  onChange={(e) => {
                    setRemovePin(e.target.checked);
                    if (e.target.checked) setPin("");
                  }}
                  className="h-4 w-4 accent-ember-500"
                />
                PIN entfernen
              </label>
            )}
          </div>

          {/* Beziehungen */}
          {others.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-mist-100">
                Beziehungen{" "}
                <span className="font-normal text-mist-500">
                  — {name || "diese Person"} ist …
                </span>
              </p>
              <div className="mt-2 space-y-2">
                {others.map((o) => (
                  <div key={o.id} className="flex items-center gap-3">
                    <select
                      value={relations.find((r) => r.toId === o.id)?.label ?? ""}
                      onChange={(e) => setRelation(o.id, e.target.value)}
                      className="w-40 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
                    >
                      <option value="">— keine —</option>
                      {RELATION_LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-mist-300">von {o.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={!name.trim() || (pin.length > 0 && pin.length !== 4)}
              className="rounded-full bg-ember-500 px-6 py-2.5 font-medium text-night-950 transition hover:bg-ember-400 disabled:opacity-40"
            >
              {editing ? "Speichern" : "Loslegen"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="rounded-full border border-night-600 px-6 py-2.5 text-mist-300 hover:border-mist-500"
            >
              Abbrechen
            </button>
            {editing &&
              (confirmDelete ? (
                <button
                  onClick={deleteProfile}
                  className="ml-auto rounded-full bg-red-500/90 px-6 py-2.5 font-medium text-white transition hover:bg-red-500"
                >
                  Wirklich löschen?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto flex items-center gap-2 rounded-full border border-red-500/40 px-6 py-2.5 text-red-400 transition hover:bg-red-500/10"
                >
                  <IconX width={14} height={14} /> Profil löschen
                </button>
              ))}
          </div>
          {editing && confirmDelete && (
            <p className="mt-3 text-sm text-mist-500">
              Löscht Profil, Chatverlauf und Langzeitgedächtnis von{" "}
              {editing.name}. Kann nicht rückgängig gemacht werden.
            </p>
          )}
        </div>
      )}

      {locked && (
        <PinPad
          title={locked.name}
          color={locked.color ?? PROFILE_COLORS[0]}
          verify={(p) => hashPin(p) === locked.pinHash}
          onSuccess={() => unlock(locked)}
          onCancel={() => setLocked(null)}
        />
      )}
    </main>
  );
}
