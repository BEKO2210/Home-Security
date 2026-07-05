import { NextRequest } from "next/server";
import { GO2RTC_BASE } from "@/lib/cameras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Einzelbild einer Kamera (JPEG), durch die App geproxied. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id fehlt", { status: 400 });
  try {
    const res = await fetch(
      `${GO2RTC_BASE}/api/frame.jpeg?src=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status}`);
    return new Response(res.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Kamera nicht erreichbar", { status: 502 });
  }
}
