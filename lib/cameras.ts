import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Kamera-Registry (Phase 3).
 *
 * Kameras liegen in .heimgeist/cameras.json und werden bei jedem Listen-Aufruf
 * im lokalen go2rtc registriert (idempotent). go2rtc übernimmt RTSP→MSE/MP4;
 * die App proxied Snapshots und Streams über /api/cameras/*, damit auch die
 * HTTPS-Ansicht (Caddy) keine Mixed-Content-Probleme bekommt.
 */

export interface Camera {
  id: string;
  name: string;
  /** Quelle, z. B. rtsp://user:pass@192.168.2.50:554/stream1 */
  src: string;
  createdAt: number;
}

export const GO2RTC_BASE =
  process.env.GO2RTC_BASE_URL ?? "http://127.0.0.1:1984";

const DATA_DIR =
  process.env.HEIMGEIST_DATA_DIR ?? path.join(process.cwd(), ".heimgeist");
const FILE = path.join(DATA_DIR, "cameras.json");

export async function listCameras(): Promise<Camera[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Camera[];
  } catch {
    return [];
  }
}

async function persist(cams: Camera[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(cams, null, 2));
}

/** Stream in go2rtc anlegen/aktualisieren (idempotent). */
export async function registerStream(cam: Camera): Promise<boolean> {
  try {
    const res = await fetch(
      `${GO2RTC_BASE}/api/streams?name=${encodeURIComponent(cam.id)}&src=${encodeURIComponent(cam.src)}`,
      { method: "PUT", signal: AbortSignal.timeout(4_000) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function go2rtcOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${GO2RTC_BASE}/api`, {
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function addCamera(name: string, src: string): Promise<Camera> {
  const cams = await listCameras();
  const cam: Camera = {
    id: `cam${Date.now().toString(36)}`,
    name: name.trim().slice(0, 40),
    src: src.trim(),
    createdAt: Date.now(),
  };
  cams.push(cam);
  await persist(cams);
  await registerStream(cam);
  return cam;
}

export async function removeCamera(id: string): Promise<void> {
  const cams = await listCameras();
  await persist(cams.filter((c) => c.id !== id));
  try {
    await fetch(`${GO2RTC_BASE}/api/streams?src=${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    /* go2rtc offline — Registry ist maßgeblich */
  }
}

/** Alle Kameras in go2rtc registrieren; liefert Online-Status. */
export async function syncCameras(): Promise<{ online: boolean; cameras: Camera[] }> {
  const cameras = await listCameras();
  const online = await go2rtcOnline();
  if (online) await Promise.all(cameras.map(registerStream));
  return { online, cameras };
}
