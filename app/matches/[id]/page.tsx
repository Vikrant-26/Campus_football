export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LiveMatch from "./LiveMatch";

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;
  match_period: string | null;
  previous_match_period: string | null;
  half_duration_minutes: number;
  elapsed_seconds: number;
  first_half_started_at: string | null;
  second_half_started_at: string | null;
  current_half_started_at: string | null;
  paused_at: string | null;
  added_time_minutes: number;
  added_time_started: boolean;
  result_type: string | null;
  cancellation_reason: string | null;
  home_score: number;
  away_score: number;
  home_team_id: number;
  away_team_id: number;
};

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Player = {
  id: number;
  name: string;
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
  description: string | null;
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

type PlayerMatchStat = {
  id: number;
  match_id: number;
  player_id: number;
  minutes_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isFinite(matchId)) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Match Not Found</h1>
        <Link href="/matches" className="mt-5 inline-block text-emerald-400">
          ← Back to Matches
        </Link>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(`
      id,
      match_date,
      venue,
      status,
      match_period,
      previous_match_period,
      half_duration_minutes,
      elapsed_seconds,
      first_half_started_at,
      second_half_started_at,
      current_half_started_at,
      paused_at,
      added_time_minutes,
      added_time_started,
      result_type,
      cancellation_reason,
      home_score,
      away_score,
      home_team_id,
      away_team_id
    `)
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    console.error("Match loading error:", JSON.stringify(matchError, null, 2));
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Unable to Load Match</h1>
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-950/20 p-5">
          <p className="font-semibold text-red-400">Match loading error</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-red-300">
            {JSON.stringify(matchError, null, 2)}
          </pre>
        </div>
        <Link href="/matches" className="mt-5 inline-block text-emerald-400">
          ← Back to Matches
        </Link>
      </main>
    );
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .order("name", { ascending: true });

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: events, error: eventsError } = await supabase
    .from("match_events")
    .select(`
      id,
      match_id,
      team_id,
      player_id,
      assist_player_id,
      player_in_id,
      player_out_id,
      event_type,
      minute,
      added_time,
      description
    `)
    .eq("match_id", matchId)
    .order("minute", { ascending: true })
    .order("id", { ascending: true });

  const { data: teamStats, error: teamStatsError } = await supabase
    .from("team_match_stats")
    .select(`
      id,
      match_id,
      team_id,
      possession,
      shots,
      shots_on_target,
      corners,
      saves
    `)
    .eq("match_id", matchId);

  const { data: playerStats, error: playerStatsError } = await supabase
    .from("player_match_stats")
    .select(`
      id,
      match_id,
      player_id,
      minutes_played,
      goals,
      assists,
      yellow_cards,
      red_cards
    `)
    .eq("match_id", matchId);

  if (
    teamsError ||
    playersError ||
    eventsError ||
    teamStatsError ||
    playerStatsError
  ) {
    console.error("Teams:", teamsError);
    console.error("Players:", playersError);
    console.error("Events:", eventsError);
    console.error("Team stats:", teamStatsError);
    console.error("Player stats:", playerStatsError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Unable to Load Match</h1>
        <p className="mt-3 text-red-400">There was a problem loading match data.</p>
        <Link href="/matches" className="mt-5 inline-block text-emerald-400">
          ← Back to Matches
        </Link>
      </main>
    );
  }

  const typedMatch = match as Match;
  const typedTeams = (teams ?? []) as Team[];
  const typedPlayers = (players ?? []) as Player[];
  const typedEvents = (events ?? []) as MatchEvent[];
  const typedStats = (teamStats ?? []) as TeamMatchStat[];
  const typedPlayerStats = (playerStats ?? []) as PlayerMatchStat[];

  const homeTeam = typedTeams.find((team) => team.id === typedMatch.home_team_id);
  const awayTeam = typedTeams.find((team) => team.id === typedMatch.away_team_id);

  const matchDate = new Date(typedMatch.match_date);
  const formattedDate = matchDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedTime = matchDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold">
            ⚽ Campus League
          </Link>

          <div className="hidden gap-6 text-sm md:flex">
            <Link href="/" className="text-slate-400 hover:text-white">Home</Link>
            <Link href="/matches" className="text-white">Matches</Link>
            <Link href="/table" className="text-slate-400 hover:text-white">Table</Link>
            <Link href="/teams" className="text-slate-400 hover:text-white">Teams</Link>
            <Link href="/players" className="text-slate-400 hover:text-white">Players</Link>
            <Link href="/stats" className="text-slate-400 hover:text-white">Stats</Link>
          </div>

          <Link href="/matches" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">
            ← Matches
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Match Center
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {homeTeam?.name ?? "Home Team"} vs {awayTeam?.name ?? "Away Team"}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {formattedDate} · {formattedTime}
          </p>
        </div>

        <LiveMatch
          initialMatch={typedMatch}
          initialEvents={typedEvents}
          initialStats={typedStats}
          initialPlayerStats={typedPlayerStats}
          teams={typedTeams}
          players={typedPlayers}
        />
      </div>
    </main>
  );
}
