export const instant = false;

import RealtimeRefresh from "../components/RealtimeRefresh";
import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
import { createClient } from "@/lib/supabase/server";
import LiveMatchListClock from "./LiveMatchListClock";

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;

  match_period: string | null;
  half_duration_minutes: number;
  elapsed_seconds: number;
  current_half_started_at:
    | string
    | null;
  added_time_minutes: number;
  added_time_started: boolean;

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

export default async function MatchesPage() {
  const supabase = await createClient();

  // ==================================================
  // GET MATCHES
  // ==================================================

  const {
    data: matches,
    error: matchesError,
  } = await supabase
    .from("matches")
    .select(
      `
      id,
      match_date,
      venue,
      status,

      match_period,
      half_duration_minutes,
      elapsed_seconds,
      current_half_started_at,
      added_time_minutes,
      added_time_started,

      home_score,
      away_score,
      home_team_id,
      away_team_id
      `
    )
    .order("match_date", {
      ascending: true,
    });

  if (matchesError) {
    console.error(
      "Matches error:",
      matchesError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load matches
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading matches from the
          database.
        </p>

        <p className="mt-3 text-sm text-slate-500">
          Check the terminal for the database error.
        </p>
      </main>
    );
  }

  // ==================================================
  // GET TEAMS
  // ==================================================

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

  if (teamsError) {
    console.error(
      "Teams error:",
      teamsError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load teams
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading team information.
        </p>
      </main>
    );
  }

  const typedMatches =
    (matches ?? []) as Match[];

  const typedTeams =
    (teams ?? []) as Team[];

  // ==================================================
  // ADD TEAM NAMES
  // ==================================================

  const matchesWithTeams =
    typedMatches.map(
      (match) => {
        const homeTeam =
          typedTeams.find(
            (team) =>
              team.id ===
              match.home_team_id
          );

        const awayTeam =
          typedTeams.find(
            (team) =>
              team.id ===
              match.away_team_id
          );

        return {
          ...match,
          homeTeamName:
            homeTeam?.name ??
            "Unknown Team",
          awayTeamName:
            awayTeam?.name ??
            "Unknown Team",
        };
      }
    );

  // ==================================================
  // GROUP MATCHES
  // ==================================================

  const liveMatches =
    matchesWithTeams.filter(
      (match) =>
        match.status ===
        "live"
    );

  const upcomingMatches =
    matchesWithTeams.filter(
      (match) =>
        match.status ===
        "scheduled"
    );

  const completedMatches =
    matchesWithTeams.filter(
      (match) =>
        match.status ===
        "completed"
    );

  // ==================================================
  // HELPERS
  // ==================================================

  function formatMatchDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatMatchTime(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleTimeString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ==================================================
          REALTIME REFRESH
          ================================================== */}

      <RealtimeRefresh />

      {/* ==================================================
          NAVBAR
          ================================================== */}

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
              className="text-white"
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

          <MobileNav currentPath="/matches" />
        </div>
      </nav>

      {/* ==================================================
          CONTENT
          ================================================== */}

      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* HEADER */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Campus Football League
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Matches
          </h1>

          <p className="mt-3 text-slate-400">
            Live matches, upcoming fixtures and completed
            results.
          </p>
        </div>

        {/* ==================================================
            LIVE MATCHES
            ================================================== */}

        {liveMatches.length >
          0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />

              <h2 className="text-2xl font-bold">
                Live Now
              </h2>
            </div>

            <div className="space-y-4">
              {liveMatches.map(
                (match) => (
                  <Link
                    key={
                      match.id
                    }
                    href={`/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 to-slate-900 p-6 transition hover:border-emerald-400/60">
                      <div className="mb-5 flex items-center justify-between">
                        <span className="text-sm font-semibold text-red-400">
                          🔴 LIVE
                        </span>

                        <span className="text-sm text-slate-500">
                          {formatMatchTime(
                            match.match_date
                          )}
                        </span>
                      </div>

                      {/* TEAMS + SCORE */}

                      <div className="grid gap-5 text-center md:grid-cols-3 md:items-center">
                        {/* HOME */}

                        <div>
                          <h3 className="text-xl font-bold">
                            {
                              match.homeTeamName
                            }
                          </h3>
                        </div>

                        {/* SCORE */}

                        <div>
                          <div className="text-5xl font-black">
                            {
                              match.home_score
                            }

                            <span className="mx-3 text-slate-500">
                              -
                            </span>

                            {
                              match.away_score
                            }
                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            {match.venue ??
                              "Venue not specified"}
                          </p>

                          {/* LIVE CLOCK */}

                          <LiveMatchListClock
                            status={
                              match.status
                            }
                            matchPeriod={
                              match.match_period
                            }
                            halfDurationMinutes={
                              match.half_duration_minutes
                            }
                            elapsedSeconds={
                              match.elapsed_seconds
                            }
                            currentHalfStartedAt={
                              match.current_half_started_at
                            }
                          />

                          {match.added_time_started && (
                            <p className="mt-1 text-xs text-slate-500">
                              Added time: +
                              {
                                match.added_time_minutes
                              }
                            </p>
                          )}
                        </div>

                        {/* AWAY */}

                        <div>
                          <h3 className="text-xl font-bold">
                            {
                              match.awayTeamName
                            }
                          </h3>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-emerald-900/60 pt-4 text-center text-sm text-emerald-400">
                        View Match Center →
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>
        )}

        {/* ==================================================
            UPCOMING MATCHES
            ================================================== */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              FIXTURES
            </p>

            <h2 className="text-2xl font-bold">
              Upcoming Matches
            </h2>
          </div>

          {upcomingMatches.length >
          0 ? (
            <div className="space-y-3">
              {upcomingMatches.map(
                (match) => (
                  <Link
                    key={
                      match.id
                    }
                    href={`/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800/70">
                      {/* DATE + VENUE */}

                      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {formatMatchDate(
                            match.match_date
                          )}
                        </span>

                        <span>
                          {match.venue ??
                            "Venue not specified"}
                        </span>
                      </div>

                      {/* TEAMS + KICK OFF / SCORE */}

                      <div className="grid items-center gap-4 md:grid-cols-3">
                        {/* HOME */}

                        <div className="font-semibold">
                          {
                            match.homeTeamName
                          }
                        </div>

                        {/* MIDDLE */}

                        <div className="text-center">
                          {match.home_score >
                            0 ||
                          match.away_score >
                            0 ? (
                            <>
                              <p className="text-xs text-slate-500">
                                SCORE
                              </p>

                              <p className="mt-1 text-2xl font-black">
                                {
                                  match.home_score
                                }

                                <span className="mx-2 text-slate-500">
                                  -
                                </span>

                                {
                                  match.away_score
                                }
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-slate-500">
                                KICK-OFF
                              </p>

                              <p className="mt-1 font-bold">
                                {formatMatchTime(
                                  match.match_date
                                )}
                              </p>
                            </>
                          )}
                        </div>

                        {/* AWAY */}

                        <div className="text-right font-semibold">
                          {
                            match.awayTeamName
                          }
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-800 pt-3 text-right text-xs text-slate-500">
                        View Match Details →
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No upcoming matches.
            </div>
          )}
        </section>

        {/* ==================================================
            COMPLETED MATCHES
            ================================================== */}

        <section className="pb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              RESULTS
            </p>

            <h2 className="text-2xl font-bold">
              Recent Results
            </h2>
          </div>

          {completedMatches.length >
          0 ? (
            <div className="space-y-3">
              {completedMatches.map(
                (match) => (
                  <Link
                    key={
                      match.id
                    }
                    href={`/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800/70">
                      {/* DATE */}

                      <div className="mb-4 text-xs text-slate-500">
                        {formatMatchDate(
                          match.match_date
                        )}
                      </div>

                      {/* TEAMS + SCORE */}

                      <div className="grid grid-cols-[1fr_auto] items-center gap-6">
                        <div className="space-y-3">
                          <p className="font-semibold">
                            {
                              match.homeTeamName
                            }
                          </p>

                          <p className="font-semibold">
                            {
                              match.awayTeamName
                            }
                          </p>
                        </div>

                        <div className="space-y-3 text-right text-lg font-black">
                          <p>
                            {
                              match.home_score
                            }
                          </p>

                          <p>
                            {
                              match.away_score
                            }
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-800 pt-3 text-right text-xs text-slate-500">
                        View Match Details →
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No completed matches yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}