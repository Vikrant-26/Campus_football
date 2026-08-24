export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Player = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  team_id: number;
};

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type MatchEvent = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number | null;
  assist_player_id: number | null;
  event_type: string;
  minute: number;
};

type PlayerMatchStat = {
  match_id: number;
  player_id: number;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  key_passes: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  rating: number | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PlayerPage({
  params,
}: PageProps) {
  const { id } = await params;

  const playerId = Number(id);

  if (Number.isNaN(playerId)) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Invalid Player
        </h1>

        <Link
          href="/players"
          className="mt-6 inline-block text-emerald-400"
        >
          ← Back to Players
        </Link>
      </main>
    );
  }

  const supabase = await createClient();

  // ============================================
  // GET PLAYER
  // ============================================

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(
      "id, name, jersey_number, position, team_id"
    )
    .eq("id", playerId)
    .single();

  if (playerError || !player) {
    console.error(playerError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Player Not Found
        </h1>

        <p className="mt-3 text-slate-400">
          We couldn't find this player.
        </p>

        <Link
          href="/players"
          className="mt-6 inline-block text-emerald-400"
        >
          ← Back to Players
        </Link>
      </main>
    );
  }

  // ============================================
  // GET TEAM
  // ============================================

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .eq("id", player.team_id)
    .single();

  if (teamError) {
    console.error(teamError);
  }

  // ============================================
  // GET PLAYER MATCH EVENTS
  // ============================================

  const { data: events, error: eventsError } = await supabase
    .from("match_events")
    .select(
      "id, match_id, team_id, player_id, assist_player_id, event_type, minute"
    )
    .or(
      `player_id.eq.${playerId},assist_player_id.eq.${playerId}`
    )
    .order("minute", { ascending: true });

  if (eventsError) {
    console.error(eventsError);
  }

  // ============================================
  // GET PLAYER MATCH STATS
  // ============================================

  const {
    data: playerMatchStats,
    error: statsError,
  } = await supabase
    .from("player_match_stats")
    .select(
      "match_id, player_id, minutes_played, goals, assists, shots, shots_on_target, key_passes, tackles, interceptions, fouls, yellow_cards, red_cards, rating"
    )
    .eq("player_id", playerId);

  if (statsError) {
    console.error(statsError);
  }

  const typedPlayer = player as Player;
  const typedTeam = team as Team | null;
  const typedEvents = (events ?? []) as MatchEvent[];
  const typedStats =
    (playerMatchStats ?? []) as PlayerMatchStat[];

  // ============================================
  // PLAYER MINUTES
  // ============================================
  // The admin match clock is the single source of truth for minutes.
  // This page only displays the persisted player_match_stats value.

  const statsWithCalculatedMinutes = typedStats.map((stat) => ({
    ...stat,
    minutes_played: Math.max(0, Number(stat.minutes_played ?? 0)),
  }));

  // ============================================
  // CALCULATE SEASON STATISTICS
  // ============================================

  const appearances = statsWithCalculatedMinutes.length;

  const minutes = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.minutes_played,
    0
  );

  const goalsFromStats = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.goals,
    0
  );

  const assistsFromStats = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.assists,
    0
  );

  const shots = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.shots,
    0
  );

  const shotsOnTarget = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.shots_on_target,
    0
  );

  const keyPasses = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.key_passes,
    0
  );

  const tackles = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.tackles,
    0
  );

  const interceptions = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.interceptions,
    0
  );

  const yellowCards = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.yellow_cards,
    0
  );

  const redCards = statsWithCalculatedMinutes.reduce(
    (total, stat) => total + stat.red_cards,
    0
  );

  // If player_match_stats has no goal data yet,
  // count goals directly from match_events.
  const goalsFromEvents = typedEvents.filter(
    (event) =>
      event.player_id === playerId &&
      (
        event.event_type === "goal" ||
        event.event_type === "penalty_goal"
      )
  ).length;

  const goals =
    goalsFromStats > 0
      ? goalsFromStats
      : goalsFromEvents;

  const assistsFromEvents = typedEvents.filter(
    (event) =>
      event.assist_player_id === playerId &&
      (
        event.event_type === "goal" ||
        event.event_type === "penalty_goal"
      )
  ).length;

  const assists =
    assistsFromStats > 0
      ? assistsFromStats
      : assistsFromEvents;

  const averageRating =
    typedStats.length > 0
      ? typedStats
          .filter((stat) => stat.rating !== null)
          .reduce(
            (total, stat) =>
              total + Number(stat.rating),
            0
          ) /
        statsWithCalculatedMinutes.filter(
          (stat) => stat.rating !== null
        ).length
      : null;

  // ============================================
  // EVENT COUNTS
  // ============================================

  const eventYellowCards = typedEvents.filter(
    (event) =>
      event.player_id === playerId &&
      event.event_type === "yellow_card"
  ).length;

  const eventRedCards = typedEvents.filter(
    (event) =>
      event.player_id === playerId &&
      event.event_type === "red_card"
  ).length;

  const finalYellowCards = Math.max(
    yellowCards,
    eventYellowCards
  );

  const finalRedCards = Math.max(
    redCards,
    eventRedCards
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-5 py-4">
          <Link
            href="/"
            className="text-xl font-bold"
          >
            ⚽ Campus League
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* BACK */}
        <Link
          href="/players"
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          ← Back to Players
        </Link>

        {/* PLAYER HEADER */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
          <div className="flex flex-col items-center text-center md:flex-row md:gap-6 md:text-left">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-800 text-5xl">
              👤
            </div>

            <div className="mt-5 md:mt-0">
              <p className="text-sm uppercase tracking-widest text-emerald-400">
                {typedTeam?.name ?? "Unknown Team"}
              </p>

              <h1 className="mt-1 text-4xl font-black">
                {typedPlayer.name}
              </h1>

              <p className="mt-2 text-slate-500">
                {typedPlayer.position}
                {" · "}
                #{typedPlayer.jersey_number ?? "-"}
              </p>
            </div>
          </div>
        </section>

        {/* MAIN SEASON STATS */}
        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-bold">
            Season Stats
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
              <p className="text-sm text-slate-500">
                Appearances
              </p>

              <p className="mt-2 text-3xl font-black">
                {appearances}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
              <p className="text-sm text-slate-500">
                Goals
              </p>

              <p className="mt-2 text-3xl font-black">
                {goals}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
              <p className="text-sm text-slate-500">
                Assists
              </p>

              <p className="mt-2 text-3xl font-black">
                {assists}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
              <p className="text-sm text-slate-500">
                Minutes
              </p>

              <p className="mt-2 text-3xl font-black">
                {minutes}
              </p>
            </div>
          </div>
        </section>

        {/* ADDITIONAL STATS */}
        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-bold">
            Additional Statistics
          </h2>

          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Shots
              </span>

              <span className="font-bold">
                {shots}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Shots on Target
              </span>

              <span className="font-bold">
                {shotsOnTarget}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Key Passes
              </span>

              <span className="font-bold">
                {keyPasses}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Tackles
              </span>

              <span className="font-bold">
                {tackles}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Interceptions
              </span>

              <span className="font-bold">
                {interceptions}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Yellow Cards
              </span>

              <span className="font-bold">
                {finalYellowCards}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-800 p-5">
              <span className="text-slate-400">
                Red Cards
              </span>

              <span className="font-bold">
                {finalRedCards}
              </span>
            </div>

            <div className="flex justify-between p-5">
              <span className="text-slate-400">
                Average Rating
              </span>

              <span className="font-bold">
                {averageRating !== null
                  ? averageRating.toFixed(1)
                  : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* RECENT EVENTS */}
        <section className="mt-8 pb-10">
          <h2 className="mb-4 text-2xl font-bold">
            Recent Match Events
          </h2>

          {typedEvents.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              {typedEvents
                .slice()
                .reverse()
                .slice(0, 10)
                .map((event, index) => {
                  let icon = "•";
                  let label = "Match Event";

                  if (
                    event.event_type === "goal" ||
                    event.event_type === "penalty_goal"
                  ) {
                    icon = "⚽";
                    label = "Goal";
                  }

                  if (
                    event.event_type === "yellow_card"
                  ) {
                    icon = "🟨";
                    label = "Yellow Card";
                  }

                  if (
                    event.event_type === "red_card"
                  ) {
                    icon = "🟥";
                    label = "Red Card";
                  }

                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-4 p-5 ${
                        index !==
                        Math.min(
                          typedEvents.length,
                          10
                        ) -
                          1
                          ? "border-b border-slate-800"
                          : ""
                      }`}
                    >
                      <span className="w-12 text-sm font-bold text-slate-500">
                        {event.minute}&apos;
                      </span>

                      <span className="text-xl">
                        {icon}
                      </span>

                      <div>
                        <p className="font-semibold">
                          {label}
                        </p>

                        <p className="text-xs text-slate-500">
                          Match #{event.match_id}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No match events recorded for this player yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}