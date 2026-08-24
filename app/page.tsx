export const instant = false;

import RealtimeRefresh from "./components/RealtimeRefresh";
import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
import { createClient } from "@/lib/supabase/server";

type Team = {
  id: number;
  name: string;
  short_name: string;
  logo_url: string | null;
};

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;
  home_score: number;
  away_score: number;
  home_team_id: number;
  away_team_id: number;
};

type Player = {
  id: number;
  name: string;
  team_id: number;
};

type MatchEvent = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number | null;
  event_type: string;
  minute: number;
};

type MatchWithTeams = Match & {
  homeTeamName: string;
  awayTeamName: string;
};

type Standing = {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type Scorer = {
  playerId: number;
  name: string;
  teamName: string;
  goals: number;
};

export default async function HomePage() {
  const supabase = await createClient();

  // ============================================
  // GET TEAMS
  // ============================================

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name, logo_url")
    .order("id", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
  }

  // ============================================
  // GET MATCHES
  // ============================================

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, match_date, venue, status, home_score, away_score, home_team_id, away_team_id"
    )
    .order("match_date", { ascending: true });

  if (matchesError) {
    console.error("Matches error:", matchesError);
  }

  // ============================================
  // GET PLAYERS
  // ============================================

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, team_id")
    .order("name", { ascending: true });

  if (playersError) {
    console.error("Players error:", playersError);
  }

  // ============================================
  // GET MATCH EVENTS
  // ============================================

  const { data: events, error: eventsError } = await supabase
    .from("match_events")
    .select(
      "id, match_id, team_id, player_id, event_type, minute"
    )
    .order("minute", { ascending: true });

  if (eventsError) {
    console.error("Events error:", eventsError);
  }

  const typedTeams = (teams ?? []) as Team[];
  const typedMatches = (matches ?? []) as Match[];
  const typedPlayers = (players ?? []) as Player[];
  const typedEvents = (events ?? []) as MatchEvent[];

  // ============================================
  // ADD TEAM NAMES TO MATCHES
  // ============================================

  const matchesWithTeams: MatchWithTeams[] = typedMatches.map(
    (match) => {
      const homeTeam = typedTeams.find(
        (team) => team.id === match.home_team_id
      );

      const awayTeam = typedTeams.find(
        (team) => team.id === match.away_team_id
      );

      return {
        ...match,
        homeTeamName: homeTeam?.name ?? "Unknown Team",
        awayTeamName: awayTeam?.name ?? "Unknown Team",
      };
    }
  );

  // ============================================
  // SEPARATE MATCHES
  // ============================================

  const liveMatches = matchesWithTeams.filter(
    (match) => match.status === "live"
  );

  const upcomingMatches = matchesWithTeams
    .filter((match) => match.status === "scheduled")
    .slice(0, 3);

  const completedMatches = matchesWithTeams
    .filter((match) => match.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.match_date).getTime() -
        new Date(a.match_date).getTime()
    )
    .slice(0, 3);

  // ============================================
  // CALCULATE LEAGUE TABLE
  // ============================================

  const completedOnly = typedMatches.filter(
    (match) => match.status === "completed"
  );

  const standings: Standing[] = typedTeams.map((team) => {
    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    completedOnly.forEach((match) => {
      const isHome = match.home_team_id === team.id;
      const isAway = match.away_team_id === team.id;

      if (!isHome && !isAway) {
        return;
      }

      played++;

      if (isHome) {
        goalsFor += match.home_score;
        goalsAgainst += match.away_score;

        if (match.home_score > match.away_score) {
          won++;
        } else if (match.home_score === match.away_score) {
          drawn++;
        } else {
          lost++;
        }
      }

      if (isAway) {
        goalsFor += match.away_score;
        goalsAgainst += match.home_score;

        if (match.away_score > match.home_score) {
          won++;
        } else if (match.away_score === match.home_score) {
          drawn++;
        } else {
          lost++;
        }
      }
    });

    return {
      teamId: team.id,
      teamName: team.name,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points: won * 3 + drawn,
    };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }

    return b.goalsFor - a.goalsFor;
  });

  // ============================================
  // CALCULATE TOP SCORERS
  // ============================================

  const scorerMap = new Map<number, number>();

  typedEvents.forEach((event) => {
    if (
      event.player_id &&
      (
        event.event_type === "goal" ||
        event.event_type === "penalty_goal"
      )
    ) {
      const current = scorerMap.get(event.player_id) ?? 0;
      scorerMap.set(event.player_id, current + 1);
    }
  });

  const topScorers: Scorer[] = typedPlayers
    .map((player) => {
      const team = typedTeams.find(
        (team) => team.id === player.team_id
      );

      return {
        playerId: player.id,
        name: player.name,
        teamName: team?.name ?? "Unknown Team",
        goals: scorerMap.get(player.id) ?? 0,
      };
    })
    .filter((player) => player.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 4);

  // ============================================
  // FORMAT FUNCTIONS
  // ============================================

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <RealtimeRefresh />
      {/* ================= NAVBAR ================= */}

      <nav className="border-b border-slate-800 bg-slate-950 relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <Link
              href="/"
              className="text-xl font-bold"
            >
              ⚽ Campus League
            </Link>

            <p className="text-xs text-slate-500">
              Season 2026
            </p>
          </div>

          <div className="hidden gap-7 text-sm font-medium md:flex">
            <Link
              href="/"
              className="text-white"
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
              className="text-slate-400 hover:text-white"
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

          <MobileNav currentPath="/" />
        </div>
      </nav>

      {/* ================= PAGE CONTENT ================= */}

      <div className="mx-auto max-w-7xl px-5 py-8">
        {/* HEADER */}

        <section className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Campus Football League
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-5xl">
            The home of campus football.
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Follow live matches, fixtures, standings,
            players and league statistics.
          </p>
        </section>

        {/* ================= LIVE MATCH ================= */}

        {liveMatches.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />

              <h2 className="text-2xl font-bold">
                Live Now
              </h2>
            </div>

            {liveMatches.slice(0, 1).map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="block"
              >
                <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 to-slate-900 transition hover:border-emerald-400/60">
                  <div className="flex items-center justify-between border-b border-emerald-900/60 px-5 py-4">
                    <span className="text-sm font-semibold text-red-400">
                      🔴 LIVE
                    </span>

                    <span className="text-sm text-slate-500">
                      {formatTime(match.match_date)}
                    </span>
                  </div>

                  <div className="grid gap-6 px-5 py-8 text-center md:grid-cols-3 md:items-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-2xl">
                        ⚽
                      </div>

                      <h3 className="text-xl font-bold">
                        {match.homeTeamName}
                      </h3>
                    </div>

                    <div>
                      <div className="text-5xl font-black">
                        {match.home_score}

                        <span className="mx-3 text-slate-500">
                          -
                        </span>

                        {match.away_score}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {match.venue ?? "Venue not specified"}
                      </p>
                    </div>

                    <div>
                      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-2xl">
                        ⚽
                      </div>

                      <h3 className="text-xl font-bold">
                        {match.awayTeamName}
                      </h3>
                    </div>
                  </div>

                  <div className="border-t border-emerald-900/60 px-5 py-4 text-center text-sm text-emerald-400">
                    View Match Center →
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* ================= UPCOMING + RESULTS ================= */}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* UPCOMING */}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-400">
                  NEXT MATCHES
                </p>

                <h2 className="text-2xl font-bold">
                  Upcoming Fixtures
                </h2>
              </div>

              <Link
                href="/matches"
                className="text-sm text-slate-500 hover:text-white"
              >
                View all →
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingMatches.length > 0 ? (
                upcomingMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600 hover:bg-slate-800/70">
                      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {formatDate(match.match_date)}
                        </span>

                        <span>
                          {match.venue ?? "Football Ground"}
                        </span>
                      </div>

                      <div className="grid items-center gap-4 md:grid-cols-3">
                        <div className="font-semibold">
                          {match.homeTeamName}
                        </div>

                        <div className="text-center">
                          {match.home_score > 0 ||
                          match.away_score > 0 ? (
                            <p className="text-lg font-black">
                              {match.home_score}
                              <span className="mx-2 text-slate-500">
                                -
                              </span>
                              {match.away_score}
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-slate-500">
                                KICK-OFF
                              </p>

                              <p className="mt-1 font-bold">
                                {formatTime(match.match_date)}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="text-right font-semibold">
                          {match.awayTeamName}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500">
                  No upcoming matches.
                </div>
              )}
            </div>
          </section>

          {/* RECENT RESULTS */}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-400">
                  RESULTS
                </p>

                <h2 className="text-2xl font-bold">
                  Recent Results
                </h2>
              </div>

              <Link
                href="/matches"
                className="text-sm text-slate-500 hover:text-white"
              >
                View all →
              </Link>
            </div>

            <div className="space-y-3">
              {completedMatches.length > 0 ? (
                completedMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800/70">
                      <div className="mb-4 text-xs text-slate-500">
                        {formatDate(match.match_date)}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <p className="font-semibold">
                            {match.homeTeamName}
                          </p>

                          <p className="font-semibold">
                            {match.awayTeamName}
                          </p>
                        </div>

                        <div className="space-y-2 text-right text-lg font-black">
                          <p>{match.home_score}</p>
                          <p>{match.away_score}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500">
                  No completed matches yet.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ================= LEAGUE TABLE ================= */}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">
                STANDINGS
              </p>

              <h2 className="text-2xl font-bold">
                League Table
              </h2>
            </div>

            <Link
              href="/table"
              className="text-sm text-slate-500 hover:text-white"
            >
              Full table →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="border-b border-slate-800 text-slate-500">
                <tr>
                  <th className="px-4 py-4 text-left">
                    #
                  </th>

                  <th className="px-4 py-4 text-left">
                    Team
                  </th>

                  <th className="px-4 py-4 text-center">
                    P
                  </th>

                  <th className="px-4 py-4 text-center">
                    W
                  </th>

                  <th className="px-4 py-4 text-center">
                    D
                  </th>

                  <th className="px-4 py-4 text-center">
                    L
                  </th>

                  <th className="px-4 py-4 text-center">
                    GD
                  </th>

                  <th className="px-4 py-4 text-center">
                    PTS
                  </th>
                </tr>
              </thead>

              <tbody>
                {standings.slice(0, 4).map((team, index) => (
                  <tr
                    key={team.teamId}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-4 text-slate-500">
                      {index + 1}
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {team.teamName}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {team.played}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {team.won}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {team.drawn}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {team.lost}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {team.goalDifference > 0
                        ? `+${team.goalDifference}`
                        : team.goalDifference}
                    </td>

                    <td className="px-4 py-4 text-center font-bold">
                      {team.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= TOP SCORERS ================= */}

        <section className="mt-10 pb-12">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">
                STATISTICS
              </p>

              <h2 className="text-2xl font-bold">
                Top Scorers
              </h2>
            </div>

            <Link
              href="/stats"
              className="text-sm text-slate-500 hover:text-white"
            >
              More stats →
            </Link>
          </div>

          {topScorers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topScorers.map((player, index) => (
                <Link
                  key={player.playerId}
                  href={`/players/${player.playerId}`}
                  className="group"
                >
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition group-hover:border-slate-600 group-hover:bg-slate-800/70">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-bold">
                        {index + 1}
                      </div>

                      <span className="text-2xl">
                        ⚽
                      </span>
                    </div>

                    <h3 className="font-bold">
                      {player.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {player.teamName}
                    </p>

                    <div className="mt-4 flex items-end gap-2">
                      <span className="text-3xl font-black">
                        {player.goals}
                      </span>

                      <span className="pb-1 text-sm text-slate-500">
                        goals
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No goals recorded yet.
            </div>
          )}
        </section>
      </div>

      {/* FOOTER */}

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-5 py-6 text-center text-sm text-slate-500">
          Campus Football League © 2026
        </div>
      </footer>
    </main>
  );
}