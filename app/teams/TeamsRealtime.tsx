"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

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

type TeamSummary = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  possession: number | null;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  saves: number;
};

type Props = {
  initialTeams: Team[];
  initialMatches: Match[];
  initialTeamStats: TeamMatchStat[];
};

function calculateTeamSummary(
  teamId: number,
  matches: Match[],
  stats: TeamMatchStat[]
): TeamSummary {
  const completedMatches = matches.filter(
    (match) =>
      match.status === "completed" &&
      (match.home_team_id === teamId ||
        match.away_team_id === teamId)
  );

  let played = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;

  for (const match of completedMatches) {
    const isHome = match.home_team_id === teamId;
    const gf = isHome ? match.home_score : match.away_score;
    const ga = isHome ? match.away_score : match.home_score;

    played += 1;
    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > ga) {
      won += 1;
      points += 3;
    } else if (gf === ga) {
      drawn += 1;
      points += 1;
    } else {
      lost += 1;
    }
  }

  const teamMatchStats = stats.filter(
    (stat) => stat.team_id === teamId
  );

  const possessionValues = teamMatchStats
    .filter((stat) => stat.possession !== null)
    .map((stat) => Number(stat.possession));

  const possession =
    possessionValues.length > 0
      ? possessionValues.reduce((sum, value) => sum + value, 0) /
        possessionValues.length
      : null;

  return {
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    possession,
    shots: teamMatchStats.reduce(
      (sum, stat) => sum + Number(stat.shots ?? 0),
      0
    ),
    shotsOnTarget: teamMatchStats.reduce(
      (sum, stat) => sum + Number(stat.shots_on_target ?? 0),
      0
    ),
    corners: teamMatchStats.reduce(
      (sum, stat) => sum + Number(stat.corners ?? 0),
      0
    ),
    saves: teamMatchStats.reduce(
      (sum, stat) => sum + Number(stat.saves ?? 0),
      0
    ),
  };
}

export default function TeamsRealtime({
  initialTeams,
  initialMatches,
  initialTeamStats,
}: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [teamStats, setTeamStats] =
    useState<TeamMatchStat[]>(initialTeamStats);

  const [connectionStatus, setConnectionStatus] =
    useState("CONNECTING");

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("teams-page-live")

      // MATCHES
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: number };

            if (deleted.id !== undefined) {
              setMatches((current) =>
                current.filter(
                  (match) => match.id !== deleted.id
                )
              );
            }

            return;
          }

          const updated = payload.new as Match;

          setMatches((current) => {
            const exists = current.some(
              (match) => match.id === updated.id
            );

            if (!exists) {
              return [...current, updated];
            }

            return current.map((match) =>
              match.id === updated.id
                ? updated
                : match
            );
          });
        }
      )

      // TEAM MATCH STATS
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_match_stats",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as {
              id?: number;
            };

            if (deleted.id !== undefined) {
              setTeamStats((current) =>
                current.filter(
                  (stat) => stat.id !== deleted.id
                )
              );
            }

            return;
          }

          const updated =
            payload.new as TeamMatchStat;

          setTeamStats((current) => {
            const exists = current.some(
              (stat) => stat.id === updated.id
            );

            if (!exists) {
              return [...current, updated];
            }

            return current.map((stat) =>
              stat.id === updated.id
                ? updated
                : stat
            );
          });
        }
      )

      // TEAMS
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as {
              id?: number;
            };

            if (deleted.id !== undefined) {
              setTeams((current) =>
                current.filter(
                  (team) => team.id !== deleted.id
                )
              );
            }

            return;
          }

          const updated = payload.new as Team;

          setTeams((current) => {
            const exists = current.some(
              (team) => team.id === updated.id
            );

            if (!exists) {
              return [...current, updated].sort(
                (a, b) => a.id - b.id
              );
            }

            return current.map((team) =>
              team.id === updated.id
                ? updated
                : team
            );
          });
        }
      )

      .subscribe((status) => {
        setConnectionStatus(status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <>
      <div className="mb-5 flex items-center justify-end gap-2 text-xs text-slate-500">
        <span
          className={`h-2 w-2 rounded-full ${
            connectionStatus === "SUBSCRIBED"
              ? "bg-emerald-400"
              : "bg-yellow-400"
          }`}
        />

        {connectionStatus === "SUBSCRIBED"
          ? "Live team statistics connected"
          : `Realtime: ${connectionStatus}`}
      </div>

      {teams.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {teams.map((team) => {
            const summary =
              calculateTeamSummary(
                team.id,
                matches,
                teamStats
              );

            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="group"
              >
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-3xl">
                        {team.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          "⚽"
                        )}
                      </div>

                      <div>
                        <h2 className="text-xl font-bold">
                          {team.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {team.short_name}
                        </p>
                      </div>
                    </div>

                    <span className="text-slate-500 transition group-hover:text-white">
                      →
                    </span>
                  </div>

                  {team.description && (
                    <p className="mt-5 border-t border-slate-800 pt-4 text-sm leading-6 text-slate-400">
                      {team.description}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-4 gap-2">
                    <Stat label="P" value={summary.played} />
                    <Stat label="W" value={summary.won} />
                    <Stat label="D" value={summary.drawn} />
                    <Stat label="L" value={summary.lost} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Stat
                      label="GF"
                      value={summary.goalsFor}
                    />
                    <Stat
                      label="GA"
                      value={summary.goalsAgainst}
                    />
                    <Stat
                      label="GD"
                      value={summary.goalDifference}
                    />
                    <Stat
                      label="PTS"
                      value={summary.points}
                      highlight
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-slate-800 pt-5 text-sm">
                    <Detail
                      label="Possession"
                      value={
                        summary.possession !== null
                          ? `${summary.possession.toFixed(1)}%`
                          : "—"
                      }
                    />

                    <Detail
                      label="Shots"
                      value={summary.shots}
                    />

                    <Detail
                      label="On Target"
                      value={
                        summary.shotsOnTarget
                      }
                    />

                    <Detail
                      label="Corners"
                      value={summary.corners}
                    />

                    <Detail
                      label="Saves"
                      value={summary.saves}
                    />

                    <Detail
                      label="Points"
                      value={summary.points}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-400">
            No teams found.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-950/70 px-2 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-black ${
          highlight
            ? "text-emerald-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">
        {label}
      </span>
      <span className="font-semibold text-slate-200">
        {value}
      </span>
    </div>
  );
}
