"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Match = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
};

type Standing = {
  teamId: number;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type Props = {
  teams: Team[];
  initialMatches: Match[];
};

export default function TableRealtime({
  teams,
  initialMatches,
}: Props) {
  const [matches, setMatches] =
    useState<Match[]>(initialMatches);

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
      .channel("league-table-live")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          console.log(
            "[Table Realtime]",
            payload
          );

          if (payload.eventType === "INSERT") {
            const newMatch =
              payload.new as Match;

            setMatches((current) => {
              const exists = current.some(
                (match) =>
                  match.id === newMatch.id
              );

              if (exists) {
                return current.map(
                  (match) =>
                    match.id ===
                    newMatch.id
                      ? newMatch
                      : match
                );
              }

              return [
                ...current,
                newMatch,
              ];
            });

            return;
          }

          if (payload.eventType === "UPDATE") {
            const updatedMatch =
              payload.new as Match;

            setMatches((current) => {
              const exists = current.some(
                (match) =>
                  match.id ===
                  updatedMatch.id
              );

              if (!exists) {
                return [
                  ...current,
                  updatedMatch,
                ];
              }

              return current.map(
                (match) =>
                  match.id ===
                  updatedMatch.id
                    ? updatedMatch
                    : match
              );
            });

            return;
          }

          if (payload.eventType === "DELETE") {
            const deletedMatch =
              payload.old as {
                id?: number;
              };

            if (!deletedMatch.id) {
              return;
            }

            setMatches((current) =>
              current.filter(
                (match) =>
                  match.id !==
                  deletedMatch.id
              )
            );
          }
        }
      )

      .subscribe((status) => {
        console.log(
          "[Table Realtime Status]",
          status
        );

        setConnectionStatus(status);
      });

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [supabase]);

  const standings: Standing[] =
    teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      shortName: team.short_name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }));

  // Only completed matches count.
  matches
    .filter(
      (match) =>
        match.status === "completed"
    )
    .forEach((match) => {
      const homeTeam = standings.find(
        (team) =>
          team.teamId ===
          match.home_team_id
      );

      const awayTeam = standings.find(
        (team) =>
          team.teamId ===
          match.away_team_id
      );

      if (!homeTeam || !awayTeam) {
        return;
      }

      homeTeam.played += 1;
      awayTeam.played += 1;

      homeTeam.goalsFor +=
        match.home_score;

      homeTeam.goalsAgainst +=
        match.away_score;

      awayTeam.goalsFor +=
        match.away_score;

      awayTeam.goalsAgainst +=
        match.home_score;

      if (
        match.home_score >
        match.away_score
      ) {
        homeTeam.won += 1;
        awayTeam.lost += 1;
        homeTeam.points += 3;
      } else if (
        match.home_score <
        match.away_score
      ) {
        awayTeam.won += 1;
        homeTeam.lost += 1;
        awayTeam.points += 3;
      } else {
        homeTeam.drawn += 1;
        awayTeam.drawn += 1;
        homeTeam.points += 1;
        awayTeam.points += 1;
      }
    });

  standings.forEach((team) => {
    team.goalDifference =
      team.goalsFor -
      team.goalsAgainst;
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (
      b.goalDifference !==
      a.goalDifference
    ) {
      return (
        b.goalDifference -
        a.goalDifference
      );
    }

    if (
      b.goalsFor !==
      a.goalsFor
    ) {
      return (
        b.goalsFor -
        a.goalsFor
      );
    }

    return a.teamName.localeCompare(
      b.teamName
    );
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2 text-xs text-slate-500">
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
          ? "Live table updates connected"
          : `Realtime: ${connectionStatus}`}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-4 text-left">
                #
              </th>

              <th className="px-4 py-4 text-left">
                Team
              </th>

              <th className="px-4 py-4 text-center">
                P
              </th>

              <th className="px-4 py-4 text-center">
                W
              </th>

              <th className="px-4 py-4 text-center">
                D
              </th>

              <th className="px-4 py-4 text-center">
                L
              </th>

              <th className="px-4 py-4 text-center">
                GF
              </th>

              <th className="px-4 py-4 text-center">
                GA
              </th>

              <th className="px-4 py-4 text-center">
                GD
              </th>

              <th className="px-4 py-4 text-center">
                PTS
              </th>
            </tr>
          </thead>

          <tbody>
            {standings.map(
              (team, index) => (
                <tr
                  key={team.teamId}
                  className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50"
                >
                  <td className="px-4 py-5 text-slate-500">
                    {index + 1}
                  </td>

                  <td className="px-4 py-5 font-semibold">
                    {team.teamName}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.played}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.won}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.drawn}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.lost}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.goalsFor}
                  </td>

                  <td className="px-4 py-5 text-center">
                    {team.goalsAgainst}
                  </td>

                  <td
                    className={`px-4 py-5 text-center font-semibold ${
                      team.goalDifference >
                      0
                        ? "text-emerald-400"
                        : team.goalDifference <
                            0
                          ? "text-red-400"
                          : "text-slate-400"
                    }`}
                  >
                    {team.goalDifference >
                    0
                      ? `+${team.goalDifference}`
                      : team.goalDifference}
                  </td>

                  <td className="px-4 py-5 text-center text-lg font-black">
                    {team.points}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}