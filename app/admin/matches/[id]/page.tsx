export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import EventForm from "./EventForm";
import MatchControl from "./MatchControl";
import MatchLineup from "./MatchLineup";

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;

  result_type: string | null;
  cancellation_reason: string | null;

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
  jersey_number: number | null;
  position: string;
  team_id: number;
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

type MatchLineupRow = {
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

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

// ==================================================
// AUTOMATIC PLAYER MINUTES
// ==================================================

async function syncPlayerMinutes(
  serverSupabase: any,
  currentMatchId: number
) {
  const { data: currentMatch, error: matchError } =
    await serverSupabase
      .from("matches")
      .select(
        `
        id,
        status,
        match_period,
        half_duration_minutes,
        elapsed_seconds,
        current_half_started_at,
        added_time_started,
        added_time_minutes,
        home_team_id
        `
      )
      .eq("id", currentMatchId)
      .single();

  if (matchError || !currentMatch) {
    console.error("Automatic minutes match error:", matchError);
    return;
  }

  const regulationMinutes = Number(
    currentMatch.half_duration_minutes ?? 0
  );
  const regulationSeconds = regulationMinutes * 60;

  const { data: lineups, error: lineupError } =
    await serverSupabase
      .from("match_lineups")
      .select("team_id, starting_xi")
      .eq("match_id", currentMatchId);

  if (lineupError) {
    console.error("Automatic minutes lineup error:", lineupError);
    return;
  }

  const { data: timelineEvents, error: timelineError } =
    await serverSupabase
      .from("match_events")
      .select(
        "id, team_id, event_type, minute, added_time, player_in_id, player_out_id"
      )
      .eq("match_id", currentMatchId)
      .order("id", { ascending: true });

  if (timelineError) {
    console.error("Automatic minutes timeline error:", timelineError);
    return;
  }

  const events = timelineEvents ?? [];

  const secondHalfStartEvent = events.find(
    (event: any) => event.event_type === "second_half_start"
  );

  const secondHalfStartedAtId =
    secondHalfStartEvent?.id ?? Number.POSITIVE_INFINITY;

  const firstHalfAddedEvent = events
    .filter(
      (event: any) =>
        event.event_type === "added_time" &&
        Number(event.id) < secondHalfStartedAtId
    )
    .sort(
      (a: any, b: any) => Number(b.id) - Number(a.id)
    )[0];

  const firstHalfAddedMinutes = Math.max(
    0,
    Number(firstHalfAddedEvent?.added_time ?? 0)
  );

  const firstHalfEndMinute =
    regulationMinutes + firstHalfAddedMinutes;

  let runningElapsedSeconds = Number(
    currentMatch.elapsed_seconds ?? 0
  );

  if (
    currentMatch.status === "live" &&
    currentMatch.current_half_started_at
  ) {
    const startedAt = new Date(
      currentMatch.current_half_started_at
    ).getTime();

    runningElapsedSeconds += Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000)
    );
  }

  let currentMatchMinute = 0;

  if (currentMatch.match_period === "first_half") {
    if (currentMatch.added_time_started) {
      const addedTimeElapsedSeconds = Math.max(
        0,
        runningElapsedSeconds - regulationSeconds
      );

      currentMatchMinute =
        regulationMinutes +
        Math.min(
          firstHalfAddedMinutes,
          addedTimeElapsedSeconds / 60
        );
    } else {
      currentMatchMinute = Math.min(
        runningElapsedSeconds / 60,
        regulationMinutes
      );
    }
  } else if (currentMatch.match_period === "halftime") {
    currentMatchMinute = Math.max(
      regulationMinutes,
      runningElapsedSeconds / 60
    );

    if (firstHalfAddedMinutes > 0) {
      currentMatchMinute = Math.min(
        currentMatchMinute,
        firstHalfEndMinute
      );
    }
  } else if (currentMatch.match_period === "second_half") {
    const secondHalfElapsedSeconds = Math.max(
      0,
      runningElapsedSeconds - regulationSeconds
    );

    currentMatchMinute =
      firstHalfEndMinute + secondHalfElapsedSeconds / 60;
  } else if (currentMatch.match_period === "full_time") {
    const secondHalfElapsedSeconds = Math.max(
      0,
      runningElapsedSeconds - regulationSeconds
    );

    currentMatchMinute =
      firstHalfEndMinute + secondHalfElapsedSeconds / 60;
  } else {
    currentMatchMinute = Math.max(
      0,
      runningElapsedSeconds / 60
    );
  }

  const minutesByPlayer = new Map<number, number>();

  for (const lineup of lineups ?? []) {
    const startingXI = Array.isArray(lineup.starting_xi)
      ? lineup.starting_xi
          .map(Number)
          .filter((id: number) => id > 0)
      : [];

    const activePlayers = new Map<number, number>();

    for (const playerId of startingXI) {
      activePlayers.set(playerId, 0);
      minutesByPlayer.set(playerId, 0);
    }

    const teamSubstitutions = events.filter(
      (event: any) =>
        event.team_id === lineup.team_id &&
        event.event_type === "substitution" &&
        event.player_in_id &&
        event.player_out_id
    );

    for (const event of teamSubstitutions) {
      const eventIsSecondHalf =
        Number(event.id) > secondHalfStartedAtId;

      let eventMinute: number;

      if (eventIsSecondHalf) {
        eventMinute =
          firstHalfEndMinute +
          Math.max(
            0,
            Number(event.minute ?? regulationMinutes) -
              regulationMinutes
          );
      } else {
        eventMinute =
          Number(event.minute ?? 0) +
          Number(event.added_time ?? 0);
      }

      eventMinute = Math.max(
        0,
        Math.min(currentMatchMinute, eventMinute)
      );

      const playerOutId = Number(event.player_out_id);
      const playerInId = Number(event.player_in_id);

      if (
        playerOutId > 0 &&
        activePlayers.has(playerOutId)
      ) {
        const startedAt =
          activePlayers.get(playerOutId) ?? eventMinute;

        const played = Math.max(
          0,
          eventMinute - startedAt
        );

        minutesByPlayer.set(
          playerOutId,
          Math.floor(
            (minutesByPlayer.get(playerOutId) ?? 0) +
              played
          )
        );

        activePlayers.delete(playerOutId);
      }

      if (playerInId > 0) {
        activePlayers.set(playerInId, eventMinute);

        if (!minutesByPlayer.has(playerInId)) {
          minutesByPlayer.set(playerInId, 0);
        }
      }
    }

    for (const [playerId, startedAt] of activePlayers) {
      const played = Math.max(
        0,
        currentMatchMinute - startedAt
      );

      minutesByPlayer.set(
        playerId,
        Math.floor(
          (minutesByPlayer.get(playerId) ?? 0) +
            played
        )
      );
    }
  }

  for (const [playerId, minutes] of minutesByPlayer) {
    const { error } = await serverSupabase
      .from("player_match_stats")
      .upsert(
        {
          match_id: currentMatchId,
          player_id: playerId,
          minutes_played: Math.max(
            0,
            Math.min(Math.floor(minutes), 150)
          ),
        },
        {
          onConflict: "match_id,player_id",
        }
      );

    if (error) {
      console.error("Automatic minutes save error:", error);
    }
  }
}

// ==================================================
// CLIENT-TRIGGERED AUTOMATIC MINUTE SYNC
// ==================================================

async function syncPlayerMinutesAction(
  formData: FormData
) {
  "use server";

  const serverSupabase = await createClient();

  const {
    data: { user: currentUser },
  } = await serverSupabase.auth.getUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const { data: admin } = await serverSupabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  const currentMatchId = Number(
    formData.get("match_id")
  );

  if (!Number.isInteger(currentMatchId) || currentMatchId <= 0) {
    return;
  }

  await syncPlayerMinutes(
    serverSupabase,
    currentMatchId
  );
}

export default async function AdminMatchPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const matchId = Number(id);

  if (Number.isNaN(matchId)) {
    redirect(
      "/admin/matches"
    );
  }

  const supabase =
    await createClient();

  // ==================================================
  // AUTH
  // ==================================================

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/auth/login"
    );
  }

  // ==================================================
  // ADMIN
  // ==================================================

  const { data: adminUser } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (!adminUser) {
    redirect("/");
  }

  // ==================================================
  // LOAD MATCH
  // ==================================================

  const {
    data: match,
    error: matchError,
  } =
    await supabase
      .from("matches")
      .select(
        `
        id,
        match_date,
        venue,
        status,

        result_type,
        cancellation_reason,

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

        home_score,
        away_score,

        home_team_id,
        away_team_id
        `
      )
      .eq(
        "id",
        matchId
      )
      .single();

  if (
    matchError ||
    !match
  ) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Match Not Found
        </h1>

        <p className="mt-3 text-red-400">
          Unable to load this match.
        </p>

        <Link
          href="/admin/matches"
          className="mt-5 inline-block text-emerald-400"
        >
          ← Back to Matches
        </Link>
      </main>
    );
  }

  // ==================================================
  // LOAD DATA
  // ==================================================

  const {
    data: teams,
    error: teamsError,
  } =
    await supabase
      .from("teams")
      .select(
        "id, name, short_name"
      )
      .order("name");

  const {
    data: players,
    error: playersError,
  } =
    await supabase
      .from("players")
      .select(
        `
        id,
        name,
        jersey_number,
        position,
        team_id
        `
      )
      .order("name");

  const {
    data: events,
    error: eventsError,
  } =
    await supabase
      .from("match_events")
      .select(
        `
        id,
        team_id,
        player_id,
        assist_player_id,
        player_in_id,
        player_out_id,
        event_type,
        minute,
        added_time,
        description
        `
      )
      .eq(
        "match_id",
        matchId
      )
      .order("minute")
      .order("id");

  const {
    data: teamStats,
    error: teamStatsError,
  } =
    await supabase
      .from("team_match_stats")
      .select(
        `
        id,
        match_id,
        team_id,
        possession,
        shots,
        shots_on_target,
        corners,
        saves
        `
      )
      .eq(
        "match_id",
        matchId
      );

  const {
    data: playerStats,
    error: playerStatsError,
  } =
    await supabase
      .from("player_match_stats")
      .select(
        `
        id,
        match_id,
        player_id,
        minutes_played,
        goals,
        assists,
        yellow_cards,
        red_cards
        `
      )
      .eq(
        "match_id",
        matchId
      );

  const {
    data: lineups,
    error: lineupsError,
  } = await supabase
    .from("match_lineups")
    .select(
      "id, match_id, team_id, formation, starting_xi"
    )
    .eq("match_id", matchId);

  if (
    teamsError ||
    playersError ||
    eventsError ||
    teamStatsError ||
    playerStatsError ||
    lineupsError
  ) {
    console.error(
      "Data loading error",
      {
        teamsError,
        playersError,
        eventsError,
        teamStatsError,
        playerStatsError,
        lineupsError,
      }
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to Load Match
        </h1>
      </main>
    );
  }

  const typedMatch =
    match as Match;

  const typedTeams =
    (teams ??
      []) as Team[];

  const typedPlayers =
    (players ??
      []) as Player[];

  const typedEvents =
    (events ??
      []) as MatchEvent[];

  const typedTeamStats =
    (teamStats ??
      []) as TeamMatchStat[];

  const typedPlayerStats =
    (playerStats ??
      []) as PlayerMatchStat[];

  const typedLineups =
    (lineups ??
      []) as MatchLineupRow[];

  const homeTeam =
    typedTeams.find(
      (team) =>
        team.id ===
        typedMatch.home_team_id
    );

  const awayTeam =
    typedTeams.find(
      (team) =>
        team.id ===
        typedMatch.away_team_id
    );

  const homeStats =
    typedTeamStats.find(
      (stat) =>
        stat.team_id ===
        typedMatch.home_team_id
    );

  const awayStats =
    typedTeamStats.find(
      (stat) =>
        stat.team_id ===
        typedMatch.away_team_id
    );

  const matchPlayers =
    typedPlayers.filter(
      (player) =>
        player.team_id ===
          typedMatch.home_team_id ||
        player.team_id ===
          typedMatch.away_team_id
    );

  const homePlayers =
    typedPlayers.filter(
      (player) =>
        player.team_id ===
        typedMatch.home_team_id
    );

  const awayPlayers =
    typedPlayers.filter(
      (player) =>
        player.team_id ===
        typedMatch.away_team_id
    );

  const homeLineup =
    typedLineups.find(
      (lineup) =>
        lineup.team_id ===
        typedMatch.home_team_id
    ) ?? null;

  const awayLineup =
    typedLineups.find(
      (lineup) =>
        lineup.team_id ===
        typedMatch.away_team_id
    ) ?? null;

  // ==================================================
  // HELPERS
  // ==================================================

  function getTeamName(
    teamId: number
  ) {
    return (
      typedTeams.find(
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
      typedPlayers.find(
        (player) =>
          player.id === playerId
      )?.name ??
      "Unknown Player"
    );
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

      default:
        return "Match Event";
    }
  }

  // ==================================================
  // SAVE HALF DURATION
  // ==================================================

  async function saveHalfDuration(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const minutes = Number(
      formData.get(
        "half_duration_minutes"
      )
    );

    if (
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      minutes > 120
    ) {
      redirect(
        `/admin/matches/${matchId}?error=duration`
      );
    }

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select("status")
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
      "scheduled"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=duration_locked`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          half_duration_minutes:
            Math.floor(minutes),
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=duration`
      );
    }

    redirect(
      `/admin/matches/${matchId}?success=duration`
    );
  }

  // ==================================================
  // START FIRST HALF
  // ==================================================

  async function startFirstHalf() {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const { data: currentMatch } =
      await serverSupabase
        .from("matches")
        .select("status, home_team_id, away_team_id")
        .eq("id", matchId)
        .single();

    if (!currentMatch || currentMatch.status !== "scheduled") {
      redirect(
        `/admin/matches/${matchId}?error=start`
      );
    }

    const { data: savedLineups } =
      await serverSupabase
        .from("match_lineups")
        .select("team_id, starting_xi")
        .eq("match_id", matchId);

    const homeSaved = savedLineups?.find(
      (lineup) =>
        lineup.team_id === currentMatch.home_team_id
    );
    const awaySaved = savedLineups?.find(
      (lineup) =>
        lineup.team_id === currentMatch.away_team_id
    );

    if (
      !homeSaved ||
      !awaySaved ||
      !Array.isArray(homeSaved.starting_xi) ||
      !Array.isArray(awaySaved.starting_xi) ||
      homeSaved.starting_xi.length !== 11 ||
      awaySaved.starting_xi.length !== 11
    ) {
      redirect(
        `/admin/matches/${matchId}?error=lineup_required`
      );
    }

    const now =
      new Date().toISOString();

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          status: "live",
          match_period:
            "first_half",

          first_half_started_at:
            now,

          current_half_started_at:
            now,

          second_half_started_at:
            null,

          paused_at: null,

          elapsed_seconds: 0,

          added_time_minutes: 0,

          added_time_started:
            false,

          previous_match_period:
            null,

          result_type:
            "normal",

          cancellation_reason:
            null,
        })
        .eq(
          "id",
          matchId
        )
        .eq(
          "status",
          "scheduled"
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=start`
      );
    }

    // Record the start of the match in the viewer timeline.
    const { error: matchStartedEventError } =
      await serverSupabase
        .from("match_events")
        .insert({
          match_id: matchId,
          team_id: currentMatch.home_team_id ?? null,
          player_id: null,
          assist_player_id: null,
          player_in_id: null,
          player_out_id: null,
          event_type: "match_started",
          minute: 0,
          added_time: 0,
          description: "Match started.",
        });

    if (matchStartedEventError) {
      console.error(
        "Match-start event error:",
        matchStartedEventError
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // START ADDED TIME
  // ==================================================

  async function startAddedTime(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const addedMinutes =
      Number(
        formData.get(
          "added_time_minutes"
        )
      );

    if (
      !Number.isFinite(
        addedMinutes
      ) ||
      addedMinutes < 1 ||
      addedMinutes > 30
    ) {
      redirect(
        `/admin/matches/${matchId}?error=added_time`
      );
    }

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          `
          status,
          match_period,
          elapsed_seconds,
          half_duration_minutes,
          added_time_started,
          current_half_started_at,
          home_team_id
          `
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
      "live"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=not_live`
      );
    }

    if (
      currentMatch.match_period !==
        "first_half" &&
      currentMatch.match_period !==
        "second_half"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=added_time_state`
      );
    }

    if (
      currentMatch.added_time_started
    ) {
      redirect(
        `/admin/matches/${matchId}?error=added_time_started`
      );
    }

    const regulationSeconds =
      currentMatch.match_period ===
      "second_half"
        ? currentMatch.half_duration_minutes *
          2 *
          60
        : currentMatch.half_duration_minutes *
          60;

    // Calculate current elapsed
    // time on the server.
    let elapsed =
      currentMatch.elapsed_seconds ??
      0;

    if (
      currentMatch.current_half_started_at
    ) {
      const started =
        new Date(
          currentMatch.current_half_started_at
        ).getTime();

      const now =
        Date.now();

      elapsed += Math.max(
        0,
        Math.floor(
          (now - started) /
            1000
        )
      );
    }

    if (
      elapsed <
      regulationSeconds
    ) {
      redirect(
        `/admin/matches/${matchId}?error=regulation_not_reached`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          elapsed_seconds:
            Math.max(
              elapsed,
              regulationSeconds
            ),

          added_time_minutes:
            Math.floor(
              addedMinutes
            ),

          added_time_started:
            true,

          current_half_started_at:
            new Date().toISOString(),

          paused_at:
            null,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=added_time`
      );
    }

    // Record the referee's added-time decision as an automatic timeline event.
    const regulationMinute = Math.floor(
      regulationSeconds / 60
    );

    const { error: addedEventError } =
      await serverSupabase
        .from("match_events")
        .insert({
          match_id: matchId,
          team_id: currentMatch.home_team_id,
          player_id: null,
          assist_player_id: null,
          player_in_id: null,
          player_out_id: null,
          event_type: "added_time",
          minute: regulationMinute,
          added_time: Math.floor(addedMinutes),
          description: `Referee added ${Math.floor(addedMinutes)} minute${Math.floor(addedMinutes) === 1 ? "" : "s"}.`,
        });

    if (addedEventError) {
      console.error(
        "Added-time event error:",
        addedEventError
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // HALFTIME
  // ==================================================

  async function startHalfTime() {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          `
          status,
          match_period,
          elapsed_seconds,
          half_duration_minutes,
          current_half_started_at,
          home_team_id
          `
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
        "live" ||
      currentMatch.match_period !==
        "first_half"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=invalid_transition`
      );
    }

    let elapsed =
      currentMatch.elapsed_seconds ??
      0;

    if (
      currentMatch.current_half_started_at
    ) {
      const started =
        new Date(
          currentMatch.current_half_started_at
        ).getTime();

      elapsed += Math.max(
        0,
        Math.floor(
          (Date.now() -
            started) /
            1000
        )
      );
    }

    const regulation =
      currentMatch.half_duration_minutes *
      60;

    if (
      elapsed <
      regulation
    ) {
      redirect(
        `/admin/matches/${matchId}?error=regulation_not_reached`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          match_period:
            "halftime",

          elapsed_seconds:
            elapsed,

          current_half_started_at:
            null,

          paused_at:
            null,

          added_time_started:
            false,

          added_time_minutes:
            0,

          previous_match_period:
            null,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=halftime`
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    const halftimeMinute = Math.floor(
      regulation / 60
    );

    const { error: halftimeEventError } =
      await serverSupabase
        .from("match_events")
        .insert({
          match_id: matchId,
          team_id: currentMatch.home_team_id ?? null,
          player_id: null,
          assist_player_id: null,
          player_in_id: null,
          player_out_id: null,
          event_type: "halftime",
          minute: halftimeMinute,
          added_time: 0,
          description: "Half time.",
        });

    if (halftimeEventError) {
      console.error(
        "Half-time event error:",
        halftimeEventError
      );
    }

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // START SECOND HALF
  // ==================================================

  async function startSecondHalf() {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const now =
      new Date().toISOString();

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "status, match_period, half_duration_minutes, elapsed_seconds, home_team_id"
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
        "live" ||
      currentMatch.match_period !==
        "halftime"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=invalid_transition`
      );
    }

    // Keep the cumulative elapsed time from the first half.
    // This includes any first-half added time and is also the
    // baseline used for cumulative player minutes.
    const cumulativeElapsedSeconds =
      Number(currentMatch.elapsed_seconds ?? 0);

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          match_period:
            "second_half",

          status: "live",

          second_half_started_at:
            now,

          current_half_started_at:
            now,

          paused_at: null,

          // The second-half clock starts at the first-half
          // regulation endpoint (e.g. 10:00), not at first-half
          // added time. Player-minute calculation keeps stoppage
          // time separately.
          elapsed_seconds:
            Number(currentMatch.half_duration_minutes ?? 0) *
            60,

          added_time_minutes:
            0,

          added_time_started:
            false,

          previous_match_period:
            null,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=second_half`
      );
    }

    // Timeline marker used only by the minute engine to distinguish
    // second-half substitutions from first-half stoppage time.
    const regulationMinute =
      Number(currentMatch.half_duration_minutes ?? 0);

    const { error: secondHalfMarkerError } =
      await serverSupabase
        .from("match_events")
        .insert({
          match_id: matchId,
          team_id: currentMatch.home_team_id ?? 0,
          player_id: null,
          assist_player_id: null,
          player_in_id: null,
          player_out_id: null,
          event_type: "second_half_start",
          minute: regulationMinute,
          added_time: 0,
          description: "Second half started.",
        });

    if (secondHalfMarkerError) {
      console.error(
        "Second-half marker error:",
        secondHalfMarkerError
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // PAUSE
  // ==================================================

  async function pauseMatch() {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          `
          status,
          match_period,
          elapsed_seconds,
          current_half_started_at
          `
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
        "live" ||
      (
        currentMatch.match_period !==
          "first_half" &&
        currentMatch.match_period !==
          "second_half"
      )
    ) {
      redirect(
        `/admin/matches/${matchId}?error=cannot_pause`
      );
    }

    let elapsed =
      currentMatch.elapsed_seconds ??
      0;

    if (
      currentMatch.current_half_started_at
    ) {
      const started =
        new Date(
          currentMatch.current_half_started_at
        ).getTime();

      elapsed += Math.max(
        0,
        Math.floor(
          (Date.now() -
            started) /
            1000
        )
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          match_period:
            "paused",

          previous_match_period:
            currentMatch.match_period,

          elapsed_seconds:
            elapsed,

          current_half_started_at:
            null,

          paused_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=pause`
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // RESUME
  // ==================================================

  async function resumeMatch() {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          `
          status,
          match_period,
          previous_match_period
          `
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
        "live" ||
      currentMatch.match_period !==
        "paused"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=cannot_resume`
      );
    }

    if (
      currentMatch.previous_match_period !==
        "first_half" &&
      currentMatch.previous_match_period !==
        "second_half"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=cannot_resume`
      );
    }

    const now =
      new Date().toISOString();

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          match_period:
            currentMatch.previous_match_period,

          current_half_started_at:
            now,

          paused_at:
            null,

          previous_match_period:
            null,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=resume`
      );
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // FULL TIME
  // ==================================================

  async function endMatchNormally() {
  "use server";

  const serverSupabase = await createClient();

  const {
    data: { user: currentUser },
  } =
    await serverSupabase.auth.getUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const { data: admin } =
    await serverSupabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  const { data: currentMatch } =
    await serverSupabase
      .from("matches")
      .select(
        `
        status,
        match_period,
        half_duration_minutes,
        elapsed_seconds,
        current_half_started_at,
        added_time_started,
        added_time_minutes,
        home_team_id
        `
      )
      .eq("id", matchId)
      .single();

  if (!currentMatch) {
    redirect(
      `/admin/matches/${matchId}?error=not_found`
    );
  }

  if (
    currentMatch.status !== "live" ||
    currentMatch.match_period !== "second_half"
  ) {
    redirect(
      `/admin/matches/${matchId}?error=not_full_time`
    );
  }

  let currentSecondHalfSeconds =
    0;

  if (
    currentMatch.current_half_started_at
  ) {
    const startedAt =
      new Date(
        currentMatch.current_half_started_at
      ).getTime();

    currentSecondHalfSeconds =
      Math.max(
        0,
        Math.floor(
          (Date.now() - startedAt) /
            1000
        )
      );
  }

  const regulationSeconds =
    currentMatch.half_duration_minutes *
    60;

  /*
   * The match may already have regulation
   * time stored in elapsed_seconds.
   *
   * When second half starts, elapsed_seconds
   * is set to the first-half duration.
   *
   * Therefore we only need to check the
   * currently-running second-half portion.
   */

  if (
    currentSecondHalfSeconds <
    regulationSeconds &&
    !currentMatch.added_time_started
  ) {
    redirect(
      `/admin/matches/${matchId}?error=regulation_not_reached`
    );
  }

  const totalElapsed =
    regulationSeconds +
    currentSecondHalfSeconds;

  const { error } =
    await serverSupabase
      .from("matches")
      .update({
        status: "completed",
        match_period: "full_time",

        elapsed_seconds:
          currentMatch.added_time_started
            ? Math.max(
                currentMatch.elapsed_seconds ??
                  regulationSeconds,
                totalElapsed
              )
            : totalElapsed,

        current_half_started_at: null,
        paused_at: null,

        result_type: "normal",
      })
      .eq("id", matchId);

  if (error) {
    console.error(
      "Full time error:",
      error
    );

    redirect(
      `/admin/matches/${matchId}?error=end`
    );
  }

  const fullTimeMinute = Math.floor(
    totalElapsed / 60
  );

  // The current added-time value belongs to the second half here.
  const secondHalfAddedMinutes =
    currentMatch.added_time_started
      ? Number(currentMatch.added_time_minutes ?? 0)
      : 0;

  const fullTimeDisplayMinute =
    currentMatch.added_time_started
      ? Number(currentMatch.half_duration_minutes) * 2
      : fullTimeMinute;

  const { error: fullTimeEventError } =
    await serverSupabase
      .from("match_events")
      .insert({
        match_id: matchId,
        team_id: currentMatch.home_team_id ?? null,
        player_id: null,
        assist_player_id: null,
        player_in_id: null,
        player_out_id: null,
        event_type: "full_time",
        minute: fullTimeDisplayMinute,
        added_time: secondHalfAddedMinutes,
        description: "Full time.",
      });

  if (fullTimeEventError) {
    console.error(
      "Full-time event error:",
      fullTimeEventError
    );
  }

  redirect(
    `/admin/matches/${matchId}?success=completed`
  );
}

  // ==================================================
  // RESULT / CANCEL ACTIONS
  // ==================================================

  async function declareDraw(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const reason =
      String(
        formData.get(
          "reason"
        ) ?? ""
      ).trim();

    const {
      data: currentMatch,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "status, home_score, away_score"
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (
      currentMatch.status !==
      "live"
    ) {
      redirect(
        `/admin/matches/${matchId}?error=not_live`
      );
    }

    if (
      currentMatch.home_score !==
      currentMatch.away_score
    ) {
      redirect(
        `/admin/matches/${matchId}?error=draw_score`
      );
    }

    if (!reason) {
      redirect(
        `/admin/matches/${matchId}?error=draw_reason`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          status:
            "completed",

          match_period:
            "full_time",

          current_half_started_at:
            null,

          paused_at: null,

          added_time_started:
            false,

          result_type:
            "draw",

          cancellation_reason:
            reason,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=draw`
      );
    }

    redirect(
      `/admin/matches/${matchId}?success=draw`
    );
  }

  async function cancelMatch(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const reason =
      String(
        formData.get(
          "reason"
        ) ?? ""
      ).trim();

    if (!reason) {
      redirect(
        `/admin/matches/${matchId}?error=cancel_reason`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          status:
            "cancelled",

          match_period:
            "cancelled",

          current_half_started_at:
            null,

          paused_at: null,

          added_time_started:
            false,

          result_type:
            "cancelled",

          cancellation_reason:
            reason,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        error
      );

      redirect(
        `/admin/matches/${matchId}?error=cancel`
      );
    }

    redirect(
      `/admin/matches/${matchId}?success=cancelled`
    );
  }

  // ==================================================
  // EXISTING EVENT ACTIONS
  // ==================================================

  async function addEvent(
    formData: FormData
  ) {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: admin } = await serverSupabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const eventType = String(formData.get("event_type") ?? "");
    const teamId = Number(formData.get("team_id"));
    const playerIdValue = String(formData.get("player_id") ?? "");
    const assistValue = String(formData.get("assist_player_id") ?? "");
    const playerInValue = String(formData.get("player_in_id") ?? "");
    const playerOutValue = String(formData.get("player_out_id") ?? "");
    const description = String(formData.get("description") ?? "").trim();

    if (!eventType || !teamId) return;

    const { data: currentMatch, error: matchError } = await serverSupabase
      .from("matches")
      .select(
        "status, match_period, half_duration_minutes, elapsed_seconds, current_half_started_at"
      )
      .eq("id", matchId)
      .single();

    if (matchError || !currentMatch) return;

    if (
      currentMatch.status !== "live" ||
      !["first_half", "second_half"].includes(currentMatch.match_period ?? "")
    ) {
      return;
    }

    // The database/server calculates the event minute from the authoritative match clock.
    let elapsedSeconds = Number(currentMatch.elapsed_seconds ?? 0);

    if (currentMatch.current_half_started_at) {
      elapsedSeconds += Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(currentMatch.current_half_started_at).getTime()) /
            1000
        )
      );
    }

    const minute = Math.max(1, Math.floor(elapsedSeconds / 60) + 1);

    const playerId = playerIdValue ? Number(playerIdValue) : null;
    const assistPlayerId = assistValue ? Number(assistValue) : null;
    const playerInId = playerInValue ? Number(playerInValue) : null;
    const playerOutId = playerOutValue ? Number(playerOutValue) : null;

    const { data: lineup } = await serverSupabase
      .from("match_lineups")
      .select("team_id, starting_xi")
      .eq("match_id", matchId)
      .eq("team_id", teamId)
      .maybeSingle();

    if (!lineup) return;

    const { data: squad } = await serverSupabase
      .from("players")
      .select("id, team_id")
      .eq("team_id", teamId);

    if (!squad) return;

    const squadIds = new Set(
      squad.map((player) => Number(player.id))
    );

    const currentXI = Array.isArray(lineup.starting_xi)
      ? lineup.starting_xi.map(Number).filter((id) => squadIds.has(id))
      : [];

    const { data: substitutions } = await serverSupabase
      .from("match_events")
      .select("id, minute, added_time, player_in_id, player_out_id")
      .eq("match_id", matchId)
      .eq("team_id", teamId)
      .eq("event_type", "substitution")
      .order("minute", { ascending: true })
      .order("id", { ascending: true });

    for (const event of substitutions ?? []) {
      const outId = event.player_out_id ? Number(event.player_out_id) : null;
      const inId = event.player_in_id ? Number(event.player_in_id) : null;

      if (!outId || !inId) continue;

      const outIndex = currentXI.indexOf(outId);
      if (outIndex < 0) continue;

      currentXI[outIndex] = inId;
    }

    const currentXISet = new Set(currentXI);
    const substituteIds = new Set(
      squad
        .map((player) => Number(player.id))
        .filter((playerId) => !currentXISet.has(playerId))
    );

    if (
      [
        "goal",
        "penalty_goal",
        "own_goal",
        "yellow_card",
        "red_card",
      ].includes(eventType)
    ) {
      if (!playerId || !currentXISet.has(playerId)) return;
    }

    if (eventType === "goal" && assistPlayerId) {
      if (!currentXISet.has(assistPlayerId)) return;
      if (assistPlayerId === playerId) return;
    }

    if (eventType === "substitution") {
      if (!playerOutId || !playerInId) return;
      if (!currentXISet.has(playerOutId)) return;
      if (!substituteIds.has(playerInId)) return;
    }

    const { error } = await serverSupabase
      .from("match_events")
      .insert({
        match_id: matchId,
        team_id: teamId,
        player_id: playerId,
        assist_player_id: eventType === "goal" ? assistPlayerId : null,
        player_in_id: eventType === "substitution" ? playerInId : null,
        player_out_id: eventType === "substitution" ? playerOutId : null,
        event_type: eventType,
        minute,
        // Retained for schema compatibility; added time is no longer entered by admin.
        added_time: 0,
        description: description || null,
      });

    if (error) {
      console.error("Add event error:", error);
      return;
    }

    await syncPlayerMinutes(serverSupabase, matchId);

    redirect(`/admin/matches/${matchId}`);
  }

  async function editEvent(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const eventId =
      Number(
        formData.get(
          "event_id"
        )
      );

    const eventType =
      String(
        formData.get(
          "event_type"
        ) ?? ""
      );

    const teamId =
      Number(
        formData.get(
          "team_id"
        )
      );

    const playerIdValue =
      String(
        formData.get(
          "player_id"
        ) ?? ""
      );

    const assistValue =
      String(
        formData.get(
          "assist_player_id"
        ) ?? ""
      );

    const playerInValue =
      String(
        formData.get(
          "player_in_id"
        ) ?? ""
      );

    const playerOutValue =
      String(
        formData.get(
          "player_out_id"
        ) ?? ""
      );

    const minute =
      Number(
        formData.get(
          "minute"
        )
      );

    const addedTime =
      Number(
        formData.get(
          "added_time"
        ) ?? 0
      );

    const description =
      String(
        formData.get(
          "description"
        ) ?? ""
      ).trim();

    if (
      !eventId ||
      !eventType ||
      !teamId ||
      !minute ||
      minute < 1
    ) {
      return;
    }

    const playerId =
      playerIdValue !== ""
        ? Number(
            playerIdValue
          )
        : null;

    const assistPlayerId =
      assistValue !== ""
        ? Number(
            assistValue
          )
        : null;

    const playerInId =
      playerInValue !== ""
        ? Number(
            playerInValue
          )
        : null;

    const playerOutId =
      playerOutValue !== ""
        ? Number(
            playerOutValue
          )
        : null;

    const { error } =
      await serverSupabase
        .from(
          "match_events"
        )
        .update({
          team_id:
            teamId,

          player_id:
            playerId,

          assist_player_id:
            eventType ===
            "goal"
              ? assistPlayerId
              : null,

          player_in_id:
            eventType ===
            "substitution"
              ? playerInId
              : null,

          player_out_id:
            eventType ===
            "substitution"
              ? playerOutId
              : null,

          event_type:
            eventType,

          minute,

          added_time:
            Math.max(
              0,
              addedTime
            ),

          description:
            description ||
            null,
        })
        .eq(
          "id",
          eventId
        )
        .eq(
          "match_id",
          matchId
        );

    if (error) {
      console.error(
        error
      );
      return;
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  async function deleteEvent(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const eventId =
      Number(
        formData.get(
          "event_id"
        )
      );

    if (!eventId) {
      return;
    }

    const { error } =
      await serverSupabase
        .from(
          "match_events"
        )
        .delete()
        .eq(
          "id",
          eventId
        )
        .eq(
          "match_id",
          matchId
        );

    if (error) {
      console.error(
        error
      );
      return;
    }

    await syncPlayerMinutes(
      serverSupabase,
      matchId
    );

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // TEAM STATS
  // ==================================================

  async function saveTeamStats(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect(
        "/auth/login"
      );
    }

    const {
      data: admin,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const homePossession =
      Number(
        formData.get(
          "home_possession"
        ) ?? 0
      );

    const awayPossession =
      Number(
        formData.get(
          "away_possession"
        ) ?? 0
      );

    if (
      homePossession +
        awayPossession !==
      100
    ) {
      return;
    }

    const { error } =
      await serverSupabase
        .from(
          "team_match_stats"
        )
        .upsert(
          [
            {
              match_id:
                matchId,

              team_id:
                typedMatch.home_team_id,

              possession:
                homePossession,

              shots:
                Number(
                  formData.get(
                    "home_shots"
                  ) ?? 0
                ),

              shots_on_target:
                Number(
                  formData.get(
                    "home_shots_on_target"
                  ) ?? 0
                ),

              corners:
                Number(
                  formData.get(
                    "home_corners"
                  ) ?? 0
                ),

              saves:
                Number(
                  formData.get(
                    "home_saves"
                  ) ?? 0
                ),
            },

            {
              match_id:
                matchId,

              team_id:
                typedMatch.away_team_id,

              possession:
                awayPossession,

              shots:
                Number(
                  formData.get(
                    "away_shots"
                  ) ?? 0
                ),

              shots_on_target:
                Number(
                  formData.get(
                    "away_shots_on_target"
                  ) ?? 0
                ),

              corners:
                Number(
                  formData.get(
                    "away_corners"
                  ) ?? 0
                ),

              saves:
                Number(
                  formData.get(
                    "away_saves"
                  ) ?? 0
                ),
            },
          ],
          {
            onConflict:
              "match_id,team_id",
          }
        );

    if (error) {
      console.error(
        error
      );
      return;
    }

    redirect(
      `/admin/matches/${matchId}`
    );
  }

  // ==================================================
  // SAVE MATCH LINEUP
  // ==================================================

  async function saveLineup(
    formData: FormData
  ) {
    "use server";

    const serverSupabase =
      await createClient();

    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: admin } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (!admin) {
      redirect("/");
    }

    const teamId = Number(
      formData.get("team_id")
    );

    const formation = String(
      formData.get("formation") ?? ""
    ).trim();

    const startingXi = formData
      .getAll("starting_xi")
      .map((value) => Number(value))
      .filter((id) => id > 0);

    if (
      !teamId ||
      !formation ||
      startingXi.length !== 11 ||
      new Set(startingXi).size !== 11
    ) {
      redirect(
        `/admin/matches/${matchId}?error=lineup_invalid`
      );
    }

    const { data: currentMatch } =
      await serverSupabase
        .from("matches")
        .select(
          "status, home_team_id, away_team_id"
        )
        .eq("id", matchId)
        .single();

    if (!currentMatch) {
      redirect(
        `/admin/matches/${matchId}?error=not_found`
      );
    }

    if (currentMatch.status !== "scheduled") {
      redirect(
        `/admin/matches/${matchId}?error=lineup_locked`
      );
    }

    if (
      teamId !== currentMatch.home_team_id &&
      teamId !== currentMatch.away_team_id
    ) {
      redirect(
        `/admin/matches/${matchId}?error=lineup_team`
      );
    }

    const { data: squadPlayers, error: squadError } =
      await serverSupabase
        .from("players")
        .select("id")
        .eq("team_id", teamId)
        .in("id", startingXi);

    if (
      squadError ||
      !squadPlayers ||
      squadPlayers.length !== 11
    ) {
      redirect(
        `/admin/matches/${matchId}?error=lineup_players`
      );
    }

    const { error } =
      await serverSupabase
        .from("match_lineups")
        .upsert(
          {
            match_id: matchId,
            team_id: teamId,
            formation,
            starting_xi: startingXi,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "match_id,team_id",
          }
        );

    if (error) {
      console.error(
        "Save lineup error:",
        error
      );
      redirect(
        `/admin/matches/${matchId}?error=lineup_save`
      );
    }

    redirect(
      `/admin/matches/${matchId}?success=lineup`
    );
  }


  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ================================================= */}
      {/* NAV */}
      {/* ================================================= */}

      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <Link
              href="/admin"
              className="text-xl font-bold"
            >
              ⚽ Campus League
            </Link>

            <p className="mt-1 text-xs text-slate-500">
              Match Control
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/matches"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              ← Matches
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* ================================================= */}
        {/* MESSAGE */}
        {/* ================================================= */}

        {query.success ===
          "duration" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            Half duration saved.
          </div>
        )}

        {query.success ===
          "completed" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            Match finished.
          </div>
        )}

        {query.success ===
          "draw" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            Match declared as a draw.
          </div>
        )}

        {query.error === "lineup_required" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300">
            Save the Starting XI for both teams before starting the match.
          </div>
        )}

        {query.success === "lineup" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            Starting XI and formation saved.
          </div>
        )}

        {query.error && !query.error.startsWith("lineup_") && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            Match control error:{" "}
            {query.error}
          </div>
        )}

        {/* ================================================= */}
        {/* SCORE */}
        {/* ================================================= */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="grid gap-8 text-center md:grid-cols-3 md:items-center">
            <div>
              <h1 className="text-2xl font-black">
                {homeTeam?.name ??
                  "Home Team"}
              </h1>
            </div>

            <div>
              <div className="text-6xl font-black">
                {
                  typedMatch.home_score
                }

                <span className="mx-4 text-slate-600">
                  -
                </span>

                {
                  typedMatch.away_score
                }
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {typedMatch.venue ??
                  "Venue not specified"}
              </p>
            </div>

            <div>
              <h1 className="text-2xl font-black">
                {awayTeam?.name ??
                  "Away Team"}
              </h1>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* HALF DURATION */}
        {/* ================================================= */}

        {typedMatch.status ===
          "scheduled" && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              Match Duration
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              The referee decides the regulation duration of
              each half before the match starts.
            </p>

            <form
              action={
                saveHalfDuration
              }
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Minutes per half
                </label>

                <input
                  name="half_duration_minutes"
                  type="number"
                  min="1"
                  max="120"
                  defaultValue={
                    typedMatch.half_duration_minutes
                  }
                  required
                  className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
              >
                Save Half Duration
              </button>
            </form>
          </section>
        )}

        {/* ================================================= */}
        {/* FORMATIONS & STARTING XI */}
        {/* ================================================= */}

        {typedMatch.status === "scheduled" && (
          <MatchLineup
            homeTeam={{
              id: homeTeam?.id ?? typedMatch.home_team_id,
              name: homeTeam?.name ?? "Home Team",
              short_name: homeTeam?.short_name ?? "HOME",
            }}
            awayTeam={{
              id: awayTeam?.id ?? typedMatch.away_team_id,
              name: awayTeam?.name ?? "Away Team",
              short_name: awayTeam?.short_name ?? "AWAY",
            }}
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            homeLineup={homeLineup}
            awayLineup={awayLineup}
            saveLineup={saveLineup}
            matchStatus={typedMatch.status}
          />
        )}

        {/* ================================================= */}
        {/* MATCH CONTROL */}
        {/* ================================================= */}

        <section className="mt-6">
          <h2 className="mb-4 text-2xl font-bold">
            Match Control
          </h2>

          <MatchControl
            matchId={typedMatch.id}
            match={{
              status: typedMatch.status,
              match_period: typedMatch.match_period,
              half_duration_minutes:
                typedMatch.half_duration_minutes,
              elapsed_seconds:
                typedMatch.elapsed_seconds,
              current_half_started_at:
                typedMatch.current_half_started_at,
              added_time_minutes:
                typedMatch.added_time_minutes,
              added_time_started:
                typedMatch.added_time_started,
              previous_match_period:
                typedMatch.previous_match_period,
            }}
            startFirstHalf={startFirstHalf}
            syncPlayerMinutes={syncPlayerMinutesAction}
            pauseMatch={pauseMatch}
            resumeMatch={resumeMatch}
            startHalfTime={startHalfTime}
            startSecondHalf={startSecondHalf}
            startAddedTime={startAddedTime}
            endMatchNormally={endMatchNormally}
            cancelMatch={cancelMatch}
          />
        </section>

        {/* ================================================= */}
        {/* EXISTING EVENT FORM */}
        {/* ================================================= */}

        {typedMatch.status ===
          "live" &&
          (
            typedMatch.match_period ===
              "first_half" ||
            typedMatch.match_period ===
              "second_half"
          ) && (
            <section className="mt-8">
              <h2 className="mb-4 text-2xl font-bold">
                Add Match Event
              </h2>

              <EventForm
                homeTeam={
                  homeTeam
                    ? {
                        id: homeTeam.id,
                        name: homeTeam.name,
                      }
                    : null
                }
                awayTeam={
                  awayTeam
                    ? {
                        id: awayTeam.id,
                        name: awayTeam.name,
                      }
                    : null
                }
                players={
                  matchPlayers.map(
                    (player) => ({
                      id: player.id,
                      name: player.name,
                      position: player.position,
                      team_id: player.team_id,
                      jersey_number: player.jersey_number,
                    })
                  )
                }
                events={typedEvents}
                lineups={typedLineups}
                matchPeriod={typedMatch.match_period}
                elapsedSeconds={typedMatch.elapsed_seconds}
                currentHalfStartedAt={typedMatch.current_half_started_at}
                halfDurationMinutes={typedMatch.half_duration_minutes}
                action={addEvent}
              />
            </section>
          )}

        {/* ================================================= */}
        {/* TEAM STATS */}
        {/* ================================================= */}

        <section className="mt-8">
          <h2 className="mb-2 text-2xl font-bold">
            Match Statistics
          </h2>

          <p className="mb-5 text-sm text-slate-500">
            Update the live team statistics below. These values are shown to viewers on the match page.
          </p>

          <form
            action={
              saveTeamStats
            }
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  prefix: "home",
                  team: homeTeam,
                  stats: homeStats,
                },
                {
                  prefix: "away",
                  team: awayTeam,
                  stats: awayStats,
                },
              ].map(
                ({
                  prefix,
                  team,
                  stats,
                }) => (
                  <div
                    key={prefix}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <h3 className="mb-5 text-xl font-bold">
                      {team?.name}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Possession (%)
                        </label>
                        <input
                          name={`${prefix}_possession`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={
                            stats?.possession ??
                            50
                          }
                          placeholder="e.g. 55"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Shots
                        </label>
                        <input
                          name={`${prefix}_shots`}
                          type="number"
                          min="0"
                          defaultValue={
                            stats?.shots ??
                            0
                          }
                          placeholder="e.g. 8"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Shots on Target
                        </label>
                        <input
                          name={`${prefix}_shots_on_target`}
                          type="number"
                          min="0"
                          defaultValue={
                            stats?.shots_on_target ??
                            0
                          }
                          placeholder="e.g. 4"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Corners
                        </label>
                        <input
                          name={`${prefix}_corners`}
                          type="number"
                          min="0"
                          defaultValue={
                            stats?.corners ??
                            0
                          }
                          placeholder="e.g. 5"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Saves
                        </label>
                        <input
                          name={`${prefix}_saves`}
                          type="number"
                          min="0"
                          defaultValue={
                            stats?.saves ??
                            0
                          }
                          placeholder="e.g. 3"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950"
            >
              Save Team Statistics
            </button>
          </form>
        </section>

        {/* ================================================= */}
        {/* EVENTS */}
        {/* ================================================= */}

        <section className="mt-8 pb-10">
          <h2 className="mb-4 text-2xl font-bold">
            Match Events
          </h2>

          {typedEvents.length >
          0 ? (
            <div className="space-y-3">
              {typedEvents
                .filter((event) => event.event_type !== "second_half_start")
                .map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 text-sm font-bold text-slate-500">
                        {
                          event.minute
                        }
                        {event.added_time
                          ? `+${event.added_time}`
                          : ""}
                        &apos;
                      </div>

                      <div className="text-2xl">
                        {
                          eventIcon(
                            event.event_type
                          )
                        }
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold">
                          {
                            eventLabel(
                              event.event_type
                            )
                          }
                        </p>

                        {event.event_type !== "added_time" && (
                          <p className="text-sm text-slate-500">
                            {
                              getTeamName(
                                event.team_id
                              )
                            }
                          </p>
                        )}
                      </div>

                      {event.event_type !== "added_time" && (
                        <form
                          action={
                            deleteEvent
                          }
                        >
                          <input
                            type="hidden"
                            name="event_id"
                            value={
                              event.id
                            }
                          />

                          <button
                            type="submit"
                            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="mt-4 text-sm text-slate-400">
                      {event.event_type === "added_time" ? (
                        <span className="font-semibold text-yellow-400">
                          Referee added {event.added_time ?? 0} minute{(event.added_time ?? 0) === 1 ? "" : "s"}.
                        </span>
                      ) : event.event_type ===
                      "substitution" ? (
                        <>
                          OUT:{" "}
                          {getPlayerName(
                            event.player_out_id
                          )}

                          {" → "}

                          IN:{" "}
                          {getPlayerName(
                            event.player_in_id
                          )}
                        </>
                      ) : (
                        <>
                          Player:{" "}
                          {getPlayerName(
                            event.player_id
                          )}

                          {event.assist_player_id && (
                            <>
                              {" · "}
                              Assist:{" "}
                              {getPlayerName(
                                event.assist_player_id
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No events recorded yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}