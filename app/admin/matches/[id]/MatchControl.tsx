"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import MatchClock from "@/app/matches/[id]/MatchClock";

type MatchState = {
  status: string;
  match_period: string | null;
  half_duration_minutes: number;
  elapsed_seconds: number;
  current_half_started_at:
    | string
    | null;
  added_time_minutes: number;
  added_time_started: boolean;
  previous_match_period:
    | string
    | null;
};

type Action = (
  formData: FormData
) => void | Promise<void>;

type Props = {
  match: MatchState;
  matchId: number;

  startFirstHalf: Action;
  syncPlayerMinutes: Action;
  pauseMatch: Action;
  resumeMatch: Action;
  startHalfTime: Action;
  startSecondHalf: Action;
  startAddedTime: Action;
  endMatchNormally: Action;
  cancelMatch: Action;
};

export default function MatchControl({
  match,
  matchId,
  startFirstHalf,
  syncPlayerMinutes,
  pauseMatch,
  resumeMatch,
  startHalfTime,
  startSecondHalf,
  startAddedTime,
  endMatchNormally,
  cancelMatch,
}: Props) {
  const [mounted, setMounted] =
    useState(false);

  const [now, setNow] =
    useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());

    const timer =
      window.setInterval(() => {
        setNow(Date.now());
      }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const currentElapsed =
    useMemo(() => {
      if (
        !mounted ||
        now === null ||
        match.status !== "live" ||
        !match.current_half_started_at ||
        match.match_period ===
          "paused" ||
        match.match_period ===
          "halftime"
      ) {
        return Math.max(
          0,
          match.elapsed_seconds
        );
      }

      const started =
        new Date(
          match.current_half_started_at
        ).getTime();

      const running =
        Math.floor(
          (now - started) / 1000
        );

      return Math.max(
        0,
        match.elapsed_seconds +
          running
      );
    }, [
      mounted,
      now,
      match.status,
      match.match_period,
      match.current_half_started_at,
      match.elapsed_seconds,
    ]);

  const regulationSeconds =
    match.match_period ===
    "second_half"
      ? match.half_duration_minutes *
        2 *
        60
      : match.half_duration_minutes *
        60;

  const effectiveElapsedSeconds =
    match.status === "live" &&
    !match.added_time_started &&
    regulationSeconds > 0
      ? Math.min(
          currentElapsed,
          regulationSeconds
        )
      : currentElapsed;

  const currentMatchMinute =
    Math.floor(
      Math.max(0, effectiveElapsedSeconds) / 60
    );

  const lastSyncedMinuteRef =
    useRef<number>(-1);

  // Persist player minutes continuously while the match is running.
  //
  // There are two complementary triggers:
  // 1. A 60-second heartbeat keeps player_match_stats.minutes_played
  //    synchronized even when React/browser rendering is throttled.
  // 2. A minute-change sync below reacts immediately when the displayed
  //    match minute changes.
  //
  // The server action is idempotent because syncPlayerMinutes() rebuilds
  // the minute totals from the lineup + substitution timeline.
  useEffect(() => {
    if (
      !mounted ||
      match.status !== "live" ||
      (match.match_period !== "first_half" &&
        match.match_period !== "second_half")
    ) {
      return;
    }

    const syncNow = () => {
      const formData = new FormData();
      formData.set(
        "match_id",
        String(matchId)
      );

      void Promise.resolve(
        syncPlayerMinutes(formData)
      ).catch((error) => {
        console.error(
          "Automatic player minute sync failed:",
          error
        );
      });
    };

    // Sync immediately when the live-half controller mounts/updates.
    syncNow();

    const heartbeat = window.setInterval(
      syncNow,
      60_000
    );

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [
    mounted,
    matchId,
    match.status,
    match.match_period,
    syncPlayerMinutes,
  ]);

  // Persist player minutes whenever the live clock enters
  // a new displayed match minute.
  //
  // This is intentionally separate from the 60-second heartbeat:
  // it gives responsive minute updates during normal foreground use,
  // while the heartbeat provides a reliable periodic database update.
  useEffect(() => {
    if (
      !mounted ||
      match.status !== "live" ||
      (match.match_period !== "first_half" &&
        match.match_period !== "second_half")
    ) {
      return;
    }

    if (currentMatchMinute <= 0) {
      return;
    }

    if (
      currentMatchMinute ===
      lastSyncedMinuteRef.current
    ) {
      return;
    }

    lastSyncedMinuteRef.current =
      currentMatchMinute;

    const formData = new FormData();
    formData.set(
      "match_id",
      String(matchId)
    );

    void Promise.resolve(
      syncPlayerMinutes(formData)
    ).catch((error) => {
      console.error(
        "Automatic player minute sync failed:",
        error
      );
    });
  }, [
    mounted,
    matchId,
    match.status,
    match.match_period,
    currentMatchMinute,
    syncPlayerMinutes,
  ]);

  useEffect(() => {
    if (
      match.status !== "live" ||
      (match.match_period !== "first_half" &&
        match.match_period !== "second_half")
    ) {
      lastSyncedMinuteRef.current = -1;
    }
  }, [
    matchId,
    match.status,
    match.match_period,
  ]);

  const regulationReached =
    currentElapsed >=
    regulationSeconds;

  useEffect(() => {
    if (
      match.status !== "live" ||
      (match.match_period !== "first_half" &&
        match.match_period !== "second_half")
    ) {
      lastSyncedMinuteRef.current = -1;
    }
  }, [
    matchId,
    match.status,
    match.match_period,
  ]);

  // SCHEDULED
  if (
    match.status ===
      "scheduled" ||
    match.match_period ===
      "scheduled"
  ) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-500">
            Referee-selected duration
          </p>

          <p className="mt-2 text-2xl font-bold">
            {match.half_duration_minutes}
            <span className="ml-2 text-sm font-normal text-slate-500">
              minutes per half
            </span>
          </p>
        </div>

        <form action={startFirstHalf}>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-6 py-4 font-bold text-slate-950"
          >
            ▶ Start First Half
          </button>
        </form>

        <form
          action={cancelMatch}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5"
        >
          <input
            name="reason"
            required
            placeholder="Cancellation reason"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
          />

          <button
            type="submit"
            className="mt-3 w-full rounded-lg border border-yellow-500/40 px-5 py-3 font-semibold text-yellow-400"
          >
            ⚠ Cancel Match
          </button>
        </form>
      </div>
    );
  }

  // HALF TIME
  if (
    match.status === "live" &&
    match.match_period ===
      "halftime"
  ) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
          <p className="font-semibold text-yellow-400">
            ⏱ HALF TIME
          </p>

          <p className="mt-2 text-sm text-slate-500">
            First half has ended.
          </p>
        </div>

        <form action={startSecondHalf}>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-6 py-4 font-bold text-slate-950"
          >
            ▶ Start Second Half
          </button>
        </form>
      </div>
    );
  }

  // PAUSED
  if (
    match.status === "live" &&
    match.match_period ===
      "paused"
  ) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
          <p className="font-semibold text-yellow-400">
            ⏸ MATCH PAUSED
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Paused during{" "}
            {match.previous_match_period ===
            "first_half"
              ? "First Half"
              : "Second Half"}
          </p>
        </div>

        <form action={resumeMatch}>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-6 py-4 font-bold text-slate-950"
          >
            ▶ Resume Match
          </button>
        </form>
      </div>
    );
  }

  // COMPLETED
  if (
    match.status === "completed" ||
    match.match_period ===
      "full_time"
  ) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
        <p className="font-semibold text-emerald-400">
          ■ FULL TIME
        </p>
      </div>
    );
  }

  // CANCELLED
  if (
    match.status === "cancelled"
  ) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
        <p className="font-semibold text-yellow-400">
          ⚠ MATCH CANCELLED
        </p>
      </div>
    );
  }

  // LIVE
  return (
    <div className="space-y-4">

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <MatchClock
            status={match.status}
            matchPeriod={match.match_period}
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
      </div>
    
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {match.match_period ===
          "first_half"
            ? "First Half"
            : "Second Half"}
        </p>

        {regulationReached &&
          !match.added_time_started && (
            <p className="mt-2 font-semibold text-yellow-400">
              REGULATION TIME REACHED
            </p>
          )}

        {!regulationReached && (
          <p className="mt-2 text-sm text-slate-500">
            The referee can decide added time after
            regulation.
          </p>
        )}

        {match.added_time_started && (
          <p className="mt-2 text-sm text-slate-500">
            Added time announced: +
            {match.added_time_minutes}
          </p>
        )}
      </div>

      {/* END MATCH NOW */}

      <form
        action={endMatchNormally}
        className="rounded-xl border border-red-500/30 bg-red-500/5 p-4"
      >
        <p className="mb-3 text-sm text-slate-400">
          End the match immediately at the current point.
        </p>

        <button
          type="submit"
          className="w-full rounded-lg bg-red-500 px-6 py-4 font-bold text-white hover:bg-red-400"
        >
          ■ End Match Now
        </button>
      </form>

      {/* PAUSE */}

      <form action={pauseMatch}>
        <button
          type="submit"
          className="w-full rounded-lg border border-yellow-500/40 px-6 py-4 font-semibold text-yellow-400"
        >
          ⏸ Pause
        </button>
      </form>

      {/* DECIDE ADDED TIME */}

      {regulationReached &&
        !match.added_time_started && (
          <form
            action={startAddedTime}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5"
          >
            <h3 className="font-semibold text-yellow-400">
              Decide Added Time
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              The referee decides how many additional
              minutes will be played.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Added minutes
                </label>

                <input
                  name="added_time_minutes"
                  type="number"
                  min="1"
                  max="30"
                  required
                  className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-yellow-500 px-5 py-3 font-bold text-slate-950"
              >
                Start Added Time
              </button>
            </div>
          </form>
        )}

      {/* FIRST HALF AFTER ADDED TIME */}

      {match.match_period ===
        "first_half" &&
        match.added_time_started && (
          <form action={startHalfTime}>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-700 px-6 py-4 font-bold"
            >
              ⏱ Half Time
            </button>
          </form>
        )}

      {/* SECOND HALF AFTER ADDED TIME */}

      {match.match_period ===
        "second_half" &&
        match.added_time_started && (
          <form
            action={endMatchNormally}
          >
            <button
              type="submit"
              className="w-full rounded-lg bg-red-500 px-6 py-4 font-bold text-white"
            >
              ■ Full Time
            </button>
          </form>
        )}
    </div>
  );
}
