import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api"
});

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface TrainerPokemon {
  id: number;
  name: string;
  type1: string;
  sprite: string;
  level: number;
}

export interface TrainerChar {
  type: string;
  label: string;
  sprite: string;
  name: string;
  age: number;
  city: string;
  hobby: string;
  quote: string;
  fav_type: string;
  gender: string;
}

export interface Trainer {
  id: number;
  rarity: Rarity;
  label: string;
  emoji: string;
  trainer_type: string;
  battles_per_day: number;
  battles_remaining: number;
  can_battle: boolean;
  minutes_until_battle: number;
  next_battle_at: string;
  cooldown_hours: number;
  level: number;
  xp: number;
  xp_in_level: number;
  xp_to_next: number;
  max_level_unlocked: number;
  next_unlock_cap: number | null;
  next_unlock_cost: number | null;
  pokemon_slots: number;
  pokemon_count: number;
  multiplier: number;
  team_power: number;
  win_rates: number[];
  wins: number;
  losses: number;
  is_active: boolean;
  pokemon: TrainerPokemon[];
  char: TrainerChar | null;
  obtained_at: string;
}

export interface GymLeader {
  id: number;
  name: string;
  city: string;
  type: string;
  emoji: string;
  reward: number;
}

export interface Player {
  name: string;
  tokens: number;
  wins: number;
  losses: number;
  gym_wins: number;
  badges: number;
  elite4_wins: number;
  elite4_available: boolean;
  gym_passes: number;
  current_gym: GymLeader | null;
  gym_available: boolean;
  trainer_count: number;
  counts: Record<Rarity, number>;
  active_trainer: Trainer | null;
  bag_count: number;
  bag_capacity: number;
}

export interface BagPokemon {
  id: number;
  name: string;
  type1: string;
  sprite: string;
  level: number;
}

export interface BagResult {
  pokemon: BagPokemon[];
  count: number;
  capacity: number;
  expand_cost: number | null;
}

export interface Npc {
  id: number;
  name: string;
  emoji: string;
  base_reward: number;
}

export interface Route {
  id: number;
  name: string;
  subtitle: string;
  badge_required: number;
  theme: string;
  pokemon_pool: number[];
  drop_multiplier: number;
  stone_rate: number;
  stone_types: string[];
  description: string;
}

export interface BattleResult {
  won: boolean;
  reward: number;
  tokens: number;
  npc: string;
  win_rate: number;
  team_power: number;
  battles_remaining: number;
  battles_per_day: number;
  xp_gained: number;
  trainer_level: number;
  trainer_xp: number;
  xp_in_level: number;
  xp_to_next: number;
  dropped_pokemon: number | null;
  dropped_gym_pass: boolean;
  dropped_stone: string | null;
  dropped_stone_icon: string;
  dropped_backpack: { rarity: string; tokens: number } | null;
  gym_passes: number;
  pokemon_count: number;
  pokemon_slots: number;
  bag_count: number;
  bag_capacity: number;
  items: Record<string, number>;
  route_name: string;
}

export interface GymResult {
  won: boolean;
  reward: number;
  tokens: number;
  gym_wins: number;
  badges: number;
  elite4_available: boolean;
  gym: GymLeader;
  trainer_type: string;
  win_rate: number;
  gym_passes: number;
  dropped_backpack: { rarity: string; tokens: number } | null;
}

export interface Elite4Matchup {
  member: string;
  type: string;
  emoji: string;
  rate: number;
}

export interface Elite4Result {
  won: boolean;
  reward: number;
  tokens: number;
  elite4_wins: number;
  badges: number;
  win_rate: number;
  trainer_type: string;
  matchups: Elite4Matchup[];
}

export const createPlayer = (name: string) =>
  api.post<{ ok: boolean; player: Player }>("/player/create", { name }).then(r => r.data);

export const getPlayer = (name: string) =>
  api.get<Player>(`/player/${name}`).then(r => r.data);

export interface PokemonPackResult {
  ok: boolean;
  tokens: number;
  rarity: string;
  pokemon: {
    id: number; name: string; type1: string; sprite: string; level: number;
  };
}

export const openPack = (name: string) =>
  api.post<{ ok: boolean; tokens: number; trainer: Trainer }>(`/player/${name}/pack`).then(r => r.data);

export const openTrainerPack = (name: string) =>
  api.post<{ ok: boolean; tokens: number; trainer: Trainer }>(`/player/${name}/pack/trainer`).then(r => r.data);

export const openPokemonPack = (name: string) =>
  api.post<PokemonPackResult>(`/player/${name}/pack/pokemon`).then(r => r.data);

export const swapTrainerType = (name: string, tid: number, new_type: string) =>
  api.post<{ ok: boolean; tokens: number; new_type: string }>(`/player/${name}/trainers/${tid}/swap-type`, { new_type }).then(r => r.data);

export const listTrainers = (name: string) =>
  api.get<Trainer[]>(`/player/${name}/trainers`).then(r => r.data);

export const activateTrainer = (name: string, tid: number) =>
  api.post(`/player/${name}/trainers/${tid}/activate`).then(r => r.data);

export const doBattle = (name: string, npc_id: number, trainer_id: number, route_id: number = 1) =>
  api.post<BattleResult>(`/player/${name}/battle`, { npc_id, trainer_id, route_id }).then(r => r.data);

export const doGym = (name: string) =>
  api.post<GymResult>(`/player/${name}/gym`).then(r => r.data);

export const burnTrainers = (name: string, rarity: Rarity) =>
  api.post<{ ok: boolean; burned: number; new_trainer: Trainer }>(`/player/${name}/burn`, { rarity }).then(r => r.data);

export const doElite4 = (name: string) =>
  api.post<Elite4Result>(`/player/${name}/elite4`).then(r => r.data);

export const buyPokemon = (name: string, tid: number) =>
  api.post<{ ok: boolean; new_pokemon_id: number; tokens: number; pokemon_count: number; cooldown_hours: number; trainer: Trainer }>(
    `/player/${name}/trainers/${tid}/buy-pokemon`
  ).then(r => r.data);

export const getNpcs = () =>
  api.get<Npc[]>("/npcs").then(r => r.data);

export const getGyms = () =>
  api.get<GymLeader[]>("/gyms").then(r => r.data);

export const unlockLevelTier = (name: string, tid: number) =>
  api.post<{ ok: boolean; max_level_unlocked: number; tokens: number; trainer_level: number; trainer: Trainer }>(
    `/player/${name}/trainers/${tid}/unlock-level`
  ).then(r => r.data);

export const getBag = (name: string) =>
  api.get<BagResult>(`/player/${name}/bag`).then(r => r.data);

export const equipFromBag = (name: string, bag_index: number, trainer_id: number) =>
  api.post<{ ok: boolean; pokemon_count: number; bag_count: number; trainer: Trainer; bag: BagPokemon[] }>(
    `/player/${name}/bag/equip`, { bag_index, trainer_id }
  ).then(r => r.data);

export const unequipToBag = (name: string, poke_index: number, trainer_id?: number) =>
  api.post<{ ok: boolean; pokemon_count: number; bag_count: number; trainer: Trainer; bag: BagPokemon[] }>(
    `/player/${name}/bag/unequip`, { poke_index, trainer_id }
  ).then(r => r.data);

export const releaseFromBag = (name: string, bag_index: number) =>
  api.post<{ ok: boolean; bag_count: number; bag: BagPokemon[] }>(
    `/player/${name}/bag/release/${bag_index}`
  ).then(r => r.data);

export const expandBag = (name: string) =>
  api.post<{ ok: boolean; bag_capacity: number; tokens: number }>(
    `/player/${name}/bag/expand`
  ).then(r => r.data);

export const getRoutes = () =>
  api.get<Route[]>("/routes").then(r => r.data);

export const getItems = (name: string) =>
  api.get<Record<string, number>>(`/player/${name}/items`).then(r => r.data);

export const useStone = (name: string, bag_index: number, stone_name: string) =>
  api.post<{ ok: boolean; old_name: string; new_name: string; new_id: number; items: Record<string, number>; bag: BagPokemon[] }>(
    `/player/${name}/bag/use-stone`, { bag_index, stone_name }
  ).then(r => r.data);
