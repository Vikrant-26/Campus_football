"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createBrowserClient } from "@supabase/ssr";
import MatchClock from "./MatchClock";

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;

  match_period: string | null;
  previous_match_period: string | null;

  half_duration_minutes: number;
  elapsed_seconds: number;

  first_half_started_at:
    | string
    | null;

  second_half_started_at:
    | string
    | null;

  current_half_started_at:
    | string
    | null;

  paused_at:
    | string
    | null;

  added_time_minutes: number;
  added_time_started: boolean;

  result_type:
    | string
    | null;

  cancellation_reason:
    | string
    | null;

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
  jersey_number?: number | null;
  position?: string;
  team_id?: number;
};

type MatchEvent = {
  id: number;
  match_id: number;
  team_id: number;

  player_id: number | null;
  assist_player_id:
    | number
    | null;

  player_in_id:
    | number
    | null;

  player_out_id:
    | number
    | null;

  event_type: string;
  minute: number;
  added_time: number | null;

  description:
    | string
    | null;
};

type TeamMatchStat = {
  id: number;
  match_id: number;
  team_id: number;

  possession:
    | number
    | null;

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

type Props = {
  initialMatch: Match;
  initialEvents: MatchEvent[];
  initialStats: TeamMatchStat[];
  initialPlayerStats: PlayerMatchStat[];
  teams: Team[];
  players: Player[];
};

export default function LiveMatch({
  initialMatch,
  initialEvents,
  initialStats,
  initialPlayerStats,
  teams,
  players,
}: Props) {
  const [match, setMatch] =
    useState<Match>(
      initialMatch
    );

  const [events, setEvents] =
    useState<MatchEvent[]>(
      initialEvents
    );

  const [stats, setStats] =
    useState<TeamMatchStat[]>(
      initialStats
    );

  const [playerStats, setPlayerStats] =
    useState<PlayerMatchStat[]>(
      initialPlayerStats
    );

  const [lineups, setLineups] =
    useState<MatchLineup[]>([]);

  const [squadPlayers, setSquadPlayers] =
    useState<Player[]>(
      players
    );

  const [lineupsLoading, setLineupsLoading] =
    useState(true);

  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState("CONNECTING");

  // ==================================================
  // SUPABASE BROWSER CLIENT
  // ==================================================

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      ),
    []
  );

  // ==================================================
  // REALTIME SUBSCRIPTIONS
  // ==================================================

  useEffect(() => {
    const channel =
      supabase.channel(
        `match-center-${match.id}`
      );

    // -----------------------------------------------
    // MATCH
    // -----------------------------------------------

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `id=eq.${match.id}`,
      },
      (payload) => {
        console.log(
          "[Realtime] Match update:",
          payload
        );

        if (
          payload.eventType ===
          "DELETE"
        ) {
          return;
        }

        setMatch(
          payload.new as Match
        );
      }
    );

    // -----------------------------------------------
    // EVENTS
    // -----------------------------------------------

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "match_events",
        filter: `match_id=eq.${match.id}`,
      },
      (payload) => {
        // INSERT
        if (
          payload.eventType ===
          "INSERT"
        ) {
          const newEvent =
            payload.new as MatchEvent;

          setEvents(
            (current) => {
              if (
                current.some(
                  (event) =>
                    event.id ===
                    newEvent.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                newEvent,
              ].sort(
                (a, b) => {
                  if (
                    a.minute !==
                    b.minute
                  ) {
                    return (
                      a.minute -
                      b.minute
                    );
                  }

                  return (
                    a.id -
                    b.id
                  );
                }
              );
            }
          );
        }

        // UPDATE
        if (
          payload.eventType ===
          "UPDATE"
        ) {
          const updatedEvent =
            payload.new as MatchEvent;

          setEvents(
            (current) =>
              current
                .map(
                  (event) =>
                    event.id ===
                    updatedEvent.id
                      ? updatedEvent
                      : event
                )
                .sort(
                  (a, b) => {
                    if (
                      a.minute !==
                      b.minute
                    ) {
                      return (
                        a.minute -
                        b.minute
                      );
                    }

                    return (
                      a.id -
                      b.id
                    );
                  }
                )
          );
        }

        // DELETE
        if (
          payload.eventType ===
          "DELETE"
        ) {
          const deleted =
            payload.old as {
              id?: number;
            };

          if (
            deleted.id !==
            undefined
          ) {
            setEvents(
              (current) =>
                current.filter(
                  (event) =>
                    event.id !==
                    deleted.id
                )
            );
          }
        }
      }
    );

    // -----------------------------------------------
    // TEAM MATCH STATS
    // -----------------------------------------------

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "team_match_stats",
        filter: `match_id=eq.${match.id}`,
      },
      (payload) => {
        // INSERT
        if (
          payload.eventType ===
          "INSERT"
        ) {
          const newStat =
            payload.new as TeamMatchStat;

          setStats(
            (current) => {
              const index =
                current.findIndex(
                  (stat) =>
                    stat.id ===
                    newStat.id
                );

              if (index >= 0) {
                const copy = [
                  ...current,
                ];

                copy[index] =
                  newStat;

                return copy;
              }

              return [
                ...current,
                newStat,
              ];
            }
          );
        }

        // UPDATE
        if (
          payload.eventType ===
          "UPDATE"
        ) {
          const updatedStat =
            payload.new as TeamMatchStat;

          setStats(
            (current) =>
              current.map(
                (stat) =>
                  stat.id ===
                  updatedStat.id
                    ? updatedStat
                    : stat
              )
          );
        }

        // DELETE
        if (
          payload.eventType ===
          "DELETE"
        ) {
          const deleted =
            payload.old as {
              id?: number;
            };

          if (
            deleted.id !==
            undefined
          ) {
            setStats(
              (current) =>
                current.filter(
                  (stat) =>
                    stat.id !==
                    deleted.id
                )
            );
          }
        }
      }
    );

    // -----------------------------------------------
    // PLAYER MATCH STATS
    // -----------------------------------------------

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "player_match_stats",
        filter: `match_id=eq.${match.id}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const newStat = payload.new as PlayerMatchStat;
          setPlayerStats((current) => {
            const index = current.findIndex((stat) => stat.id === newStat.id);
            if (index >= 0) {
              const copy = [...current];
              copy[index] = newStat;
              return copy;
            }
            return [...current, newStat];
          });
        }

        if (payload.eventType === "UPDATE") {
          const updatedStat = payload.new as PlayerMatchStat;
          setPlayerStats((current) =>
            current.map((stat) =>
              stat.id === updatedStat.id ? updatedStat : stat
            )
          );
        }

        if (payload.eventType === "DELETE") {
          const deleted = payload.old as { id?: number };
          if (deleted.id !== undefined) {
            setPlayerStats((current) =>
              current.filter((stat) => stat.id !== deleted.id)
            );
          }
        }
      }
    );

    // -----------------------------------------------
    // FULL MATCH SQUADS
    // -----------------------------------------------

    const loadSquads = async () => {
      const { data, error } =
        await supabase
          .from("players")
          .select(
            "id, name, jersey_number, position, team_id"
          )
          .in(
            "team_id",
            [
              match.home_team_id,
              match.away_team_id,
            ]
          )
          .order("name");

      if (error) {
        console.error(
          "[Realtime] Squad load error:",
          error
        );

        return;
      }

      setSquadPlayers(
        (data ?? []) as Player[]
      );
    };

    void loadSquads();

    // -----------------------------------------------
    // MATCH LINEUPS
    // -----------------------------------------------

    const loadLineups = async () => {
      setLineupsLoading(true);

      const { data, error } =
        await supabase
          .from("match_lineups")
          .select(
            "id, match_id, team_id, formation, starting_xi"
          )
          .eq(
            "match_id",
            match.id
          );

      if (error) {
        console.error(
          "[Realtime] Lineup load error:",
          error
        );
      } else {
        setLineups(
          (data ?? []) as MatchLineup[]
        );
      }

      setLineupsLoading(false);
    };

    void loadLineups();

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "match_lineups",
        filter: `match_id=eq.${match.id}`,
      },
      (payload) => {
        console.log(
          "[Realtime] Lineup update:",
          payload
        );

        if (
          payload.eventType ===
          "INSERT"
        ) {
          const lineup =
            payload.new as MatchLineup;

          setLineups(
            (current) => {
              const index =
                current.findIndex(
                  (item) =>
                    item.id ===
                    lineup.id
                );

              if (index >= 0) {
                const copy = [
                  ...current,
                ];

                copy[index] =
                  lineup;

                return copy;
              }

              return [
                ...current,
                lineup,
              ];
            }
          );
        }

        if (
          payload.eventType ===
          "UPDATE"
        ) {
          const lineup =
            payload.new as MatchLineup;

          setLineups(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  lineup.id
                    ? lineup
                    : item
              )
          );
        }

        if (
          payload.eventType ===
          "DELETE"
        ) {
          const deleted =
            payload.old as {
              id?: number;
            };

          if (
            deleted.id !==
            undefined
          ) {
            setLineups(
              (current) =>
                current.filter(
                  (item) =>
                    item.id !==
                    deleted.id
                )
            );
          }
        }
      }
    );

    // -----------------------------------------------
    // SUBSCRIBE
    // -----------------------------------------------

    channel.subscribe(
      (status) => {
        console.log(
          "[Realtime] Subscription:",
          status
        );

        setConnectionStatus(
          status
        );
      }
    );

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    match.id,
    match.home_team_id,
    match.away_team_id,
    supabase,
  ]);

  // ==================================================
  // HELPERS
  // ==================================================

  function getTeamName(
    teamId: number
  ) {
    return (
      teams.find(
        (team) =>
          team.id === teamId
      )?.name ??
      "Unknown Team"
    );
  }

  function getPlayerName(
    playerId: number | null
  ) {
    if (!playerId) {
      return "—";
    }

    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ??
      "Unknown Player"
    );
  }

  function getPlayer(
    playerId: number
  ) {
    return squadPlayers.find(
      (player) =>
        player.id === playerId
    );
  }

  function getPlayerStats(playerId: number) {
    return (
      playerStats.find(
        (stat) => stat.player_id === playerId
      ) ?? null
    );
  }

  function getLineup(
    teamId: number
  ) {
    return (
      lineups.find(
        (lineup) =>
          lineup.team_id ===
          teamId
      ) ?? null
    );
  }

  function getCurrentLineupPlayers(
    teamId: number
  ) {
    const lineup =
      getLineup(teamId);

    if (!lineup) {
      return [];
    }

    let currentPlayers =
      [...lineup.starting_xi];

    const teamSubstitutions =
      events.filter(
        (event) =>
          event.team_id ===
            teamId &&
          event.event_type ===
            "substitution" &&
          event.player_in_id &&
          event.player_out_id
      );

    for (
      const event of
      teamSubstitutions
    ) {
      const outId =
        event.player_out_id!;
      const inId =
        event.player_in_id!;

      const outIndex =
        currentPlayers.indexOf(
          outId
        );

      if (
        outIndex >= 0
      ) {
        currentPlayers[
          outIndex
        ] = inId;
      } else if (
        !currentPlayers.includes(
          inId
        )
      ) {
        currentPlayers.push(
          inId
        );
      }
    }

    return currentPlayers;
  }

  function getSubstitutePlayers(
    teamId: number
  ) {
    const currentLineup =
      getCurrentLineupPlayers(
        teamId
      );

    return squadPlayers.filter(
      (player) =>
        player.id !== undefined &&
        player.team_id === teamId &&
        !currentLineup.includes(
          player.id
        )
    );
  }

  function getOriginalStartingXI(
    teamId: number
  ) {
    return (
      getLineup(teamId)
        ?.starting_xi ?? []
    );
  }

  function wasSubstitutedOut(
    playerId: number,
    teamId: number
  ) {
    return events.some(
      (event) =>
        event.team_id === teamId &&
        event.event_type === "substitution" &&
        event.player_out_id === playerId
    );
  }

  function wasSubstitutedOn(
    playerId: number,
    teamId: number
  ) {
    return events.some(
      (event) =>
        event.team_id === teamId &&
        event.event_type === "substitution" &&
        event.player_in_id === playerId
    );
  }

  function RedFootballIcon() {
    return (
      <span
        title="Own goal"
        aria-label="Own goal"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[7px] font-black text-white shadow-sm ring-1 ring-red-300/50"
      >
        ⚽
      </span>
    );
  }

  function getPlayerEventBadges(
    playerId: number
  ) {
    const goalCount = events.filter(
      (event) =>
        (event.event_type === "goal" ||
          event.event_type === "penalty_goal") &&
        Number(event.player_id) === Number(playerId)
    ).length;

    const ownGoalCount = events.filter(
      (event) =>
        event.event_type === "own_goal" &&
        Number(event.player_id) === Number(playerId)
    ).length;

    const assistCount = events.filter(
      (event) =>
        event.event_type === "goal" &&
        Number(event.assist_player_id) === Number(playerId)
    ).length;

    const yellowCount = events.filter(
      (event) =>
        event.event_type === "yellow_card" &&
        Number(event.player_id) === Number(playerId)
    ).length;

    const redCount = events.filter(
      (event) =>
        event.event_type === "red_card" &&
        Number(event.player_id) === Number(playerId)
    ).length;

    return {
      goals: goalCount,
      ownGoals: ownGoalCount,
      assists: assistCount,
      yellowCards: yellowCount,
      redCards: redCount,
    };
  }

  function positionRank(position?: string) {
    const value = String(position ?? "").toLowerCase();

    if (
      value.includes("goalkeeper") ||
      value === "gk" ||
      value.includes("keeper")
    ) return 1;

    if (
      value.includes("defender") ||
      value.includes("defence") ||
      value.includes("defense") ||
      ["df", "cb", "lb", "rb", "lwb", "rwb"].includes(value)
    ) return 2;

    if (
      value.includes("midfielder") ||
      value.includes("midfield") ||
      ["mf", "cm", "dm", "am", "lm", "rm"].includes(value)
    ) return 3;

    if (
      value.includes("forward") ||
      value.includes("striker") ||
      value.includes("attacker") ||
      ["fw", "st", "lw", "rw"].includes(value)
    ) return 4;

    return 5;
  }

  function normaliseFormation(formation?: string | null) {
    const parts = String(formation ?? "")
      .replace(/\s/g, "")
      .split("-")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);

    return parts.length > 0 ? parts : [4, 3, 3];
  }

  function getFormationSlotLabels(formation?: string | null) {
    const rows = normaliseFormation(formation);
    const labels: string[] = ["GK"];

    rows.forEach((count, rowIndex) => {
      const isDefence = rowIndex === 0;
      const isAttack = rowIndex === rows.length - 1;

      if (isDefence) {
        if (count === 3) labels.push("LCB", "CB", "RCB");
        else if (count === 4) labels.push("LB", "LCB", "RCB", "RB");
        else if (count === 5) labels.push("LWB", "LCB", "CB", "RCB", "RWB");
        else labels.push(...Array.from({ length: count }, (_, i) => `DF${i + 1}`));
        return;
      }

      if (isAttack) {
        if (count === 1) labels.push("ST");
        else if (count === 2) labels.push("LW", "ST");
        else if (count === 3) labels.push("LW", "ST", "RW");
        else if (count === 4) labels.push("LW", "LF", "RF", "RW");
        else labels.push(...Array.from({ length: count }, (_, i) => `FW${i + 1}`));
        return;
      }

      if (count === 1) labels.push("CM");
      else if (count === 2) labels.push("LM", "RM");
      else if (count === 3) labels.push("LM", "CM", "RM");
      else if (count === 4) labels.push("LM", "LCM", "RCM", "RM");
      else if (count === 5) labels.push("LM", "LCM", "CM", "RCM", "RM");
      else labels.push(...Array.from({ length: count }, (_, i) => `MF${i + 1}`));
    });

    return labels.slice(0, 11);
  }

  function getMatchPosition(
    teamId: number,
    playerId: number
  ) {
    const lineup = getLineup(teamId);

    if (!lineup) {
      return getPlayer(playerId)?.position ?? "Player";
    }

    const originalXI = lineup.starting_xi.map(Number);
    const slotLabels = getFormationSlotLabels(lineup.formation);

    // Original starter: position comes directly from the formation slot.
    const originalIndex = originalXI.indexOf(Number(playerId));

    if (originalIndex >= 0) {
      return slotLabels[originalIndex] ?? "Player";
    }

    // Find the latest substitution where this player came ON.
    const incomingEvent = events
      .filter(
        (event) =>
          event.team_id === teamId &&
          event.event_type === "substitution" &&
          Number(event.player_in_id) === Number(playerId)
      )
      .sort(
        (a, b) =>
          (a.minute - b.minute) || (a.id - b.id)
      )
      .at(-1);

    if (!incomingEvent?.player_out_id) {
      return getPlayer(playerId)?.position ?? "Player";
    }

    const directOutId = Number(
      incomingEvent.player_out_id
    );

    // If the player directly replaced an original starter,
    // inherit that starter's formation slot.
    const directOutIndex = originalXI.indexOf(
      directOutId
    );

    if (directOutIndex >= 0) {
      return slotLabels[directOutIndex] ?? "Player";
    }

    // If this player replaced another substitute, trace the chain
    // backwards until we reach the original starter's slot.
    let tracedPlayerId = directOutId;
    const visited = new Set<number>();

    while (
      tracedPlayerId > 0 &&
      !visited.has(tracedPlayerId)
    ) {
      visited.add(tracedPlayerId);

      const starterIndex = originalXI.indexOf(
        tracedPlayerId
      );

      if (starterIndex >= 0) {
        return (
          slotLabels[starterIndex] ?? "Player"
        );
      }

      const previousIncomingEvent = events
        .filter(
          (event) =>
            event.team_id === teamId &&
            event.event_type === "substitution" &&
            Number(event.player_in_id) === tracedPlayerId
        )
        .sort(
          (a, b) =>
            (a.minute - b.minute) || (a.id - b.id)
        )
        .at(-1);

      if (!previousIncomingEvent?.player_out_id) {
        break;
      }

      tracedPlayerId = Number(
        previousIncomingEvent.player_out_id
      );
    }

    return getPlayer(playerId)?.position ?? "Player";
  }

  function getMatchPositionRank(position?: string) {
    return positionRank(position);
  }

  function sortPlayersByMatchPosition(
    playerIds: number[],
    teamId: number
  ) {
    return playerIds
      .map((id, index) => ({
        id: Number(id),
        index,
        position: getMatchPosition(teamId, Number(id)),
        player: getPlayer(Number(id)),
      }))
      .filter((item) => item.player)
      .sort((a, b) => {
        const rankA = getMatchPositionRank(a.position);
        const rankB = getMatchPositionRank(b.position);
        if (rankA !== rankB) return rankA - rankB;

        return a.index - b.index;
      })
      .map((item) => item.id);
  }

  function eventIcon(
    eventType: string
  ) {
    switch (eventType) {
      case "goal":
      case "penalty_goal":
      case "own_goal":
        return "⚽";

      case "yellow_card":
        return "🟨";

      case "red_card":
        return "🟥";

      case "substitution":
        return "🔄";

      case "added_time":
      case "match_started":
      case "halftime":
      case "second_half_start":
      case "full_time":
        return "⏱️";

      default:
        return "•";
    }
  }

  function eventLabel(
    eventType: string
  ) {
    switch (eventType) {
      case "goal":
        return "Goal";

      case "penalty_goal":
        return "Penalty Goal";

      case "own_goal":
        return "Own Goal";

      case "yellow_card":
        return "Yellow Card";

      case "red_card":
        return "Red Card";

      case "substitution":
        return "Substitution";

      case "added_time":
        return "Added Time";

      case "match_started":
        return "Match Started";

      case "halftime":
        return "Half Time";

      case "second_half_start":
        return "Second Half Started";

      case "full_time":
        return "Full Time";

      default:
        return "Match Event";
    }
  }

  const homeStats =
    stats.find(
      (stat) =>
        stat.team_id ===
        match.home_team_id
    );

  const awayStats =
    stats.find(
      (stat) =>
        stat.team_id ===
        match.away_team_id
    );

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <>
      {/* =================================================
          REALTIME STATUS
          ================================================= */}

      <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span
          className={`h-2 w-2 rounded-full ${
            connectionStatus ===
            "SUBSCRIBED"
              ? "bg-emerald-400"
              : "bg-yellow-400"
          }`}
        />

        {connectionStatus ===
        "SUBSCRIBED"
          ? "Live updates connected"
          : connectionStatus}
      </div>

      {/* =================================================
          STATUS MESSAGES
          ================================================= */}

      {match.status ===
        "live" &&
        match.match_period ===
          "paused" && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
            <p className="font-semibold text-yellow-400">
              ⏸ Match Paused
            </p>
          </div>
        )}

      {match.status ===
        "live" &&
        match.match_period ===
          "halftime" && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
            <p className="font-semibold text-yellow-400">
              ⏱ Half Time
            </p>
          </div>
        )}

      {match.status ===
        "cancelled" && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
          <p className="font-semibold text-yellow-400">
            ⚠ Match Cancelled
          </p>

          {match.cancellation_reason && (
            <p className="mt-2 text-sm text-slate-500">
              {
                match.cancellation_reason
              }
            </p>
          )}
        </div>
      )}

      {/* =================================================
          SCORE
          ================================================= */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="grid gap-8 text-center md:grid-cols-3 md:items-center">
          {/* HOME */}

          <div>
            <p className="text-2xl font-black">
              {getTeamName(
                match.home_team_id
              )}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Home
            </p>
          </div>

          {/* SCORE */}

          <div>
            <p className="text-6xl font-black">
              {match.home_score}

              <span className="mx-4 text-slate-600">
                -
              </span>

              {match.away_score}
            </p>

            <p className="mt-3 text-sm text-slate-500">
              {match.venue ??
                "Venue not specified"}
            </p>
          </div>

          {/* AWAY */}

          <div>
            <p className="text-2xl font-black">
              {getTeamName(
                match.away_team_id
              )}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Away
            </p>
          </div>
        </div>
      </section>

      {/* =================================================
          CLOCK — BELOW SCORE
          ================================================= */}

      <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <MatchClock
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
          addedTimeMinutes={
            match.added_time_minutes
          }
          addedTimeStarted={
            match.added_time_started
          }
        />
      </section>

      {/* =================================================
          MATCH EVENTS
          ================================================= */}

      <section className="mt-8 pb-10">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">
            MATCH
          </p>

          <h2 className="text-2xl font-bold">
            Match Events
          </h2>
        </div>

        {events.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {events
              .map((event) => (
                <div
                  key={event.id}
                  className="border-b border-slate-800 p-5 last:border-0"
                >
                  <div className="flex items-start gap-4">
                    {/* MINUTE */}

                    <div className="w-14 text-sm font-bold text-slate-500">
                      {event.minute}

                      {event.added_time
                        ? `+${event.added_time}`
                        : ""}
                      &apos;
                    </div>

                    {/* ICON */}

                    <div className="text-2xl">
                      {eventIcon(
                        event.event_type
                      )}
                    </div>

                    {/* CONTENT */}

                    <div>
                      <p className="font-semibold">
                        {eventLabel(
                          event.event_type
                        )}
                      </p>

                      {event.event_type !== "added_time" && (
                        <p className="mt-1 text-sm text-slate-500">
                          {getTeamName(
                            event.team_id
                          )}
                        </p>
                      )}

                      {/* PLAYER */}

                      {event.player_id && (
                        <p className="mt-1 text-sm text-slate-300">
                          Player:{" "}
                          {getPlayerName(
                            event.player_id
                          )}
                        </p>
                      )}

                      {/* ASSIST */}

                      {event.assist_player_id && (
                        <p className="mt-1 text-sm text-slate-500">
                          Assist:{" "}
                          {getPlayerName(
                            event.assist_player_id
                          )}
                        </p>
                      )}

                      {/* SUBSTITUTION */}

                      {event.event_type ===
                        "substitution" && (
                        <>
                          <p className="mt-1 text-sm text-red-400">
                            OUT:{" "}
                            {getPlayerName(
                              event.player_out_id
                            )}
                          </p>

                          <p className="mt-1 text-sm text-emerald-400">
                            IN:{" "}
                            {getPlayerName(
                              event.player_in_id
                            )}
                          </p>
                        </>
                      )}

                      {event.event_type === "added_time" && (
                        <p className="mt-1 text-sm font-semibold text-yellow-400">
                          +{event.added_time ?? 0} minute
                          {(event.added_time ?? 0) === 1 ? "" : "s"} added
                        </p>
                      )}

                      {/* DESCRIPTION */}

                      {event.description && event.event_type !== "added_time" && (
                        <p className="mt-2 text-xs text-slate-600">
                          {
                            event.description
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
            No match events recorded yet.
          </div>
        )}
      </section>

      {/* =================================================
          LINEUPS
          ================================================= */}

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">LINEUPS</p>
          <h2 className="text-2xl font-bold">
            Starting XI & Substitutes
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Match formation is shown on the pitch. Positions belong to the
            selected match slots, not the player's registered position.
          </p>
        </div>

        {lineupsLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
            Loading lineups...
          </div>
        ) : lineups.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
            Lineups have not been published yet.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              {
                teamId: match.home_team_id,
                teamName: getTeamName(match.home_team_id),
              },
              {
                teamId: match.away_team_id,
                teamName: getTeamName(match.away_team_id),
              },
            ].map((team) => {
              const lineup = getLineup(team.teamId);
              const originalXI = getOriginalStartingXI(team.teamId).map(Number);
              const slotLabels = getFormationSlotLabels(lineup?.formation);

              const formationRows: number[][] = [];
              let cursor = 0;

              // Goalkeeper
              formationRows.push(originalXI.slice(0, 1));
              cursor = 1;

              // Outfield rows according to formation, preserving admin-selected order.
              for (const count of normaliseFormation(lineup?.formation)) {
                formationRows.push(originalXI.slice(cursor, cursor + count));
                cursor += count;
              }

              const originalXISet = new Set(originalXI);

              const substitutes = squadPlayers
                .filter(
                  (player) =>
                    player.team_id === team.teamId &&
                    !originalXISet.has(player.id)
                )
                .sort((a, b) => {
                  const rankA = positionRank(a.position);
                  const rankB = positionRank(b.position);
                  if (rankA !== rankB) return rankA - rankB;
                  return (a.jersey_number ?? 999) - (b.jersey_number ?? 999);
                });

              return (
                <div
                  key={team.teamId}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                >
                  <div className="border-b border-slate-800 bg-slate-950 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xl font-bold">{team.teamName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {lineup?.formation ?? "Formation unavailable"}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                        {originalXI.length}/11
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* PITCH / FORMATION */}
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4">
                      <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/20" />
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[calc(100%-24px)] -translate-x-1/2 bg-white/20" />
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

                      <div className="relative z-10 flex min-h-[560px] flex-col justify-between gap-4 py-3">
                        {formationRows.map((row, rowIndex) => (
                          <div
                            key={`formation-row-${rowIndex}`}
                            className="flex items-center justify-center gap-2 sm:gap-4"
                          >
                            {row.map((playerId, localIndex) => {
                              const player = getPlayer(playerId);
                              if (!player) return null;

                              const globalIndex =
                                rowIndex === 0
                                  ? 0
                                  : 1 +
                                    formationRows
                                      .slice(1, rowIndex)
                                      .reduce((sum, values) => sum + values.length, 0) +
                                    localIndex;

                              const position =
                                slotLabels[globalIndex] ??
                                getMatchPosition(team.teamId, playerId);

                              const off = wasSubstitutedOut(
                                playerId,
                                team.teamId
                              );

                              return (
                                <div
                                  key={`${team.teamId}-pitch-${playerId}`}
                                  className="flex min-w-0 flex-1 justify-center"
                                >
                                  <div className="flex w-[90px] flex-col items-center text-center sm:w-[110px]">
                                    <div
                                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-slate-950 text-sm font-black shadow-lg sm:h-14 sm:w-14 ${
                                        off
                                          ? "border-red-400/70 text-red-300"
                                          : "border-white/70 text-white"
                                      }`}
                                    >
                                      {player.jersey_number ?? "—"}
                                    </div>

                                    <p className="mt-2 w-full truncate text-xs font-bold text-white sm:text-sm">
                                      {player.name}
                                    </p>

                                    <div className="mt-1 flex items-center justify-center gap-1">
                                      <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                                        {position}
                                      </span>

                                      {off && (
                                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-300">
                                          OFF
                                        </span>
                                      )}
                                    </div>

                                    {(() => {
                                      const badges =
                                        getPlayerEventBadges(
                                          playerId
                                        );

                                      if (
                                        badges.goals === 0 &&
                                        badges.ownGoals === 0 &&
                                        badges.assists === 0 &&
                                        badges.yellowCards === 0 &&
                                        badges.redCards === 0
                                      ) {
                                        return null;
                                      }

                                      return (
                                        <div className="mt-1.5 flex items-center justify-center gap-1">
                                          {badges.goals > 0 && (
                                            <span
                                              title={`Goals: ${badges.goals}`}
                                              className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"
                                            >
                                              ⚽{badges.goals > 1 ? badges.goals : ""}
                                            </span>
                                          )}

                                          {badges.ownGoals > 0 && (
                                            <span
                                              title={`Own goals: ${badges.ownGoals}`}
                                              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-300"
                                            >
                                              <RedFootballIcon />{badges.ownGoals > 1 ? badges.ownGoals : ""}
                                            </span>
                                          )}

                                          {badges.assists > 0 && (
                                            <span
                                              title={`Assists: ${badges.assists}`}
                                              className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300"
                                            >
                                              A{badges.assists > 1 ? badges.assists : ""}
                                            </span>
                                          )}

                                          {badges.yellowCards > 0 && (
                                            <span
                                              title={`Yellow cards: ${badges.yellowCards}`}
                                              className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300"
                                            >
                                              🟨{badges.yellowCards > 1 ? badges.yellowCards : ""}
                                            </span>
                                          )}

                                          {badges.redCards > 0 && (
                                            <span
                                              title={`Red cards: ${badges.redCards}`}
                                              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-300"
                                            >
                                              🟥{badges.redCards > 1 ? badges.redCards : ""}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SUBSTITUTES */}
                    <div className="mt-7">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Substitutes
                        </p>
                        <span className="text-xs text-slate-600">
                          Bench
                        </span>
                      </div>

                      {substitutes.length > 0 ? (
                        <div className="space-y-2">
                          {substitutes.map((player) => {
                            const on = wasSubstitutedOn(
                              player.id,
                              team.teamId
                            );
                            const matchPosition = on
                              ? getMatchPosition(team.teamId, player.id)
                              : player.position ?? "Player";

                            return (
                              <div
                                key={player.id}
                                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-slate-200">
                                      {player.jersey_number != null
                                        ? `#${player.jersey_number} `
                                        : ""}
                                      {player.name}
                                    </p>

                                    {(() => {
                                      const badges =
                                        getPlayerEventBadges(
                                          player.id
                                        );

                                      if (
                                        badges.goals === 0 &&
                                        badges.ownGoals === 0 &&
                                        badges.assists === 0 &&
                                        badges.yellowCards === 0 &&
                                        badges.redCards === 0
                                      ) {
                                        return null;
                                      }

                                      return (
                                        <div className="flex shrink-0 items-center gap-1">
                                          {badges.goals > 0 && (
                                            <span
                                              title={`Goals: ${badges.goals}`}
                                              className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"
                                            >
                                              ⚽{badges.goals > 1 ? badges.goals : ""}
                                            </span>
                                          )}

                                          {badges.ownGoals > 0 && (
                                            <span
                                              title={`Own goals: ${badges.ownGoals}`}
                                              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-300"
                                            >
                                              <RedFootballIcon />{badges.ownGoals > 1 ? badges.ownGoals : ""}
                                            </span>
                                          )}

                                          {badges.assists > 0 && (
                                            <span
                                              title={`Assists: ${badges.assists}`}
                                              className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300"
                                            >
                                              A{badges.assists > 1 ? badges.assists : ""}
                                            </span>
                                          )}

                                          {badges.yellowCards > 0 && (
                                            <span
                                              title={`Yellow cards: ${badges.yellowCards}`}
                                              className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300"
                                            >
                                              🟨{badges.yellowCards > 1 ? badges.yellowCards : ""}
                                            </span>
                                          )}

                                          {badges.redCards > 0 && (
                                            <span
                                              title={`Red cards: ${badges.redCards}`}
                                              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-300"
                                            >
                                              🟥{badges.redCards > 1 ? badges.redCards : ""}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {matchPosition}
                                  </p>
                                </div>

                                {on ? (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-400">
                                    ON
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600">
                                    Bench
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-slate-800 p-4 text-sm text-slate-600">
                          No substitutes available.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =================================================
          PLAYER STATISTICS
          ================================================= */}

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">
            PLAYER STATISTICS
          </p>
          <h2 className="text-2xl font-bold">
            Current Match Player Stats
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Minutes, goals, assists and cards update automatically.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[
            {
              teamId: match.home_team_id,
              teamName: getTeamName(match.home_team_id),
            },
            {
              teamId: match.away_team_id,
              teamName: getTeamName(match.away_team_id),
            },
          ].map((team) => {
            const originalStartingXI = getOriginalStartingXI(
              team.teamId
            ).map(Number);

            const starterSet = new Set(
              originalStartingXI
            );

            // Starting XI first, ordered by the actual match position
            // determined by the formation slots.
            const starterPlayers = originalStartingXI
              .map((playerId) => getPlayer(playerId))
              .filter(
                (player): player is Player =>
                  !!player
              );

            // Then substitutes/bench players. Players who have entered
            // inherit the position of the player they replaced.
            const substitutePlayers = squadPlayers
              .filter(
                (player) =>
                  player.team_id === team.teamId &&
                  !starterSet.has(player.id)
              )
              .sort((a, b) => {
                const positionA = getMatchPosition(
                  team.teamId,
                  Number(a.id)
                );
                const positionB = getMatchPosition(
                  team.teamId,
                  Number(b.id)
                );

                const rankA =
                  getMatchPositionRank(positionA);
                const rankB =
                  getMatchPositionRank(positionB);

                if (rankA !== rankB) {
                  return rankA - rankB;
                }

                return (
                  (a.jersey_number ?? 999) -
                  (b.jersey_number ?? 999)
                );
              });

            const teamPlayers = [
              ...starterPlayers,
              ...substitutePlayers,
            ];

            return (
              <div
                key={`player-stats-${team.teamId}`}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
              >
                <div className="border-b border-slate-800 bg-slate-950 p-5">
                  <h3 className="text-xl font-bold">
                    {team.teamName}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-3 py-3 text-center">Min</th>
                        <th className="px-3 py-3 text-center">G</th>
                        <th className="px-3 py-3 text-center">A</th>
                        <th className="px-3 py-3 text-center">YC</th>
                        <th className="px-3 py-3 text-center">RC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.map((player) => {
                        const stat = getPlayerStats(player.id);
                        return (
                          <tr
                            key={`player-stat-${player.id}`}
                            className="border-b border-slate-800 last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>
                                  {player.jersey_number != null
                                    ? `#${player.jersey_number} `
                                    : ""}
                                  {player.name}
                                </span>

                                {starterSet.has(
                                  Number(player.id)
                                ) ? (
                                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                                    Starter
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    Sub
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                {getMatchPosition(
                                  team.teamId,
                                  Number(player.id)
                                )}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-center text-slate-300">
                              {stat?.minutes_played ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-slate-300">
                              {stat?.goals ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-slate-300">
                              {stat?.assists ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-yellow-400">
                              {stat?.yellow_cards ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-red-400">
                              {stat?.red_cards ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================
          MATCH STATISTICS
          ================================================= */}

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-sm text-emerald-400">
            STATISTICS
          </p>

          <h2 className="text-2xl font-bold">
            Match Statistics
          </h2>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900">
          {/* POSSESSION */}

          <div className="border-b border-slate-800 p-5">
            <div className="flex justify-between">
              <span>
                {homeStats?.possession ??
                  "—"}

                {homeStats?.possession !=
                  null
                  ? "%"
                  : ""}
              </span>

              <span className="text-slate-400">
                Possession
              </span>

              <span>
                {awayStats?.possession ??
                  "—"}

                {awayStats?.possession !=
                  null
                  ? "%"
                  : ""}
              </span>
            </div>
          </div>

          {/* SHOTS */}

          <div className="flex justify-between border-b border-slate-800 p-5">
            <span>
              {homeStats?.shots ??
                "—"}
            </span>

            <span className="text-slate-400">
              Shots
            </span>

            <span>
              {awayStats?.shots ??
                "—"}
            </span>
          </div>

          {/* SHOTS ON TARGET */}

          <div className="flex justify-between border-b border-slate-800 p-5">
            <span>
              {homeStats?.shots_on_target ??
                "—"}
            </span>

            <span className="text-slate-400">
              Shots on Target
            </span>

            <span>
              {awayStats?.shots_on_target ??
                "—"}
            </span>
          </div>

          {/* CORNERS */}

          <div className="flex justify-between border-b border-slate-800 p-5">
            <span>
              {homeStats?.corners ??
                "—"}
            </span>

            <span className="text-slate-400">
              Corners
            </span>

            <span>
              {awayStats?.corners ??
                "—"}
            </span>
          </div>

          {/* SAVES */}

          <div className="flex justify-between p-5">
            <span>
              {homeStats?.saves ??
                "—"}
            </span>

            <span className="text-slate-400">
              Saves
            </span>

            <span>
              {awayStats?.saves ??
                "—"}
            </span>
          </div>
        </div>
      </section>

    </>
  );
}