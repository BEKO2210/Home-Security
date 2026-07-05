import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHISPER_BASE =
  process.env.WHISPER_BASE_URL ?? "http://127.0.0.1:9000";

/** Health: ist der lokale Whisper-Server erreichbar? */
export async function GET() {
  try {
    const res = await fetch(`${WHISPER_BASE}/docs`, {
      signal: AbortSignal.timeout(2_500),
      cache: "no-store",
    });
    return NextResponse.json({ online: res.ok });
  } catch {
    return NextResponse.json({ online: false });
  }
}

/** Audio (webm/ogg/wav) → deutscher Text via faster-whisper. */
export async function POST(req: NextRequest) {
  const audio = await req.blob();
  if (!audio.size) {
    return NextResponse.json({ error: "kein Audio" }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Aufnahme zu groß" }, { status: 413 });
  }

  const form = new FormData();
  form.append("audio_file", audio, "aufnahme.webm");

  try {
    const res = await fetch(
      `${WHISPER_BASE}/asr?encode=true&task=transcribe&language=de&output=json`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) throw new Error(`whisper ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch {
    return NextResponse.json(
      { error: "Whisper-Server nicht erreichbar" },
      { status: 502 },
    );
  }
}
