"use client";

import { useMemo, useState } from "react";

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

type ExistingLineup = {
  team_id: number;
  formation: string;
  starting_xi: number[];
};

type Props = {
  homeTeam: Team;
  awayTeam: Team;

  homePlayers: Player[];
  awayPlayers: Player[];

  homeLineup: ExistingLineup | null;
  awayLineup: ExistingLineup | null;

  saveLineup: (
    formData: FormData
  ) => void | Promise<void>;

  matchStatus: string;
};

const formations: Record<
  string,
  string[]
> = {
  "4-4-2": [
    "GK",
    "LB",
    "LCB",
    "RCB",
    "RB",
    "LM",
    "LCM",
    "RCM",
    "RM",
    "ST",
    "ST",
  ],

  "4-3-3": [
    "GK",
    "LB",
    "LCB",
    "RCB",
    "RB",
    "LCM",
    "CM",
    "RCM",
    "LW",
    "ST",
    "RW",
  ],

  "4-2-3-1": [
    "GK",
    "LB",
    "LCB",
    "RCB",
    "RB",
    "LDM",
    "RDM",
    "LAM",
    "CAM",
    "RAM",
    "ST",
  ],

  "3-5-2": [
    "GK",
    "LCB",
    "CB",
    "RCB",
    "LWB",
    "LCM",
    "CM",
    "RCM",
    "RWB",
    "ST",
    "ST",
  ],

  "3-4-3": [
    "GK",
    "LCB",
    "CB",
    "RCB",
    "LM",
    "LCM",
    "RCM",
    "RM",
    "LW",
    "ST",
    "RW",
  ],

  "4-1-4-1": [
    "GK",
    "LB",
    "LCB",
    "RCB",
    "RB",
    "DM",
    "LM",
    "LCM",
    "RCM",
    "RM",
    "ST",
  ],

  "5-3-2": [
    "GK",
    "LWB",
    "LCB",
    "CB",
    "RCB",
    "RWB",
    "LCM",
    "CM",
    "RCM",
    "ST",
    "ST",
  ],

  "5-4-1": [
    "GK",
    "LWB",
    "LCB",
    "CB",
    "RCB",
    "RWB",
    "LM",
    "LCM",
    "RCM",
    "RM",
    "ST",
  ],
};

function getPlayerLabel(
  player: Player
) {
  const number =
    player.jersey_number !== null
      ? `#${player.jersey_number} `
      : "";

  return `${number}${player.name}`;
}

function LineupEditor({
  team,
  players,
  existingLineup,
  saveLineup,
  matchStatus,
}: {
  team: Team;
  players: Player[];
  existingLineup:
    | ExistingLineup
    | null;
  saveLineup: Props["saveLineup"];
  matchStatus: string;
}) {
  const initialFormation =
    existingLineup?.formation ??
    "4-3-3";

  const [formation, setFormation] =
    useState(initialFormation);

  const [playersSelected, setPlayersSelected] =
    useState<number[]>(
      existingLineup?.starting_xi
        ?.slice(0, 11) ??
        Array(11).fill(0)
    );

  const slots = useMemo(
    () =>
      formations[
        formation
      ] ?? formations["4-3-3"],
    [formation]
  );

  function changeFormation(
    value: string
  ) {
    setFormation(value);

    const newLength =
      formations[value]?.length ??
      11;

    setPlayersSelected(
      Array.from(
        { length: newLength },
        (_, index) =>
          playersSelected[
            index
          ] ?? 0
      )
    );
  }

  function changePlayer(
    index: number,
    playerId: number
  ) {
    setPlayersSelected(
      (current) => {
        const copy = [
          ...current,
        ];

        copy[index] =
          playerId;

        return copy;
      }
    );
  }

  const selectedIds =
    playersSelected.filter(
      (id) => id > 0
    );

  const duplicateIds =
    selectedIds.filter(
      (id, index) =>
        selectedIds.indexOf(id) !==
        index
    );

  const validCount =
    selectedIds.length === 11;

  const hasDuplicates =
    duplicateIds.length > 0;

  const canSave =
    validCount &&
    !hasDuplicates;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-emerald-400">
            STARTING XI
          </p>

          <h3 className="mt-1 text-2xl font-bold">
            {team.name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Squad: {players.length} players
          </p>
        </div>

        <div className="w-full md:w-56">
          <label className="mb-2 block text-sm text-slate-400">
            Formation
          </label>

          <select
            value={formation}
            disabled={
              matchStatus !==
              "scheduled"
            }
            onChange={(event) =>
              changeFormation(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            {Object.keys(
              formations
            ).map(
              (formationName) => (
                <option
                  key={
                    formationName
                  }
                  value={
                    formationName
                  }
                >
                  {formationName}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm text-slate-400">
          Selected:
          <span
            className={`ml-2 font-bold ${
              validCount &&
              !hasDuplicates
                ? "text-emerald-400"
                : "text-yellow-400"
            }`}
          >
            {selectedIds.length}/11
          </span>
        </p>

        {hasDuplicates && (
          <p className="mt-2 text-sm text-red-400">
            A player cannot be selected more than once.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {slots.map(
          (
            position,
            index
          ) => {
            const currentPlayer =
              playersSelected[
                index
              ] ?? 0;

            return (
              <div
                key={`${position}-${index}`}
                className="grid grid-cols-[80px_1fr] gap-3"
              >
                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs font-bold text-emerald-400">
                  {position}
                </div>

                <select
                  value={
                    currentPlayer
                  }
                  disabled={
                    matchStatus !==
                    "scheduled"
                  }
                  onChange={(
                    event
                  ) =>
                    changePlayer(
                      index,
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value={0}>
                    Select player
                  </option>

                  {players
                    .filter(
                      (player) =>
                        player.id ===
                          currentPlayer ||
                        !playersSelected.includes(
                          player.id
                        )
                    )
                    .map(
                      (player) => (
                        <option
                          key={
                            player.id
                          }
                          value={
                            player.id
                          }
                        >
                          {getPlayerLabel(
                            player
                          )}
                        </option>
                      )
                    )}
                </select>
              </div>
            );
          }
        )}
      </div>

      {matchStatus ===
        "scheduled" && (
        <form
          action={saveLineup}
          className="mt-6"
        >
          <input
            type="hidden"
            name="team_id"
            value={team.id}
          />

          <input
            type="hidden"
            name="formation"
            value={formation}
          />

          {playersSelected.map(
            (playerId, index) => (
              <input
                key={index}
                type="hidden"
                name="starting_xi"
                value={playerId}
              />
            )
          )}

          <button
            type="submit"
            disabled={
              !canSave
            }
            className={`w-full rounded-lg px-5 py-3 font-bold ${
              canSave
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "cursor-not-allowed bg-slate-700 text-slate-500"
            }`}
          >
            Save {team.name} Starting XI
          </button>
        </form>
      )}

      {matchStatus !==
        "scheduled" && (
        <p className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-sm text-slate-500">
          Lineups can only be changed before the match starts.
        </p>
      )}
    </div>
  );
}

export default function MatchLineup({
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  homeLineup,
  awayLineup,
  saveLineup,
  matchStatus,
}: Props) {
  return (
    <section className="mt-8">
      <div className="mb-5">
        <p className="text-sm text-emerald-400">
          MATCH SETUP
        </p>

        <h2 className="mt-1 text-2xl font-bold">
          Formations & Starting XI
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Select a formation and exactly 11 players from each
          team's squad before the match starts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineupEditor
          team={homeTeam}
          players={
            homePlayers
          }
          existingLineup={
            homeLineup
          }
          saveLineup={
            saveLineup
          }
          matchStatus={
            matchStatus
          }
        />

        <LineupEditor
          team={awayTeam}
          players={
            awayPlayers
          }
          existingLineup={
            awayLineup
          }
          saveLineup={
            saveLineup
          }
          matchStatus={
            matchStatus
          }
        />
      </div>
    </section>
  );
}