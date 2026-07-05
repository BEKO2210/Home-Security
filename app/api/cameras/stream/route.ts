import { NextRequest } from "next/server";
import { GO2RTC_BASE } from "@/lib/cameras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live-Stream (MP4) einer Kamera, durch die App geproxied —
 *  funktioniert damit auch über die HTTPS-Ansicht ohne Mixed-Content. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id fehlt", { status: 400 });
  try {
    const res = await fetch(
      `${GO2RTC_BASE}/api/stream.mp4?src=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok || !res.body) throw new Error(`${res.status}`);
    return new Response(res.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Kamera nicht erreichbar", { status: 502 });
  }
}
