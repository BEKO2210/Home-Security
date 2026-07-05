"use client";

import { Profile, profileColor } from "@/lib/store";

/** Profilbild falls vorhanden, sonst Monogramm auf Akzentfarbe. */
export default function Avatar({
  profile,
  size = 40,
  className = "",
}: {
  profile: Profile;
  size?: number;
  className?: string;
}) {
  if (profile.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Daten-URL, kein next/image nötig
      <img
        src={profile.photo}
        alt={profile.name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full font-display font-semibold text-night-950 ${className}`}
      style={{
        background: profileColor(profile),
        width: size,
        height: size,
        fontSize: size * 0.45,
      }}
    >
      {profile.name[0]?.toUpperCase()}
    </span>
  );
}

/** Foto vom Handy/PC: verkleinert auf 128×128 (cover) als JPEG-Daten-URL. */
export function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 128;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        S,
        S,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bild"));
    };
    img.src = url;
  });
}
