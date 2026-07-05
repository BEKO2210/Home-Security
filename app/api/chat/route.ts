import { NextRequest } from "next/server";
import {
  TOOL_DEFS,
  DOWNLOAD_TOOL_DEF,
  MEMORY_TOOL_DEF,
  CAMERA_TOOL_DEF,
  executeTool,
  ToolCall,
  TOOL_LABEL,
} from "@/lib/tools";
import { listMemories, memoryPromptSection } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const MAX_TOOL_ROUNDS = 3;

const DEMO_REPLY = `Hallo! Ich bin HeimGeist im **Demo-Modus** — dein lokaler Ollama-Server ist von hier aus nicht erreichbar.

So verbindest du mich mit eurer Familien-KI:
1. Starte Ollama auf eurem Rechner (\`ollama serve\`).
2. Betreibe HeimGeist im Heimnetz (\`npm run dev\` oder \`npm start\`) — oder setze die Umgebungsvariable \`OLLAMA_BASE_URL\`.
3. Fertig — das beste verfügbare Modell wird automatisch gewählt.

Dann beantworte ich alles — von Hausaufgaben bis Rezepte, mit Internet-Zugriff für aktuelle Fragen.`;

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

interface ChatBody {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  ollamaUrl?: string;
  tools?: boolean;
  allowDownload?: boolean;
  profileId?: string;
}

function demoStream(): Response {
  const encoder = new TextEncoder();
  const words = DEMO_REPLY.split(/(?<=\s)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(encoder.encode(w));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-HeimGeist-Mode": "demo" },
  });
}

/** Entfernt <think>…</think>-Blöcke von Reasoning-Modellen aus dem Stream,
 *  auch wenn Tags über Chunk-Grenzen verteilt ankommen. */
function createThinkFilter() {
  let inThink = false;
  let carry = "";
  return (chunk: string): string => {
    let text = carry + chunk;
    carry = "";
    let out = "";
    for (;;) {
      if (inThink) {
        const close = text.indexOf("</think>");
        if (close === -1) {
          const partial = text.lastIndexOf("<");
          if (partial !== -1 && "</think>".startsWith(text.slice(partial))) {
            carry = text.slice(partial);
          }
          return out;
        }
        text = text.slice(close + 8);
        inThink = false;
      } else {
        const open = text.indexOf("<think>");
        if (open === -1) {
          const partial = text.lastIndexOf("<");
          if (partial !== -1 && "<think>".startsWith(text.slice(partial))) {
            carry = text.slice(partial);
            out += text.slice(0, partial);
          } else {
            out += text;
          }
          return out;
        }
        out += text.slice(0, open);
        text = text.slice(open + 7);
        inThink = true;
      }
    }
  };
}

/** Manche Modelle (z. B. phi4-mini) können kein natives Tool-Calling und
 *  schreiben stattdessen JSON wie [{"name":"web_search","parameters":{…}}]
 *  in die Antwort. Das hier erkennt solche Antworten und macht daraus
 *  echte Tool-Aufrufe. */
function parseInlineToolCalls(content: string): ToolCall[] | null {
  const text = content.replace(/<\|[^|]{0,24}\|>/g, "").trim();
  const start = text.search(/[[{]/);
  if (start === -1 || start > 4) return null;
  // JSON-Ende suchen (Klammern zählen)
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end));
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const calls: ToolCall[] = [];
    for (const item of arr) {
      const name = item?.name ?? item?.function?.name;
      const args =
        item?.parameters ?? item?.arguments ?? item?.function?.arguments ?? {};
      if (typeof name === "string" && name && typeof args === "object") {
        calls.push({ function: { name, arguments: args } });
      }
    }
    return calls.length ? calls : null;
  } catch {
    return null;
  }
}

async function callOllama(
  base: string,
  model: string,
  messages: OllamaMessage[],
  tools: object[] | undefined,
): Promise<Response> {
  return fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
      // gegen leckende Chat-Template-Tokens (phi4 & Co.)
      options: {
        stop: ["<|user|>", "<|assistant|>", "<|end|>"],
        // stabilere, weniger fantasievolle Antworten für Familien-Assistent
        temperature: 0.4,
      },
      ...(tools ? { tools } : {}),
    }),
    signal: AbortSignal.timeout(180_000),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatBody;
  const base = (body.ollamaUrl || DEFAULT_OLLAMA).replace(/\/$/, "");
  const wantTools = body.tools !== false;
  const toolDefs = wantTools
    ? [
        ...TOOL_DEFS,
        CAMERA_TOOL_DEF,
        ...(body.profileId ? [MEMORY_TOOL_DEF] : []),
        ...(body.allowDownload ? [DOWNLOAD_TOOL_DEF] : []),
      ]
    : undefined;

  // Langzeitgedächtnis des Profils in den System-Prompt injizieren
  let system = body.system;
  if (body.profileId) {
    system += memoryPromptSection(await listMemories(body.profileId));
    if (wantTools) {
      system +=
        "\n\nWenn du etwas Dauerhaftes über die Person erfährst (Vorlieben, wichtige Termine, Allergien) oder sie dich bittet, dir etwas zu merken, speichere es mit memory_save.";
    }
  }
  if (wantTools) {
    system +=
      "\n\nWerkzeug-Regeln: Rufe Werkzeuge ausschließlich über die Tool-Schnittstelle auf — schreibe niemals JSON oder Werkzeugnamen in deine Antwort. Steht die Antwort bereits oben im Gedächtnis oder im Gespräch, antworte direkt ohne Werkzeug. Es gibt nur die bereitgestellten Werkzeuge, keine anderen. Gib nach einem Werkzeug-Aufruf dessen Ergebnis INHALTLICH wieder (was gefunden/gesehen wurde) — sage nie nur, dass du das Werkzeug benutzt hast.";
  }

  // Erreichbarkeit prüfen — sonst Demo-Modus
  let first: Response;
  try {
    first = await callOllama(
      base,
      body.model,
      [{ role: "system", content: system }, ...body.messages],
      toolDefs,
    );
    if (first.status === 400 && toolDefs) {
      // Modell ohne Tool-Support: ohne Werkzeuge erneut
      first = await callOllama(
        base,
        body.model,
        [{ role: "system", content: system }, ...body.messages],
        undefined,
      );
    }
    if (!first.ok || !first.body) throw new Error(`ollama ${first.status}`);
  } catch {
    return demoStream();
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      const msgs: OllamaMessage[] = [
        { role: "system", content: system },
        ...body.messages,
      ];

      try {
        let upstream: Response | null = first;
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (!upstream) {
            // letzte Runde ohne Werkzeuge erzwingen, damit eine Antwort kommt
            const useTools = round < MAX_TOOL_ROUNDS ? toolDefs : undefined;
            upstream = await callOllama(base, body.model, msgs, useTools);
            if (!upstream.ok || !upstream.body) throw new Error(`ollama ${upstream.status}`);
          }

          const stripThink = createThinkFilter();
          const reader = upstream.body!.getReader();
          let buffer = "";
          let content = "";
          const toolCalls: ToolCall[] = [];

          // Sieht die Antwort wie Inline-Tool-JSON aus, halten wir sie
          // zurück, statt sie zu streamen ("hold"); sonst normal streamen.
          const st = { mode: "unknown" as "unknown" | "stream" | "hold", held: "" };
          const emit = (raw: string) => {
            const visible = stripThink(raw).replace(/<\|[^|]{0,24}\|>/g, "");
            if (!visible) return;
            if (st.mode === "stream") {
              send(visible);
              return;
            }
            st.held += visible;
            if (st.mode === "unknown") {
              const first = st.held.trimStart()[0];
              if (first === "[" || first === "{") {
                st.mode = "hold";
              } else if (first) {
                st.mode = "stream";
                send(st.held);
                st.held = "";
              }
            }
          };

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                const token: string | undefined = json?.message?.content;
                if (token) {
                  content += token;
                  emit(token);
                }
                const calls: ToolCall[] | undefined = json?.message?.tool_calls;
                if (calls?.length) toolCalls.push(...calls);
              } catch {
                /* partial line — ignored */
              }
            }
          }

          // Text-JSON-Tool-Aufrufe (Modelle ohne natives Tool-Calling)
          if (!toolCalls.length && st.mode === "hold" && toolDefs) {
            const inline = parseInlineToolCalls(content);
            if (inline) {
              toolCalls.push(...inline);
              content = "";
            }
          }

          if (!toolCalls.length) {
            if (st.held) send(st.held); // war doch kein Tool-JSON
            break;
          }

          msgs.push({ role: "assistant", content, tool_calls: toolCalls });
          for (const call of toolCalls) {
            const name = call.function?.name ?? "?";
            const label = TOOL_LABEL[name] ?? name;
            const hint =
              name === "web_search"
                ? String(call.function?.arguments?.query ?? "")
                : String(
                    call.function?.arguments?.filename ??
                      call.function?.arguments?.url ??
                      "",
                  );
            send(`\n\n*${label}${hint ? `: ${hint}` : ""} …*\n\n`);
            const result = await executeTool(call, { profileId: body.profileId, ollamaBase: base });
            msgs.push({ role: "tool", content: result, tool_name: name });
          }
          upstream = null; // nächste Runde neu anfragen
        }
      } catch {
        send(
          "\n\nDa ist etwas schiefgelaufen. Ist der Ollama-Server erreichbar? (Einstellungen → Testen)",
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-HeimGeist-Mode": "ollama" },
  });
}
