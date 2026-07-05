import { writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { addMemory } from "@/lib/memory";

/**
 * Server-side agent tools for the chat (Ollama tool calling).
 *
 * - web_search: DuckDuckGo HTML search (no API key required)
 * - fetch_url: read a web page as plain text
 * - download_file: save a file to the PC's download folder — only offered
 *   to adult profiles (see route.ts) and guarded against path traversal
 *   and oversized files.
 */

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Sucht aktuelle Informationen im Internet. Nutze dies für Fragen zu aktuellen Ereignissen, Preisen, Wetter, Öffnungszeiten oder Fakten, die du nicht sicher weißt.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Suchanfrage" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Lädt eine Webseite und gibt ihren Textinhalt zurück. Nutze dies, um Details aus einem Suchergebnis zu lesen.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Vollständige URL (https://…)" },
        },
        required: ["url"],
      },
    },
  },
];

export const MEMORY_TOOL_DEF = {
  type: "function",
  function: {
    name: "memory_save",
    description:
      "Speichert eine dauerhafte Erinnerung über die aktuelle Person (Vorlieben, Geburtstage, Allergien, Hobbys, wichtige Fakten). Nutze dies, wenn du etwas erfährst, das für künftige Gespräche wichtig bleibt, oder wenn dich jemand bittet, dir etwas zu merken.",
    parameters: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: "Kurzer Fakt in dritter Person, z. B. 'Mag keine Pilze'",
        },
      },
      required: ["fact"],
    },
  },
};

export const DOWNLOAD_TOOL_DEF = {
  type: "function",
  function: {
    name: "download_file",
    description:
      "Lädt eine Datei aus dem Internet in den Download-Ordner des Familien-PCs herunter. Nur verwenden, wenn ausdrücklich um einen Download gebeten wurde.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direkte Download-URL" },
        filename: {
          type: "string",
          description: "Zieldateiname inkl. Endung, z. B. rezeptbuch.pdf",
        },
      },
      required: ["url", "filename"],
    },
  },
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x?\d+;/g, " ");
}

async function webSearch(query: string): Promise<string> {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) },
  );
  const html = await res.text();
  const results: string[] = [];
  const re =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < 5) {
    let url = m[1];
    const uddg = url.match(/uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, "").trim());
    const snippet = decodeEntities((m[3] ?? "").replace(/<[^>]+>/g, "").trim());
    if (title && url.startsWith("http")) {
      results.push(`${results.length + 1}. ${title}\n   ${url}\n   ${snippet}`);
    }
  }
  return results.length
    ? results.join("\n\n")
    : "Keine Suchergebnisse gefunden.";
}

async function fetchUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return "Fehler: nur http(s)-URLs erlaubt.";
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html") && !type.includes("text") && !type.includes("json")) {
    return `Kein Textinhalt (Content-Type: ${type}). Für Dateien download_file nutzen.`;
  }
  const html = await res.text();
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
  return text.slice(0, 6000) || "Seite enthielt keinen lesbaren Text.";
}

const MAX_DOWNLOAD = 500 * 1024 * 1024; // 500 MB

async function downloadFile(url: string, filename: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return "Fehler: nur http(s)-URLs erlaubt.";
  // Pfad-Traversal ausschließen, nur einfacher Dateiname
  const safe = path.basename(filename).replace(/[^\w.\-äöüÄÖÜß ]/g, "_");
  if (!safe || safe.startsWith(".")) return "Fehler: ungültiger Dateiname.";

  const dir =
    process.env.HEIMGEIST_DOWNLOAD_DIR ?? path.join(homedir(), "Downloads");
  await mkdir(dir, { recursive: true });

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return `Download fehlgeschlagen: HTTP ${res.status}`;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_DOWNLOAD) return "Fehler: Datei größer als 500 MB.";

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_DOWNLOAD) return "Fehler: Datei größer als 500 MB.";

  // vorhandene Dateien nicht überschreiben
  const ext = path.extname(safe);
  const stem = safe.slice(0, safe.length - ext.length);
  let target = path.join(dir, safe);
  for (let i = 1; i < 100; i++) {
    try {
      await writeFile(target, buf, { flag: "wx" });
      return `Gespeichert: ${target} (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`;
    } catch {
      target = path.join(dir, `${stem} (${i})${ext}`);
    }
  }
  return "Fehler: konnte Datei nicht speichern.";
}

export interface ToolContext {
  profileId?: string;
}

export async function executeTool(
  call: ToolCall,
  ctx: ToolContext = {},
): Promise<string> {
  const { name, arguments: args } = call.function;
  try {
    switch (name) {
      case "web_search":
        return await webSearch(String(args.query ?? ""));
      case "fetch_url":
        return await fetchUrl(String(args.url ?? ""));
      case "download_file":
        return await downloadFile(String(args.url ?? ""), String(args.filename ?? ""));
      case "memory_save": {
        if (!ctx.profileId) return "Fehler: kein Profil aktiv.";
        const fact = String(args.fact ?? "").trim();
        if (!fact) return "Fehler: leerer Fakt.";
        await addMemory(ctx.profileId, fact);
        return `Gemerkt: ${fact}`;
      }
      default:
        return `Unbekanntes Werkzeug: ${name}`;
    }
  } catch (err) {
    return `Werkzeug-Fehler: ${err instanceof Error ? err.message : "unbekannt"}`;
  }
}

export const TOOL_LABEL: Record<string, string> = {
  web_search: "Suche im Web",
  fetch_url: "Lese Webseite",
  download_file: "Lade Datei herunter",
  memory_save: "Merke mir",
};
