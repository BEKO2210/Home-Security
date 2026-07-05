# 🏠 HeimGeist — Euer Zuhause. Eure KI.

Privater KI-Home-Assistent für die ganze Familie — als installierbare **PWA**, komplett **lokal** über [Ollama](https://ollama.com). Keine Cloud, keine Abos, keine Daten verlassen das Haus.

![HeimGeist](public/hero.png)

## Features

- **Familien-Chat** mit lokaler KI — Streaming, Markdown, Stop/Regenerate, Starter-Prompts
- **Automatische Modellwahl** — bestes installiertes Ollama-Modell wird erkannt (Reasoning-/Embedding-Modelle aussortiert, `<think>`-Blöcke gefiltert)
- **Internet & Werkzeuge** — Websuche (DuckDuckGo), Webseiten lesen, Datei-Downloads in den PC-Download-Ordner (nur Eltern-Profile, abschaltbar)
- **Langzeitgedächtnis pro Profil** — `memory_save`-Tool + Server-Store, Erinnerungen fließen in jeden Chat ein, verwaltbar in den Einstellungen
- **Familienprofile** — kindgerechte Antworten für Kinder, geduldige für Großeltern
- **Sprachsteuerung** per Browser-Spracherkennung (de-DE), Whisper-ready
- **Dashboard** mit Modul-Registry — vorbereitet für Kameras & Automationen
- **PWA** — auf Handy/Tablet/Desktop installierbar

## Schnellstart (Heimnetz)

```bash
# Voraussetzung: Ollama läuft (z. B. auf pop-os.local)
ollama serve
ollama pull llama3.1:8b

npm install
npm run dev          # Entwicklung
# oder produktiv:
npm run build && npm start
```

Dann im Heimnetz öffnen (z. B. `http://pop-os.local:3000`), Profil anlegen, unter **Einstellungen** Ollama-Adresse testen und Modell wählen.

## Whisper-Sprachsteuerung + HTTPS (Phase 2)

```bash
# einmalig: Docker-Gruppe (danach ab- und wieder anmelden)
sudo usermod -aG docker $USER

cd deploy && docker compose up -d
```

Startet zwei Container:
- **whisper** — faster-whisper (Modell `small`) auf der GPU, nur via localhost:9000
- **caddy** — HTTPS-Proxy fürs Heimnetz: `https://pop-os.local:3443` (selbstsigniert;
  Zertifikatswarnung einmal bestätigen). HTTPS ist Pflicht, damit Browser das
  Mikrofon freigeben.

Die App erkennt den Whisper-Server automatisch (`/api/transcribe`) und nutzt
sonst die Browser-Spracherkennung. Smoke-Test: `./scripts/smoke.sh`

## Konfiguration

| Variable | Default | Zweck |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama-Server (serverseitiger Proxy) |
| `WHISPER_BASE_URL` | `http://127.0.0.1:9000` | faster-whisper-Server |
| `HEIMGEIST_DOWNLOAD_DIR` | `~/Downloads` | Zielordner für download_file |
| `HEIMGEIST_DATA_DIR` | `./.heimgeist` | Langzeitgedächtnis & Kamera-Registry |
| `GO2RTC_BASE_URL` | `http://127.0.0.1:1984` | go2rtc Kamera-Server |
| `HEIMGEIST_VISION_MODEL` | `llava:7b` | Vision-Modell für camera_look |

Ohne erreichbares Ollama läuft die App im **Demo-Modus** (z. B. auf Vercel) — ideal als Landing Page + Vorschau.

## Roadmap

1. ✅ **Phase 1:** Familien-Chat, Profile, Internet-Werkzeuge, Langzeitgedächtnis, Dashboard, PWA
2. ✅ **Phase 2:** Whisper-Sprachsteuerung (faster-whisper, GPU) + HTTPS im Heimnetz
3. ✅ **Phase 3:** Kameras — Live-Streams (go2rtc: IP-Kamera, Handy-App, USB-Webcam) + KI-Blick per Vision-Modell (`camera_look`, llava)
4. 🔜 **Phase 4:** Automationen (Home-Assistant-Bridge, Function-Calling)

Details: [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript · Ollama

---

Gebaut mit Claude Code + RuFlo-Swarm · Hero-Bild: Higgsfield AI
