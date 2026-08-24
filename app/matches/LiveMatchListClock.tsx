"use client";

import {
  useEffect,
  useState,
} from "react";

type Props = {
  status: string;
  matchPeriod: string | null;
  halfDurationMinutes: number;
  elapsedSeconds: number;
  currentHalfStartedAt: string | null;
};

function formatTime(seconds: number) {
  const safe = Math.max(
    0,
    Math.floor(seconds)
  );

  const minutes = Math.floor(
    safe / 60
  );

  const sec = safe % 60;

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(sec).padStart(
    2,
    "0"
  )}`;
}

/**
 * The database clock is cumulative for the match:
 *
 * First half:
 *   0:00 -> halfDuration
 *   halfDuration + added time
 *
 * Second half:
 *   halfDuration -> halfDuration * 2
 *   halfDuration * 2 + added time
 *
 * This means a 10-minute match starts the second half at 10:00.
 * First-half added time is included in player-minute accounting,
 * but it does NOT move the visible second-half regulation clock
 * above 10:00.
 */
function formatFootballTime(
  seconds: number,
  halfDurationMinutes: number,
  period: string | null
) {
  const safe = Math.max(
    0,
    Math.floor(seconds)
  );

  const halfSeconds =
    Math.max(1, halfDurationMinutes) * 60;

  if (
    period === "first_half"
  ) {
    if (safe <= halfSeconds) {
      return formatTime(safe);
    }

    const added =
      safe - halfSeconds;

    return `${halfDurationMinutes}+${formatTime(
      added
    )}`;
  }

  if (
    period === "second_half"
  ) {
    const secondHalfRegulation =
      halfSeconds * 2;

    if (safe <= secondHalfRegulation) {
      return formatTime(safe);
    }

    const added =
      safe - secondHalfRegulation;

    return `${halfDurationMinutes * 2}+${formatTime(
      added
    )}`;
  }

  return formatTime(safe);
}

export default function LiveMatchListClock({
  status,
  matchPeriod,
  halfDurationMinutes,
  elapsedSeconds,
  currentHalfStartedAt,
}: Props) {
  const [now, setNow] =
    useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const timer =
      window.setInterval(() => {
        setNow(Date.now());
      }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  let elapsed =
    Math.max(0, elapsedSeconds);

  if (
    now !== null &&
    status === "live" &&
    currentHalfStartedAt &&
    matchPeriod !== "paused" &&
    matchPeriod !== "halftime"
  ) {
    const started =
      new Date(
        currentHalfStartedAt
      ).getTime();

    elapsed =
      Math.max(
        0,
        elapsedSeconds +
          Math.floor(
            (now - started) / 1000
          )
      );
  }

  if (status !== "live") {
    return null;
  }

  if (
    matchPeriod !== "first_half" &&
    matchPeriod !== "second_half"
  ) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-emerald-900/60 pt-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
        {matchPeriod ===
        "first_half"
          ? "First Half"
          : "Second Half"}
      </p>

      <p className="mt-1 text-3xl font-black">
        {formatFootballTime(
          elapsed,
          halfDurationMinutes,
          matchPeriod
        )}
      </p>
    </div>
  );
}
