import { NextRequest, NextResponse } from "next/server";
import { syncCameras, addCamera, removeCamera } from "@/lib/cameras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { online, cameras } = await syncCameras();
  return NextResponse.json({
    online,
    cameras: cameras.map((c) => ({ id: c.id, name: c.name })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string; src?: string };
  const name = (body.name ?? "").trim();
  const src = (body.src ?? "").trim();
  if (!name || !src) {
    return NextResponse.json({ error: "Name und Quelle nötig" }, { status: 400 });
  }
  if (!/^(rtsp|rtmp|http|https|ffmpeg|tcp):/i.test(src)) {
    return NextResponse.json(
      { error: "Quelle muss mit rtsp://, http(s):// o. ä. beginnen" },
      { status: 400 },
    );
  }
  const cam = await addCamera(name, src);
  return NextResponse.json({ id: cam.id, name: cam.name });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) await removeCamera(id);
  return NextResponse.json({ ok: true });
}
