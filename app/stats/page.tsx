export const instant = false;

import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
import { createClient } from "@/lib/supabase/server";
import StatsRealtime from "./StatsRealtime";

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Player = {
  id: number;
  name: string;
  team_id: number;
};

type Match = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
  match_period: string | null;
  half_duration_minutes: number;
  elapsed_seconds: number;
  current_half_started_at: string | null;
};

type PlayerMatchStat = {
  match_id: number;
  player_id: number;
  minutes_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
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

type MatchLineup = {
  id: number;
  match_id: number;
  team_id: number;
  formation: string;
  starting_xi: number[];
};

type MatchEvent = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number | null;
  assist_player_id: number | null;
  player_in_id: number | null;
  player_out_id: number | null;
  event_type: string;
  minute: number;
  added_time: number | null;
};

export default async function StatsPage() {
  const supabase = await createClient();

  const [
    teamsResult,
    playersResult,
    matchesResult,
    playerStatsResult,
    teamStatsResult,
    lineupsResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name")
      .order("id", { ascending: true }),

    supabase
      .from("players")
      .select("id, name, team_id")
      .order("name", { ascending: true }),

    supabase
      .from("matches")
      .select(
        `
        id,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        match_period,
        half_duration_minutes,
        elapsed_seconds,
        current_half_started_at
        `
      ),

    supabase
      .from("player_match_stats")
      .select(
        "match_id, player_id, minutes_played, goals, assists, yellow_cards, red_cards"
      ),

    supabase
      .from("team_match_stats")
      .select(
        "id, match_id, team_id, possession, shots, shots_on_target, corners, saves"
      ),

    supabase
      .from("match_lineups")
      .select("id, match_id, team_id, formation, starting_xi"),

    supabase
      .from("match_events")
      .select(
        "id, match_id, team_id, player_id, assist_player_id, player_in_id, player_out_id, event_type, minute, added_time"
      )
      .order("minute", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const { data: teams, error: teamsError } = teamsResult;
  const { data: players, error: playersError } = playersResult;
  const { data: matches, error: matchesError } = matchesResult;
  const { data: playerStats, error: playerStatsError } = playerStatsResult;
  const { data: teamStats, error: teamStatsError } = teamStatsResult;
  const { data: lineups, error: lineupsError } = lineupsResult;
  const { data: events, error: eventsError } = eventsResult;

  if (
    teamsError ||
    playersError ||
    matchesError ||
    playerStatsError ||
    teamStatsError ||
    lineupsError ||
    eventsError
  ) {
    console.error("Teams:", teamsError);
    console.error("Players:", playersError);
    console.error("Matches:", matchesError);
    console.error("Player stats:", playerStatsError);
    console.error("Team stats:", teamStatsError);
    console.error("Lineups:", lineupsError);
    console.error("Events:", eventsError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Unable to load statistics</h1>
        <p className="mt-3 text-red-400">
          There was a problem loading statistics.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
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
            <Link href="/teams" className="text-slate-400 hover:text-white">
              Teams
            </Link>
            <Link
              href="/players"
              className="text-slate-400 hover:text-white"
            >
              Players
            </Link>
            <Link href="/stats" className="text-white">
              Stats
            </Link>
          </div>

          <MobileNav currentPath="/stats" />
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Season 2026
          </p>
          <h1 className="mt-2 text-4xl font-bold">Statistics</h1>
          <p className="mt-3 text-slate-400">
            Statistics calculated from league matches and saved player and
            team match data.
          </p>
        </div>

        <StatsRealtime
          teams={(teams ?? []) as Team[]}
          players={(players ?? []) as Player[]}
          matches={(matches ?? []) as Match[]}
          initialPlayerStats={(playerStats ?? []) as PlayerMatchStat[]}
          initialTeamStats={(teamStats ?? []) as TeamMatchStat[]}
          initialLineups={(lineups ?? []) as MatchLineup[]}
          initialEvents={(events ?? []) as MatchEvent[]}
        />
      </div>
    </main>
  );
}
