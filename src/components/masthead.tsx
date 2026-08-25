"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/notes", label: "매매노트" },
  { href: "/watchlist", label: "워치리스트" },
  { href: "/about", label: "읽는 법" },
];

export function Masthead() {
  const path = usePathname();
  return (
    <header className="masthead">
      <div className="wrap masthead__bar">
        <Link href="/" className="brand">
          <span className="brand__mark">層</span>
          <span className="brand__name">테마 지도</span>
        </Link>
        <nav className="masthead__nav">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="navlink"
              aria-current={path === l.href ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
