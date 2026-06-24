import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { listTrainers, activateTrainer, burnTrainers, buyPokemon, unlockLevelTier, getPlayer, unequipToBag, swapTrainerType } from "../api";
import type { Trainer, Rarity } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { TypeIcon } from "../components/Icons";

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];
const BURN_NEXT: Record<string, string> = { common: "Rare", rare: "Epic", epic: "Legendary" };

const RARITY_GRADIENT: Record<string, [string, string]> = {
  common:    ["#1f2937", "#111827"],
  rare:      ["#1e3a5f", "#0c1a3a"],
  epic:      ["#2e1065", "#180840"],
  legendary: ["#451a03", "#1c0a00"],
};
const RARITY_BORDER_COLOR: Record<string, string> = {
  common: "#475569", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};
const RARITY_GLOW: Record<string, string> = {
  common:    "0 0 20px rgba(71,85,105,0.2)",
  rare:      "0 0 24px rgba(59,130,246,0.3)",
  epic:      "0 0 28px rgba(168,85,247,0.35)",
  legendary: "0 0 40px rgba(245,158,11,0.45), 0 0 80px rgba(245,158,11,0.15)",
};
const RARITY_LABEL: Record<string, string> = {
  common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY",
};

const ALL_TYPES = [
  "Rock","Water","Electric","Grass","Poison","Psychic","Fire","Ground",
  "Ice","Fighting","Normal","Flying","Bug","Ghost","Dragon","Dark","Steel","Fairy",
];
const ALL_TYPES_LEGENDARY = [...ALL_TYPES, "Universal"];

const TYPE_BG: Record<string, string> = {
  Rock:"rgba(120,113,108,0.3)",Water:"rgba(37,99,235,0.3)",Electric:"rgba(202,138,4,0.3)",
  Grass:"rgba(21,128,61,0.3)",Poison:"rgba(126,34,206,0.3)",Psychic:"rgba(190,24,93,0.3)",
  Fire:"rgba(194,65,12,0.3)",Ground:"rgba(180,83,9,0.3)",Ice:"rgba(14,116,144,0.3)",
  Fighting:"rgba(185,28,28,0.3)",Normal:"rgba(75,85,99,0.3)",Flying:"rgba(3,105,161,0.3)",
  Bug:"rgba(63,98,18,0.3)",Ghost:"rgba(76,29,149,0.3)",Dragon:"rgba(30,58,138,0.3)",
  Dark:"rgba(28,25,23,0.4)",Steel:"rgba(51,65,85,0.3)",Fairy:"rgba(157,23,77,0.3)",
  Universal:"rgba(245,158,11,0.3)",
};
const TYPE_COLOR: Record<string, string> = {
  Rock:"#a8a29e",Water:"#60a5fa",Electric:"#fbbf24",Grass:"#4ade80",Poison:"#c084fc",
  Psychic:"#f472b6",Fire:"#fb923c",Ground:"#fcd34d",Ice:"#67e8f9",Fighting:"#f87171",
  Normal:"#9ca3af",Flying:"#7dd3fc",Bug:"#a3e635",Ghost:"#818cf8",Dragon:"#818cf8",
  Dark:"#78716c",Steel:"#cbd5e1",Fairy:"#f9a8d4",Universal:"#fbbf24",
};

function fmtCooldown(mins: number): string {
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

const TYPE_EMOJI: Record<string, string> = {
  Rock:"🪨",Water:"💧",Electric:"⚡",Grass:"🌿",Poison:"☠️",Psychic:"🔮",
  Fire:"🔥",Ground:"🌍",Ice:"❄️",Fighting:"🥊",Normal:"⬜",Flying:"🦅",
  Bug:"🐛",Ghost:"👻",Dragon:"🐉",Dark:"🌑",Steel:"⚙️",Fairy:"✨",Universal:"🌈",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{ background: TYPE_BG[type] ?? "rgba(99,102,241,0.2)", color: TYPE_COLOR[type] ?? "#818cf8" }}>
      <TypeIcon type={type} height={14} />
    </span>
  );
}

function CooldownBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - current) / total) * 100)) : 100;
  return (
    <div className="hp-bar-outer">
      <div className="hp-bar-inner hp-high" style={{ width: `${pct}%` }} />
    </div>
  );
}

function XpBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999, transition: "width 0.5s ease" }} />
    </div>
  );
}

function TypeSwapModal({
  trainer, playerTokens, onConfirm, onCancel,
}: {
  trainer: Trainer; playerTokens: number;
  onConfirm: (newType: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(trainer.trainer_type);
  const types = trainer.rarity === "legendary" ? ALL_TYPES_LEGENDARY : ALL_TYPES;
  const cost = 300;
  const canAfford = playerTokens >= cost;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="card animate-slide-up" style={{ maxWidth: 420, width: "100%", border: "1px solid rgba(99,102,241,0.3)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-white">Swap Type</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {trainer.char?.name ?? trainer.label} · Current: <span style={{ color: TYPE_COLOR[trainer.trainer_type] }}>{trainer.trainer_type}</span>
            </p>
          </div>
          <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "4px 10px" }}>
            <span className="font-black text-yellow-400 text-sm">{cost} $PKG</span>
          </div>
        </div>

        {trainer.pokemon_count > 0 && (
          <div className="mb-4 px-3 py-2 rounded-xl text-xs text-orange-400 font-bold"
               style={{ background: "rgba(194,65,12,0.1)", border: "1px solid rgba(194,65,12,0.25)" }}>
            ⚠️ Remove all Pokémon from this trainer before swapping type.
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4 max-h-64 overflow-y-auto">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setSelected(t)}
              disabled={t === trainer.trainer_type}
              className="px-2 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: selected === t ? (TYPE_BG[t] ?? "rgba(99,102,241,0.3)") : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${selected === t ? (TYPE_COLOR[t] ?? "#818cf8") : "rgba(255,255,255,0.08)"}`,
                color: selected === t ? (TYPE_COLOR[t] ?? "#818cf8") : (t === trainer.trainer_type ? "#4b5563" : "#9ca3af"),
                opacity: t === trainer.trainer_type ? 0.5 : 1,
              }}
            >
              {t}
              {t === trainer.trainer_type && <span className="block text-[9px] opacity-50">current</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button className="btn-gray flex-1" onClick={onCancel}>Cancel</button>
          <button
            className="btn-yellow flex-1"
            disabled={selected === trainer.trainer_type || !canAfford || trainer.pokemon_count > 0}
            onClick={() => onConfirm(selected)}
          >
            {!canAfford ? "Not enough tokens" : `Swap → ${selected}`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmState {
  title: string; message: string; detail?: string;
  danger?: boolean; confirmLabel?: string; action: () => void;
}

function TrainerCard({
  t, onActivate, onBuyPokemon, onUnlockLevel, onUnequip, onSwapType,
  buying, unlocking, unequipping, playerTokens,
}: {
  t: Trainer;
  onActivate: (id: number) => void;
  onBuyPokemon: (id: number) => void;
  onUnlockLevel: (id: number) => void;
  onUnequip: (tid: number, pIdx: number) => void;
  onSwapType: (trainer: Trainer) => void;
  buying: boolean; unlocking: boolean; unequipping: boolean;
  playerTokens: number;
}) {
  const borderColor = RARITY_BORDER_COLOR[t.rarity];
  const [g1, g2]   = RARITY_GRADIENT[t.rarity];
  const glow        = RARITY_GLOW[t.rarity];

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
         style={{ background: `linear-gradient(145deg, ${g1}, ${g2})`, border: `2px solid ${borderColor}`, boxShadow: glow }}>

      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-xs font-black tracking-widest" style={{ color: borderColor }}>{RARITY_LABEL[t.rarity]}</span>
        {t.is_active && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: borderColor, color: "#111" }}>ACTIVE</span>
        )}
      </div>

      <div className="flex items-end justify-center" style={{ minHeight: 96, background: "rgba(0,0,0,0.2)" }}>
        {t.char ? (
          <img src={t.char.sprite} alt={t.char.name} className="h-24 w-auto"
               style={{ imageRendering: "pixelated" }}
               onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="text-5xl pb-2">{t.emoji}</div>
        )}
      </div>

      <div className="px-3 pt-2">
        <p className="font-black text-sm text-white leading-tight">{t.char?.name ?? t.label}</p>
        <p className="text-xs text-gray-400">{t.char?.label ?? t.label}{t.char && <span> · {t.char.age}y · {t.char.city}</span>}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <TypeBadge type={t.trainer_type} />
          <span className="text-xs text-gray-500">×{t.multiplier}</span>
        </div>
      </div>

      {t.char?.quote && (
        <p className="mx-3 mt-2 text-xs text-gray-500 italic leading-snug line-clamp-2 border-l-2 pl-2"
           style={{ borderColor: `${borderColor}50` }}>
          "{t.char.quote}"
        </p>
      )}

      <div className="mx-3 mt-2.5 rounded-xl p-2.5"
           style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-black" style={{ color: borderColor }}>LV.{t.level}</span>
          <span className="text-gray-500">
            {t.level < t.max_level_unlocked
              ? `${t.xp_in_level.toLocaleString()} / ${t.xp_to_next.toLocaleString()} XP`
              : `CAP: Lv.${t.max_level_unlocked}`}
          </span>
        </div>
        <XpBar pct={t.level < t.max_level_unlocked ? Math.round((t.xp_in_level / t.xp_to_next) * 100) : 100} color={borderColor} />
        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-600">
          <span>Cap: Lv.{t.max_level_unlocked}</span>
          <span>{t.pokemon_slots} Pokémon slot{t.pokemon_slots !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="px-3 mt-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {t.pokemon.map((p, pIdx) => (
            <div key={p.id} className="relative group" style={{ marginBottom: 4 }}>
              <img src={p.sprite} alt={p.name} className="w-9 h-9" style={{ imageRendering: "pixelated" }} />
              <span style={{
                position: "absolute", bottom: -1, right: -2, fontSize: 7, fontWeight: 900,
                color: "rgba(200,230,255,0.85)", background: "rgba(0,0,0,0.6)", borderRadius: 3, padding: "0 2px",
              }}>{p.level}</span>
              <button
                onClick={e => { e.stopPropagation(); onUnequip(t.id, pIdx); }}
                disabled={unequipping}
                title={`Remove ${p.name}`}
                style={{
                  position: "absolute", top: -4, left: -4, width: 16, height: 16, borderRadius: "50%",
                  background: "#dc2626", border: "1.5px solid #fff", color: "#fff",
                  fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", opacity: 0, transition: "opacity 0.15s", lineHeight: 1, padding: 0,
                }}
                className="group-hover:!opacity-100"
              >×</button>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-1.5 rounded
                              opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {p.name} Lv.{p.level}
              </div>
            </div>
          ))}
          {t.pokemon_count === 0 && (
            <div className="text-xs text-gray-700 italic px-1">No Pokémon — 0% win rate</div>
          )}
          {Array.from({ length: Math.max(0, t.pokemon_slots - t.pokemon_count) }).map((_, i) => (
            <div key={`e-${i}`} className="w-9 h-9 rounded-full border border-dashed border-gray-700/50 flex items-center justify-center">
              <span className="text-gray-700 text-xs">+</span>
            </div>
          ))}
          {t.pokemon_slots < 6 && Array.from({ length: 6 - t.pokemon_slots }).map((_, i) => (
            <div key={`l-${i}`} className="w-9 h-9 rounded-full border border-dashed border-gray-800/40 flex items-center justify-center opacity-30">
              <span className="text-gray-700 text-xs">🔒</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">{t.pokemon_count}/{t.pokemon_slots} Pokémon · <TypeIcon type={t.trainer_type} height={12} /> {t.trainer_type}</p>
      </div>

      <div className="mx-3 mt-2.5 rounded-xl p-2.5"
           style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">Battle cooldown</span>
          <span className={`font-black ${t.can_battle ? "text-green-400" : "text-orange-400"}`}>
            {t.can_battle ? "✓ Ready" : `⏱ ${fmtCooldown(t.minutes_until_battle)}`}
          </span>
        </div>
        <CooldownBar current={t.minutes_until_battle} total={Math.round(t.cooldown_hours * 60)} />
        <p className="text-xs text-gray-600 mt-1">Base: {t.cooldown_hours.toFixed(1)}h · +{t.pokemon_count - 1} Pokémon</p>
      </div>

      <div className="flex justify-between text-xs text-gray-500 px-3 mt-2 mb-2">
        <span>🏆 {t.wins}W · 💀 {t.losses}L</span>
        <span className="text-gray-600">{t.wins + t.losses > 0 ? `${Math.round(t.wins / (t.wins + t.losses) * 100)}% win` : "—"}</span>
      </div>

      <div className="px-3 pb-3 space-y-1.5 mt-2">
        <button
          onClick={() => onActivate(t.id)}
          className="w-full text-xs py-2 rounded-xl font-bold transition-all"
          style={{
            background: t.is_active ? `${borderColor}22` : "rgba(255,255,255,0.05)",
            border: `1px solid ${t.is_active ? borderColor + "80" : "rgba(255,255,255,0.08)"}`,
            color: t.is_active ? borderColor : "#9ca3af",
          }}>
          {t.is_active ? "✓ Active Trainer" : "Set as Active"}
        </button>

        <button
          onClick={() => onSwapType(t)}
          disabled={t.pokemon_count > 0}
          title={t.pokemon_count > 0 ? "Remove all Pokémon first" : "Change type specialization (300 tokens)"}
          className="w-full text-xs py-2 rounded-xl font-bold transition-all disabled:opacity-40"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>
          🔄 Swap Type · 300 $PKG
        </button>

        {t.next_unlock_cap !== null && t.next_unlock_cost !== null && (
          <button
            onClick={() => onUnlockLevel(t.id)}
            disabled={unlocking || playerTokens < t.next_unlock_cost}
            className="w-full text-xs py-2 rounded-xl font-bold transition-all disabled:opacity-50"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc" }}>
            🔓 Unlock Lv.{t.max_level_unlocked + 1}–{t.next_unlock_cap} · {t.next_unlock_cost.toLocaleString()} $PKG
          </button>
        )}

        {t.pokemon_count < t.pokemon_slots && (
          <button
            onClick={() => onBuyPokemon(t.id)}
            disabled={buying}
            className="w-full text-xs py-2 rounded-xl font-bold transition-all disabled:opacity-50"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
            🛒 Buy Pokémon · 400 $PKG
          </button>
        )}
      </div>
    </div>
  );
}

export default function MyTrainers() {
  const { playerName, player, setPlayer } = useGameStore();
  const [trainers, setTrainers]       = useState<Trainer[]>([]);
  const [filter, setFilter]           = useState<string>("all");
  const [loading, setLoading]         = useState(true);
  const [burning, setBurning]         = useState(false);
  const [buying, setBuying]           = useState(false);
  const [unlocking, setUnlocking]     = useState(false);
  const [unequipping, setUnequipping] = useState(false);
  const [swapping, setSwapping]       = useState(false);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm]         = useState<ConfirmState | null>(null);
  const [swapModal, setSwapModal]     = useState<Trainer | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!playerName) return;
    listTrainers(playerName).then(list => { setTrainers(list); setLoading(false); });
  }, [playerName]);

  if (!playerName) return (
    <div className="text-center py-24">
      <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
    </div>
  );

  async function handleActivate(id: number) {
    if (!playerName) return;
    await activateTrainer(playerName, id);
    const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
    setTrainers(list); setPlayer(p);
  }

  function askBurn(rarity: Rarity) {
    const next = BURN_NEXT[rarity];
    setConfirm({
      title: `Burn 3 ${RARITY_LABEL[rarity]} Trainers`,
      message: `Burn 3 ${rarity} trainers (with no Pokémon) to forge 1 ${next} trainer?`,
      detail: `This action cannot be undone. Make sure all 3 have no Pokémon equipped.`,
      danger: true,
      confirmLabel: "Burn them",
      action: () => executeBurn(rarity),
    });
  }

  async function executeBurn(rarity: Rarity) {
    if (!playerName) return;
    setConfirm(null); setBurning(true); setMsg(null);
    try {
      const res = await burnTrainers(playerName, rarity);
      setMsg({ text: `3 ${rarity} burned → ${res.new_trainer.label} created!`, ok: true });
      const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
      setTrainers(list); setPlayer(p);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error", ok: false });
    } finally { setBurning(false); }
  }

  function askUnlockLevel(tid: number, cost: number, nextCap: number) {
    setConfirm({
      title: "Unlock Level Cap",
      message: `Unlock levels up to Lv.${nextCap} for this trainer?`,
      detail: `Cost: ${cost.toLocaleString()} $PKG`,
      confirmLabel: "Unlock",
      action: () => executeUnlockLevel(tid),
    });
  }

  async function executeUnlockLevel(tid: number) {
    if (!playerName) return;
    setConfirm(null); setUnlocking(true); setMsg(null);
    try {
      const res = await unlockLevelTier(playerName, tid);
      setMsg({ text: `Level unlocked! Cap: Lv.${res.max_level_unlocked}`, ok: true });
      const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
      setTrainers(list); setPlayer(p);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error", ok: false });
    } finally { setUnlocking(false); }
  }

  function askUnequip(tid: number, pIdx: number, pokeName: string) {
    setConfirm({
      title: "Return Pokémon to Box",
      message: `Send ${pokeName} back to the Box?`,
      confirmLabel: "Return",
      action: () => executeUnequip(tid, pIdx),
    });
  }

  async function executeUnequip(tid: number, pIdx: number) {
    if (!playerName) return;
    setConfirm(null); setUnequipping(true); setMsg(null);
    try {
      await unequipToBag(playerName, pIdx, tid);
      setMsg({ text: "Pokémon returned to Box!", ok: true });
      const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
      setTrainers(list); setPlayer(p);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error", ok: false });
    } finally { setUnequipping(false); }
  }

  function askBuyPokemon(tid: number, trainerType: string) {
    setConfirm({
      title: "Buy Pokémon",
      message: `Buy a ${trainerType}-type Pokémon for this trainer?`,
      detail: "Cost: 400 $PKG",
      confirmLabel: "Buy",
      action: () => executeBuyPokemon(tid),
    });
  }

  async function executeBuyPokemon(tid: number) {
    if (!playerName) return;
    setConfirm(null); setBuying(true); setMsg(null);
    try {
      const res = await buyPokemon(playerName, tid);
      setMsg({ text: `Pokémon added! (${res.pokemon_count}/6) · Cooldown: ${res.cooldown_hours.toFixed(1)}h`, ok: true });
      const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
      setTrainers(list); setPlayer(p);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error", ok: false });
    } finally { setBuying(false); }
  }

  function handleSwapTypeOpen(trainer: Trainer) {
    setSwapModal(trainer);
  }

  function askSwapType(trainer: Trainer, newType: string) {
    setSwapModal(null);
    setConfirm({
      title: "Swap Type",
      message: `Change ${trainer.char?.name ?? trainer.label}'s type to ${newType}?`,
      detail: "Cost: 300 $PKG",
      confirmLabel: "Swap",
      action: () => executeSwapType(trainer.id, newType),
    });
  }

  async function executeSwapType(tid: number, newType: string) {
    if (!playerName) return;
    setConfirm(null); setSwapping(true); setMsg(null);
    try {
      await swapTrainerType(playerName, tid, newType);
      setMsg({ text: `Type changed to ${newType}!`, ok: true });
      const [list, p] = await Promise.all([listTrainers(playerName), getPlayer(playerName)]);
      setTrainers(list); setPlayer(p);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error", ok: false });
    } finally { setSwapping(false); }
  }

  const countByRarity      = (r: string) => trainers.filter(t => t.rarity === r).length;
  const countEmptyByRarity = (r: string) => trainers.filter(t => t.rarity === r && t.pokemon_count === 0).length;
  const shown = filter === "all" ? trainers : trainers.filter(t => t.rarity === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Confirmation modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          detail={confirm.detail}
          danger={confirm.danger}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Type swap modal */}
      {swapModal && (
        <TypeSwapModal
          trainer={swapModal}
          playerTokens={player?.tokens ?? 0}
          onConfirm={newType => askSwapType(swapModal, newType)}
          onCancel={() => setSwapModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">My Trainers</h1>
          <p className="text-gray-400 text-sm">{trainers.length} trainers · {player?.tokens ?? 0} $PKG</p>
        </div>
        <button className="btn-yellow" onClick={() => nav("/pack")}>+ Open Pack</button>
      </div>

      {/* Burn section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔥</span>
          <div>
            <h2 className="font-black text-white">Burn Trainers</h2>
            <p className="text-xs text-gray-500">3 with no Pokémon of same rarity → 1 higher rarity</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["common", "rare", "epic"] as Rarity[]).map(r => {
            const total   = countByRarity(r);
            const empty   = countEmptyByRarity(r);
            const canBurn = total >= 3 && empty >= 3;
            const notEnoughEmpty = total >= 3 && empty < 3;
            const bc = RARITY_BORDER_COLOR[r];
            return (
              <button key={r} onClick={() => canBurn && askBurn(r)} disabled={!canBurn || burning}
                      className="rounded-xl p-3 text-center transition-all hover:scale-105 disabled:hover:scale-100"
                      style={{
                        background: canBurn ? `${bc}18` : "rgba(255,255,255,0.03)",
                        border: `2px solid ${canBurn ? bc + "60" : "rgba(255,255,255,0.06)"}`,
                        opacity: canBurn ? 1 : 0.55,
                      }}>
                <div className="text-2xl font-black" style={{ color: canBurn ? bc : "#4b5563" }}>
                  {empty}/{3}
                </div>
                <div className="text-xs font-bold mt-0.5" style={{ color: canBurn ? bc : "#6b7280" }}>
                  {RARITY_LABEL[r]}
                </div>
                <div className="text-gray-500 text-xs mt-1">→ {BURN_NEXT[r]}</div>
                {notEnoughEmpty && (
                  <div className="text-orange-500 text-[9px] mt-1">
                    remove Pokémon first
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {msg && (
          <div className={`mt-3 text-sm text-center px-3 py-2 rounded-xl ${
            msg.ok ? "bg-green-500/10 text-green-400 border border-green-500/20"
                   : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {msg.ok ? "✅ " : "❌ "}{msg.text}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...RARITY_ORDER].map(f => {
          const bc = RARITY_BORDER_COLOR[f as Rarity];
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: active ? (f === "all" ? "#fbbf24" : `${bc}22`) : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? (f === "all" ? "#fbbf24" : bc) : "rgba(255,255,255,0.08)"}`,
                      color: active ? (f === "all" ? "#111827" : bc) : "#6b7280",
                    }}>
              {f === "all" ? `All (${trainers.length})` : `${RARITY_LABEL[f as Rarity]} (${countByRarity(f)})`}
            </button>
          );
        })}
      </div>

      {/* Trainer grid */}
      {loading ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4 animate-spin inline-block">🎴</div>
          <p>Loading trainers...</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-400 text-lg">
            {trainers.length === 0 ? "No trainers yet" : "None in this rarity"}
          </p>
          {trainers.length === 0 && (
            <button className="btn-yellow mt-5" onClick={() => nav("/pack")}>Open Pack</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {shown.map(t => (
            <TrainerCard
              key={t.id}
              t={t}
              onActivate={handleActivate}
              onBuyPokemon={(id) => {
                const tr = trainers.find(x => x.id === id);
                if (tr) askBuyPokemon(id, tr.trainer_type);
              }}
              onUnlockLevel={(id) => {
                const tr = trainers.find(x => x.id === id);
                if (tr && tr.next_unlock_cost && tr.next_unlock_cap)
                  askUnlockLevel(id, tr.next_unlock_cost, tr.next_unlock_cap);
              }}
              onUnequip={(tid, pIdx) => {
                const tr = trainers.find(x => x.id === tid);
                const pok = tr?.pokemon[pIdx];
                askUnequip(tid, pIdx, pok?.name ?? "Pokémon");
              }}
              onSwapType={handleSwapTypeOpen}
              buying={buying}
              unlocking={unlocking}
              unequipping={unequipping}
              playerTokens={player?.tokens ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
