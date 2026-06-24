import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { doGym, getPlayer, listTrainers, getGyms } from "../api";
import type { Trainer } from "../api";
import { GymIconLarge, BackpackCommon, BackpackEpic, BackpackLegendary, TypeIcon } from "../components/Icons";
import { ConfirmModal } from "../components/ConfirmModal";

const PS = "https://play.pokemonshowdown.com/sprites/trainers";

const GYM_LEADERS = [
  { id: 1, name: "Brock",     city: "Pewter City",    type: "Rock",     emoji: "🪨", reward: 1500, badge: "Boulder",  sprite: `${PS}/brock.png`,    desc: "Rock-type specialist. His defense is impenetrable." },
  { id: 2, name: "Misty",     city: "Cerulean City",  type: "Water",    emoji: "💧", reward: 2000, badge: "Cascade",  sprite: `${PS}/misty.png`,    desc: "The Cerulean girl who commands water with elegance and power." },
  { id: 3, name: "Lt. Surge", city: "Vermilion City", type: "Electric", emoji: "⚡", reward: 2500, badge: "Thunder",  sprite: `${PS}/surge.png`,    desc: "War veteran who uses Electric-types with military discipline." },
  { id: 4, name: "Erika",     city: "Celadon City",   type: "Grass",    emoji: "🌿", reward: 3000, badge: "Rainbow",  sprite: `${PS}/erika.png`,    desc: "A gentle leader who commands Grass-types with natural grace." },
  { id: 5, name: "Koga",      city: "Fuchsia City",   type: "Poison",   emoji: "☠️", reward: 3500, badge: "Soul",     sprite: `${PS}/koga.png`,     desc: "Ninja master who uses Poison-types and guerrilla tactics." },
  { id: 6, name: "Sabrina",   city: "Saffron City",   type: "Psychic",  emoji: "🔮", reward: 4000, badge: "Marsh",    sprite: `${PS}/sabrina.png`,  desc: "Legendary psychic who can foresee the enemy's every move." },
  { id: 7, name: "Blaine",    city: "Cinnabar Island",type: "Fire",     emoji: "🔥", reward: 4500, badge: "Volcano",  sprite: `${PS}/blaine.png`,   desc: "Eccentric scientist who commands Fire-types with wild fervor." },
  { id: 8, name: "Giovanni",  city: "Viridian City",  type: "Ground",   emoji: "🌍", reward: 5000, badge: "Earth",    sprite: `${PS}/giovanni.png`, desc: "Team Rocket boss and Kanto's final Gym Leader." },
];

const ELITE4 = [
  { name: "Lorelei", type: "Ice",     emoji: "🧊", sprite: `${PS}/lorelei.png`,  desc: "Ice-type specialist who freezes opponents with relentless cold." },
  { name: "Bruno",   type: "Fighting",emoji: "🥊", sprite: `${PS}/bruno.png`,    desc: "Tireless fighter who trains body and mind to their limits." },
  { name: "Agatha",  type: "Ghost",   emoji: "👻", sprite: `${PS}/agatha.png`,   desc: "Elder master who commands Ghost Pokémon with ancient wisdom." },
  { name: "Lance",   type: "Dragon",  emoji: "🐉", sprite: `${PS}/lance.png`,    desc: "The Dragon Master — the mightiest of the Elite Four." },
];

const TYPE_BG: Record<string, string> = {
  Rock:     "rgba(120,113,108,0.25)", Water:    "rgba(37,99,235,0.25)",
  Electric: "rgba(202,138,4,0.25)",   Grass:    "rgba(21,128,61,0.25)",
  Poison:   "rgba(126,34,206,0.25)",  Psychic:  "rgba(190,24,93,0.25)",
  Fire:     "rgba(194,65,12,0.25)",   Ground:   "rgba(180,83,9,0.25)",
  Ice:      "rgba(14,116,144,0.25)",  Fighting: "rgba(185,28,28,0.25)",
  Normal:   "rgba(75,85,99,0.25)",    Flying:   "rgba(3,105,161,0.25)",
  Bug:      "rgba(63,98,18,0.25)",    Ghost:    "rgba(76,29,149,0.25)",
  Dragon:   "rgba(30,58,138,0.25)",   Dark:     "rgba(28,25,23,0.25)",
  Steel:    "rgba(51,65,85,0.25)",    Fairy:    "rgba(157,23,77,0.25)",
};

const TYPE_BORDER: Record<string, string> = {
  Rock:     "#78716c", Water:    "#3b82f6", Electric: "#eab308", Grass:    "#22c55e",
  Poison:   "#a855f7", Psychic:  "#ec4899", Fire:     "#f97316", Ground:   "#f59e0b",
  Ice:      "#22d3ee", Fighting: "#ef4444", Normal:   "#6b7280", Flying:   "#38bdf8",
  Bug:      "#84cc16", Ghost:    "#8b5cf6", Dragon:   "#6366f1", Dark:     "#57534e",
  Steel:    "#94a3b8", Fairy:    "#f472b6",
};

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

function getMatchup(attacker: string, defender: string): number {
  if (SUPER_EFF[attacker]?.includes(defender)) return 0.9;
  if (NOT_EFF[attacker]?.includes(defender)) return 0.1;
  return 0.5;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="text-xs font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: TYPE_BG[type] ?? "rgba(99,102,241,0.2)", border: `1px solid ${TYPE_BORDER[type] ?? "#6366f1"}40`, color: TYPE_BORDER[type] ?? "#818cf8" }}
    >
      <TypeIcon type={type} height={14} />
    </span>
  );
}

export default function Gyms() {
  const { playerName, player, setPlayer } = useGameStore();
  const [activeTrainer, setActiveTrainer] = useState<Trainer | null>(null);
  const [battling, setBattling] = useState(false);
  const [gymResult, setGymResult] = useState<{ won: boolean; reward: number; gymName: string; dropped_backpack?: { rarity: string; tokens: number } | null } | null>(null);
  const [confirmGym, setConfirmGym] = useState(false);
  const [gymRewards, setGymRewards] = useState<Record<number, number>>({});
  const nav = useNavigate();

  useEffect(() => {
    if (!playerName) return;
    listTrainers(playerName).then(ts => setActiveTrainer(ts.find(t => t.is_active) ?? ts[0] ?? null));
    getGyms().then(gyms => {
      const map: Record<number, number> = {};
      gyms.forEach(g => { map[g.id] = g.reward; });
      setGymRewards(map);
    }).catch(() => {});
  }, [playerName]);

  const getGymReward = (gymId: number, fallback: number) => gymRewards[gymId] ?? fallback;

  if (!playerName) return (
    <div className="text-center py-24">
      <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
    </div>
  );

  const badges = player?.badges ?? 0;
  const gymPasses = player?.gym_passes ?? 0;
  const elite4Available = player?.elite4_available ?? false;

  async function handleGymChallenge() {
    if (!playerName) return;
    setBattling(true);
    try {
      const res = await doGym(playerName);
      const updated = await getPlayer(playerName);
      setPlayer(updated);
      setGymResult({ won: res.won, reward: res.reward, gymName: res.gym.name, dropped_backpack: res.dropped_backpack });
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Error");
    } finally {
      setBattling(false);
    }
  }

  const BACKPACK_CFG = {
    common:    { label: "Common Backpack",    bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  color: "#4ade80", Icon: BackpackCommon    },
    epic:      { label: "Epic Backpack",      bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.35)", color: "#c084fc", Icon: BackpackEpic      },
    legendary: { label: "Legendary Backpack", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.4)",  color: "#fbbf24", Icon: BackpackLegendary },
  } as const;

  const currentGym = GYM_LEADERS.find(g => g.id - 1 === badges);

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Gym challenge confirmation */}
      {confirmGym && currentGym && (
        <ConfirmModal
          title={`Challenge ${currentGym.name}?`}
          message={`Use 1 Gym Ticket to battle ${currentGym.name} at ${currentGym.city}?`}
          detail={`Win rate depends on your trainer type vs ${currentGym.type}. Reward: ${getGymReward(currentGym.id, currentGym.reward).toLocaleString()} $PKG + 🏅 Badge.`}
          confirmLabel="Challenge!"
          onConfirm={() => { setConfirmGym(false); handleGymChallenge(); }}
          onCancel={() => setConfirmGym(false)}
        />
      )}

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-black text-yellow-400 mb-2 flex items-center justify-center gap-3">
          <GymIconLarge size={44}/>
          Kanto Gyms
        </h1>
        <p className="text-gray-400 text-sm">Defeat all leaders to challenge the Elite Four</p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
               style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span className="text-2xl font-black text-yellow-400">{badges}/8</span>
            <span className="text-gray-400 text-sm">badges</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
               style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="text-2xl font-black text-green-400">🎫 {gymPasses}</span>
            <span className="text-gray-400 text-sm">tickets</span>
          </div>
          {activeTrainer && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                 style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)" }}>
              <span className="text-blue-400 font-black">{activeTrainer.trainer_type}</span>
              <span className="text-gray-400 text-sm">active type</span>
            </div>
          )}
        </div>
      </div>

      {/* Gym result banner */}
      {gymResult && (
        <div className={`card border-2 text-center animate-bounce-in ${gymResult.won ? "border-green-500" : "border-red-600"}`}>
          <div className="text-5xl mb-2">{gymResult.won ? "🏆" : "💀"}</div>
          <p className={`text-2xl font-black ${gymResult.won ? "text-green-400" : "text-red-400"}`}>
            {gymResult.won ? `${gymResult.gymName} DEFEATED!` : `Defeated at ${gymResult.gymName}`}
          </p>
          {gymResult.won && <p className="text-green-400 font-bold mt-1">+{gymResult.reward} $PKG + 🏅 Badge</p>}
          {gymResult.dropped_backpack && (() => {
            const bp = gymResult.dropped_backpack!;
            const cfg = BACKPACK_CFG[bp.rarity as keyof typeof BACKPACK_CFG] ?? BACKPACK_CFG.common;
            return (
              <div className="flex items-center gap-3 rounded-xl p-2 mt-3"
                   style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <cfg.Icon size={44} />
                <div className="text-left">
                  <p className="font-black text-sm" style={{ color: cfg.color }}>{cfg.label} found!</p>
                  <p className="text-white font-black">+{bp.tokens.toLocaleString()} $PKG</p>
                </div>
              </div>
            );
          })()}
          <button onClick={() => setGymResult(null)} className="btn-gray mt-3 text-sm">Close</button>
        </div>
      )}

      {/* Badge overview row */}
      <div className="card">
        <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wider">Your Badges</p>
        <div className="grid grid-cols-8 gap-2">
          {GYM_LEADERS.map((gym, i) => {
            const earned = i < badges;
            return (
              <div key={gym.id} title={gym.badge}
                   className={`aspect-square rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                     earned
                       ? "border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20"
                       : i === badges
                         ? "border-yellow-600/40 bg-yellow-900/20 animate-pulse"
                         : "border-gray-800 bg-gray-900 grayscale opacity-30"
                   }`}>
                {gym.emoji}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gym cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {GYM_LEADERS.map((gym, i) => {
          const earned    = i < badges;
          const isCurrent = i === badges && !elite4Available;
          const locked    = i > badges;
          const matchup   = activeTrainer && activeTrainer.pokemon_count > 0 ? getMatchup(activeTrainer.trainer_type, gym.type) : 0;

          return (
            <div
              key={gym.id}
              className={`rounded-2xl overflow-hidden relative transition-all duration-200 ${
                earned ? "gym-card-earned" : isCurrent ? "gym-card-current" : "gym-card-locked"
              } ${!locked ? "hover:-translate-y-1" : ""}`}
              style={{ background: locked ? "#09091a" : TYPE_BG[gym.type] ?? "#0e0e1c" }}
            >
              {/* Status ribbon */}
              <div className={`absolute top-0 left-0 right-0 text-center text-xs font-black py-1 ${
                earned ? "bg-yellow-500/20 text-yellow-400" :
                isCurrent ? "bg-yellow-400 text-gray-900" :
                "bg-gray-800/80 text-gray-500"
              }`}>
                {earned ? "🏅 EARNED" : isCurrent ? "⚡ NEXT" : `🔒 BADGE ${i + 1}`}
              </div>

              {/* Leader sprite */}
              <div className="pt-8 pb-2 flex justify-center">
                <img
                  src={gym.sprite}
                  alt={gym.name}
                  className={`h-24 w-auto ${locked ? "grayscale opacity-40" : ""}`}
                  style={{ imageRendering: "pixelated" }}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const el = document.createElement("div");
                    el.className = "text-5xl py-2";
                    el.textContent = gym.emoji;
                    e.currentTarget.parentElement?.appendChild(el);
                  }}
                />
              </div>

              {/* Info */}
              <div className="px-3 pb-3">
                <p className={`font-black text-base ${locked ? "text-gray-600" : "text-white"}`}>{gym.name}</p>
                <p className="text-gray-500 text-xs mb-2">{gym.city}</p>

                <TypeBadge type={gym.type} />

                {/* Matchup preview */}
                {activeTrainer && !locked && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{activeTrainer.trainer_type}</span>
                      <span className={`font-black ${matchup >= 0.7 ? "text-green-400" : matchup >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                        {Math.round(matchup * 100)}%
                      </span>
                    </div>
                    <div className="hp-bar-outer">
                      <div className={`hp-bar-inner ${matchup >= 0.7 ? "hp-high" : matchup >= 0.4 ? "hp-mid" : "hp-low"}`}
                           style={{ width: `${Math.round(matchup * 100)}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {earned ? `${getGymReward(gym.id, gym.reward).toLocaleString()} $PKG` : `${getGymReward(gym.id, gym.reward).toLocaleString()} $PKG + 🏅`}
                  </span>
                  {earned && <span className="text-yellow-400 text-lg badge-earned-icon">{gym.emoji}</span>}
                </div>

                {/* Challenge button */}
                {isCurrent && gymPasses > 0 && (
                  <button
                    className="btn-yellow w-full mt-3 text-sm py-2"
                    onClick={() => setConfirmGym(true)}
                    disabled={battling}
                  >
                    {battling ? "Battling..." : `⚔️ Challenge (🎫 ${gymPasses} ticket${gymPasses !== 1 ? "s" : ""})`}
                  </button>
                )}
                {isCurrent && gymPasses === 0 && (
                  <div className="mt-3 text-center text-xs text-gray-500 px-1">
                    🎫 No tickets · Earn them in NPC battles
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Elite 4 section */}
      <div className={`rounded-2xl overflow-hidden ${elite4Available ? "" : "opacity-50"}`}
           style={{ border: "2px solid rgba(168,85,247,0.5)", background: "linear-gradient(135deg,#0c0020,#100830)" }}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">👑</div>
            <div>
              <h2 className="text-2xl font-black text-purple-300">Elite Four</h2>
              <p className="text-gray-400 text-sm">
                {elite4Available ? "You have all 8 badges! You're ready." : `Collect ${8 - badges} badge${8 - badges !== 1 ? "s" : ""} to unlock`}
              </p>
            </div>
            {elite4Available && (
              <div className="ml-auto px-3 py-1.5 rounded-xl bg-yellow-400 text-gray-900 font-black text-sm animate-pulse">
                AVAILABLE!
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ELITE4.map((m, i) => {
              const matchup = activeTrainer ? getMatchup(activeTrainer.trainer_type, m.type) : 0.5;
              return (
                <div key={i} className="rounded-xl p-3 text-center"
                     style={{ background: TYPE_BG[m.type], border: `1px solid ${TYPE_BORDER[m.type]}30` }}>
                  <img src={m.sprite} alt={m.name}
                       className={`h-16 w-auto mx-auto mb-1 ${!elite4Available ? "grayscale" : ""}`}
                       style={{ imageRendering: "pixelated" }}
                       onError={e => { (e.currentTarget as HTMLImageElement).textContent = m.emoji; }} />
                  <p className="font-black text-white text-sm">{m.name}</p>
                  <TypeBadge type={m.type} />
                  {activeTrainer && elite4Available && (
                    <p className={`text-xs font-black mt-1 ${matchup >= 0.7 ? "text-green-400" : matchup >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                      {Math.round(matchup * 100)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {elite4Available && (
            <button className="btn-purple w-full mt-4 py-3 text-lg" onClick={() => nav("/battle")}>
              ⚡ Challenge the Elite Four
            </button>
          )}
        </div>
      </div>

      {/* No trainer warning */}
      {!activeTrainer && (
        <div className="card border border-yellow-500/30 text-center">
          <p className="text-yellow-400 font-bold">You need an active trainer to see matchups!</p>
          <button className="btn-yellow mt-3" onClick={() => nav("/pack")}>Open Pack</button>
        </div>
      )}
    </div>
  );
}
