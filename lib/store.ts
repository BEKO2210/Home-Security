"use client";

export type Role = "eltern" | "kind" | "grosseltern" | "gast";

export interface Profile {
  id: string;
  name: string;
  /** Akzentfarbe für den Monogramm-Avatar (Hex). */
  color?: string;
  /** Altbestand aus v1-Profilen; wird nicht mehr angezeigt. */
  emoji?: string;
  role: Role;
  createdAt: number;
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

export function systemPrompt(profile: Profile): string {
  const base = `Du bist HeimGeist, der freundliche KI-Home-Assistent der Familie. Du sprichst Deutsch, bist warmherzig, hilfsbereit und antwortest kompakt. Du sprichst gerade mit ${profile.name} (${ROLE_LABEL[profile.role]}).`;
  if (profile.role === "kind") {
    return `${base} WICHTIG: ${profile.name} ist ein Kind. Antworte kindgerecht, einfach, positiv und absolut sicher. Keine Gewalt, keine Erwachsenenthemen, keine gefährlichen Anleitungen. Bei heiklen Fragen freundlich an die Eltern verweisen.`;
  }
  if (profile.role === "grosseltern") {
    return `${base} Erkläre geduldig, ohne Fachjargon, in ruhigem Ton. Schrittweise Anleitungen, wenn es um Technik geht.`;
  }
  return base;
}
