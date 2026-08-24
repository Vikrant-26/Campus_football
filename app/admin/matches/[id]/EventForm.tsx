"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  id: number;
  name: string;
};

type Player = {
  id: number;
  name: string;
  position?: string;
  team_id?: number;
  jersey_number?: number | null;
};

type MatchEvent = {
  id: number;
  team_id: number;
  player_id: number | null;
  assist_player_id: number | null;
  player_in_id: number | null;
  player_out_id: number | null;
  event_type: string;
  minute: number;
  added_time: number | null;
};

type Lineup = {
  id: number;
  match_id: number;
  team_id: number;
  formation: string;
  starting_xi: number[];
};

type Props = {
  homeTeam: Team | null;
  awayTeam: Team | null;
  players: Player[];
  events: MatchEvent[];
  lineups: Lineup[];
  matchPeriod: string | null;
  elapsedSeconds: number;
  currentHalfStartedAt: string | null;
  halfDurationMinutes: number;
  action: (formData: FormData) => void | Promise<void>;
};

function getCurrentMinute({
  matchPeriod,
  elapsedSeconds,
  currentHalfStartedAt,
  halfDurationMinutes,
}: Pick<
  Props,
  | "matchPeriod"
  | "elapsedSeconds"
  | "currentHalfStartedAt"
  | "halfDurationMinutes"
>) {
  let totalSeconds = Math.max(0, elapsedSeconds);

  if (
    (matchPeriod === "first_half" ||
      matchPeriod === "second_half") &&
    currentHalfStartedAt
  ) {
    totalSeconds += Math.max(
      0,
      Math.floor(
        (Date.now() -
          new Date(currentHalfStartedAt).getTime()) /
          1000
      )
    );
  }

  const regulationSeconds = halfDurationMinutes * 60;
  totalSeconds = Math.min(totalSeconds, regulationSeconds * 2 + 30 * 60);

  return Math.max(1, Math.floor(totalSeconds / 60) + 1);
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
      else if (count === 2) labels.push("LW", "RW");
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

function getCurrentMatchPosition(
  playerId: number,
  lineup: Lineup | undefined,
  events: MatchEvent[],
  teamId: number,
  fallbackPosition?: string
) {
  if (!lineup) return fallbackPosition ?? "Player";

  const originalXI = lineup.starting_xi.map(Number);
  const slotLabels = getFormationSlotLabels(lineup.formation);
  const originalIndex = originalXI.indexOf(Number(playerId));

  if (originalIndex >= 0) {
    return slotLabels[originalIndex] ?? fallbackPosition ?? "Player";
  }

  const incomingEvent = events
    .filter(
      (event) =>
        event.team_id === teamId &&
        event.event_type === "substitution" &&
        Number(event.player_in_id) === Number(playerId)
    )
    .sort((a, b) => (a.minute - b.minute) || (a.id - b.id))
    .at(-1);

  if (!incomingEvent?.player_out_id) {
    return fallbackPosition ?? "Player";
  }

  let tracedPlayerId = Number(incomingEvent.player_out_id);
  const visited = new Set<number>();

  while (tracedPlayerId > 0 && !visited.has(tracedPlayerId)) {
    visited.add(tracedPlayerId);

    const starterIndex = originalXI.indexOf(tracedPlayerId);
    if (starterIndex >= 0) {
      return slotLabels[starterIndex] ?? fallbackPosition ?? "Player";
    }

    const previousIncoming = events
      .filter(
        (event) =>
          event.team_id === teamId &&
          event.event_type === "substitution" &&
          Number(event.player_in_id) === tracedPlayerId
      )
      .sort((a, b) => (a.minute - b.minute) || (a.id - b.id))
      .at(-1);

    if (!previousIncoming?.player_out_id) break;
    tracedPlayerId = Number(previousIncoming.player_out_id);
  }

  return fallbackPosition ?? "Player";
}

export default function EventForm({
  homeTeam,
  awayTeam,
  players,
  events,
  lineups,
  matchPeriod,
  elapsedSeconds,
  currentHalfStartedAt,
  halfDurationMinutes,
  action,
}: Props) {
  const [teamId, setTeamId] = useState<number>(
    homeTeam?.id ?? awayTeam?.id ?? 0
  );
  const [eventType, setEventType] = useState("goal");

  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    if (
      matchPeriod !== "first_half" &&
      matchPeriod !== "second_half"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [matchPeriod]);

  const currentMinute = useMemo(
    () =>
      getCurrentMinute({
        matchPeriod,
        elapsedSeconds,
        currentHalfStartedAt,
        halfDurationMinutes,
      }),
    [
      clockTick,
      matchPeriod,
      elapsedSeconds,
      currentHalfStartedAt,
      halfDurationMinutes,
    ]
  );

  const teamPlayers = useMemo(
    () => players.filter((player) => player.team_id === teamId),
    [players, teamId]
  );

  const currentLineup = useMemo(() => {
    const lineup = lineups.find((item) => item.team_id === teamId);
    if (!lineup) return [];

    const current = [...lineup.starting_xi];

    [...events]
      .filter(
        (event) =>
          event.team_id === teamId &&
          event.event_type === "substitution" &&
          event.player_in_id &&
          event.player_out_id
      )
      .sort((a, b) => {
        const aMinute = a.minute + (a.added_time ?? 0);
        const bMinute = b.minute + (b.added_time ?? 0);
        return aMinute - bMinute || a.id - b.id;
      })
      .forEach((event) => {
        const outId = event.player_out_id!;
        const inId = event.player_in_id!;
        const index = current.indexOf(outId);

        if (index >= 0) {
          current[index] = inId;
        }
      });

    return current;
  }, [events, lineups, teamId]);

  const selectedLineup = useMemo(
    () =>
      lineups.find(
        (item) => item.team_id === teamId
      ),
    [lineups, teamId]
  );

  const getMatchPosition = (player: Player) =>
    getCurrentMatchPosition(
      player.id,
      selectedLineup,
      events,
      teamId,
      player.position
    );

  const currentXI = useMemo(() => {
    const playerById = new Map(
      teamPlayers.map((player) => [player.id, player])
    );

    return currentLineup
      .map((playerId) => playerById.get(playerId))
      .filter((player): player is Player => Boolean(player));
  }, [teamPlayers, currentLineup]);

  const currentSubstitutes = useMemo(
    () =>
      teamPlayers.filter(
        (player) => !currentLineup.includes(player.id)
      ),
    [teamPlayers, currentLineup]
  );

  const needsPlayer = [
    "goal",
    "penalty_goal",
    "own_goal",
    "yellow_card",
    "red_card",
  ].includes(eventType);

  const isSubstitution = eventType === "substitution";

  const formatPlayer = (player: Player) =>
    `${player.jersey_number != null ? `#${player.jersey_number} ` : ""}${player.name}`;

  return (
    <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Automatic Match Time
        </p>
        <p className="mt-1 text-2xl font-black">
          {currentMinute}&apos;
        </p>
        <p className="mt-1 text-xs text-slate-500">
          The event minute is taken automatically from the live match clock.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-slate-400">
            Team
          </label>
          <select
            name="team_id"
            value={teamId || ""}
            onChange={(event) => setTeamId(Number(event.target.value))}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="">Select team</option>
            {homeTeam && (
              <option value={homeTeam.id}>{homeTeam.name}</option>
            )}
            {awayTeam && (
              <option value={awayTeam.id}>{awayTeam.name}</option>
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">
            Event
          </label>
          <select
            name="event_type"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="goal">Goal</option>
            <option value="penalty_goal">Penalty Goal</option>
            <option value="own_goal">Own Goal</option>
            <option value="yellow_card">Yellow Card</option>
            <option value="red_card">Red Card</option>
            <option value="substitution">Substitution</option>
          </select>
        </div>
      </div>

      {teamId > 0 && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {(needsPlayer || isSubstitution) && (
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                {isSubstitution ? "Player Out — Current Playing XI" : "Player"}
              </label>
              <select
                name={isSubstitution ? "player_out_id" : "player_id"}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">
                  {currentXI.length
                    ? "Select player"
                    : "No current Playing XI available"}
                </option>
                {currentXI.map((player) => (
                  <option key={player.id} value={player.id}>
                    {formatPlayer(player)}
                    {" — "}
                    {getMatchPosition(player)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isSubstitution && (
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Player In — Current Substitutes
              </label>
              <select
                name="player_in_id"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">
                  {currentSubstitutes.length
                    ? "Select substitute"
                    : "No substitutes available"}
                </option>
                {currentSubstitutes.map((player) => (
                  <option key={player.id} value={player.id}>
                    {formatPlayer(player)}
                    {" — "}
                    {getMatchPosition(player)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {eventType === "goal" && (
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Assist — Current Playing XI (optional)
              </label>
              <select
                name="assist_player_id"
                defaultValue=""
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">No assist</option>
                {currentXI.map((player) => (
                  <option key={player.id} value={player.id}>
                    {formatPlayer(player)}
                    {" — "}
                    {getMatchPosition(player)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <label className="mb-2 block text-sm text-slate-400">
          Description (optional)
        </label>
        <input
          name="description"
          type="text"
          placeholder="e.g. Counter attack"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          Event time is automatic. Player positions use the current match lineup and substitution history.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
        >
          Add Event
        </button>
      </div>
    </form>
  );
}
