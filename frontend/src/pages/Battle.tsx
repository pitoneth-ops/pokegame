import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { getNpcs, doBattle, doGym, doElite4, getPlayer, listTrainers, getRoutes } from "../api";
import type { Npc, BattleResult, GymResult, Elite4Result, Trainer, Route } from "../api";
import { BackpackCommon, BackpackEpic, BackpackLegendary, TypeIcon } from "../components/Icons";

type Phase = "select" | "preview" | "fighting" | "result" | "gym_preview" | "gym_fighting" | "gym_result" | "elite_preview" | "elite_fighting" | "elite_result";

// ── NPC visual data ──────────────────────────────────────────────────────────
const PS = "https://play.pokemonshowdown.com/sprites/trainers";
const NPC_SPRITE_POOLS: Record<number, string[]> = {
  1: [`${PS}/youngster.png`, `${PS}/bugcatcher.png`, `${PS}/camper.png`,    `${PS}/picnicker.png`],
  2: [`${PS}/lass.png`,      `${PS}/guitarist.png`,  `${PS}/rocker.png`,    `${PS}/sailor.png`,   `${PS}/fisherman.png`],
  3: [`${PS}/hiker.png`,     `${PS}/channeler.png`,  `${PS}/birdkeeper.png`,`${PS}/scientist.png`],
  4: [`${PS}/cooltrainerm.png`, `${PS}/cooltrainerf.png`, `${PS}/brock.png`, `${PS}/misty.png`, `${PS}/surge.png`],
};
function randomNpcSprites(npcList: { id: number }[]): Record<number, string> {
  const out: Record<number, string> = {};
  npcList.forEach(n => {
    const pool = NPC_SPRITE_POOLS[n.id] ?? [];
    out[n.id] = pool[Math.floor(Math.random() * pool.length)] ?? `${PS}/youngster.png`;
  });
  return out;
}

const TYPE_ICONS: Record<string, string> = {
  Normal:"⬜",Fire:"🔥",Water:"💧",Grass:"🌿",Electric:"⚡",Ice:"❄️",
  Fighting:"🥊",Poison:"☠️",Ground:"🌍",Flying:"🦅",Psychic:"🔮",Bug:"🐛",
  Rock:"🪨",Ghost:"👻",Dragon:"🐉",Dark:"🌑",Steel:"⚙️",Fairy:"✨",Universal:"🌟",
};

function pokeSpriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function generateRandomTeam(npcId: number): number[] {
  const size = npcId === 1 ? 2 : npcId === 2 ? 3 : npcId === 3 ? 4 : 5;
  const pool = Array.from({ length: 151 }, (_, i) => i + 1);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, size);
}

function generateAllTeams(npcList: { id: number }[]): Record<number, number[]> {
  const result: Record<number, number[]> = {};
  npcList.forEach(n => { result[n.id] = generateRandomTeam(n.id); });
  return result;
}

// ── Type matchup ─────────────────────────────────────────────────────────────
const SUPER_EFF: Record<string, string[]> = {
  Water:["Fire","Ground","Rock"],Grass:["Water","Ground","Rock"],Electric:["Water","Flying"],
  Fire:["Grass","Ice","Bug","Steel"],Ice:["Grass","Ground","Flying","Dragon"],
  Fighting:["Normal","Ice","Rock","Dark","Steel"],Poison:["Grass","Fairy"],
  Ground:["Fire","Electric","Poison","Rock","Steel"],Flying:["Grass","Fighting","Bug"],
  Psychic:["Fighting","Poison"],Bug:["Grass","Psychic","Dark"],Rock:["Fire","Ice","Flying","Bug"],
  Ghost:["Psychic","Ghost"],Dragon:["Dragon"],Dark:["Psychic","Ghost"],Normal:[],
  Steel:["Ice","Rock","Fairy"],Fairy:["Fighting","Dragon","Dark"],
};
const NOT_EFF: Record<string, string[]> = {
  Water:["Water","Grass","Dragon"],Grass:["Fire","Grass","Poison","Flying","Bug","Dragon","Steel"],
  Electric:["Grass","Electric","Dragon","Ground"],Fire:["Water","Fire","Rock","Dragon"],
  Ice:["Water","Ice","Steel"],Fighting:["Poison","Flying","Psychic","Bug","Fairy"],
  Poison:["Poison","Ground","Rock","Ghost"],Ground:["Grass","Bug"],Flying:["Electric","Rock","Steel"],
  Psychic:["Steel","Dark"],Bug:["Fire","Fighting","Flying","Ghost","Steel","Fairy"],
  Rock:["Fighting","Ground","Steel"],Ghost:["Dark"],Dragon:["Steel"],
  Dark:["Fighting","Dark","Fairy"],Normal:["Rock","Steel","Ghost"],
  Steel:["Fire","Water","Electric","Steel"],Fairy:["Fire","Poison","Steel"],
};
function typeMatchup(a: string, d: string): number {
  if (SUPER_EFF[a]?.includes(d)) return 0.9;
  if (NOT_EFF[a]?.includes(d)) return 0.1;
  return 0.5;
}

function fmtCooldown(mins: number): string {
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function WinRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-400">Win Rate</span>
        <span className={`font-black text-xl ${pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400"}`}>
          {pct}%
        </span>
      </div>
      <div className="hp-bar-outer h-3">
        <div className={`hp-bar-inner ${pct >= 70 ? "hp-high" : pct >= 40 ? "hp-mid" : "hp-low"}`}
             style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">
        {pct >= 70 ? "🟢 You have the advantage!" : pct >= 40 ? "🟡 Balanced battle" : "🔴 You are at a disadvantage"}
      </p>
    </div>
  );
}

// ── HP bar component ─────────────────────────────────────────────────────────
function HPBar({ pct, name, isEnemy }: { pct: number; name: string; isEnemy: boolean }) {
  const cls = pct > 50 ? "hp-high" : pct > 25 ? "hp-mid" : "hp-low";
  return (
    <div className={isEnemy ? "mb-4" : "mt-4"}>
      <div className={`flex justify-between text-xs mb-1 ${isEnemy ? "" : ""}`}>
        <span className="font-bold text-gray-300">{name}</span>
        <span className="text-gray-400">HP</span>
      </div>
      <div className="hp-bar-outer">
        <div className={`hp-bar-inner ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Route selector ───────────────────────────────────────────────────────────
function RouteSelector({
  routes, selectedRouteId, onSelectRoute, badges,
}: {
  routes: Route[]; selectedRouteId: number; onSelectRoute:(id:number)=>void; badges:number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {routes.map(route => {
        const unlocked = route.badge_required <= badges;
        const selected = route.id === selectedRouteId;
        return (
          <button
            key={route.id}
            onClick={() => unlocked && onSelectRoute(route.id)}
            disabled={!unlocked}
            className={`text-left p-3 rounded-lg border transition-all ${
              selected
                ? "border-green-500 bg-green-950/60 ring-1 ring-green-500"
                : unlocked
                  ? "border-gray-700 bg-gray-800/60 hover:border-gray-500 hover:bg-gray-700/60"
                  : "border-gray-800 bg-gray-900/40 opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-base">{route.theme}</span>
              {!unlocked && (
                <span className="text-xs text-gray-500">🏅{route.badge_required}</span>
              )}
              {selected && (
                <span className="text-xs text-green-400 font-bold">✓</span>
              )}
            </div>
            <div className="font-bold text-sm text-white leading-tight">{route.name}</div>
            <div className="text-xs text-gray-400 mt-0.5 leading-tight">{route.subtitle}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-green-400 font-semibold">×{route.drop_multiplier.toFixed(1)} drops</span>
              {route.stone_types.length > 0 && (
                <span className="text-xs text-purple-400">
                  {route.stone_types.map(s => s.replace(" Stone","")).join(", ")}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Pokémon sprite in battle ─────────────────────────────────────────────────
function BattleSprite({ src, alt, animClass, flip }: { src?: string; alt: string; animClass: string; flip?: boolean }) {
  if (src) {
    return (
      <img src={src} alt={alt}
           className={`w-28 h-28 ${animClass}`}
           style={{ imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : undefined }} />
    );
  }
  return <div className={`text-7xl ${animClass}`}>{alt}</div>;
}

const BACKPACK_CONFIG = {
  common:    { label: "Common Backpack",    bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)",   color: "#4ade80",  Icon: BackpackCommon    },
  epic:      { label: "Epic Backpack",      bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.35)",  color: "#c084fc",  Icon: BackpackEpic      },
  legendary: { label: "Legendary Backpack", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.4)",   color: "#fbbf24",  Icon: BackpackLegendary },
} as const;

function BackpackDropRow({ backpack }: { backpack: { rarity: string; tokens: number } }) {
  const cfg = BACKPACK_CONFIG[backpack.rarity as keyof typeof BACKPACK_CONFIG] ?? BACKPACK_CONFIG.common;
  return (
    <div className="flex items-center gap-3 rounded-xl p-2"
         style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <cfg.Icon size={52} />
      <div>
        <p className="font-black text-sm" style={{ color: cfg.color }}>
          {cfg.label} found!
        </p>
        <p className="text-white font-black text-base">+{backpack.tokens.toLocaleString()} $PKG</p>
        <p className="text-xs text-gray-400">Tokens added automatically</p>
      </div>
    </div>
  );
}

const STONE_COLORS: Record<string, string> = {
  "Fire Stone":    "#ef4444",
  "Water Stone":   "#3b82f6",
  "Thunder Stone": "#eab308",
  "Leaf Stone":    "#22c55e",
  "Moon Stone":    "#a855f7",
};

export default function Battle() {
  const { playerName, player, setPlayer } = useGameStore();
  const [npcs, setNpcs]               = useState<Npc[]>([]);
  const [npcTeams, setNpcTeams]       = useState<Record<number, number[]>>({});
  const [trainers, setTrainers]       = useState<Trainer[]>([]);
  const [activeTrainer, setActive]    = useState<Trainer | null>(null);
  const [phase, setPhase]             = useState<Phase>("select");
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);
  const [animStep, setAnimStep]       = useState(0);
  const [playerHp, setPlayerHp]       = useState(100);
  const [enemyHp, setEnemyHp]         = useState(100);
  const [result, setResult]           = useState<BattleResult | null>(null);
  const [gymResult, setGymResult]     = useState<GymResult | null>(null);
  const [eliteResult, setEliteResult] = useState<Elite4Result | null>(null);
  const [error, setError]             = useState("");
  const [routes, setRoutes]           = useState<Route[]>([]);
  const [selectedRouteId, setRouteId] = useState(1);
  const [npcSprites, setNpcSprites]   = useState<Record<number, string>>({});
  const timersRef                     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!playerName) return;
    getNpcs().then(npcList => {
      setNpcs(npcList);
      setNpcTeams(generateAllTeams(npcList));
      setNpcSprites(randomNpcSprites(npcList));
    });
    listTrainers(playerName).then(list => {
      setTrainers(list);
      setActive(list.find(t => t.is_active) ?? list[0] ?? null);
    });
    getRoutes().then(setRoutes);
  }, [playerName]);

  // Battle animation steps
  useEffect(() => {
    if (phase !== "fighting" && phase !== "gym_fighting" && phase !== "elite_fighting") return;
    setAnimStep(0); setPlayerHp(100); setEnemyHp(100);
    const clr = timersRef.current;
    clr.forEach(clearTimeout);
    timersRef.current = [
      setTimeout(() => setAnimStep(1),        500),
      setTimeout(() => setEnemyHp(35),        950),
      setTimeout(() => setAnimStep(2),        1100),
      setTimeout(() => setAnimStep(3),        1800),
      setTimeout(() => setPlayerHp(58),       2250),
      setTimeout(() => setAnimStep(4),        2400),
    ];
    return () => timersRef.current.forEach(clearTimeout);
  }, [phase]);

  if (!playerName) return (
    <div className="text-center py-24">
      <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
    </div>
  );

  if (!activeTrainer) return (
    <div className="text-center py-24">
      <div className="text-6xl mb-4">🎴</div>
      <p className="text-gray-400 text-lg mb-5">You need a trainer to battle!</p>
      <button className="btn-yellow" onClick={() => nav("/pack")}>Open Pack</button>
    </div>
  );

  function reset() {
    setPhase("select");
    setResult(null); setGymResult(null); setEliteResult(null);
    setSelectedNpc(null); setAnimStep(0); setPlayerHp(100); setEnemyHp(100);
    setError("");
    setNpcTeams(generateAllTeams(npcs));
    setNpcSprites(randomNpcSprites(npcs));
  }

  async function handleBattleConfirm() {
    if (!playerName || !activeTrainer || !selectedNpc) return;
    setError("");
    setPhase("fighting");
    try {
      const [data] = await Promise.all([
        doBattle(playerName, selectedNpc.id, activeTrainer.id, selectedRouteId).then(async r => {
          const [p, ts] = await Promise.all([getPlayer(playerName), listTrainers(playerName)]);
          return { result: r, player: p, trainers: ts };
        }),
        new Promise(r => setTimeout(r, 3200)),
      ]);
      setPlayer(data.player);
      setTrainers(data.trainers);
      setActive(data.trainers.find(t => t.id === activeTrainer?.id) ?? null);
      setResult(data.result);
      setPhase("result");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error"); setPhase("select");
    }
  }

  async function handleGymConfirm() {
    if (!playerName) return;
    setPhase("gym_fighting");
    try {
      const [data] = await Promise.all([
        doGym(playerName).then(async r => {
          const p = await getPlayer(playerName);
          return { result: r, player: p };
        }),
        new Promise(r => setTimeout(r, 3200)),
      ]);
      setPlayer(data.player);
      setGymResult(data.result);
      setPhase("gym_result");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error"); setPhase("select");
    }
  }

  async function handleElite4Confirm() {
    if (!playerName) return;
    setPhase("elite_fighting");
    try {
      const [data] = await Promise.all([
        doElite4(playerName).then(async r => {
          const p = await getPlayer(playerName);
          return { result: r, player: p };
        }),
        new Promise(r => setTimeout(r, 3500)),
      ]);
      setPlayer(data.player);
      setEliteResult(data.result);
      setPhase("elite_result");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error"); setPhase("select");
    }
  }

  const mainPokemon = activeTrainer.pokemon[0];

  // ── PREVIEW: battle matchup before confirming ─────────────────────────────
  if (phase === "preview" && selectedNpc) {
    const route   = routes.find(r => r.id === selectedRouteId) ?? routes[0];
    const winRate = activeTrainer.win_rates[selectedNpc.id - 1] ?? 0;
    const BASE_NPC_RATES: Record<number, { pokemon: number; gym_pass: number }> = {
      1: { pokemon: 0.01, gym_pass: 0.005 },
      2: { pokemon: 0.02, gym_pass: 0.01  },
      3: { pokemon: 0.05, gym_pass: 0.05  },
      4: { pokemon: 0.15, gym_pass: 0.15  },
    };
    const base   = BASE_NPC_RATES[selectedNpc.id] ?? { pokemon: 0.01, gym_pass: 0.005 };
    const mult   = route?.drop_multiplier ?? 1;
    const pkPct  = Math.min(40, +(base.pokemon * mult * 100).toFixed(1));
    const gpPct  = Math.min(35, +(base.gym_pass * mult * 100).toFixed(1));
    const stPct  = route ? +(route.stone_rate * 100).toFixed(1) : 0;

    return (
      <div className="space-y-4 animate-slide-up">
        <button onClick={reset} className="text-gray-500 hover:text-white text-sm flex items-center gap-1 transition-colors">
          ← Back
        </button>
        <div className="battle-arena p-6">
          <h2 className="text-lg font-black text-center text-white mb-4 tracking-wide">⚔️ BATTLE PREVIEW</h2>

          {/* Route badge */}
          {route && (
            <div className="rounded-xl px-4 py-2 mb-4 flex items-center justify-between text-sm"
                 style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <span className="text-yellow-400 font-black">{route.theme} {route.name}</span>
              <span className="text-gray-400">{route.subtitle}</span>
              <span className="text-green-400 font-bold">×{route.drop_multiplier.toFixed(2)} drops</span>
            </div>
          )}

          {/* Team Power badge */}
          <div className="rounded-xl px-4 py-2 mb-4 flex items-center justify-between text-sm"
               style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <span className="text-purple-400 font-black">⚡ Team Power</span>
            <span className="text-white font-bold">{activeTrainer.team_power.toFixed(1)}</span>
            <span className="text-purple-300 text-xs">+{Math.round(Math.min(25, activeTrainer.team_power / 120 * 100))}% win bonus</span>
          </div>

          {/* Two sides */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p className="text-xs text-blue-400 font-black mb-2 tracking-wider">YOUR TRAINER</p>
              {activeTrainer.char && (
                <img src={activeTrainer.char.sprite} alt="" className="h-16 w-auto mx-auto mb-1"
                     style={{ imageRendering: "pixelated" }} />
              )}
              <p className="font-black text-white text-sm">{activeTrainer.char?.name ?? activeTrainer.label}</p>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 mt-1">
                <TypeIcon type={activeTrainer.trainer_type} height={14} /> {activeTrainer.trainer_type}
              </span>
              <div className="flex justify-center gap-1 mt-2 flex-wrap">
                {activeTrainer.pokemon.map(p => (
                  <img key={p.id} src={p.sprite} alt={p.name} title={`${p.name} Lv.${p.level}`}
                       className="w-9 h-9" style={{ imageRendering: "pixelated" }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-xs text-red-400 font-black mb-2 tracking-wider">OPPONENT</p>
              <img src={npcSprites[selectedNpc.id] ?? `${PS}/youngster.png`} alt={selectedNpc.name}
                   className="h-16 w-auto mx-auto" style={{ imageRendering: "pixelated" }} />
              <p className="font-black text-white mt-1">{selectedNpc.name}</p>
              <p className="text-green-400 text-sm font-bold">+{selectedNpc.base_reward} $PKG</p>
              <div className="flex justify-center gap-0.5 mt-2 flex-wrap">
                {(npcTeams[selectedNpc.id] ?? []).map(id => (
                  <img key={id} src={pokeSpriteUrl(id)} alt="" className="w-8 h-8"
                       style={{ imageRendering: "pixelated" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Win rate */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,0,0,0.3)" }}>
            <WinRateBar rate={winRate} />
          </div>

          {/* Drops */}
          <div className={`grid gap-2 mb-5 ${route?.stone_rate > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="rounded-xl p-3 text-center text-xs" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div className="text-2xl mb-1">🎯</div>
              <p className="font-bold text-green-300">{pkPct}%</p>
              <p className="text-gray-500">Pokémon</p>
            </div>
            <div className="rounded-xl p-3 text-center text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <div className="text-2xl mb-1">🎫</div>
              <p className="font-bold text-yellow-300">{gpPct}%</p>
              <p className="text-gray-500">Gym Ticket</p>
            </div>
            {route?.stone_rate > 0 && (
              <div className="rounded-xl p-3 text-center text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <div className="text-2xl mb-1">{route.stone_types[0] === "Fire Stone" ? "🔥" : route.stone_types[0] === "Water Stone" ? "💧" : route.stone_types[0] === "Thunder Stone" ? "⚡" : route.stone_types[0] === "Leaf Stone" ? "🌿" : "🌙"}</div>
                <p className="font-bold text-purple-300">{stPct}%</p>
                <p className="text-gray-500">Stone</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-gray flex-1">← Cancel</button>
            <button onClick={handleBattleConfirm} className="btn-yellow flex-1 text-base font-black">
              ⚔️ BATTLE!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── GYM PREVIEW ──────────────────────────────────────────────────────────
  if (phase === "gym_preview" && player?.current_gym) {
    const gym      = player.current_gym;
    const matchup  = typeMatchup(activeTrainer.trainer_type, gym.type);
    return (
      <div className="space-y-4 animate-slide-up">
        <button onClick={reset} className="text-gray-500 hover:text-white text-sm flex items-center gap-1 transition-colors">← Back</button>
        <div className="battle-arena p-6">
          <h2 className="text-xl font-black text-center text-yellow-400 mb-6">🏟️ GYM CHALLENGE</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p className="text-xs text-blue-400 font-black mb-2">YOUR TRAINER</p>
              {activeTrainer.char && (
                <img src={activeTrainer.char.sprite} alt="" className="h-16 w-auto mx-auto mb-1" style={{ imageRendering: "pixelated" }} />
              )}
              <p className="font-black text-white">{activeTrainer.char?.name ?? activeTrainer.label}</p>
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 mt-1">{activeTrainer.trainer_type}</span>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-xs text-yellow-400 font-black mb-2">LEADER</p>
              <div className="text-5xl my-2">{gym.emoji}</div>
              <p className="font-black text-white">{gym.name}</p>
              <p className="text-gray-400 text-xs">{gym.city}</p>
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 mt-1">{gym.type}</span>
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">{activeTrainer.trainer_type} vs {gym.type}</span>
              <span className={`font-black ${matchup >= 0.7 ? "text-green-400" : matchup >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                {matchup >= 0.7 ? "ADVANTAGE" : matchup >= 0.4 ? "NEUTRAL" : "DISADVANTAGE"} {Math.round(matchup * 100)}%
              </span>
            </div>
            <WinRateBar rate={matchup} />
          </div>

          <div className="flex items-center justify-between text-sm mb-6 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
            <span className="text-gray-400">Victory reward</span>
            <span className="font-black text-yellow-400">{gym.reward.toLocaleString()} $PKG + 🏅 Badge</span>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-gray flex-1">← Cancel</button>
            <button onClick={handleGymConfirm} className="btn-yellow flex-1 text-base font-black">
              ⚔️ CHALLENGE {gym.name}!
            </button>
          </div>
        </div>
        <p className="text-center text-gray-500 text-xs">🎫 {player.gym_passes} ticket(s) available · 1 will be used</p>
      </div>
    );
  }

  // ── ELITE 4 PREVIEW ──────────────────────────────────────────────────────
  if (phase === "elite_preview") {
    const elite4Members = [
      { name: "Lorelei", type: "Ice", emoji: "🧊" },
      { name: "Bruno", type: "Fighting", emoji: "🥊" },
      { name: "Agatha", type: "Ghost", emoji: "👻" },
      { name: "Lance", type: "Dragon", emoji: "🐉" },
    ];
    const matchups = elite4Members.map(m => ({
      ...m, rate: typeMatchup(activeTrainer.trainer_type, m.type)
    }));
    const avgRate = matchups.reduce((s, m) => s + m.rate, 0) / 4;
    const finalRate = Math.max(0.1, Math.min(0.7, avgRate * 0.8 + 0.1));

    return (
      <div className="space-y-4 animate-slide-up">
        <button onClick={reset} className="text-gray-500 hover:text-white text-sm flex items-center gap-1 transition-colors">← Back</button>
        <div className="battle-arena p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-1">👑</div>
            <h2 className="text-2xl font-black text-purple-300">ELITE FOUR</h2>
            <p className="text-gray-400 text-sm">Defeat them all to become Champion!</p>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            {matchups.map((m, i) => (
              <div key={i} className="rounded-xl p-2 text-center" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <div className="text-3xl mb-1">{m.emoji}</div>
                <p className="text-xs font-black text-white">{m.name}</p>
                <p className="text-xs text-gray-500">{m.type}</p>
                <p className={`text-xs font-black mt-1 ${m.rate >= 0.7 ? "text-green-400" : m.rate >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                  {Math.round(m.rate * 100)}%
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-xs text-gray-400 mb-2">
              Your type: <span className="text-white font-bold">{activeTrainer.trainer_type}</span>
            </p>
            <WinRateBar rate={finalRate} />
          </div>

          <div className="text-center mb-5">
            <span className="text-3xl font-black text-green-400">10,000 $PKG</span>
            <p className="text-gray-400 text-xs mt-1">victory reward</p>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-gray flex-1">← Cancel</button>
            <button onClick={handleElite4Confirm} className="btn-purple flex-1 text-base font-black">
              👑 CHALLENGE ELITE FOUR!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FIGHTING ANIMATION ───────────────────────────────────────────────────
  if (phase === "fighting" || phase === "gym_fighting" || phase === "elite_fighting") {
    const isElite = phase === "elite_fighting";
    const isGym   = phase === "gym_fighting";
    const enemyEmoji = isElite ? "👑" : isGym ? (player?.current_gym?.emoji ?? "🏟️") : (selectedNpc?.emoji ?? "🏟️");
    const enemyName  = isElite ? "Elite Four" : isGym ? (player?.current_gym?.name ?? "Gym") : (selectedNpc?.name ?? "NPC");

    const playerAnim = animStep === 1 ? "animate-pokemon-attack" : animStep === 4 ? "animate-take-hit" : "";
    const enemyAnim  = animStep === 2 ? "animate-take-hit" : animStep === 3 ? "animate-shake" : "";

    const enemyPokemonId = !isGym && !isElite && selectedNpc
      ? (npcTeams[selectedNpc.id] ?? [])[0] : null;

    return (
      <div className="battle-arena p-6 min-h-[520px] flex flex-col justify-between animate-fade-in">
        {/* Enemy HP + sprite (top) */}
        <div>
          <HPBar pct={enemyHp} name={enemyName} isEnemy={true} />
          <div className="flex justify-end mt-4 mb-2">
            {enemyPokemonId ? (
              <img
                src={pokeSpriteUrl(enemyPokemonId)}
                alt={enemyName}
                className={`w-28 h-28 ${enemyAnim}`}
                style={{
                  imageRendering: "pixelated",
                  transform: "scaleX(-1)",
                  filter: animStep === 2 ? "brightness(3) saturate(0)" : "none",
                  transition: "filter 0.1s",
                }}
              />
            ) : (
              <div className={`text-8xl ${enemyAnim}`}
                   style={{ filter: animStep === 2 ? "brightness(3) saturate(0)" : "none", transition: "filter 0.1s" }}>
                {enemyEmoji}
              </div>
            )}
          </div>
        </div>

        {/* VS center */}
        <div className="text-center">
          <span className="text-2xl font-black text-white/20 animate-vs-pulse">⚡ VS ⚡</span>
          <p className="text-gray-500 text-sm mt-2 animate-pulse">
            {animStep === 0 ? "Starting battle..." :
             animStep === 1 ? `${activeTrainer.char?.name ?? activeTrainer.label} attacks!` :
             animStep === 2 ? `${enemyName} was hit!` :
             animStep === 3 ? `${enemyName} counter-attacks!` :
             animStep === 4 ? "Calculating result..." : "Finishing..."}
          </p>
        </div>

        {/* Player sprite + HP (bottom) */}
        <div>
          <div className="flex justify-start mb-2">
            {mainPokemon ? (
              <img src={mainPokemon.sprite} alt={mainPokemon.name}
                   className={`w-28 h-28 ${playerAnim}`}
                   style={{ imageRendering: "pixelated", filter: animStep === 4 ? "brightness(3) saturate(0)" : "none", transition: "filter 0.1s" }} />
            ) : (
              <div className={`text-7xl ${playerAnim}`}>{activeTrainer.emoji}</div>
            )}
          </div>
          <HPBar pct={playerHp} name={activeTrainer.char?.name ?? activeTrainer.label} isEnemy={false} />
        </div>

        {isElite && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-2 pointer-events-none">
            {["🧊","🥊","👻","🐉"].map((e, i) => (
              <div key={i} className={`text-3xl opacity-${animStep > i ? "100" : "20"} transition-opacity`}>{e}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── BATTLE RESULT ────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const xpPct = result.xp_to_next > 0
      ? Math.round((result.xp_in_level / result.xp_to_next) * 100) : 100;
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="text-center py-6">
          <div className="text-8xl animate-bounce-in mb-3">{result.won ? "🏆" : "💀"}</div>
          <h2 className={`text-4xl font-black ${result.won ? "text-green-400" : "text-red-400"}`}>
            {result.won ? "VICTORY!" : "DEFEAT!"}
          </h2>
          {result.won && <p className="text-green-300 text-xl font-bold mt-2">+{result.reward} $PKG</p>}
        </div>

        {/* XP gained */}
        <div className="card" style={{ border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.05)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-300 font-black text-sm">⭐ XP GAINED</span>
            <span className="text-purple-400 font-black text-lg">+{result.xp_gained.toLocaleString()} XP</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Lv.{result.trainer_level}</span>
            <span>{result.xp_in_level.toLocaleString()} / {result.xp_to_next.toLocaleString()} XP</span>
          </div>
          <div style={{ height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${xpPct}%`,
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              borderRadius: 9999,
              boxShadow: "0 0 6px rgba(139,92,246,0.6)",
            }} />
          </div>
        </div>

        <div className="card space-y-3">
          {[
            ["Opponent",           result.npc],
            ["Win Rate",           `${Math.round(result.win_rate * 100)}%`],
            ["Balance",            `${result.tokens} $PKG`],
            ["Battles remaining",  `${result.battles_remaining}/${result.battles_per_day}`],
            ["Pokémon on team",    `${result.pokemon_count}/${result.pokemon_slots}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-bold text-white">{value}</span>
            </div>
          ))}
        </div>

        {/* Drops */}
        {(result.dropped_pokemon || result.dropped_gym_pass || result.dropped_stone || result.dropped_backpack) && (
          <div className="card animate-bounce-in" style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)" }}>
            <p className="font-black text-yellow-400 text-sm mb-3">✨ DROPS EARNED! · {result.route_name}</p>
            <div className="space-y-2">
              {result.dropped_pokemon && (
                <div className="flex items-center gap-3 rounded-xl p-2" style={{ background: "rgba(34,197,94,0.08)" }}>
                  <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${result.dropped_pokemon}.png`}
                       alt="pokemon" className="w-12 h-12" style={{ imageRendering: "pixelated" }} />
                  <div>
                    <p className="font-bold text-green-400 text-sm">Pokémon added to Box!</p>
                    <p className="text-xs text-gray-400">Box: {result.bag_count}/{result.bag_capacity}</p>
                  </div>
                </div>
              )}
              {result.dropped_gym_pass && (
                <div className="flex items-center gap-3 rounded-xl p-2" style={{ background: "rgba(245,158,11,0.08)" }}>
                  <div className="text-3xl">🎫</div>
                  <div>
                    <p className="font-bold text-yellow-400 text-sm">Battle Gym Ticket!</p>
                    <p className="text-xs text-gray-400">Total: {result.gym_passes} ticket(s)</p>
                  </div>
                </div>
              )}
              {result.dropped_stone && (
                <div className="flex items-center gap-3 rounded-xl p-2"
                     style={{ background: `rgba(${STONE_COLORS[result.dropped_stone] ? "168,85,247" : "168,85,247"},0.08)` }}>
                  <div className="text-3xl">{result.dropped_stone_icon}</div>
                  <div>
                    <p className="font-bold text-purple-300 text-sm">{result.dropped_stone} found!</p>
                    <p className="text-xs text-gray-400">Use in Box to evolve Pokémon</p>
                  </div>
                </div>
              )}
              {result.dropped_backpack && <BackpackDropRow backpack={result.dropped_backpack} />}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="btn-red flex-1">Battle again</button>
          <button onClick={() => nav("/bag")} className="btn-gray flex-1">📦 Box</button>
        </div>
      </div>
    );
  }

  // ── GYM RESULT ──────────────────────────────────────────────────────────
  if (phase === "gym_result" && gymResult) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="text-center py-6">
          <div className="text-7xl animate-bounce-in mb-3">{gymResult.won ? gymResult.gym.emoji : "😢"}</div>
          <h2 className={`text-3xl font-black ${gymResult.won ? "text-yellow-400" : "text-red-400"}`}>
            {gymResult.won ? `${gymResult.gym.name} defeated!` : "Gym Defeat"}
          </h2>
          {gymResult.won && <p className="text-green-400 font-bold text-xl mt-2">+{gymResult.reward} $PKG</p>}
        </div>

        {gymResult.dropped_backpack && (
          <div className="card animate-bounce-in" style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)" }}>
            <p className="font-black text-yellow-400 text-sm mb-3">✨ GYM DROP!</p>
            <BackpackDropRow backpack={gymResult.dropped_backpack} />
          </div>
        )}

        {gymResult.won && (
          <div className="card">
            <p className="text-yellow-400 font-black mb-3">🏅 +1 Badge earned!</p>
            <div className="grid grid-cols-8 gap-1.5">
              {["🪨","💧","⚡","🌈","💜","🌿","🔥","🌍"].map((emoji, i) => (
                <div key={i} className={`aspect-square rounded-full flex items-center justify-center text-base border-2 ${
                  i < gymResult.badges ? "border-yellow-400 bg-yellow-400/10 shadow-md shadow-yellow-400/20" : "border-gray-800 bg-gray-900 grayscale opacity-30"
                }`}>{emoji}</div>
              ))}
            </div>
            <p className="text-gray-400 text-xs mt-2 text-center">{gymResult.badges}/8 badges</p>
          </div>
        )}

        <div className="card text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-400">Gym</span><span className="font-bold">{gymResult.gym.name}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Matchup</span>
            <span className={`font-black ${gymResult.win_rate >= 0.7 ? "text-green-400" : gymResult.win_rate >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
              {Math.round(gymResult.win_rate * 100)}%
            </span>
          </div>
          <div className="flex justify-between"><span className="text-gray-400">Tickets remaining</span><span className="font-bold">🎫 {gymResult.gym_passes}</span></div>
        </div>

        {gymResult.elite4_available && (
          <div className="card text-center" style={{ border: "2px solid rgba(168,85,247,0.5)", background: "rgba(168,85,247,0.08)" }}>
            <p className="text-2xl mb-1">👑</p>
            <p className="text-purple-300 font-black text-xl">ELITE FOUR UNLOCKED!</p>
            <button onClick={() => setPhase("elite_preview")} className="btn-purple w-full mt-3">⚡ Challenge Now</button>
          </div>
        )}

        <button onClick={reset} className="btn-yellow w-full">Continue</button>
      </div>
    );
  }

  // ── ELITE 4 RESULT ──────────────────────────────────────────────────────
  if (phase === "elite_result" && eliteResult) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="text-center py-6">
          <div className="text-8xl animate-bounce-in mb-3">{eliteResult.won ? "👑" : "💀"}</div>
          <h2 className={`text-4xl font-black ${eliteResult.won ? "text-yellow-400" : "text-red-400"}`}>
            {eliteResult.won ? "CHAMPION!" : "Defeated"}
          </h2>
          {eliteResult.won && <p className="text-green-400 font-black text-2xl mt-2">+{eliteResult.reward.toLocaleString()} $PKG</p>}
        </div>

        <div className="card">
          <p className="text-xs text-gray-400 mb-3 font-semibold">FINAL MATCHUP — {eliteResult.trainer_type}</p>
          <div className="grid grid-cols-4 gap-2">
            {eliteResult.matchups.map((m, i) => (
              <div key={i} className="text-center rounded-xl p-2" style={{ background: "rgba(168,85,247,0.08)" }}>
                <div className="text-2xl">{m.emoji}</div>
                <p className="text-xs font-bold text-white mt-1">{m.member}</p>
                <p className={`text-xs font-black ${m.rate >= 0.7 ? "text-green-400" : m.rate >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                  {Math.round(m.rate * 100)}%
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm mt-3 border-t border-gray-800 pt-3">
            <span className="text-gray-400">Final win rate</span>
            <span className="font-black text-white">{Math.round(eliteResult.win_rate * 100)}%</span>
          </div>
        </div>

        {eliteResult.won ? (
          <div className="card text-center" style={{ border: "2px solid rgba(245,158,11,0.5)" }}>
            <p className="text-yellow-400 font-black">🏆 You are the Kanto Champion!</p>
            <p className="text-gray-400 text-xs mt-1">Badges reset. A new cycle begins!</p>
          </div>
        ) : (
          <div className="card text-center">
            <p className="text-gray-400">The Elite Four was relentless...</p>
            <p className="text-gray-500 text-sm mt-1">Your {eliteResult.badges} badges were kept.</p>
          </div>
        )}

        <div className="flex gap-3">
          {eliteResult.won && (
            <button onClick={() => setPhase("elite_preview")} className="btn-purple flex-1">Play again</button>
          )}
          <button onClick={reset} className="btn-yellow flex-1">Back</button>
        </div>
      </div>
    );
  }

  // ── MAIN SELECT SCREEN ───────────────────────────────────────────────────
  const gymMatchup = player?.current_gym && activeTrainer
    ? typeMatchup(activeTrainer.trainer_type, player.current_gym.type) : 0.5;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-3xl font-black text-white">⚔️ Arena</h1>
      {error && (
        <div className="rounded-xl px-4 py-3 text-red-400 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}

      {/* Active trainer card */}
      <div className="card">
        <p className="text-xs text-gray-500 font-black mb-3 tracking-wider">ACTIVE TRAINER</p>
        <div className="flex items-center gap-4 p-3 rounded-xl"
             style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {activeTrainer.char && (
            <img src={activeTrainer.char.sprite} alt="" className="h-16 w-auto flex-shrink-0"
                 style={{ imageRendering: "pixelated" }} />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-black rarity-${activeTrainer.rarity}`}>
              {activeTrainer.char?.name ?? activeTrainer.label}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300"><TypeIcon type={activeTrainer.trainer_type} height={14} /> {activeTrainer.trainer_type}</span>
              <span className="text-xs text-gray-500">{activeTrainer.pokemon_count}/{activeTrainer.pokemon_slots} Pokémon</span>
              <span className="text-xs text-purple-400 font-bold">Lv.{activeTrainer.level}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className={`text-xs font-bold ${activeTrainer.battles_remaining > 0 ? "text-green-400" : "text-orange-400"}`}>
                {activeTrainer.battles_remaining > 0
                  ? `✓ ${activeTrainer.battles_remaining}/${activeTrainer.battles_per_day} battles`
                  : `⏱ ${fmtCooldown(activeTrainer.minutes_until_battle)}`}
              </p>
              <span className="text-xs text-purple-400 font-bold">⚡ {activeTrainer.team_power.toFixed(1)} TP</span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {activeTrainer.pokemon.slice(0, 3).map(p => (
              <img key={p.id} src={p.sprite} alt={p.name} className="w-9 h-9"
                   style={{ imageRendering: "pixelated" }} />
            ))}
          </div>
        </div>

        {/* Trainer switcher */}
        {trainers.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {trainers.map(t => (
              <button key={t.id} onClick={() => setActive(t)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                      style={{
                        border: `2px solid ${t.id === activeTrainer.id ? "#fbbf24" : "rgba(255,255,255,0.08)"}`,
                        background: t.id === activeTrainer.id ? "rgba(251,191,36,0.1)" : "transparent",
                        color: t.id === activeTrainer.id ? "#fbbf24" : "#6b7280",
                      }}>
                {t.emoji} {t.trainer_type} {t.can_battle ? "✓" : "⏱"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Elite 4 banner */}
      {player?.elite4_available && (
        <div className="rounded-2xl p-5 text-center animate-legendary"
             style={{ background: "linear-gradient(135deg,#1a0840,#0c0020)", border: "2px solid rgba(168,85,247,0.6)" }}>
          <div className="text-4xl mb-2">👑</div>
          <p className="text-purple-300 font-black text-2xl">ELITE FOUR AVAILABLE!</p>
          <p className="text-gray-400 text-sm mb-4">All 8 badges conquered! You're ready.</p>
          <button onClick={() => setPhase("elite_preview")} className="btn-purple text-lg px-8 py-3">
            ⚡ Challenge the Elite Four
          </button>
        </div>
      )}

      {/* Gym section */}
      {!player?.elite4_available && (
        (player?.gym_passes ?? 0) > 0 && player?.current_gym ? (
          <div className="card" style={{ border: "2px solid rgba(245,158,11,0.4)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{player.current_gym.emoji}</div>
              <div className="flex-1">
                <p className="font-black text-yellow-400 text-lg">{player.current_gym.name}</p>
                <p className="text-gray-400 text-xs">{player.current_gym.city} · Type: {player.current_gym.type}</p>
              </div>
              <div className="text-right">
                <p className="text-yellow-400 font-black">🎫 {player.gym_passes}</p>
                <p className="text-gray-500 text-xs">tickets</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm mb-3 rounded-xl px-3 py-2"
                 style={{ background: "rgba(0,0,0,0.2)" }}>
              <span className="text-gray-400">{activeTrainer.trainer_type} vs {player.current_gym.type}</span>
              <span className={`font-black text-lg ${gymMatchup >= 0.7 ? "text-green-400" : gymMatchup >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                {gymMatchup >= 0.7 ? "ADVANTAGE" : gymMatchup >= 0.4 ? "NEUTRAL" : "DISADVANTAGE"} {Math.round(gymMatchup * 100)}%
              </span>
            </div>
            <button className="btn-yellow w-full py-3 text-lg font-black" onClick={() => setPhase("gym_preview")}>
              🏟️ Challenge {player.current_gym.name}
            </button>
          </div>
        ) : (
          <div className="card flex items-center gap-3">
            <span className="text-3xl">🎫</span>
            <div>
              <p className="font-bold text-gray-300">No Battle Gym Tickets</p>
              <p className="text-gray-500 text-xs">Earn them in NPC battles</p>
              {(player?.badges ?? 0) > 0 && <p className="text-yellow-400 text-xs mt-0.5">🏅 {player?.badges}/8 badges</p>}
            </div>
          </div>
        )
      )}

      {/* Route selector */}
      {routes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-white">🗺️ Routes</h2>
            <span className="text-xs text-gray-500">
              {routes.filter(r => r.badge_required <= (player?.badges ?? 0)).length}/{routes.length} unlocked
            </span>
          </div>
          <RouteSelector
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setRouteId}
            badges={player?.badges ?? 0}
          />
        </div>
      )}

      {/* NPC grid */}
      <div>
        <h2 className="text-lg font-black text-white mb-3">Opponents</h2>
        <div className="grid grid-cols-2 gap-3">
          {npcs.map((npc, i) => {
            const winRate  = activeTrainer.win_rates[i] ?? 0;
            const pct      = Math.round(winRate * 100);
            const disabled = activeTrainer.battles_remaining <= 0;
            const team     = npcTeams[npc.id] ?? [];
            const borderCol = pct >= 70 ? "rgba(34,197,94,0.25)" : pct >= 40 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";
            return (
              <div key={npc.id}
                   className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
                   style={{
                     background: "linear-gradient(145deg, #0e0e1c, #0c0c18)",
                     border: `1px solid ${borderCol}`,
                   }}>
                {/* Trainer sprite header */}
                <div style={{
                  background: pct >= 70 ? "rgba(34,197,94,0.06)" : pct >= 40 ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  padding: "14px 8px 0",
                  minHeight: 90,
                }}>
                  <img
                    src={npcSprites[npc.id] ?? `${PS}/youngster.png`}
                    alt={npc.name}
                    style={{ height: 80, imageRendering: "pixelated" }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>

                <div className="p-3">
                  {/* Name + reward */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-black text-white text-sm">{npc.name}</p>
                    <p className="text-green-400 text-xs font-bold">+{npc.base_reward} $PKG</p>
                  </div>

                  {/* Random Pokémon team */}
                  {team.length > 0 && (
                    <div className="flex gap-0.5 mb-3 flex-wrap">
                      {team.map(id => (
                        <img key={id} src={pokeSpriteUrl(id)} alt=""
                             className="w-8 h-8" style={{ imageRendering: "pixelated" }} />
                      ))}
                    </div>
                  )}

                  {/* Win rate bar */}
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Win</span>
                    <span className={`font-black ${pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="hp-bar-outer mb-3">
                    <div className={`hp-bar-inner ${pct >= 70 ? "hp-high" : pct >= 40 ? "hp-mid" : "hp-low"}`}
                         style={{ width: `${pct}%` }} />
                  </div>

                  <button
                    className={`w-full py-2.5 rounded-xl font-black text-sm transition-all ${
                      disabled ? "opacity-40 cursor-not-allowed" :
                      pct >= 70 ? "btn-blue" : pct >= 40 ? "btn-yellow" : "btn-red"
                    }`}
                    onClick={() => { if (!disabled) { setSelectedNpc(npc); setPhase("preview"); } }}
                    disabled={disabled}>
                    {disabled ? `⏱ ${fmtCooldown(activeTrainer.minutes_until_battle)}` : "⚔️ Battle"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hints */}
      <div className="card text-xs text-gray-600 space-y-1">
        <p>• <span className="text-purple-500">Team Power</span> = stats × Pokémon level → increases win rate (up to +25%)</p>
        <p>• Choose a route to change the drop pool and multiply the chances</p>
        <p>• <span className="text-purple-500">Evolution Stones</span> drop on advanced routes · Use in Box to evolve</p>
        <p>• Use a Gym Ticket to challenge gyms · 8 badges → Elite Four</p>
      </div>
    </div>
  );
}
