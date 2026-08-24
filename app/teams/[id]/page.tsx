export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

type Team = {
  id: number;
  name: string;
  short_name: string;
  logo_url: string | null;
  description: string | null;
};

type Player = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  team_id: number;
};

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
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

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const teamId = Number(id);

  if (!Number.isInteger(teamId)) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Team Not Found</h1>
        <Link href="/teams" className="mt-5 inline-block text-emerald-400">
          ← Back to Teams
        </Link>
      </main>
    );
  }

  const supabase = await createClient();

  const [teamResult, playersResult, matchesResult, statsResult, allTeamsResult] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, name, short_name, logo_url, description")
        .eq("id", teamId)
        .single(),
      supabase
        .from("players")
        .select("id, name, jersey_number, position, team_id")
        .eq("team_id", teamId)
        .order("jersey_number", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("matches")
        .select(
          "id, match_date, venue, status, home_team_id, away_team_id, home_score, away_score"
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("match_date", { ascending: false }),
      supabase
        .from("team_match_stats")
        .select(
          "id, match_id, team_id, possession, shots, shots_on_target, corners, saves"
        )
        .eq("team_id", teamId),
      supabase
        .from("teams")
        .select("id, name, short_name"),
    ]);

  if (teamResult.error || !teamResult.data) {
    console.error("Team error:", teamResult.error);
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Unable to load team</h1>
        <p className="mt-3 text-red-400">There was a problem loading this team.</p>
        <Link href="/teams" className="mt-5 inline-block text-emerald-400">
          ← Back to Teams
        </Link>
      </main>
    );
  }

  if (playersResult.error || matchesResult.error || statsResult.error || allTeamsResult.error) {
    console.error("Players:", playersResult.error);
    console.error("Matches:", matchesResult.error);
    console.error("Stats:", statsResult.error);
    console.error("Teams:", allTeamsResult.error);
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">Unable to load team data</h1>
        <p className="mt-3 text-red-400">There was a problem loading the team information.</p>
      </main>
    );
  }

  const team = teamResult.data as Team;
  const players = (playersResult.data ?? []) as Player[];
  const matches = (matchesResult.data ?? []) as Match[];
  const teamStats = (statsResult.data ?? []) as TeamMatchStat[];
  const allTeams = (allTeamsResult.data ?? []) as Array<Pick<Team, "id" | "name" | "short_name">>;

  const teamName = (id: number) =>
    allTeams.find((item) => item.id === id)?.name ?? "Unknown Team";

  const completedMatches = matches.filter((match) => match.status === "completed");

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;

  for (const match of completedMatches) {
    const isHome = match.home_team_id === teamId;
    const gf = isHome ? match.home_score : match.away_score;
    const ga = isHome ? match.away_score : match.home_score;

    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > ga) {
      won += 1;
      points += 3;
    } else if (gf === ga) {
      drawn += 1;
      points += 1;
    } else {
      lost += 1;
    }
  }

  const goalDifference = goalsFor - goalsAgainst;
  const possessionValues = teamStats
    .map((stat) => stat.possession)
    .filter((value): value is number => value !== null);

  const averagePossession = possessionValues.length
    ? possessionValues.reduce((sum, value) => sum + value, 0) / possessionValues.length
    : null;

  const totalShots = teamStats.reduce((sum, stat) => sum + stat.shots, 0);
  const totalShotsOnTarget = teamStats.reduce(
    (sum, stat) => sum + stat.shots_on_target,
    0
  );
  const totalCorners = teamStats.reduce((sum, stat) => sum + stat.corners, 0);
  const totalSaves = teamStats.reduce((sum, stat) => sum + stat.saves, 0);

  const recentMatches = matches.slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold">
            ⚽ Campus League
          </Link>

          <div className="hidden gap-6 text-sm md:flex">
            <Link href="/" className="text-slate-400 hover:text-white">Home</Link>
            <Link href="/matches" className="text-slate-400 hover:text-white">Matches</Link>
            <Link href="/table" className="text-slate-400 hover:text-white">Table</Link>
            <Link href="/teams" className="text-white">Teams</Link>
            <Link href="/players" className="text-slate-400 hover:text-white">Players</Link>
            <Link href="/stats" className="text-slate-400 hover:text-white">Stats</Link>
          </div>

          <Link href="/teams" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">
            ← Teams
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800 text-5xl">
              {team.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo_url} alt={`${team.name} logo`} className="h-full w-full object-cover" />
              ) : (
                "⚽"
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Team Profile
              </p>
              <h1 className="mt-2 text-4xl font-bold">{team.name}</h1>
              <p className="mt-2 text-slate-500">{team.short_name}</p>
              {team.description && (
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                  {team.description}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {[
            ["P", completedMatches.length],
            ["W", won],
            ["D", drawn],
            ["L", lost],
            ["GF", goalsFor],
            ["GA", goalsAgainst],
            ["GD", goalDifference],
            ["PTS", points],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Squad</p>
            <h2 className="mt-2 text-2xl font-bold">{players.length} Players</h2>
          </div>

          {players.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800/70"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-bold">
                      {player.jersey_number ?? "-"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{player.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{player.position}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No players registered for this team.
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Team Statistics</p>
            <h2 className="mt-2 text-2xl font-bold">Match Performance</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Avg. Possession", averagePossession !== null ? `${averagePossession.toFixed(1)}%` : "—"],
              ["Shots", totalShots],
              ["Shots on Target", totalShotsOnTarget],
              ["Corners", totalCorners],
              ["Saves", totalSaves],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 pb-10">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Fixtures</p>
            <h2 className="mt-2 text-2xl font-bold">Recent & Upcoming Matches</h2>
          </div>

          {recentMatches.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {recentMatches.map((match, index) => {
                const opponentId =
                  match.home_team_id === teamId
                    ? match.away_team_id
                    : match.home_team_id;
                const isHome = match.home_team_id === teamId;
                const teamScore = isHome ? match.home_score : match.away_score;
                const opponentScore = isHome ? match.away_score : match.home_score;
                const date = new Date(match.match_date);

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className={`block p-5 transition hover:bg-slate-800/60 ${
                      index !== recentMatches.length - 1 ? "border-b border-slate-800" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-slate-500">
                          {date.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {match.venue ? ` · ${match.venue}` : ""}
                        </p>
                        <p className="mt-1 font-semibold">
                          {team.name} <span className="text-slate-600">vs</span> {teamName(opponentId)}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {match.status === "completed" ? (
                          <span className="text-xl font-black">
                            {teamScore} - {opponentScore}
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                            {match.status}
                          </span>
                        )}
                        <span className="text-slate-500">→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No matches found for this team.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
