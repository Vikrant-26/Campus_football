export const instant = false;

import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
import { createClient } from "@/lib/supabase/server";
import TeamsRealtime from "./TeamsRealtime";

type Team = {
  id: number;
  name: string;
  short_name: string;
  logo_url: string | null;
  description: string | null;
};

type Match = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
};

type TeamMatchStat = {
  id: number;
  match_id: number;
  team_id: number;
  possession: number | null;
  shots: number;
  shots_on_target: number;
  corners: number;
  saves: number;
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const [
    teamsResult,
    matchesResult,
    teamStatsResult,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, logo_url, description")
      .order("id", { ascending: true }),

    supabase
      .from("matches")
      .select(
        "id, home_team_id, away_team_id, home_score, away_score, status"
      ),

    supabase
      .from("team_match_stats")
      .select(
        "id, match_id, team_id, possession, shots, shots_on_target, corners, saves"
      ),
  ]);

  const {
    data: teams,
    error: teamsError,
  } = teamsResult;

  const {
    data: matches,
    error: matchesError,
  } = matchesResult;

  const {
    data: teamStats,
    error: teamStatsError,
  } = teamStatsResult;

  if (teamsError || matchesError || teamStatsError) {
    console.error("Teams error:", teamsError);
    console.error("Matches error:", matchesError);
    console.error("Team stats error:", teamStatsError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load teams
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading teams and their statistics.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-slate-950 relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold">
            ⚽ Campus League
          </Link>

          <div className="hidden gap-6 text-sm md:flex">
            <Link href="/" className="text-slate-400 hover:text-white">
              Home
            </Link>

            <Link
              href="/matches"
              className="text-slate-400 hover:text-white"
            >
              Matches
            </Link>

            <Link href="/table" className="text-slate-400 hover:text-white">
              Table
            </Link>

            <Link href="/teams" className="text-white">
              Teams
            </Link>

            <Link
              href="/players"
              className="text-slate-400 hover:text-white"
            >
              Players
            </Link>

            <Link href="/stats" className="text-slate-400 hover:text-white">
              Stats
            </Link>
          </div>

          <MobileNav currentPath="/teams" />
        </div>
      </nav>

      {/* CONTENT */}
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Campus Football League
          </p>

          <h1 className="mt-2 text-4xl font-bold">Teams</h1>

          <p className="mt-3 text-slate-400">
            Explore all teams and their current league statistics.
          </p>
        </div>

        <TeamsRealtime
          initialTeams={(teams ?? []) as Team[]}
          initialMatches={(matches ?? []) as Match[]}
          initialTeamStats={(teamStats ?? []) as TeamMatchStat[]}
        />
      </div>
    </main>
  );
}
