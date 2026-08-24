"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

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

type PlayerLeaderboard = {
  id: number;
  name: string;
  teamName: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

type TeamLeaderboard = {
  id: number;
  name: string;
  possession: number | null;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  saves: number;
  goals: number;
};

type Props = {
  teams: Team[];
  players: Player[];
  matches: Match[];
  initialPlayerStats: PlayerMatchStat[];
  initialTeamStats: TeamMatchStat[];
  initialLineups: MatchLineup[];
  initialEvents: MatchEvent[];
};

function getCurrentElapsedSeconds(match: Match) {
  let seconds = Math.max(0, Number(match.elapsed_seconds ?? 0));

  const running =
    match.status === "live" &&
    (match.match_period === "first_half" ||
      match.match_period === "second_half") &&
    !!match.current_half_started_at;

  if (running) {
    seconds += Math.max(
      0,
      Math.floor(
        (Date.now() -
          new Date(match.current_half_started_at!).getTime()) /
          1000
      )
    );
  }

  return seconds;
}

function calculateMatchMinutes(
  match: Match,
  lineupRows: MatchLineup[],
  eventRows: MatchEvent[]
) {
  const currentMinute = getCurrentElapsedSeconds(match) / 60;
  const minutes = new Map<number, number>();

  for (const lineup of lineupRows) {
    if (lineup.match_id !== match.id) continue;

    const startingXI = Array.isArray(lineup.starting_xi)
      ? lineup.starting_xi.map(Number).filter((id) => id > 0)
      : [];

    const active = new Map<number, number>();

    for (const playerId of startingXI) {
      active.set(playerId, 0);
      if (!minutes.has(playerId)) minutes.set(playerId, 0);
    }

    const substitutions = eventRows
      .filter(
        (event) =>
          event.match_id === match.id &&
          event.team_id === lineup.team_id &&
          event.event_type === "substitution" &&
          event.player_in_id &&
          event.player_out_id
      )
      .slice()
      .sort((a, b) => (a.minute - b.minute) || (a.id - b.id));

    for (const event of substitutions) {
      const eventMinute = Math.min(
        currentMinute,
        Math.max(
          0,
          Number(event.minute ?? 0) +
            Number(event.added_time ?? 0)
        )
      );

      const outId = Number(event.player_out_id);
      const inId = Number(event.player_in_id);

      if (active.has(outId)) {
        const startedAt = active.get(outId) ?? eventMinute;
        const played = Math.max(0, eventMinute - startedAt);

        minutes.set(
          outId,
          Math.floor((minutes.get(outId) ?? 0) + played)
        );

        active.delete(outId);
      }

      if (inId > 0) {
        active.set(inId, eventMinute);
        if (!minutes.has(inId)) minutes.set(inId, 0);
      }
    }

    for (const [playerId, startedAt] of active) {
      const played = Math.max(0, currentMinute - startedAt);
      minutes.set(
        playerId,
        Math.floor((minutes.get(playerId) ?? 0) + played)
      );
    }
  }

  return minutes;
}

export default function StatsRealtime({
  teams,
  players,
  matches: initialMatches,
  initialPlayerStats,
  initialTeamStats,
  initialLineups,
  initialEvents,
}: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [playerStats, setPlayerStats] =
    useState<PlayerMatchStat[]>(initialPlayerStats);
  const [teamStats, setTeamStats] =
    useState<TeamMatchStat[]>(initialTeamStats);
  const [lineups, setLineups] =
    useState<MatchLineup[]>(initialLineups);
  const [events, setEvents] =
    useState<MatchEvent[]>(initialEvents);

  const [clockTick, setClockTick] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase.channel("league-stats-live");

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as { id?: number };
          if (deleted.id !== undefined) {
            setMatches((current) =>
              current.filter((match) => match.id !== deleted.id)
            );
          }
          return;
        }

        const updated = payload.new as Match;
        setMatches((current) => {
          const exists = current.some((match) => match.id === updated.id);
          return exists
            ? current.map((match) =>
                match.id === updated.id ? updated : match
              )
            : [...current, updated];
        });
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_match_stats" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as {
            match_id?: number;
            player_id?: number;
          };

          if (
            deleted.match_id === undefined ||
            deleted.player_id === undefined
          ) {
            return;
          }

          setPlayerStats((current) =>
            current.filter(
              (stat) =>
                !(
                  stat.match_id === deleted.match_id &&
                  stat.player_id === deleted.player_id
                )
            )
          );
          return;
        }

        const updated = payload.new as PlayerMatchStat;
        setPlayerStats((current) => {
          const exists = current.some(
            (stat) =>
              stat.match_id === updated.match_id &&
              stat.player_id === updated.player_id
          );

          return exists
            ? current.map((stat) =>
                stat.match_id === updated.match_id &&
                stat.player_id === updated.player_id
                  ? updated
                  : stat
              )
            : [...current, updated];
        });
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_events" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as { id?: number };
          if (deleted.id !== undefined) {
            setEvents((current) =>
              current.filter((event) => event.id !== deleted.id)
            );
          }
          return;
        }

        const updated = payload.new as MatchEvent;
        setEvents((current) => {
          const exists = current.some((event) => event.id === updated.id);
          return exists
            ? current.map((event) =>
                event.id === updated.id ? updated : event
              )
            : [...current, updated];
        });
      }
    );

    channel.subscribe((status) => {
      setConnectionStatus(status);
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Force a rerender every second while at least one match is live.
  // This does not write anything to the database; it only makes the
  // leaderboard's displayed minutes stay in sync with the live clock.
  void clockTick;

  const calculatedMinutesByPlayer = useMemo(() => {
    const totals = new Map<number, number>();

    for (const match of matches) {
      const matchMinutes = calculateMatchMinutes(
        match,
        lineups,
        events
      );

      for (const [playerId, minutes] of matchMinutes) {
        totals.set(
          playerId,
          (totals.get(playerId) ?? 0) + minutes
        );
      }
    }

    return totals;
  }, [matches, lineups, events, clockTick]);

  const playerLeaderboard: PlayerLeaderboard[] = players.map((player) => {
    const team = teams.find((item) => item.id === player.team_id);

    const statsForPlayer = playerStats.filter(
      (stat) => stat.player_id === player.id
    );

    // Use the timeline calculation when the player has a saved lineup
    // appearance. Fall back to stored player_match_stats for any older
    // historical match for which lineup/event data doesn't exist.
    const hasCalculatedAppearance = matches.some((match) => {
      if (match.status !== "completed" && match.status !== "live") {
        return false;
      }

      return lineups.some(
        (lineup) =>
          lineup.match_id === match.id &&
          lineup.starting_xi?.map(Number).includes(player.id)
      ) ||
        events.some(
          (event) =>
            event.match_id === match.id &&
            (event.player_in_id === player.id ||
              event.player_out_id === player.id)
        );
    });

    const calculatedMinutes = calculatedMinutesByPlayer.get(player.id) ?? 0;

    const storedMinutes = statsForPlayer.reduce(
      (sum, stat) => sum + Number(stat.minutes_played ?? 0),
      0
    );

    return {
      id: player.id,
      name: player.name,
      teamName: team?.name ?? "Unknown Team",
      minutes: hasCalculatedAppearance
        ? Math.max(calculatedMinutes, storedMinutes)
        : storedMinutes,
      goals: statsForPlayer.reduce(
        (sum, stat) => sum + Number(stat.goals ?? 0),
        0
      ),
      assists: statsForPlayer.reduce(
        (sum, stat) => sum + Number(stat.assists ?? 0),
        0
      ),
      yellowCards: statsForPlayer.reduce(
        (sum, stat) => sum + Number(stat.yellow_cards ?? 0),
        0
      ),
      redCards: statsForPlayer.reduce(
        (sum, stat) => sum + Number(stat.red_cards ?? 0),
        0
      ),
    };
  });

  const topScorers = [...playerLeaderboard]
    .filter((player) => player.goals > 0)
    .sort((a, b) => (b.goals - a.goals) || a.name.localeCompare(b.name))
    .slice(0, 10);

  const topAssists = [...playerLeaderboard]
    .filter((player) => player.assists > 0)
    .sort((a, b) => (b.assists - a.assists) || a.name.localeCompare(b.name))
    .slice(0, 10);

  const mostMinutes = [...playerLeaderboard]
    .filter((player) => player.minutes > 0)
    .sort((a, b) => (b.minutes - a.minutes) || a.name.localeCompare(b.name))
    .slice(0, 10);

  const mostCards = [...playerLeaderboard]
    .filter(
      (player) => player.yellowCards > 0 || player.redCards > 0
    )
    .sort((a, b) => {
      const totalA = a.yellowCards + a.redCards;
      const totalB = b.yellowCards + b.redCards;
      return (totalB - totalA) || a.name.localeCompare(b.name);
    })
    .slice(0, 10);

  const completedMatches = matches.filter(
    (match) => match.status === "completed"
  );

  const teamLeaderboard: TeamLeaderboard[] = teams.map((team) => {
    const statsForTeam = teamStats.filter(
      (stat) => stat.team_id === team.id
    );

    const possessionValues = statsForTeam
      .filter((stat) => stat.possession !== null)
      .map((stat) => Number(stat.possession));

    const averagePossession =
      possessionValues.length > 0
        ? possessionValues.reduce((sum, value) => sum + value, 0) /
          possessionValues.length
        : null;

    const goals = completedMatches.reduce((sum, match) => {
      if (match.home_team_id === team.id) return sum + match.home_score;
      if (match.away_team_id === team.id) return sum + match.away_score;
      return sum;
    }, 0);

    return {
      id: team.id,
      name: team.name,
      possession: averagePossession,
      shots: statsForTeam.reduce((sum, stat) => sum + stat.shots, 0),
      shotsOnTarget: statsForTeam.reduce(
        (sum, stat) => sum + stat.shots_on_target,
        0
      ),
      corners: statsForTeam.reduce((sum, stat) => sum + stat.corners, 0),
      saves: statsForTeam.reduce((sum, stat) => sum + stat.saves, 0),
      goals,
    };
  });

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
          ? "Live statistics connected"
          : `Realtime: ${connectionStatus}`}
      </div>

      <section>
        <div className="mb-4">
          <p className="text-sm text-emerald-400">PLAYERS</p>
          <h2 className="text-2xl font-bold">Top Scorers</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {topScorers.length > 0 ? (
            topScorers.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-5 ${
                  index !== topScorers.length - 1
                    ? "border-b border-slate-800"
                    : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {player.teamName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{player.goals}</p>
                  <p className="text-xs text-slate-500">GOALS</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              No player goals recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">PLAYERS</p>
          <h2 className="text-2xl font-bold">Top Assists</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {topAssists.length > 0 ? (
            topAssists.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-5 ${
                  index !== topAssists.length - 1
                    ? "border-b border-slate-800"
                    : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {player.teamName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{player.assists}</p>
                  <p className="text-xs text-slate-500">ASSISTS</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              No assists recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">PLAYERS</p>
          <h2 className="text-2xl font-bold">Most Minutes</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {mostMinutes.length > 0 ? (
            mostMinutes.map((player) => (
              <div
                key={player.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {player.teamName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{player.minutes}</p>
                    <p className="text-xs text-slate-500">MINUTES</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500 md:col-span-2">
              No minutes recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">DISCIPLINE</p>
          <h2 className="text-2xl font-bold">Player Cards</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {mostCards.length > 0 ? (
            mostCards.map((player) => (
              <div
                key={player.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {player.teamName}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>🟨 {player.yellowCards}</span>
                    <span>🟥 {player.redCards}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-500 md:col-span-2">
              No cards recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-10 pb-10">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">TEAMS</p>
          <h2 className="text-2xl font-bold">Team Statistics</h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[850px]">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4 text-left">Team</th>
                <th className="px-5 py-4 text-center">Avg. Possession</th>
                <th className="px-5 py-4 text-center">Shots</th>
                <th className="px-5 py-4 text-center">Shots on Target</th>
                <th className="px-5 py-4 text-center">Corners</th>
                <th className="px-5 py-4 text-center">Saves</th>
                <th className="px-5 py-4 text-center">Goals</th>
              </tr>
            </thead>
            <tbody>
              {teamLeaderboard.map((team) => (
                <tr
                  key={team.id}
                  className="border-b border-slate-800 last:border-0"
                >
                  <td className="px-5 py-5 font-semibold">{team.name}</td>
                  <td className="px-5 py-5 text-center">
                    {team.possession !== null
                      ? `${team.possession.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-5 text-center">{team.shots}</td>
                  <td className="px-5 py-5 text-center">{team.shotsOnTarget}</td>
                  <td className="px-5 py-5 text-center">{team.corners}</td>
                  <td className="px-5 py-5 text-center">{team.saves}</td>
                  <td className="px-5 py-5 text-center font-bold">{team.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
