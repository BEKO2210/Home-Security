import { NextRequest, NextResponse } from "next/server";
import { listMemories, deleteMemory } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ facts: [] });
  return NextResponse.json({ facts: await listMemories(profileId) });
}

export async function DELETE(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  const factId = req.nextUrl.searchParams.get("factId");
  if (profileId && factId) await deleteMemory(profileId, factId);
  return NextResponse.json({ ok: true });
}
