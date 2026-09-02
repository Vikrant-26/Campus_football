export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

const GROUP_A = [
  "Phoenix Forces FC",
  "Apex 16",
  "Juvento Jammu",
  "Hellborn FC",
];

const GROUP_B = [
  "La Furia FC",
  "Jotunheim FC",
  "Northern Strikers FC",
  "Real Jammu",
];

function sortStandings(a: Standing, b: Standing) {
  if (b.points !== a.points) {
    return b.points - a.points;
  }

  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }

  if (b.goalsFor !== a.goalsFor) {
    return b.goalsFor - a.goalsFor;
  }

  return a.teamName.localeCompare(b.teamName);
}

function TableSection({
  title,
  standings,
}: {
  title: string;
  standings: Standing[];
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-bold">
            {title} Table
          </h2>
        </div>

        <p className="text-sm text-slate-500">
          Top 2 qualify for the knockout stage
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-4 text-left">#</th>
              <th className="px-4 py-4 text-left">Team</th>
              <th className="px-4 py-4 text-center">P</th>
              <th className="px-4 py-4 text-center">W</th>
              <th className="px-4 py-4 text-center">D</th>
              <th className="px-4 py-4 text-center">L</th>
              <th className="px-4 py-4 text-center">GF</th>
              <th className="px-4 py-4 text-center">GA</th>
              <th className="px-4 py-4 text-center">GD</th>
              <th className="px-4 py-4 text-center">PTS</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((team, index) => (
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
                    team.goalDifference > 0
                      ? "text-emerald-400"
                      : team.goalDifference < 0
                        ? "text-red-400"
                        : "text-slate-400"
                  }`}
                >
                  {team.goalDifference > 0
                    ? `+${team.goalDifference}`
                    : team.goalDifference}
                </td>

                <td className="px-4 py-5 text-center text-lg font-black">
                  {team.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TablePage() {
  const supabase = await createClient();

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .order("id", { ascending: true });

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, home_team_id, away_team_id, home_score, away_score, status"
    )
    .eq("status", "completed");

  if (teamsError || matchesError) {
    console.error("Teams error:", teamsError);
    console.error("Matches error:", matchesError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load league table
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading league data.
        </p>
      </main>
    );
  }

  const typedTeams = (teams ?? []) as Team[];
  const typedMatches = (matches ?? []) as Match[];

  const allStandings: Standing[] = typedTeams.map((team) => ({
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

  /*
   * Only completed matches count toward standings.
   * The fixture schedule keeps each group separate:
   * Group A:
   *   Phoenix Forces FC
   *   Apex 16
   *   Juvento Jammu
   *   Hellborn FC
   *
   * Group B:
   *   La Furia FC
   *   Jotunheim FC
   *   Northern Strikers FC
   *   Real Jammu
   */
  typedMatches.forEach((match) => {
    const homeTeam = allStandings.find(
      (team) => team.teamId === match.home_team_id
    );

    const awayTeam = allStandings.find(
      (team) => team.teamId === match.away_team_id
    );

    if (!homeTeam || !awayTeam) {
      return;
    }

    homeTeam.played += 1;
    awayTeam.played += 1;

    homeTeam.goalsFor += match.home_score;
    homeTeam.goalsAgainst += match.away_score;

    awayTeam.goalsFor += match.away_score;
    awayTeam.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      homeTeam.won += 1;
      awayTeam.lost += 1;
      homeTeam.points += 3;
    } else if (match.home_score < match.away_score) {
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

  allStandings.forEach((team) => {
    team.goalDifference =
      team.goalsFor - team.goalsAgainst;
  });

  const groupAStandings = allStandings
    .filter((team) => GROUP_A.includes(team.teamName))
    .sort(sortStandings);

  const groupBStandings = allStandings
    .filter((team) => GROUP_B.includes(team.teamName))
    .sort(sortStandings);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-xl font-bold"
          >
            ⚽ Campus League
          </Link>

          <div className="hidden gap-6 text-sm md:flex">
            <Link
              href="/"
              className="text-slate-400 hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/matches"
              className="text-slate-400 hover:text-white"
            >
              Matches
            </Link>

            <Link
              href="/table"
              className="text-white"
            >
              Table
            </Link>

            <Link
              href="/teams"
              className="text-slate-400 hover:text-white"
            >
              Teams
            </Link>

            <Link
              href="/players"
              className="text-slate-400 hover:text-white"
            >
              Players
            </Link>

            <Link
              href="/stats"
              className="text-slate-400 hover:text-white"
            >
              Stats
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Season 2026
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            League Tables
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Group-stage standings calculated automatically from
            completed matches.
          </p>
        </div>

        <TableSection
          title="Group A"
          standings={groupAStandings}
        />

        <TableSection
          title="Group B"
          standings={groupBStandings}
        />

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
          <p>
            <span className="font-semibold text-white">P</span>{" "}
            = Played
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">W</span>{" "}
            = Won
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">D</span>{" "}
            = Drawn
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">L</span>{" "}
            = Lost
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">GF</span>{" "}
            = Goals For
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">GA</span>{" "}
            = Goals Against
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">GD</span>{" "}
            = Goal Difference
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">PTS</span>{" "}
            = Points
          </p>
        </div>
      </div>
    </main>
  );
}
