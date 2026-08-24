export const instant = false;

import Link from "next/link";
import MobileNav from "@/app/components/MobileNav";
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

export default async function PlayersPage() {
  const supabase = await createClient();

  // Get all players
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, jersey_number, position, team_id")
    .order("name", { ascending: true });

  if (playersError) {
    console.error(playersError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load players
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading players from the database.
        </p>
      </main>
    );
  }

  // Get all teams
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .order("id", { ascending: true });

  if (teamsError) {
    console.error(teamsError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load teams
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading team information.
        </p>
      </main>
    );
  }

  const typedPlayers = (players ?? []) as Player[];
  const typedTeams = (teams ?? []) as Team[];

  // Find the team for each player
  const playersWithTeams = typedPlayers.map((player) => {
    const team = typedTeams.find(
      (team) => team.id === player.team_id
    );

    return {
      ...player,
      teamName: team?.name ?? "Unknown Team",
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold">
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
              className="text-slate-400 hover:text-white"
            >
              Table
            </Link>

            <Link
              href="/teams"
              className="text-slate-400 hover:text-white"
            >
              Teams
            </Link>

            <Link href="/players" className="text-white">
              Players
            </Link>

            <Link
              href="/stats"
              className="text-slate-400 hover:text-white"
            >
              Stats
            </Link>
          </div>

          <MobileNav currentPath="/players" />
        </div>
      </nav>

      {/* CONTENT */}
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Player Centre
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Players
          </h1>

          <p className="mt-3 text-slate-400">
            All players registered in the Campus Football League.
          </p>
        </div>

        {playersWithTeams.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {playersWithTeams.map((player, index) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="block"
              >
                <div
                  className={`p-5 transition hover:bg-slate-800/70 ${
                    index !== playersWithTeams.length - 1
                      ? "border-b border-slate-800"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-xl font-bold">
                        {player.jersey_number ?? "-"}
                      </div>

                      <div>
                        <h2 className="font-bold">
                          {player.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {player.position}
                        </p>

                        <p className="mt-1 text-sm text-emerald-400">
                          {player.teamName}
                        </p>
                      </div>
                    </div>

                    <span className="text-slate-500">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">
              No players found.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}