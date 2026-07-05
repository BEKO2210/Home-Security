/**
 * Automatic model selection.
 *
 * Ranks the models available on the Ollama server and picks the best default
 * for family chat: prefer strong general instruct models in the 7–9B range
 * (fits 8 GB VRAM), avoid reasoning models that emit <think> traces, exclude
 * embedding/vision-only models. Users can still override in settings.
 */

const EXCLUDE = /embed|rerank/i;

const FAMILY_BONUS: [RegExp, number][] = [
  [/llama3\.[123]/i, 30],
  [/gemma[234]/i, 25],
  [/qwen2\.5/i, 25],
  [/mistral/i, 20],
  [/phi4/i, 15],
  [/german/i, 12],
];

const PENALTY: [RegExp, number][] = [
  [/deepseek-r1|qwq|magistral|qwen3/i, -40], // reasoning: <think>-Ausgabe
  [/llava|vision/i, -20], // Vision-Spezialist, nicht als Chat-Default
  [/coder|code/i, -15],
  [/test/i, -25],
];

function paramSize(name: string): number {
  const m = name.match(/(\d+(?:\.\d+)?)b/i);
  if (!m) return 4;
  const size = parseFloat(m[1]);
  return size > 14 ? 14 - size * 0.5 : size; // zu groß für 8 GB VRAM
}

export function scoreModel(name: string): number {
  if (EXCLUDE.test(name)) return -1000;
  let score = paramSize(name);
  for (const [re, bonus] of FAMILY_BONUS) if (re.test(name)) score += bonus;
  for (const [re, malus] of PENALTY) if (re.test(name)) score += malus;
  return score;
}

export function pickBestModel(models: string[]): string | null {
  if (!models.length) return null;
  const ranked = [...models].sort((a, b) => scoreModel(b) - scoreModel(a));
  return scoreModel(ranked[0]) > -1000 ? ranked[0] : null;
}
