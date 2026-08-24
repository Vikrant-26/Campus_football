/* app/matches/[id]/MatchClock.tsx */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Props = {
  status: string;
  matchPeriod: string | null;
  halfDurationMinutes: number;
  elapsedSeconds: number;
  currentHalfStartedAt: string | null;
  addedTimeMinutes: number;
  addedTimeStarted: boolean;
};

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFootballClock(
  totalSeconds: number,
  halfDurationMinutes: number,
  matchPeriod: string | null
) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const halfSeconds =
    Math.max(1, Number(halfDurationMinutes || 0)) * 60;
  const fullRegulationSeconds = halfSeconds * 2;

  if (matchPeriod === "first_half") {
    if (safe <= halfSeconds) return formatClock(safe);

    return `${Math.floor(halfDurationMinutes)}+${formatClock(
      safe - halfSeconds
    )}`;
  }

  if (matchPeriod === "second_half") {
    if (safe <= fullRegulationSeconds) return formatClock(safe);

    return `${Math.floor(halfDurationMinutes * 2)}+${formatClock(
      safe - fullRegulationSeconds
    )}`;
  }

  return formatClock(safe);
}

export default function MatchClock({
  status,
  matchPeriod,
  halfDurationMinutes,
  elapsedSeconds,
  currentHalfStartedAt,
  addedTimeMinutes,
  addedTimeStarted,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  const currentElapsed = useMemo(() => {
    const base = Math.max(0, Number(elapsedSeconds ?? 0));

    const isRunning =
      status === "live" &&
      (matchPeriod === "first_half" ||
        matchPeriod === "second_half") &&
      !!currentHalfStartedAt &&
      mounted &&
      now !== null;

    if (!isRunning) return base;

    const started = new Date(currentHalfStartedAt!).getTime();

    if (!Number.isFinite(started)) return base;

    const running = Math.floor((now - started) / 1000);

    return Math.max(0, base + Math.max(0, running));
  }, [
    mounted,
    now,
    status,
    matchPeriod,
    elapsedSeconds,
    currentHalfStartedAt,
  ]);

  const halfSeconds =
    Math.max(1, Number(halfDurationMinutes || 0)) * 60;

  const isHalfTime =
    status === "live" &&
    matchPeriod === "halftime";

  const isFullTime =
    status === "completed" ||
    matchPeriod === "full_time";

  const isPaused =
    status === "live" &&
    matchPeriod === "paused";

  const hasRegulation =
    matchPeriod === "first_half"
      ? currentElapsed >= halfSeconds
      : matchPeriod === "second_half"
        ? currentElapsed >= halfSeconds * 2
        : false;

  // Full time is a terminal display state.
  // Do not show any match clock or added-time indicator after FT.
  if (isFullTime) {
    return (
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          FULL TIME
        </p>
      </div>
    );
  }

  let label = "PRE-MATCH";

  if (isHalfTime) {
    label = "HALF TIME";
  } else if (isPaused) {
    label = "PAUSED";
  } else if (matchPeriod === "first_half") {
    label = addedTimeStarted
      ? `FIRST HALF +${addedTimeMinutes}`
      : "FIRST HALF";
  } else if (matchPeriod === "second_half") {
    label = addedTimeStarted
      ? `SECOND HALF +${addedTimeMinutes}`
      : "SECOND HALF";
  }

  let displaySeconds = currentElapsed;

  if (
    matchPeriod === "first_half" &&
    !addedTimeStarted
  ) {
    displaySeconds = Math.min(
      displaySeconds,
      halfSeconds
    );
  } else if (isHalfTime) {
    displaySeconds = halfSeconds;
  } else if (matchPeriod === "second_half") {
    displaySeconds = Math.max(
      displaySeconds,
      halfSeconds
    );
  }

  const regulationReady =
    matchPeriod === "first_half" ||
    matchPeriod === "second_half"
      ? hasRegulation
      : false;

  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-5xl font-black tabular-nums sm:text-6xl">
        {formatFootballClock(
          displaySeconds,
          halfDurationMinutes,
          matchPeriod
        )}
      </p>

      {addedTimeStarted && (
        <p className="mt-2 text-sm font-semibold text-yellow-400">
          +{addedTimeMinutes} added time
        </p>
      )}

      {!addedTimeStarted && regulationReady && (
        <p className="mt-2 text-xs text-slate-500">
          Regulation time reached
        </p>
      )}
    </div>
  );
}
