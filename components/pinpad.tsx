"use client";

import { useEffect, useState } from "react";
import { IconX } from "@/components/icons";

/**
 * Vollbild-PIN-Eingabe mit eigener Zahlentastatur.
 * Bei der 4. Ziffer wird automatisch geprüft — kein OK-Knopf nötig.
 */
export default function PinPad({
  title,
  color,
  verify,
  onSuccess,
  onCancel,
}: {
  title: string;
  color: string;
  verify: (pin: string) => boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length < 4) return;
    if (verify(pin)) {
      onSuccess();
    } else {
      setShake(true);
      setTimeout(() => {
        setPin("");
        setShake(false);
      }, 450);
    }
  }, [pin, verify, onSuccess]);

  // Hardware-Tastatur (Desktop) weiter erlauben
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const press = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-night-950/90 px-6 backdrop-blur-sm">
      <button
        onClick={onCancel}
        aria-label="Abbrechen"
        className="absolute right-5 top-5 rounded-full p-2 text-mist-500 hover:bg-night-700 hover:text-mist-100"
      >
        <IconX />
      </button>

      <span
        className="flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-semibold text-night-950"
        style={{ background: color }}
      >
        {title[0]?.toUpperCase()}
      </span>
      <p className="mt-3 font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-sm text-mist-500">PIN eingeben</p>

      <div className={`mt-6 flex gap-4 ${shake ? "pin-shake" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition ${
              i < pin.length ? "bg-ember-400" : "bg-night-600"
            }`}
          />
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-[264px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="glass h-16 rounded-2xl font-display text-2xl font-semibold transition active:scale-95 active:bg-night-600"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          className="glass h-16 rounded-2xl font-display text-2xl font-semibold transition active:scale-95 active:bg-night-600"
        >
          0
        </button>
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Ziffer löschen"
          className="h-16 rounded-2xl text-mist-500 transition active:scale-95 hover:text-mist-100"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
