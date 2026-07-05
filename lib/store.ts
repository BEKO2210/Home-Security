"use client";

export type Role = "eltern" | "kind" | "grosseltern" | "gast";

export interface Profile {
  id: string;
  name: string;
  /** Akzentfarbe für den Monogramm-Avatar (Hex). */
  color?: string;
  /** Altbestand aus v1-Profilen; wird nicht mehr angezeigt. */
  emoji?: string;
  /** Gehashte 4-stellige PIN (optional). Kindersicherung, keine Kryptografie. */
  pinHash?: string;
  /** Profilbild als kleines Daten-URL-JPEG (~10 KB), lokal auf dem Gerät. */
  photo?: string;
  /** Beziehungen zu anderen Profilen: "ist <label> von <toId>". */
  relations?: { toId: string; label: string }[];
  role: Role;
  createdAt: number;
}

export const RELATION_LABELS = [
  "Mutter",
  "Vater",
  "Sohn",
  "Tochter",
  "Oma",
  "Opa",
  "Enkelkind",
  "Bruder",
  "Schwester",
  "Partner/in",
] as const;

/** djb2 — bewusst simpel: hält Geschwister raus, ist kein Sicherheitsfeature.
 *  (crypto.subtle steht über HTTP im Heimnetz nicht zur Verfügung.) */
export function hashPin(pin: string): string {
  let h = 5381;
  const salted = `heimgeist:${pin}`;
  for (let i = 0; i < salted.length; i++) {
    h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export const PROFILE_COLORS = [
  "#f5a524",
  "#2dd4bf",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#4ade80",
  "#fb923c",
  "#94a3b8",
];

export function profileColor(p: Profile): string {
  if (p.color) return p.color;
  // stabile Farbe für Altprofile ohne color-Feld
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PROFILE_COLORS[h % PROFILE_COLORS.length];
}

export interface Settings {
  ollamaUrl: string;
  model: string;
  /** Internet & Werkzeuge (Websuche, Downloads, Gedächtnis) — Default an. */
  tools?: boolean;
  /** Große Schrift für bessere Lesbarkeit (Großeltern). */
  fontScale?: "normal" | "gross";
}

/** Wendet die Schriftgrößen-Einstellung auf die Seite an (Zoom, Chromium-Familie). */
export function applyFontScale(scale?: "normal" | "gross") {
  if (typeof document === "undefined") return;
  (document.body.style as CSSStyleDeclaration & { zoom?: string }).zoom =
    scale === "gross" ? "1.18" : "";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** crypto.randomUUID existiert nur in Secure Contexts (HTTPS/localhost) —
 *  im Heimnetz läuft die App über HTTP, daher eigener Fallback. */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const PROFILES_KEY = "heimgeist.profiles";
const ACTIVE_KEY = "heimgeist.activeProfile";
const SETTINGS_KEY = "heimgeist.settings";
const chatKey = (profileId: string) => `heimgeist.chat.${profileId}`;

// Leer = Server-Standard verwenden (OLLAMA_BASE_URL bzw. 127.0.0.1:11434).
// Der Next-Server läuft im Normalfall auf demselben Rechner wie Ollama.
export const DEFAULT_SETTINGS: Settings = {
  ollamaUrl: "",
  model: "",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — non-fatal */
  }
}

export const store = {
  profiles: (): Profile[] => read(PROFILES_KEY, []),
  saveProfiles: (p: Profile[]) => write(PROFILES_KEY, p),
  activeProfileId: (): string | null => read(ACTIVE_KEY, null),
  setActiveProfile: (id: string | null) => write(ACTIVE_KEY, id),
  activeProfile: (): Profile | null => {
    const id = read<string | null>(ACTIVE_KEY, null);
    if (!id) return null;
    return read<Profile[]>(PROFILES_KEY, []).find((p) => p.id === id) ?? null;
  },
  settings: (): Settings => read(SETTINGS_KEY, DEFAULT_SETTINGS),
  saveSettings: (s: Settings) => write(SETTINGS_KEY, s),
  chat: (profileId: string): ChatMessage[] => read(chatKey(profileId), []),
  saveChat: (profileId: string, messages: ChatMessage[]) =>
    write(chatKey(profileId), messages.slice(-100)),
  clearChat: (profileId: string) => write(chatKey(profileId), []),
};

export const ROLE_LABEL: Record<Role, string> = {
  eltern: "Elternteil",
  kind: "Kind",
  grosseltern: "Großeltern",
  gast: "Gast",
};

export function systemPrompt(profile: Profile, allProfiles?: Profile[]): string {
  let relationText = "";
  const others = allProfiles ?? [];
  const nameOf = (id: string) => others.find((p) => p.id === id)?.name;
  const lines: string[] = [];
  for (const p of others) {
    for (const rel of p.relations ?? []) {
      const target = nameOf(rel.toId);
      if (target) lines.push(`${p.name} ist ${rel.label} von ${target}.`);
    }
  }
  if (others.length > 1) {
    const names = others.map((p) => `${p.name} (${ROLE_LABEL[p.role]})`).join(", ");
    relationText = ` Zur Familie gehören: ${names}.`;
    if (lines.length) relationText += ` Beziehungen: ${lines.join(" ")}`;
  }
  const base = `Du bist HeimGeist, der freundliche KI-Home-Assistent der Familie. Du sprichst Deutsch, bist warmherzig, hilfsbereit und antwortest kompakt. Du sprichst gerade mit ${profile.name} (${ROLE_LABEL[profile.role]}).${relationText}`;
  if (profile.role === "kind") {
    return `${base} WICHTIG: ${profile.name} ist ein Kind. Antworte kindgerecht, einfach, positiv und absolut sicher. Keine Gewalt, keine Erwachsenenthemen, keine gefährlichen Anleitungen. Bei heiklen Fragen freundlich an die Eltern verweisen.`;
  }
  if (profile.role === "grosseltern") {
    return `${base} Erkläre geduldig, ohne Fachjargon, in ruhigem Ton. Schrittweise Anleitungen, wenn es um Technik geht.`;
  }
  return base;
}
