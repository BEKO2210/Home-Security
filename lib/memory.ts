import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Long-term memory, per family profile.
 *
 * Stored server-side as one JSON file per profile under .heimgeist/memory/
 * (the app runs on the family PC, so this is durable and stays at home).
 * The model writes via the memory_save tool; every chat request gets the
 * profile's memories injected into the system prompt.
 */

export interface MemoryFact {
  id: string;
  text: string;
  createdAt: number;
}

const DATA_DIR =
  process.env.HEIMGEIST_DATA_DIR ?? path.join(process.cwd(), ".heimgeist");

function fileFor(profileId: string): string {
  // profileId kommt vom Client — strikt auf harmloses Format normalisieren
  const safe = profileId.replace(/[^\w-]/g, "").slice(0, 64);
  return path.join(DATA_DIR, "memory", `${safe || "unknown"}.json`);
}

export async function listMemories(profileId: string): Promise<MemoryFact[]> {
  try {
    const raw = await readFile(fileFor(profileId), "utf8");
    return JSON.parse(raw) as MemoryFact[];
  } catch {
    return [];
  }
}

async function persist(profileId: string, facts: MemoryFact[]): Promise<void> {
  await mkdir(path.dirname(fileFor(profileId)), { recursive: true });
  await writeFile(fileFor(profileId), JSON.stringify(facts, null, 2));
}

export async function addMemory(
  profileId: string,
  text: string,
): Promise<MemoryFact> {
  const facts = await listMemories(profileId);
  const fact: MemoryFact = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim().slice(0, 500),
    createdAt: Date.now(),
  };
  // Duplikate vermeiden, älteste raus wenn zu viele
  if (!facts.some((f) => f.text === fact.text)) {
    facts.push(fact);
    await persist(profileId, facts.slice(-200));
  }
  return fact;
}

export async function deleteMemory(
  profileId: string,
  factId: string,
): Promise<void> {
  const facts = await listMemories(profileId);
  await persist(profileId, facts.filter((f) => f.id !== factId));
}

export function memoryPromptSection(facts: MemoryFact[]): string {
  if (!facts.length) return "";
  const lines = facts.map((f) => `- ${f.text}`).join("\n");
  return `\n\nLangzeitgedächtnis über diese Person (nutze es natürlich, zähle es nicht auf):\n${lines}`;
}
