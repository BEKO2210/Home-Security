/**
 * Dashboard module registry.
 *
 * Every capability of the home system is a module. To add one (e.g. cameras
 * via go2rtc, Whisper voice, Home Assistant automations), append an entry
 * here and — for interactive modules — add a page under app/app/<id>/.
 * Icons resolve via components/icons.tsx (see ICON map in the dashboard).
 * See ARCHITECTURE.md → "Module".
 */

export interface HomeModule {
  id: string;
  name: string;
  icon: "chat" | "wave" | "camera" | "zap";
  description: string;
  status: "aktiv" | "bald";
  href?: string;
  phase: number;
}

export const MODULES: HomeModule[] = [
  {
    id: "chat",
    name: "Familien-Chat",
    icon: "chat",
    description: "Mit der lokalen KI sprechen — Fragen, Hausaufgaben, Rezepte, Planung.",
    status: "aktiv",
    href: "/app/chat",
    phase: 1,
  },
  {
    id: "voice",
    name: "Sprachsteuerung",
    icon: "wave",
    description: "Whisper-Spracherkennung lokal auf der GPU — aktiviert sich automatisch, sobald der Container läuft; sonst Browser-Fallback.",
    status: "aktiv",
    href: "/app/chat",
    phase: 2,
  },
  {
    id: "cameras",
    name: "Kameras",
    icon: "camera",
    description: "Live-Streams von IP-Kameras, Handy oder USB-Webcam — und die KI schaut auf Wunsch nach, was los ist.",
    status: "aktiv",
    href: "/app/cameras",
    phase: 3,
  },
  {
    id: "automations",
    name: "Automationen",
    icon: "zap",
    description: "Home-Assistant-Bridge: Licht, Heizung und Szenen per Chat steuern.",
    status: "bald",
    phase: 4,
  },
];
