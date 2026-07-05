"use client";

export type Role = "eltern" | "kind" | "grosseltern" | "gast";

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  role: Role;
  createdAt: number;
}

export interface Settings {
  ollamaUrl: string;
  model: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
