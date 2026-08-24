"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  currentPath?: string;
};

const links = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/table", label: "Table" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
];

export default function MobileNav({
  currentPath,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-xl text-slate-200 hover:bg-slate-800"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-slate-800 bg-slate-950 px-5 py-3 shadow-2xl">
          <nav className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => {
              const active =
                currentPath === link.href ||
                (link.href !== "/" &&
                  currentPath?.startsWith(`${link.href}/`));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
