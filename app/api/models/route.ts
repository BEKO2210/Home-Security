import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

export async function GET(req: NextRequest) {
  const base = (req.nextUrl.searchParams.get("ollamaUrl") || DEFAULT_OLLAMA).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return NextResponse.json({
      online: true,
      models: (data.models ?? []).map((m) => m.name),
    });
  } catch {
    return NextResponse.json({ online: false, models: [] });
  }
}
