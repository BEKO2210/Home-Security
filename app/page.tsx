import Image from "next/image";
import Link from "next/link";

const features = [
  {
    icon: "👨‍👩‍👧‍👦",
    title: "Familienprofile",
    text: "Jedes Familienmitglied hat sein eigenes Profil. Der Assistent kennt Namen, Rolle und passt Ton und Inhalte an — kindgerecht für die Kleinen.",
  },
  {
    icon: "🏠",
    title: "100 % lokal",
    text: "Die KI läuft über Ollama auf eurem eigenen Rechner. Keine Cloud, keine Abos, keine Daten verlassen das Haus.",
  },
  {
    icon: "🎙️",
    title: "Sprachsteuerung",
    text: "Sprechen statt tippen — heute per Browser-Spracherkennung, bald mit lokalem Whisper für echte Privatsphäre.",
  },
  {
    icon: "📷",
    title: "Kameras & Sicherheit",
    text: "Vorbereitet für IP-Kameras über go2rtc/Frigate: Live-Ansicht und KI-Ereignisse direkt im Dashboard.",
  },
  {
    icon: "📱",
    title: "Als App installierbar",
    text: "PWA — auf jedem Handy, Tablet oder Desktop installierbar. Ein Tipp auf „Zum Startbildschirm hinzufügen“ genügt.",
  },
  {
    icon: "🔒",
    title: "Privat by Design",
    text: "Gespräche bleiben auf euren Geräten. Offene Architektur, offener Code — ihr wisst genau, was läuft.",
  },
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Familien-Chat & Profile",
    text: "Chat mit lokaler KI, Profile für alle, Dashboard, PWA.",
    status: "live",
  },
  {
    phase: "Phase 2",
    title: "Whisper-Sprachsteuerung",
    text: "Lokale Speech-to-Text-Engine (faster-whisper) als Voice-Adapter.",
    status: "geplant",
  },
  {
    phase: "Phase 3",
    title: "Kameras",
    text: "IP-Kameras via go2rtc/Frigate, Live-Streams und Ereignis-Erkennung.",
    status: "geplant",
  },
  {
    phase: "Phase 4",
    title: "Automationen",
    text: "Home-Assistant-Bridge: Licht, Heizung, Szenen — per Chat oder Stimme.",
    status: "geplant",
  },
];

export default function Landing() {
  return (
    <main className="grain relative min-h-screen">
      <div className="aurora" aria-hidden />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-semibold tracking-tight text-ember-400">
          Heim<span className="text-mist-100">Geist</span>
        </span>
        <div className="flex items-center gap-6 text-sm text-mist-300">
          <a href="#funktionen" className="hidden transition hover:text-mist-100 sm:block">
            Funktionen
          </a>
          <a href="#roadmap" className="hidden transition hover:text-mist-100 sm:block">
            Roadmap
          </a>
          <Link
            href="/app"
            className="rounded-full bg-ember-500 px-5 py-2 font-medium text-night-950 transition hover:bg-ember-400"
          >
            App starten
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-20 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="rise rise-1 mb-4 font-mono text-xs tracking-[0.25em] text-sage-400 uppercase">
              Privater KI-Home-Assistent
            </p>
            <h1 className="rise rise-2 font-display text-5xl leading-[1.05] font-semibold sm:text-6xl">
              Euer Zuhause.
              <br />
              <span className="text-ember-400">Eure KI.</span>
            </h1>
            <p className="rise rise-3 mt-6 max-w-md text-lg leading-relaxed text-mist-300">
              Ein Assistent, der die ganze Familie kennt — und trotzdem nichts
              verrät. Läuft komplett lokal auf eurem eigenen Rechner. Keine
              Cloud. Keine Abos. Nur euer Zuhause, ein bisschen schlauer.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="glow-ring rounded-full bg-ember-500 px-7 py-3 font-medium text-night-950 transition hover:bg-ember-400"
              >
                Jetzt loslegen
              </Link>
              <a
                href="#roadmap"
                className="rounded-full border border-night-600 px-7 py-3 text-mist-300 transition hover:border-mist-500 hover:text-mist-100"
              >
                Was kommt noch?
              </a>
            </div>
            <p className="rise rise-5 mt-6 font-mono text-xs text-mist-500">
              Ollama · Next.js · PWA · Open Source
            </p>
          </div>
          <div className="rise rise-3 relative">
            <div className="glass overflow-hidden rounded-3xl p-2">
              <Image
                src="/hero.png"
                alt="Smart Home in der Dämmerung mit KI-Interface"
                width={1376}
                height={768}
                priority
                className="rounded-2xl"
              />
            </div>
            <div className="glass absolute -bottom-5 left-6 flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sage-400" />
              <span className="font-mono text-xs text-mist-300">
                KI läuft lokal · pop-os.local
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funktionen" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Ein Assistent für <span className="text-ember-400">alle</span>
        </h2>
        <p className="mt-3 max-w-xl text-mist-300">
          Von Oma bis Kind — HeimGeist spricht mit jedem so, wie es passt.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-ember-500/40"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-300">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Der Weg zum <span className="text-ember-400">Agentic Home</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {roadmap.map((r) => (
            <div key={r.phase} className="glass relative rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-mist-500 uppercase">
                  {r.phase}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-wider uppercase ${
                    r.status === "live"
                      ? "bg-sage-400/15 text-sage-400"
                      : "bg-night-700 text-mist-500"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {r.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-300">
                {r.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="glass glow-ring rounded-3xl px-8 py-14">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Bereit, euer Zuhause schlauer zu machen?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mist-300">
            Profil anlegen, Modell wählen, losplaudern. Auf dem Handy über
            „Zum Startbildschirm hinzufügen“ installieren.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-block rounded-full bg-ember-500 px-8 py-3 font-medium text-night-950 transition hover:bg-ember-400"
          >
            HeimGeist öffnen
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-night-700/60 py-8 text-center font-mono text-xs text-mist-500">
        HeimGeist · Familie Aslani · lokal & privat ·{" "}
        <a
          href="https://github.com/BEKO2210/Home-Security"
          className="text-mist-300 hover:text-ember-400"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
