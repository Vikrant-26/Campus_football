export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

type PageProps = {
  searchParams: Promise<{
    edit?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function AdminMatchesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const supabase = await createClient();

  // ==================================================
  // AUTHENTICATION
  // ==================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ==================================================
  // ADMIN CHECK
  // ==================================================

  const {
    data: adminUser,
    error: adminError,
  } = await supabase
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

  // ==================================================
  // GET TEAMS
  // ==================================================

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select(
      "id, name, short_name"
    )
    .order("name", {
      ascending: true,
    });

  // ==================================================
  // GET MATCHES
  // ==================================================

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

  if (
    teamsError ||
    matchesError
  ) {
    console.error(
      "Teams error:",
      teamsError
    );

    console.error(
      "Matches error:",
      matchesError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load matches
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading match data.
        </p>
      </main>
    );
  }

  const typedTeams =
    (teams ?? []) as Team[];

  const typedMatches =
    (matches ?? []) as Match[];

  const editId = params.edit
    ? Number(params.edit)
    : null;

  const editingMatch =
    editId !== null &&
    !Number.isNaN(editId)
      ? typedMatches.find(
          (match) =>
            match.id === editId
        ) ?? null
      : null;

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

  function formatDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleDateString(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatTime(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleTimeString(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  // ==================================================
  // CREATE MATCH
  // ==================================================

  async function createMatch(
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
      redirect("/auth/login");
    }

    const {
      data: adminUser,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!adminUser) {
      redirect("/");
    }

    const homeTeamId =
      Number(
        formData.get(
          "home_team_id"
        )
      );

    const awayTeamId =
      Number(
        formData.get(
          "away_team_id"
        )
      );

    const matchDate =
      String(
        formData.get(
          "match_date"
        ) ?? ""
      );

    const venue =
      String(
        formData.get(
          "venue"
        ) ?? ""
      ).trim();

    // -----------------------------------------------
    // HALF DURATION
    // -----------------------------------------------

    const halfDurationMinutes =
      Number(
        formData.get(
          "half_duration_minutes"
        ) ?? 45
      );

    if (
      !Number.isFinite(
        halfDurationMinutes
      ) ||
      halfDurationMinutes < 1 ||
      halfDurationMinutes > 120
    ) {
      redirect(
        "/admin/matches?error=duration"
      );
    }

    if (
      !homeTeamId ||
      !awayTeamId ||
      !matchDate
    ) {
      redirect(
        "/admin/matches?error=missing"
      );
    }

    if (
      homeTeamId ===
      awayTeamId
    ) {
      redirect(
        "/admin/matches?error=same_team"
      );
    }

    const matchDateObject =
      new Date(
        `${matchDate}:00+05:30`
      );

    if (
      Number.isNaN(
        matchDateObject.getTime()
      )
    ) {
      redirect(
        "/admin/matches?error=date"
      );
    }

    // -----------------------------------------------
    // CREATE MATCH
    // -----------------------------------------------

    const { error } =
      await serverSupabase
        .from("matches")
        .insert({
          home_team_id:
            homeTeamId,

          away_team_id:
            awayTeamId,

          match_date:
            matchDateObject.toISOString(),

          venue:
            venue || null,

          // ------------------------------
          // INITIAL MATCH STATE
          // ------------------------------

          status: "scheduled",

          match_period:
            "scheduled",

          previous_match_period:
            null,

          // ------------------------------
          // CLOCK
          // ------------------------------

          half_duration_minutes:
            Math.floor(
              halfDurationMinutes
            ),

          elapsed_seconds: 0,

          first_half_started_at:
            null,

          second_half_started_at:
            null,

          current_half_started_at:
            null,

          paused_at: null,

          // ------------------------------
          // ADDED TIME
          // ------------------------------

          added_time_minutes: 0,

          added_time_started:
            false,

          // ------------------------------
          // RESULT
          // ------------------------------

          result_type: "normal",

          cancellation_reason:
            null,

          // ------------------------------
          // SCORE
          // ------------------------------

          home_score: 0,

          away_score: 0,
        });

    if (error) {
      console.error(
        "Create match error:",
        error
      );

      redirect(
        "/admin/matches?error=create"
      );
    }

    redirect(
      "/admin/matches?success=created"
    );
  }

  // ==================================================
  // UPDATE SCHEDULED MATCH
  // ==================================================

  async function updateMatch(
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
      redirect("/auth/login");
    }

    const {
      data: adminUser,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!adminUser) {
      redirect("/");
    }

    const matchId =
      Number(
        formData.get(
          "match_id"
        )
      );

    const homeTeamId =
      Number(
        formData.get(
          "home_team_id"
        )
      );

    const awayTeamId =
      Number(
        formData.get(
          "away_team_id"
        )
      );

    const matchDate =
      String(
        formData.get(
          "match_date"
        ) ?? ""
      );

    const venue =
      String(
        formData.get(
          "venue"
        ) ?? ""
      ).trim();

    if (
      !matchId ||
      !homeTeamId ||
      !awayTeamId ||
      !matchDate
    ) {
      redirect(
        `/admin/matches?edit=${matchId}&error=missing`
      );
    }

    if (
      homeTeamId ===
      awayTeamId
    ) {
      redirect(
        `/admin/matches?edit=${matchId}&error=same_team`
      );
    }

    const matchDateObject =
      new Date(
        `${matchDate}:00+05:30`
      );

    if (
      Number.isNaN(
        matchDateObject.getTime()
      )
    ) {
      redirect(
        `/admin/matches?edit=${matchId}&error=date`
      );
    }

    const {
      data: currentMatch,
      error: currentMatchError,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "status"
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (
      currentMatchError ||
      !currentMatch
    ) {
      redirect(
        "/admin/matches?error=not_found"
      );
    }

    if (
      currentMatch.status !==
      "scheduled"
    ) {
      redirect(
        `/admin/matches?edit=${matchId}&error=not_editable`
      );
    }

    const { error } =
      await serverSupabase
        .from("matches")
        .update({
          home_team_id:
            homeTeamId,

          away_team_id:
            awayTeamId,

          match_date:
            matchDateObject.toISOString(),

          venue:
            venue || null,
        })
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        "Update match error:",
        error
      );

      redirect(
        `/admin/matches?edit=${matchId}&error=update`
      );
    }

    redirect(
      "/admin/matches?success=updated"
    );
  }

  // ==================================================
  // DELETE SCHEDULED MATCH
  // ==================================================

  async function deleteMatch(
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
      redirect("/auth/login");
    }

    const {
      data: adminUser,
    } =
      await serverSupabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (!adminUser) {
      redirect("/");
    }

    const matchId =
      Number(
        formData.get(
          "match_id"
        )
      );

    if (!matchId) {
      redirect(
        "/admin/matches?error=delete"
      );
    }

    const {
      data: currentMatch,
      error: currentMatchError,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "status"
        )
        .eq(
          "id",
          matchId
        )
        .single();

    if (
      currentMatchError ||
      !currentMatch
    ) {
      redirect(
        "/admin/matches?error=not_found"
      );
    }

    if (
      currentMatch.status !==
      "scheduled"
    ) {
      redirect(
        "/admin/matches?error=not_deletable"
      );
    }

    // EVENT CHECK

    const {
      count: eventCount,
      error: eventError,
    } =
      await serverSupabase
        .from("match_events")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "match_id",
          matchId
        );

    if (eventError) {
      console.error(
        "Event check:",
        eventError
      );

      redirect(
        "/admin/matches?error=delete"
      );
    }

    if (
      (eventCount ?? 0) > 0
    ) {
      redirect(
        "/admin/matches?error=has_events"
      );
    }

    // TEAM STATS CHECK

    const {
      count: teamStatsCount,
      error: teamStatsError,
    } =
      await serverSupabase
        .from(
          "team_match_stats"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "match_id",
          matchId
        );

    if (teamStatsError) {
      console.error(
        "Team stats check:",
        teamStatsError
      );

      redirect(
        "/admin/matches?error=delete"
      );
    }

    if (
      (teamStatsCount ?? 0) > 0
    ) {
      redirect(
        "/admin/matches?error=has_stats"
      );
    }

    // PLAYER STATS CHECK

    const {
      count: playerStatsCount,
      error: playerStatsError,
    } =
      await serverSupabase
        .from(
          "player_match_stats"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "match_id",
          matchId
        );

    if (playerStatsError) {
      console.error(
        "Player stats check:",
        playerStatsError
      );

      redirect(
        "/admin/matches?error=delete"
      );
    }

    if (
      (playerStatsCount ?? 0) > 0
    ) {
      redirect(
        "/admin/matches?error=has_stats"
      );
    }

    // DELETE

    const { error } =
      await serverSupabase
        .from("matches")
        .delete()
        .eq(
          "id",
          matchId
        );

    if (error) {
      console.error(
        "Delete match error:",
        error
      );

      redirect(
        "/admin/matches?error=delete"
      );
    }

    redirect(
      "/admin/matches?success=deleted"
    );
  }

  // ==================================================
  // RETURN
  // ==================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}

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
              Match Management
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-10">
        {/* HEADER */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Fixtures
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Matches
          </h1>

          <p className="mt-3 text-slate-400">
            Create fixtures, schedule matches and control
            the league match lifecycle.
          </p>
        </div>

        {/* MESSAGES */}

        {params.success ===
          "created" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Match scheduled successfully.
          </div>
        )}

        {params.success ===
          "updated" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Match updated successfully.
          </div>
        )}

        {params.success ===
          "deleted" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Match deleted successfully.
          </div>
        )}

        {params.error ===
          "missing" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Home team, away team and match date/time are
            required.
          </div>
        )}

        {params.error ===
          "same_team" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Home team and away team must be different.
          </div>
        )}

        {params.error ===
          "date" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            The match date/time is invalid.
          </div>
        )}

        {params.error ===
          "duration" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Half duration must be between 1 and 120
            minutes.
          </div>
        )}

        {params.error ===
          "create" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to create the match.
          </div>
        )}

        {params.error ===
          "update" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to update the match.
          </div>
        )}

        {params.error ===
          "not_found" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Match not found.
          </div>
        )}

        {params.error ===
          "not_editable" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            Only scheduled matches can be edited.
          </div>
        )}

        {params.error ===
          "not_startable" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            Only scheduled matches can be started.
          </div>
        )}

        {params.error ===
          "start" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to start the match.
          </div>
        )}

        {params.error ===
          "not_deletable" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            Only scheduled matches without league data can
            be deleted.
          </div>
        )}

        {params.error ===
          "has_events" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This match has events and cannot be deleted.
          </div>
        )}

        {params.error ===
          "has_stats" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This match already has statistics and cannot be
            deleted.
          </div>
        )}

        {params.error ===
          "delete" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to delete the match.
          </div>
        )}

        {/* CREATE / EDIT FORM */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              {editingMatch
                ? "EDIT FIXTURE"
                : "NEW FIXTURE"}
            </p>

            <h2 className="text-2xl font-bold">
              {editingMatch
                ? "Edit Scheduled Match"
                : "Schedule New Match"}
            </h2>
          </div>

          <form
            action={
              editingMatch
                ? updateMatch
                : createMatch
            }
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            {editingMatch && (
              <input
                type="hidden"
                name="match_id"
                value={
                  editingMatch.id
                }
              />
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {/* HOME */}

              <div>
                <label
                  htmlFor="home_team_id"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Home Team
                </label>

                <select
                  id="home_team_id"
                  name="home_team_id"
                  required
                  defaultValue={
                    editingMatch?.home_team_id ??
                    ""
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">
                    Select home team
                  </option>

                  {typedTeams.map(
                    (team) => (
                      <option
                        key={
                          team.id
                        }
                        value={
                          team.id
                        }
                      >
                        {team.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* AWAY */}

              <div>
                <label
                  htmlFor="away_team_id"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Away Team
                </label>

                <select
                  id="away_team_id"
                  name="away_team_id"
                  required
                  defaultValue={
                    editingMatch?.away_team_id ??
                    ""
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">
                    Select away team
                  </option>

                  {typedTeams.map(
                    (team) => (
                      <option
                        key={
                          team.id
                        }
                        value={
                          team.id
                        }
                      >
                        {team.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DATE */}

              <div>
                <label
                  htmlFor="match_date"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Date & Time
                </label>

                <input
                  id="match_date"
                  name="match_date"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingMatch
                      ? new Date(
                          editingMatch.match_date
                        )
                          .toLocaleString(
                            "sv-SE",
                            {
                              timeZone:
                                "Asia/Kolkata",
                            }
                          )
                          .slice(
                            0,
                            16
                          )
                          .replace(
                            " ",
                            "T"
                          )
                      : ""
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white [color-scheme:dark]"
                />
              </div>

              {/* VENUE */}

              <div>
                <label
                  htmlFor="venue"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Venue
                </label>

                <input
                  id="venue"
                  name="venue"
                  type="text"
                  defaultValue={
                    editingMatch?.venue ??
                    ""
                  }
                  placeholder="Campus Football Ground"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>

              {/* HALF DURATION */}

              {!editingMatch && (
                <div>
                  <label
                    htmlFor="half_duration_minutes"
                    className="mb-2 block text-sm text-slate-400"
                  >
                    Minutes per Half
                  </label>

                  <input
                    id="half_duration_minutes"
                    name="half_duration_minutes"
                    type="number"
                    min="1"
                    max="120"
                    defaultValue="45"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    The referee/admin decides the regulation
                    duration before the match starts.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
              >
                {editingMatch
                  ? "Save Changes"
                  : "Schedule Match"}
              </button>

              {editingMatch && (
                <Link
                  href="/admin/matches"
                  className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </section>

        {/* LIVE MATCHES */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-red-400">
              LIVE
            </p>

            <h2 className="text-2xl font-bold">
              Live Matches
            </h2>
          </div>

          {typedMatches.filter(
            (match) =>
              match.status ===
              "live"
          ).length > 0 ? (
            <div className="space-y-3">
              {typedMatches
                .filter(
                  (match) =>
                    match.status ===
                    "live"
                )
                .map(
                  (match) => (
                    <div
                      key={
                        match.id
                      }
                      className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6"
                    >
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
                              {
                                match.home_score
                              }{" "}
                              -{" "}
                              {
                                match.away_score
                              }
                            </span>

                            {getTeamName(
                              match.away_team_id
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/admin/matches/${match.id}`}
                          className="rounded-lg bg-emerald-500 px-5 py-3 text-center text-sm font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          Manage Live Match
                        </Link>
                      </div>
                    </div>
                  )
                )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No live matches.
            </div>
          )}
        </section>

        {/* SCHEDULED MATCHES */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              FIXTURES
            </p>

            <h2 className="text-2xl font-bold">
              Scheduled Matches
            </h2>
          </div>

          {typedMatches.filter(
            (match) =>
              match.status ===
              "scheduled"
          ).length > 0 ? (
            <div className="space-y-3">
              {typedMatches
                .filter(
                  (match) =>
                    match.status ===
                    "scheduled"
                )
                .map(
                  (match) => (
                    <div
                      key={
                        match.id
                      }
                      className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
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

                          <p className="mt-1 text-xs text-slate-600">
                            {match.venue ??
                              "Venue not specified"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {/* EDIT */}

                          <Link
                            href={`/admin/matches?edit=${match.id}`}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            Edit
                          </Link>

                          {/* MANAGE MATCH */}

                          <Link
                            href={`/admin/matches/${match.id}`}
                            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            Manage Match
                          </Link>

                          {/* DELETE */}

                          <form
                            action={
                              deleteMatch
                            }
                          >
                            <input
                              type="hidden"
                              name="match_id"
                              value={
                                match.id
                              }
                            />

                            <button
                              type="submit"
                              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )
                )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No scheduled matches.
            </div>
          )}
        </section>

        {/* COMPLETED */}

        <section className="pb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              RESULTS
            </p>

            <h2 className="text-2xl font-bold">
              Completed Matches
            </h2>
          </div>

          {typedMatches.filter(
            (match) =>
              match.status ===
              "completed"
          ).length > 0 ? (
            <div className="space-y-3">
              {typedMatches
                .filter(
                  (match) =>
                    match.status ===
                    "completed"
                )
                .map(
                  (match) => (
                    <div
                      key={
                        match.id
                      }
                      className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <p className="font-semibold">
                            {getTeamName(
                              match.home_team_id
                            )}

                            <span className="mx-3 text-lg font-black">
                              {
                                match.home_score
                              }{" "}
                              -{" "}
                              {
                                match.away_score
                              }
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
                            {match.venue ??
                              "Venue not specified"}
                          </p>
                        </div>

                        <Link
                          href={`/admin/matches/${match.id}`}
                          className="rounded-lg border border-slate-700 px-5 py-2 text-center text-sm font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          View Match
                        </Link>
                      </div>
                    </div>
                  )
                )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No completed matches.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}