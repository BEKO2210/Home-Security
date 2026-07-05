"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconChat, IconUsers, IconSettings } from "@/components/icons";

const tabs = [
  { href: "/app/home", icon: IconHome, label: "Zuhause" },
  { href: "/app/chat", icon: IconChat, label: "Chat" },
  { href: "/app", icon: IconUsers, label: "Profile" },
  { href: "/app/settings", icon: IconSettings, label: "Mehr" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grain relative flex min-h-dvh flex-col">
      <div className="aurora" aria-hidden />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-6">
        {children}
      </div>
      <nav className="glass fixed inset-x-0 bottom-0 z-20 border-t border-night-700/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl justify-around">
          {tabs.map((t) => {
            const active =
              t.href === "/app" ? pathname === "/app" : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center gap-1 px-5 py-3 text-[11px] transition ${
                  active ? "text-ember-400" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                <Icon width={21} height={21} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
