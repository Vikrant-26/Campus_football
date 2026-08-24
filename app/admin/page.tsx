export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Match = {
  id: number;
  match_date: string;
  venue: string | null;
  status: string;
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

export default async function AdminPage() {
  const supabase = await createClient();

  // --------------------------------------------
  // LOGIN CHECK
  // --------------------------------------------

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // --------------------------------------------
  // ADMIN CHECK
  // --------------------------------------------

  const { data: adminUser, error: adminError } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (adminError) {
    console.error(
      "Admin check error:",
      adminError
    );
  }

  if (!adminUser) {
    redirect("/");
  }

  // --------------------------------------------
  // GET MATCHES
  // --------------------------------------------

  const {
    data: matches,
    error: matchesError,
  } = await supabase
    .from("matches")
    .select(
      "id, match_date, venue, status, home_score, away_score, home_team_id, away_team_id"
    )
    .order("match_date", {
      ascending: true,
    });

  // --------------------------------------------
  // GET TEAMS
  // --------------------------------------------

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select(
      "id, name, short_name"
    )
    .order("id", {
      ascending: true,
    });

  if (matchesError || teamsError) {
    console.error("Matches:", matchesError);
    console.error("Teams:", teamsError);

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load admin dashboard
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading league data.
        </p>
      </main>
    );
  }

  const typedMatches = (matches ?? []) as Match[];
  const typedTeams = (teams ?? []) as Team[];

  const liveMatches = typedMatches.filter(
    (match) =>
      match.status === "live"
  );

  const scheduledMatches =
    typedMatches.filter(
      (match) =>
        match.status === "scheduled"
    );

  const completedMatches =
    typedMatches.filter(
      (match) =>
        match.status === "completed"
    );

  function getTeamName(teamId: number) {
    return (
      typedTeams.find(
        (team) => team.id === teamId
      )?.name ?? "Unknown Team"
    );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <Link
              href="/"
              className="text-xl font-bold"
            >
              ⚽ Campus League
            </Link>

            <p className="mt-1 text-xs text-slate-500">
              Admin Dashboard
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              View Website
            </Link>

            <form
              action="/auth/signout"
              method="post"
            >
              <button
                type="submit"
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="mx-auto max-w-7xl px-5 py-10">
        {/* TITLE */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Administration
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Dashboard
          </h1>

          <p className="mt-3 text-slate-400">
            Manage the Campus Football League.
          </p>
        </div>

        {/* SUMMARY */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Live
            </p>

            <p className="mt-2 text-4xl font-black text-red-400">
              {liveMatches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Scheduled
            </p>

            <p className="mt-2 text-4xl font-black">
              {scheduledMatches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Completed
            </p>

            <p className="mt-2 text-4xl font-black">
              {completedMatches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Teams
            </p>

            <p className="mt-2 text-4xl font-black text-emerald-400">
              {typedTeams.length}
            </p>
          </div>
        </div>

        {/* ADMIN SECTIONS */}
        <section className="mt-10">
          <h2 className="mb-5 text-2xl font-bold">
            Management
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            <Link
              href="/admin/matches"
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <p className="text-3xl">
                ⚽
              </p>

              <h3 className="mt-4 text-xl font-bold">
                Matches
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Create fixtures and control live matches.
              </p>

              <p className="mt-5 text-sm text-emerald-400">
                Open Matches →
              </p>
            </Link>

            <Link
              href="/admin/teams"
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <p className="text-3xl">
                🏆
              </p>

              <h3 className="mt-4 text-xl font-bold">
                Teams
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Add and manage league teams.
              </p>

              <p className="mt-5 text-sm text-emerald-400">
                Open Teams →
              </p>
            </Link>

            <Link
              href="/admin/players"
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <p className="text-3xl">
                👤
              </p>

              <h3 className="mt-4 text-xl font-bold">
                Players
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Add players and assign them to teams.
              </p>

              <p className="mt-5 text-sm text-emerald-400">
                Open Players →
              </p>
            </Link>
          </div>
        </section>

        {/* LIVE MATCHES */}
        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400">
                LIVE
              </p>

              <h2 className="text-2xl font-bold">
                Live Matches
              </h2>
            </div>

            <Link
              href="/admin/matches"
              className="text-sm text-slate-500 hover:text-white"
            >
              View all →
            </Link>
          </div>

          {liveMatches.length > 0 ? (
            <div className="space-y-3">
              {liveMatches.map(
                (match) => (
                  <Link
                    key={match.id}
                    href={`/admin/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5 transition hover:border-red-400/50">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <span className="text-sm font-semibold text-red-400">
                            🔴 LIVE
                          </span>

                          <div className="mt-2 text-xl font-bold">
                            {getTeamName(
                              match.home_team_id
                            )}

                            <span className="mx-3">
                              {match.home_score} -{" "}
                              {match.away_score}
                            </span>

                            {getTeamName(
                              match.away_team_id
                            )}
                          </div>
                        </div>

                        <span className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950">
                          Manage
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No live matches.
            </div>
          )}
        </section>

        {/* UPCOMING */}
        <section className="mt-10 pb-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">
                FIXTURES
              </p>

              <h2 className="text-2xl font-bold">
                Upcoming Matches
              </h2>
            </div>

            <Link
              href="/admin/matches"
              className="text-sm text-slate-500 hover:text-white"
            >
              View all →
            </Link>
          </div>

          {scheduledMatches.length > 0 ? (
            <div className="space-y-3">
              {scheduledMatches
                .slice(0, 5)
                .map((match) => (
                  <Link
                    key={match.id}
                    href={`/admin/matches/${match.id}`}
                    className="block"
                  >
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800/70">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <p className="font-semibold">
                            {getTeamName(
                              match.home_team_id
                            )}

                            <span className="mx-2 text-slate-600">
                              vs
                            </span>

                            {getTeamName(
                              match.away_team_id
                            )}
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            {formatDate(
                              match.match_date
                            )}{" "}
                            ·{" "}
                            {formatTime(
                              match.match_date
                            )}
                          </p>
                        </div>

                        <span className="text-sm text-slate-500">
                          Manage →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No scheduled matches.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}