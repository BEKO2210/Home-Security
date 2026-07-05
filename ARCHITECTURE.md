# HeimGeist — Architektur

Privater, lokaler KI-Home-Assistent als PWA. Ausgelegt als **Agentic Home System**: heute Chat + Profile, morgen Whisper-Sprachsteuerung, Kameras und Automationen — ohne Umbau, nur durch neue Adapter/Module.

```
┌─────────────────────────────────────────────────────┐
│  PWA (Next.js App Router, installierbar)            │
│  ┌───────────┐ ┌────────┐ ┌───────────┐ ┌─────────┐ │
│  │ Landing / │ │ Profile│ │   Chat    │ │Dashboard│ │
│  └───────────┘ └────────┘ └─────┬─────┘ └────┬────┘ │
│                    lib/store (localStorage)  │      │
│                    lib/voice (VoiceAdapter)  │      │
│                    lib/modules (Registry) ───┘      │
├─────────────────────────────────────────────────────┤
│  API-Routen (Server-Proxy)                          │
│  /api/chat    → Ollama /api/chat (NDJSON-Streaming) │
│  /api/models  → Ollama /api/tags                    │
├─────────────────────────────────────────────────────┤
│  Lokale Dienste im Heimnetz                         │
│  Ollama (pop-os.local:11434)                        │
│  später: faster-whisper · go2rtc/Frigate · HA       │
└─────────────────────────────────────────────────────┘
```

## Grundprinzipien

- **Lokal zuerst.** Die KI läuft via Ollama im Heimnetz. Der Next.js-Server proxied Anfragen (`/api/chat`), damit der Browser nie direkt mit HTTP-Ollama sprechen muss (vermeidet Mixed-Content bei HTTPS).
- **Demo-Modus.** Ist Ollama nicht erreichbar (z. B. Vercel-Deployment), streamt `/api/chat` eine erklärende Demo-Antwort. Die App bricht nie hart.
- **Profile = Personas.** `lib/store.ts → systemPrompt()` baut pro Familienmitglied einen System-Prompt: kindgerecht für Kinder, geduldig für Großeltern.
- **Alles Client-State in localStorage.** Keine Datenbank nötig; Chats bleiben pro Gerät und Profil. (Späterer Ausbau: SQLite/Postgres im Heimnetz.)

## Agent-Werkzeuge & Gedächtnis (live)

`lib/tools.ts` definiert Ollama-Tools, die der Server in einer Tool-Schleife
(max. 3 Runden, streaming) ausführt:

| Tool | Zweck | Schutz |
|---|---|---|
| `web_search` | DuckDuckGo-HTML-Suche, Top 5 | Timeout 10 s |
| `fetch_url` | Webseite als Text (6 000 Zeichen) | nur http(s), Timeout |
| `download_file` | Datei nach `~/Downloads` | nur Eltern-Profile, Pfad-Sanitizing, 500 MB-Limit, kein Überschreiben |
| `memory_save` | Fakt ins Langzeitgedächtnis | pro Profil, Dedupe, max. 200 Fakten |
| `camera_look` | Kamerabild holen + per Vision-Modell (llava) beschreiben | nur lokale go2rtc-Frames |

Langzeitgedächtnis (`lib/memory.ts`): eine JSON-Datei pro Profil unter
`.heimgeist/memory/` (bleibt auf dem Familien-PC, gitignored). Bei jeder
Chat-Anfrage werden die Fakten des Profils in den System-Prompt injiziert;
Verwaltung über `/api/memory` und die Einstellungen-Seite.

Modelle ohne Tool-Support (HTTP 400) fallen automatisch auf reinen Chat
zurück. `lib/models.ts` wählt das Standard-Modell automatisch.

## Erweiterungspunkte

### 1. Voice-Adapter (Phase 2 — Whisper)

`lib/voice.ts` definiert das Interface:

```ts
interface VoiceAdapter {
  available(): boolean;
  start(onResult: (text: string, final: boolean) => void, onEnd: () => void): void;
  stop(): void;
}
```

Aktiv ist `BrowserSpeechAdapter` (Web Speech API, de-DE). Für Whisper:

1. [faster-whisper](https://github.com/SYSTRAN/faster-whisper)-Server im Heimnetz starten (läuft gut auf der RTX 3070).
2. `WhisperAdapter` in `lib/voice.ts` implementieren: MediaRecorder → Audio-Blob → `POST /transcribe` → Text.
3. In `createVoiceAdapter()` bei konfiguriertem Endpoint den WhisperAdapter zurückgeben.

Kein UI-Code ändert sich — der Mikrofon-Button im Chat nutzt nur das Interface.

### 2. Module (Phase 3 — Kameras, Phase 4 — Automationen)

`lib/modules.ts` ist die Registry fürs Dashboard. Neues Modul:

1. Eintrag in `MODULES` ergänzen (`id`, `icon`, `status: "aktiv"`, `href`).
2. Seite unter `app/app/<id>/page.tsx` anlegen.
3. Serverseitige Integration als API-Route unter `app/api/<id>/`.

**Kameras (live seit Phase 3):** [go2rtc](https://github.com/AlexxIT/go2rtc) (deploy/) nimmt RTSP/HTTP-Quellen, Handy-Apps („IP Webcam") und USB-Webcams. Registry in `.heimgeist/cameras.json` (`lib/cameras.ts`), idempotent in go2rtc registriert. Die App proxied Snapshot (`/api/cameras/snapshot`) und MP4-Live-Stream (`/api/cameras/stream`) — kein Mixed-Content über HTTPS. Ausbau: [Frigate](https://frigate.video) für Ereignis-Erkennung (Person erkannt → Push/Chat-Meldung).

**Automationen konkret:** Home-Assistant-REST/WebSocket-API als Tool-Schicht; der Chat bekommt Function-Calling (Ollama `tools`), damit „Mach das Wohnzimmerlicht an“ eine echte Aktion wird.

## Deployment

| Ziel | Zweck | KI |
|---|---|---|
| **Heimnetz** (`npm run build && npm start` auf pop-os) | Produktiv für die Familie | echte Ollama-Verbindung |
| **Vercel** | Landing Page + Demo | Demo-Modus (LAN unerreichbar) |

Env: `OLLAMA_BASE_URL` (Default `http://pop-os.local:11434`). Die Ollama-Adresse ist zusätzlich pro Gerät in den Einstellungen überschreibbar.

## PWA

- `public/manifest.webmanifest` + Icons (192/512, maskable)
- `public/sw.js`: App-Shell-Cache, network-first, API-Traffic wird nie gecacht
- Installation: Browser-Menü → „Zum Startbildschirm hinzufügen"
