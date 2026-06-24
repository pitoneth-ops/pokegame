import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "./api";

interface GameStore {
  playerName: string | null;
  player: Player | null;
  setPlayerName: (name: string) => void;
  setPlayer: (p: Player) => void;
  logout: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      playerName: null,
      player: null,
      setPlayerName: (name) => set({ playerName: name }),
      setPlayer: (player) => set({ player, playerName: player.name }),
      logout: () => set({ playerName: null, player: null }),
    }),
    { name: "pokegame-store" }
  )
);
