"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { THEMES } from "@/data/themes";

export function ThemeRail() {
  const path = usePathname();
  return (
    <nav className="rail" aria-label="테마 목록">
      <div className="wrap">
        <div className="rail__track">
          {THEMES.map((t) => {
            const href = `/theme/${t.slug}`;
            const active = path === href;
            return (
              <Link
                key={t.slug}
                href={href}
                className="rail__item"
                aria-current={active ? "page" : undefined}
                style={active ? { ["--accent" as string]: t.accent } : undefined}
              >
                {t.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
