export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Team = {
  id: number;
  name: string;
  short_name: string;
  logo_url: string | null;
  description: string | null;
};

type PageProps = {
  searchParams: Promise<{
    edit?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function AdminTeamsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const supabase = await createClient();

  // ============================================
  // AUTHENTICATION
  // ============================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ============================================
  // ADMIN CHECK
  // ============================================

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

  // ============================================
  // GET TEAMS
  // ============================================

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select(
      "id, name, short_name, logo_url, description"
    )
    .order("id", {
      ascending: true,
    });

  if (teamsError) {
    console.error(
      "Teams error:",
      teamsError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load teams
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading teams.
        </p>
      </main>
    );
  }

  const typedTeams = (teams ?? []) as Team[];

  const editId = params.edit
    ? Number(params.edit)
    : null;

  const editingTeam =
    editId !== null && !Number.isNaN(editId)
      ? typedTeams.find(
          (team) => team.id === editId
        ) ?? null
      : null;

  // ============================================
  // CREATE TEAM
  // ============================================

  async function createTeam(
    formData: FormData
  ) {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: adminUser } =
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

    const name = String(
      formData.get("name") ?? ""
    ).trim();

    const shortName = String(
      formData.get("short_name") ?? ""
    ).trim();

    const logoUrl = String(
      formData.get("logo_url") ?? ""
    ).trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    if (!name || !shortName) {
      redirect(
        "/admin/teams?error=missing"
      );
    }

    const { error } =
      await serverSupabase
        .from("teams")
        .insert({
          name,
          short_name: shortName,
          logo_url: logoUrl || null,
          description:
            description || null,
        });

    if (error) {
      console.error(
        "Create team error:",
        error
      );

      redirect(
        "/admin/teams?error=create"
      );
    }

    redirect(
      "/admin/teams?success=created"
    );
  }

  // ============================================
  // UPDATE TEAM
  // ============================================

  async function updateTeam(
    formData: FormData
  ) {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: adminUser } =
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

    const teamId = Number(
      formData.get("team_id")
    );

    const name = String(
      formData.get("name") ?? ""
    ).trim();

    const shortName = String(
      formData.get("short_name") ?? ""
    ).trim();

    const logoUrl = String(
      formData.get("logo_url") ?? ""
    ).trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    if (
      !teamId ||
      !name ||
      !shortName
    ) {
      redirect(
        "/admin/teams?error=missing"
      );
    }

    const { error } =
      await serverSupabase
        .from("teams")
        .update({
          name,
          short_name: shortName,
          logo_url: logoUrl || null,
          description:
            description || null,
        })
        .eq("id", teamId);

    if (error) {
      console.error(
        "Update team error:",
        error
      );

      redirect(
        `/admin/teams?edit=${teamId}&error=update`
      );
    }

    redirect(
      "/admin/teams?success=updated"
    );
  }

  // ============================================
  // DELETE TEAM
  // ============================================

  async function deleteTeam(
    formData: FormData
  ) {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser },
    } =
      await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: adminUser } =
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

    const teamId = Number(
      formData.get("team_id")
    );

    if (!teamId) {
      redirect(
        "/admin/teams?error=delete"
      );
    }

    // ========================================
    // CHECK PLAYERS
    // ========================================

    const {
      count: playerCount,
      error: playerCountError,
    } =
      await serverSupabase
        .from("players")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq("team_id", teamId);

    if (playerCountError) {
      console.error(
        "Player reference check:",
        playerCountError
      );

      redirect(
        "/admin/teams?error=delete"
      );
    }

    if ((playerCount ?? 0) > 0) {
      redirect(
        "/admin/teams?error=has_players"
      );
    }

    // ========================================
    // CHECK HOME MATCHES
    // ========================================

    const {
      count: homeMatchCount,
      error: homeMatchError,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "home_team_id",
          teamId
        );

    if (homeMatchError) {
      console.error(
        "Home match check:",
        homeMatchError
      );

      redirect(
        "/admin/teams?error=delete"
      );
    }

    // ========================================
    // CHECK AWAY MATCHES
    // ========================================

    const {
      count: awayMatchCount,
      error: awayMatchError,
    } =
      await serverSupabase
        .from("matches")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "away_team_id",
          teamId
        );

    if (awayMatchError) {
      console.error(
        "Away match check:",
        awayMatchError
      );

      redirect(
        "/admin/teams?error=delete"
      );
    }

    if (
      (homeMatchCount ?? 0) > 0 ||
      (awayMatchCount ?? 0) > 0
    ) {
      redirect(
        "/admin/teams?error=has_matches"
      );
    }

    // ========================================
    // DELETE
    // ========================================

    const { error } =
      await serverSupabase
        .from("teams")
        .delete()
        .eq("id", teamId);

    if (error) {
      console.error(
        "Delete team error:",
        error
      );

      redirect(
        "/admin/teams?error=delete"
      );
    }

    redirect(
      "/admin/teams?success=deleted"
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ====================================== */}
      {/* NAVBAR */}
      {/* ====================================== */}

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
              Team Management
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

      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* ====================================== */}
        {/* HEADER */}
        {/* ====================================== */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            League Setup
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Teams
          </h1>

          <p className="mt-3 text-slate-400">
            Add and manage the teams participating in
            the Campus Football League.
          </p>
        </div>

        {/* ====================================== */}
        {/* MESSAGES */}
        {/* ====================================== */}

        {params.success === "created" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Team created successfully.
          </div>
        )}

        {params.success === "updated" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Team updated successfully.
          </div>
        )}

        {params.success === "deleted" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Team deleted successfully.
          </div>
        )}

        {params.error === "missing" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Team name and short name are required.
          </div>
        )}

        {params.error === "create" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to create the team. Check the terminal
            for the database error.
          </div>
        )}

        {params.error === "update" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to update the team.
          </div>
        )}

        {params.error === "delete" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to delete the team.
          </div>
        )}

        {params.error === "has_players" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This team cannot be deleted because players are
            assigned to it. Remove or reassign the players first.
          </div>
        )}

        {params.error === "has_matches" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This team cannot be deleted because it already
            has matches. Existing league data is protected.
          </div>
        )}

        {/* ====================================== */}
        {/* ADD / EDIT FORM */}
        {/* ====================================== */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              {editingTeam
                ? "EDIT TEAM"
                : "NEW TEAM"}
            </p>

            <h2 className="text-2xl font-bold">
              {editingTeam
                ? `Edit ${editingTeam.name}`
                : "Add Team"}
            </h2>
          </div>

          <form
            action={
              editingTeam
                ? updateTeam
                : createTeam
            }
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            {editingTeam && (
              <input
                type="hidden"
                name="team_id"
                value={editingTeam.id}
              />
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {/* NAME */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Team Name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={
                    editingTeam?.name ?? ""
                  }
                  placeholder="CSE FC"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>

              {/* SHORT NAME */}
              <div>
                <label
                  htmlFor="short_name"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Short Name
                </label>

                <input
                  id="short_name"
                  name="short_name"
                  type="text"
                  required
                  maxLength={10}
                  defaultValue={
                    editingTeam?.short_name ?? ""
                  }
                  placeholder="CSE"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>

              {/* LOGO */}
              <div>
                <label
                  htmlFor="logo_url"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Logo URL
                </label>

                <input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  defaultValue={
                    editingTeam?.logo_url ?? ""
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Description
                </label>

                <input
                  id="description"
                  name="description"
                  type="text"
                  defaultValue={
                    editingTeam?.description ?? ""
                  }
                  placeholder="Computer Science Football Club"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
              >
                {editingTeam
                  ? "Save Changes"
                  : "Add Team"}
              </button>

              {editingTeam && (
                <Link
                  href="/admin/teams"
                  className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </section>

        {/* ====================================== */}
        {/* TEAM LIST */}
        {/* ====================================== */}

        <section className="pb-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400">
                CURRENT TEAMS
              </p>

              <h2 className="text-2xl font-bold">
                {typedTeams.length} Teams
              </h2>
            </div>
          </div>

          {typedTeams.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {typedTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-800">
                        {team.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">
                            ⚽
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xl font-bold">
                          {team.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {team.short_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {team.description && (
                    <p className="mt-5 text-sm text-slate-400">
                      {team.description}
                    </p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <Link
                      href={`/admin/teams?edit=${team.id}`}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Edit
                    </Link>

                    <form action={deleteTeam}>
                      <input
                        type="hidden"
                        name="team_id"
                        value={team.id}
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
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              No teams found.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}