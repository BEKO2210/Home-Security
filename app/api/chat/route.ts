import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

const DEMO_REPLY = `Hallo! Ich bin HeimGeist im **Demo-Modus** — dein lokaler Ollama-Server ist von hier aus nicht erreichbar.

So verbindest du mich mit eurer Familien-KI:
1. Starte Ollama auf eurem Rechner (\`ollama serve\`).
2. Betreibe HeimGeist im Heimnetz (\`npm run dev\` oder \`npm start\`) — oder setze die Umgebungsvariable \`OLLAMA_BASE_URL\`.
3. Wähle unter **Einstellungen** ein Modell aus.

Dann beantworte ich alles — von Hausaufgaben bis Rezepte. 🏠`;

interface ChatBody {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  ollamaUrl?: string;
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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatBody;
  const base = (body.ollamaUrl || DEFAULT_OLLAMA).replace(/\/$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: body.model,
        stream: true,
        messages: [
          { role: "system", content: body.system },
          ...body.messages,
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!upstream.ok || !upstream.body) throw new Error(`ollama ${upstream.status}`);
  } catch {
    return demoStream();
  }

  // Ollama streams NDJSON; forward only the text tokens.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const token = json?.message?.content;
          if (token) controller.enqueue(encoder.encode(token));
        } catch {
          /* partial line — ignored */
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-HeimGeist-Mode": "ollama" },
  });
}
