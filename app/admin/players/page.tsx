export const instant = false;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Player = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  team_id: number;
};

type PageProps = {
  searchParams: Promise<{
    edit?: string;
    team?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function AdminPlayersPage({
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
  // GET PLAYERS
  // ==================================================

  const {
    data: players,
    error: playersError,
  } = await supabase
    .from("players")
    .select(
      "id, name, jersey_number, position, team_id"
    )
    .order("name", {
      ascending: true,
    });

  if (
    teamsError ||
    playersError
  ) {
    console.error(
      "Teams error:",
      teamsError
    );

    console.error(
      "Players error:",
      playersError
    );

    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold">
          Unable to load players
        </h1>

        <p className="mt-3 text-red-400">
          There was a problem loading player data.
        </p>
      </main>
    );
  }

  const typedTeams =
    (teams ?? []) as Team[];

  const typedPlayers =
    (players ?? []) as Player[];

  // ==================================================
  // FILTER / EDIT STATE
  // ==================================================

  const selectedTeamId =
    params.team
      ? Number(params.team)
      : null;

  const editId = params.edit
    ? Number(params.edit)
    : null;

  const editingPlayer =
    editId !== null &&
    !Number.isNaN(editId)
      ? typedPlayers.find(
          (player) =>
            player.id === editId
        ) ?? null
      : null;

  const selectedTeam =
    selectedTeamId !== null &&
    !Number.isNaN(selectedTeamId)
      ? typedTeams.find(
          (team) =>
            team.id ===
            selectedTeamId
        ) ?? null
      : null;

  const filteredPlayers =
    selectedTeamId !== null &&
    !Number.isNaN(selectedTeamId)
      ? typedPlayers.filter(
          (player) =>
            player.team_id ===
            selectedTeamId
        )
      : typedPlayers;

  // ==================================================
  // CREATE PLAYER
  // ==================================================

  async function createPlayer(
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

    const name =
      String(
        formData.get(
          "name"
        ) ?? ""
      ).trim();

    const position =
      String(
        formData.get(
          "position"
        ) ?? ""
      ).trim();

    const teamId =
      Number(
        formData.get(
          "team_id"
        )
      );

    const jerseyValue =
      String(
        formData.get(
          "jersey_number"
        ) ?? ""
      );

    const jerseyNumber =
      jerseyValue !== ""
        ? Number(
            jerseyValue
          )
        : null;

    if (
      !name ||
      !position ||
      !teamId
    ) {
      redirect(
        "/admin/players?error=missing"
      );
    }

    if (
      !typedTeamsExist(
        teamId,
        typedTeams
      )
    ) {
      redirect(
        "/admin/players?error=team"
      );
    }

    if (
      jerseyNumber !== null &&
      (
        !Number.isFinite(
          jerseyNumber
        ) ||
        jerseyNumber < 0 ||
        jerseyNumber > 99
      )
    ) {
      redirect(
        "/admin/players?error=jersey"
      );
    }

    const { error } =
      await serverSupabase
        .from("players")
        .insert({
          name,
          position,
          team_id:
            teamId,
          jersey_number:
            jerseyNumber,
        });

    if (error) {
      console.error(
        "Create player error:",
        error
      );

      redirect(
        "/admin/players?error=create"
      );
    }

    redirect(
      "/admin/players?success=created"
    );
  }

  // ==================================================
  // UPDATE PLAYER
  // ==================================================

  async function updatePlayer(
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

    const playerId =
      Number(
        formData.get(
          "player_id"
        )
      );

    const name =
      String(
        formData.get(
          "name"
        ) ?? ""
      ).trim();

    const position =
      String(
        formData.get(
          "position"
        ) ?? ""
      ).trim();

    const teamId =
      Number(
        formData.get(
          "team_id"
        )
      );

    const jerseyValue =
      String(
        formData.get(
          "jersey_number"
        ) ?? ""
      );

    const jerseyNumber =
      jerseyValue !== ""
        ? Number(
            jerseyValue
          )
        : null;

    if (
      !playerId ||
      !name ||
      !position ||
      !teamId
    ) {
      redirect(
        `/admin/players?edit=${playerId}&error=missing`
      );
    }

    if (
      !typedTeamsExist(
        teamId,
        typedTeams
      )
    ) {
      redirect(
        `/admin/players?edit=${playerId}&error=team`
      );
    }

    if (
      jerseyNumber !== null &&
      (
        !Number.isFinite(
          jerseyNumber
        ) ||
        jerseyNumber < 0 ||
        jerseyNumber > 99
      )
    ) {
      redirect(
        `/admin/players?edit=${playerId}&error=jersey`
      );
    }

    const { error } =
      await serverSupabase
        .from("players")
        .update({
          name,
          position,
          team_id:
            teamId,
          jersey_number:
            jerseyNumber,
        })
        .eq(
          "id",
          playerId
        );

    if (error) {
      console.error(
        "Update player error:",
        error
      );

      redirect(
        `/admin/players?edit=${playerId}&error=update`
      );
    }

    redirect(
      `/admin/players?team=${teamId}&success=updated`
    );
  }

  // ==================================================
  // DELETE PLAYER
  // ==================================================

  async function deletePlayer(
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

    const playerId =
      Number(
        formData.get(
          "player_id"
        )
      );

    const returnTeamId =
      Number(
        formData.get(
          "return_team_id"
        ) ?? 0
      );

    if (!playerId) {
      redirect(
        "/admin/players?error=delete"
      );
    }

    // ==================================================
    // CHECK MATCH EVENTS
    // ==================================================

    const {
      count: eventCount,
      error: eventError,
    } =
      await serverSupabase
        .from("match_events")
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        )
        .or(
          `player_id.eq.${playerId},assist_player_id.eq.${playerId},player_in_id.eq.${playerId},player_out_id.eq.${playerId}`
        );

    if (eventError) {
      console.error(
        "Event reference check:",
        eventError
      );

      redirect(
        "/admin/players?error=delete"
      );
    }

    if (
      (eventCount ?? 0) > 0
    ) {
      redirect(
        `/admin/players?error=has_events${
          returnTeamId
            ? `&team=${returnTeamId}`
            : ""
        }`
      );
    }

    // ==================================================
    // CHECK PLAYER MATCH STATS
    // ==================================================

    const {
      count: statsCount,
      error: statsError,
    } =
      await serverSupabase
        .from(
          "player_match_stats"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        )
        .eq(
          "player_id",
          playerId
        );

    if (statsError) {
      console.error(
        "Player stats reference check:",
        statsError
      );

      redirect(
        "/admin/players?error=delete"
      );
    }

    if (
      (statsCount ?? 0) > 0
    ) {
      redirect(
        `/admin/players?error=has_stats${
          returnTeamId
            ? `&team=${returnTeamId}`
            : ""
        }`
      );
    }

    // ==================================================
    // DELETE
    // ==================================================

    const { error } =
      await serverSupabase
        .from("players")
        .delete()
        .eq(
          "id",
          playerId
        );

    if (error) {
      console.error(
        "Delete player error:",
        error
      );

      redirect(
        `/admin/players?error=delete${
          returnTeamId
            ? `&team=${returnTeamId}`
            : ""
        }`
      );
    }

    redirect(
      `/admin/players?success=deleted${
        returnTeamId
          ? `&team=${returnTeamId}`
          : ""
      }`
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ==================================================
          NAVBAR
          ================================================== */}

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
              Player Management
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
        {/* ==================================================
            HEADER
            ================================================== */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            League Setup
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Players
          </h1>

          <p className="mt-3 text-slate-400">
            Add players, manage squads, assign teams and
            edit player information.
          </p>
        </div>

        {/* ==================================================
            MESSAGES
            ================================================== */}

        {params.success ===
          "created" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Player created successfully.
          </div>
        )}

        {params.success ===
          "updated" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Player updated successfully.
          </div>
        )}

        {params.success ===
          "deleted" && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Player deleted successfully.
          </div>
        )}

        {params.error ===
          "missing" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Name, position and team are required.
          </div>
        )}

        {params.error ===
          "jersey" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Jersey number must be between 0 and 99.
          </div>
        )}

        {params.error ===
          "team" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Please select a valid team.
          </div>
        )}

        {params.error ===
          "create" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to create player. Check the terminal for
            the database error.
          </div>
        )}

        {params.error ===
          "update" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to update player.
          </div>
        )}

        {params.error ===
          "delete" && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Unable to delete player.
          </div>
        )}

        {params.error ===
          "has_events" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This player cannot be deleted because they are
            already referenced by match events.
          </div>
        )}

        {params.error ===
          "has_stats" && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            This player cannot be deleted because player
            match statistics already exist.
          </div>
        )}

        {/* ==================================================
            TEAM SQUAD FILTER
            ================================================== */}

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              SQUAD MANAGEMENT
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              Select Team
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Choose a team to view and manage its complete
              squad.
            </p>
          </div>

          <form
            method="GET"
            action="/admin/players"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <select
              name="team"
              defaultValue={
                selectedTeamId ??
                ""
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="">
                All Teams
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

            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
            >
              Show Squad
            </button>

            {selectedTeamId !==
              null &&
              !Number.isNaN(
                selectedTeamId
              ) && (
                <Link
                  href="/admin/players"
                  className="rounded-lg border border-slate-700 px-6 py-3 text-center font-semibold text-slate-300 hover:bg-slate-800"
                >
                  All Teams
                </Link>
              )}
          </form>
        </section>

        {/* ==================================================
            ADD / EDIT PLAYER
            ================================================== */}

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              {editingPlayer
                ? "EDIT PLAYER"
                : "NEW PLAYER"}
            </p>

            <h2 className="text-2xl font-bold">
              {editingPlayer
                ? `Edit ${editingPlayer.name}`
                : "Add Player"}
            </h2>
          </div>

          <form
            action={
              editingPlayer
                ? updatePlayer
                : createPlayer
            }
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            {editingPlayer && (
              <input
                type="hidden"
                name="player_id"
                value={
                  editingPlayer.id
                }
              />
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {/* NAME */}

              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Player Name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={
                    editingPlayer?.name ??
                    ""
                  }
                  placeholder="Rahul Sharma"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>

              {/* TEAM */}

              <div>
                <label
                  htmlFor="team_id"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Team / Squad
                </label>

                <select
                  id="team_id"
                  name="team_id"
                  required
                  defaultValue={
                    editingPlayer?.team_id ??
                    selectedTeamId ??
                    ""
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">
                    Select team
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

                <p className="mt-2 text-xs text-slate-500">
                  Changing this team moves the player to that
                  team's squad.
                </p>
              </div>

              {/* POSITION */}

              <div>
                <label
                  htmlFor="position"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Position
                </label>

                <select
                  id="position"
                  name="position"
                  required
                  defaultValue={
                    editingPlayer?.position ??
                    ""
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">
                    Select position
                  </option>

                  <option value="Goalkeeper">
                    Goalkeeper
                  </option>

                  <option value="Defender">
                    Defender
                  </option>

                  <option value="Midfielder">
                    Midfielder
                  </option>

                  <option value="Forward">
                    Forward
                  </option>
                </select>
              </div>

              {/* JERSEY */}

              <div>
                <label
                  htmlFor="jersey_number"
                  className="mb-2 block text-sm text-slate-400"
                >
                  Jersey Number
                </label>

                <input
                  id="jersey_number"
                  name="jersey_number"
                  type="number"
                  min="0"
                  max="99"
                  defaultValue={
                    editingPlayer?.jersey_number ??
                    ""
                  }
                  placeholder="10"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
              >
                {editingPlayer
                  ? "Save Changes"
                  : "Add Player"}
              </button>

              {editingPlayer && (
                <Link
                  href={
                    selectedTeamId !==
                    null &&
                    !Number.isNaN(
                      selectedTeamId
                    )
                      ? `/admin/players?team=${selectedTeamId}`
                      : "/admin/players"
                  }
                  className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </section>

        {/* ==================================================
            PLAYER / SQUAD LIST
            ================================================== */}

        <section className="pb-10">
          <div className="mb-4">
            <p className="text-sm text-emerald-400">
              {selectedTeam
                ? "CURRENT SQUAD"
                : "ALL PLAYERS"}
            </p>

            <h2 className="text-2xl font-bold">
              {selectedTeam
                ? `${filteredPlayers.length} Players in ${selectedTeam.name}`
                : `${filteredPlayers.length} Players`}
            </h2>
          </div>

          {selectedTeam && (
            <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="font-semibold text-emerald-400">
                {selectedTeam.name}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {filteredPlayers.length} player
                {filteredPlayers.length ===
                1
                  ? ""
                  : "s"} in this squad
              </p>
            </div>
          )}

          {filteredPlayers.length >
          0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {filteredPlayers.map(
                (
                  player,
                  index
                ) => {
                  const team =
                    typedTeams.find(
                      (item) =>
                        item.id ===
                        player.team_id
                    );

                  return (
                    <div
                      key={
                        player.id
                      }
                      className={`p-5 ${
                        index !==
                        filteredPlayers.length -
                          1
                          ? "border-b border-slate-800"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                        {/* PLAYER INFO */}

                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-xl font-black">
                            {player.jersey_number ??
                              "-"}
                          </div>

                          <div>
                            <h3 className="font-bold">
                              {
                                player.name
                              }
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              {
                                player.position
                              }
                            </p>

                            <p className="mt-1 text-sm text-emerald-400">
                              {team?.name ??
                                "Unknown Team"}
                            </p>
                          </div>
                        </div>

                        {/* ACTIONS */}

                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={
                              selectedTeamId !==
                                null &&
                              !Number.isNaN(
                                selectedTeamId
                              )
                                ? `/admin/players?edit=${player.id}&team=${selectedTeamId}`
                                : `/admin/players?edit=${player.id}`
                            }
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            Edit
                          </Link>

                          <form
                            action={
                              deletePlayer
                            }
                          >
                            <input
                              type="hidden"
                              name="player_id"
                              value={
                                player.id
                              }
                            />

                            <input
                              type="hidden"
                              name="return_team_id"
                              value={
                                selectedTeamId ??
                                player.team_id
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
                  );
                }
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="text-slate-400">
                {selectedTeam
                  ? `No players have been added to ${selectedTeam.name} yet.`
                  : "No players found."}
              </p>

              {selectedTeam && (
                <Link
                  href={`/admin/players?team=${selectedTeam.id}`}
                  className="mt-4 inline-block rounded-lg bg-emerald-500 px-5 py-2 font-semibold text-slate-950"
                >
                  Add Player to{" "}
                  {selectedTeam.name}
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ======================================================
// SMALL SERVER-SAFE HELPER
// ======================================================

function typedTeamsExist(
  teamId: number,
  teams: Team[]
) {
  return teams.some(
    (team) =>
      team.id === teamId
  );
}