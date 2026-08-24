export const instant = false;

import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
import { createClient } from "@/lib/supabase/server";
import TableRealtime from "./TableRealtime";

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Match = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
};

export default async function TablePage() {
  const supabase = await createClient();

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select(
      "id, name, short_name"
    )
    .order("id", {
      ascending: true,
    });

  const {
    data: matches,
    error: matchesError,
  } = await supabase
    .from("matches")
    .select(
      "id, home_team_id, away_team_id, home_score, away_score, status"
    );

  if (teamsError || matchesError) {
    console.error(
      "Teams error:",
      teamsError
    );

    console.error(
      "Matches error:",
      matchesError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load league table
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading league data.
        </p>
      </main>
    );
  }

  const typedTeams =
    (teams ?? []) as Team[];

  const typedMatches =
    (matches ?? []) as Match[];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}

      <nav className="border-b border-slate-800 bg-slate-950 relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-xl font-bold"
          >
            ⚽ Campus League
          </Link>

          <div className="hidden gap-6 text-sm md:flex">
            <Link
              href="/"
              className="text-slate-400 hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/matches"
              className="text-slate-400 hover:text-white"
            >
              Matches
            </Link>

            <Link
              href="/table"
              className="text-white"
            >
              Table
            </Link>

            <Link
              href="/teams"
              className="text-slate-400 hover:text-white"
            >
              Teams
            </Link>

            <Link
              href="/players"
              className="text-slate-400 hover:text-white"
            >
              Players
            </Link>

            <Link
              href="/stats"
              className="text-slate-400 hover:text-white"
            >
              Stats
            </Link>
          </div>

          <MobileNav currentPath="/table" />
        </div>
      </nav>

      {/* CONTENT */}

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Season 2026
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            League Table
          </h1>

          <p className="mt-3 text-slate-400">
            Automatically calculated from completed
            league matches.
          </p>
        </div>

        <TableRealtime
          teams={typedTeams}
          initialMatches={typedMatches}
        />

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
          <p>
            <span className="font-semibold text-white">
              P
            </span>{" "}
            = Played
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              W
            </span>{" "}
            = Won
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              D
            </span>{" "}
            = Drawn
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              L
            </span>{" "}
            = Lost
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              GF
            </span>{" "}
            = Goals For
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              GA
            </span>{" "}
            = Goals Against
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              GD
            </span>{" "}
            = Goal Difference
          </p>

          <p className="mt-1">
            <span className="font-semibold text-white">
              PTS
            </span>{" "}
            = Points
          </p>
        </div>
      </div>
    </main>
  );
}