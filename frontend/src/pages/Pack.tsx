import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { openPack, openTrainerPack, openPokemonPack, getPlayer } from "../api";
import type { Trainer, PokemonPackResult } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { TypeIcon } from "../components/Icons";

const RARITY_CFG = {
  common:    { label: "COMMON",    pct: "60%", mult: "×1.0",  color: "#9ca3af", bg: "rgba(156,163,175,0.07)", border: "rgba(156,163,175,0.25)", glow: "rgba(156,163,175,0.15)" },
  rare:      { label: "RARE",      pct: "25%", mult: "×1.2",  color: "#60a5fa", bg: "rgba(96,165,250,0.07)",  border: "rgba(96,165,250,0.25)",  glow: "rgba(96,165,250,0.2)" },
  epic:      { label: "EPIC",      pct: "12%", mult: "×1.5",  color: "#c084fc", bg: "rgba(192,132,252,0.07)", border: "rgba(192,132,252,0.25)", glow: "rgba(192,132,252,0.25)" },
  legendary: { label: "LEGENDARY", pct: "3%",  mult: "×1.85", color: "#fbbf24", bg: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.3)",   glow: "rgba(251,191,36,0.35)" },
} as const;

type Rarity = keyof typeof RARITY_CFG;

type PackType = "combo" | "trainer" | "pokemon";
type Phase = "idle" | "opening" | "reveal_trainer" | "reveal_pokemon";

const PACK_COSTS: Record<PackType, number> = { combo: 150, trainer: 80, pokemon: 60 };

const TYPE_ICONS: Record<string, string> = {
  Normal:"⬜",Fire:"🔥",Water:"💧",Grass:"🌿",Electric:"⚡",Ice:"❄️",
  Fighting:"🥊",Poison:"☠️",Ground:"🌍",Flying:"🦅",Psychic:"🔮",Bug:"🐛",
  Rock:"🪨",Ghost:"👻",Dragon:"🐉",Dark:"🌑",Steel:"⚙️",Fairy:"✨",Universal:"🌈",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PackCardVisual({ accent, label, shimmer, icon }: {
  accent: string; label: string; shimmer?: boolean; icon?: string;
}) {
  return (
    <div style={{
      width: 160, height: 220, borderRadius: 16, position: "relative", overflow: "hidden",
      background: `linear-gradient(145deg,#1a1040 0%,#0d1832 40%,#0a1020 100%)`,
      border: `2px solid ${accent}40`,
      boxShadow: `0 0 30px ${accent}20, inset 0 0 40px rgba(0,0,0,0.4)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      {shimmer && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(105deg,transparent 40%,${accent}15 50%,transparent 60%)`,
          animation: "packShimmer 2.5s ease-in-out infinite",
        }} />
      )}
      <div style={{ fontSize: 32 }}>{icon ?? "🎴"}</div>
      <div style={{
        fontSize: 11, fontWeight: 900, color: `${accent}cc`,
        letterSpacing: "0.12em", textAlign: "center", padding: "0 12px",
      }}>{label}</div>
    </div>
  );
}

function TrainerReveal({ trainer, onReset, tokens, onOpen }: {
  trainer: Trainer; onReset: () => void; tokens: number; onOpen: () => void;
}) {
  const r   = trainer.rarity as Rarity;
  const cfg = RARITY_CFG[r] ?? RARITY_CFG.common;
  const nav = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "16px 0" }}>
      <p className="text-xl font-black mb-4" style={{ color: cfg.color }}>✨ Trainer obtained!</p>
      <div style={{
        width: 260, borderRadius: 20,
        background: `linear-gradient(160deg,${cfg.bg.replace("0.07","0.18")} 0%,rgba(5,8,20,1) 100%)`,
        border: `2px solid ${cfg.border}`,
        boxShadow: `0 0 40px ${cfg.glow},0 20px 60px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        animation: "bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ padding: "10px 16px 8px", background: `${cfg.bg.replace("0.07","0.2")}`, borderBottom: `1px solid ${cfg.border}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, letterSpacing: "0.1em" }}>{cfg.label}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{cfg.mult}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 16px 8px", gap: 6 }}>
          {trainer.char ? (
            <img src={trainer.char.sprite} alt={trainer.char.name}
                 style={{ height: 96, imageRendering: "pixelated", filter: `drop-shadow(0 0 16px ${cfg.glow})` }} />
          ) : <div style={{ fontSize: 56 }}>{trainer.emoji}</div>}
          <p style={{ fontWeight: 900, color: "#fff", fontSize: 15 }}>{trainer.char?.name ?? trainer.label}</p>
          {trainer.char && (
            <>
              <p style={{ fontSize: 11, color: cfg.color, opacity: 0.8 }}>{trainer.char.label}</p>
              <p style={{ fontSize: 10, color: "#6b7280" }}>{trainer.char.age}y · {trainer.char.city}</p>
            </>
          )}
          {trainer.trainer_type && (
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "2px 8px", color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <TypeIcon type={trainer.trainer_type} height={14} /> {trainer.trainer_type}
            </span>
          )}
        </div>
        {trainer.char?.quote && (
          <div style={{ margin: "0 14px 10px", padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", borderLeft: `3px solid ${cfg.border}` }}>
            <p style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic", lineHeight: 1.5 }}>"{trainer.char.quote}"</p>
          </div>
        )}
        {trainer.pokemon.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 4, paddingBottom: 10 }}>
            {trainer.pokemon.slice(0, 4).map(p => (
              <img key={p.id} src={p.sprite} alt={p.name} title={`${p.name} Lv.${p.level}`}
                   style={{ width: 40, height: 40, imageRendering: "pixelated" }} />
            ))}
          </div>
        )}
        <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${cfg.border.replace("0.25","0.1")}` }}>
          {trainer.win_rates.map((rate, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{["Easy","Medium","Hard","Expert"][i]}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 4, borderRadius: 9999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(rate * 100)}%`, borderRadius: 9999, background: cfg.color, opacity: 0.8 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", width: 32, textAlign: "right" }}>{Math.round(rate * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button className="btn-yellow" onClick={onOpen} disabled={tokens < 150}>Open Another · 150 $PKG</button>
        <button className="btn-gray" onClick={() => nav("/trainers")}>View collection</button>
      </div>
      <button className="text-gray-500 text-xs mt-3 underline" onClick={onReset}>Back</button>
      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>Balance: {tokens} $PKG</p>
    </div>
  );
}

function PokemonReveal({ result, onReset, tokens }: {
  result: PokemonPackResult; onReset: () => void; tokens: number;
}) {
  const r   = result.rarity as Rarity;
  const cfg = RARITY_CFG[r] ?? RARITY_CFG.common;
  const p   = result.pokemon;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "16px 0" }}>
      <p className="text-xl font-black mb-4" style={{ color: cfg.color }}>🎉 Pokémon obtained!</p>
      <div style={{
        width: 220, borderRadius: 20,
        background: `linear-gradient(160deg,${cfg.bg.replace("0.07","0.18")} 0%,rgba(5,8,20,1) 100%)`,
        border: `2px solid ${cfg.border}`,
        boxShadow: `0 0 40px ${cfg.glow},0 20px 60px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        animation: "bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        display: "flex", flexDirection: "column", alignItems: "center", padding: 24, gap: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, letterSpacing: "0.12em" }}>{cfg.label}</span>
        <img src={p.sprite} alt={p.name}
             style={{ width: 100, height: 100, imageRendering: "pixelated", filter: `drop-shadow(0 0 20px ${cfg.glow})` }} />
        <p style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>{p.name}</p>
        <p style={{ fontSize: 12, color: "#9ca3af" }}>{p.type1} · Lv. 1</p>
        <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>Added to your Box!</p>
      </div>
      <div className="flex gap-3 mt-5">
        <button className="btn-yellow" onClick={onReset} disabled={tokens < 60}>Open Another · 60 $PKG</button>
      </div>
      <button className="text-gray-500 text-xs mt-3 underline" onClick={onReset}>Back</button>
      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>Balance: {tokens} $PKG</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Pack() {
  const { playerName, player, setPlayer } = useGameStore();
  const [phase, setPhase]         = useState<Phase>("idle");
  const [openingType, setOpening] = useState<PackType>("combo");
  const [trainerResult, setTrainer] = useState<Trainer | null>(null);
  const [pokemonResult, setPokemon] = useState<PokemonPackResult | null>(null);
  const [error, setError]         = useState("");
  const [confirm, setConfirm]     = useState<{ type: PackType; cost: number } | null>(null);
  const nav = useNavigate();

  if (!playerName) return (
    <div className="text-center py-20">
      <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
    </div>
  );

  const tokens = player?.tokens ?? 0;

  function askOpen(type: PackType) {
    setConfirm({ type, cost: PACK_COSTS[type] });
  }

  async function handleOpen(type: PackType) {
    if (!playerName) return;
    setError(""); setOpening(type); setPhase("opening");
    try {
      if (type === "combo") {
        const res = await openPack(playerName);
        const updated = await getPlayer(playerName);
        setPlayer(updated);
        setTrainer(res.trainer);
        setTimeout(() => setPhase("reveal_trainer"), 1200);
      } else if (type === "trainer") {
        const res = await openTrainerPack(playerName);
        const updated = await getPlayer(playerName);
        setPlayer(updated);
        setTrainer(res.trainer);
        setTimeout(() => setPhase("reveal_trainer"), 1200);
      } else {
        const res = await openPokemonPack(playerName);
        const updated = await getPlayer(playerName);
        setPlayer(updated);
        setPokemon(res);
        setTimeout(() => setPhase("reveal_pokemon"), 1200);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error"); setPhase("idle");
    }
  }

  function handleReset() { setPhase("idle"); setTrainer(null); setPokemon(null); }

  const PACK_LABELS: Record<PackType, string> = { combo: "Combo Pack", trainer: "Trainer Pack", pokemon: "Pokémon Pack" };

  if (confirm) {
    return (
      <ConfirmModal
        title={`Open ${PACK_LABELS[confirm.type]}?`}
        message={`Spend ${confirm.cost} tokens to open a ${PACK_LABELS[confirm.type]}?`}
        detail={confirm.type === "combo" ? "Includes 1 Trainer + 1 Pokémon of matching type." : undefined}
        confirmLabel={`Open · ${confirm.cost} $PKG`}
        onConfirm={() => { setConfirm(null); handleOpen(confirm.type); }}
        onCancel={() => setConfirm(null)}
      />
    );
  }

  if (phase === "reveal_trainer" && trainerResult) {
    return (
      <div className="animate-fade-in">
        <style>{`@keyframes bounceIn{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.05);opacity:1}100%{transform:scale(1)}}`}</style>
        <TrainerReveal trainer={trainerResult} onReset={handleReset} tokens={tokens} onOpen={() => askOpen("combo")} />
      </div>
    );
  }
  if (phase === "reveal_pokemon" && pokemonResult) {
    return (
      <div className="animate-fade-in">
        <style>{`@keyframes bounceIn{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.05);opacity:1}100%{transform:scale(1)}}`}</style>
        <PokemonReveal result={pokemonResult} onReset={handleReset} tokens={tokens} />
      </div>
    );
  }

  const isOpening = phase === "opening";

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-fade-in">
      <style>{`
        @keyframes packShimmer { 0%{transform:translateX(-100%)}100%{transform:translateX(200%)} }
        @keyframes packFloat { 0%,100%{transform:translateY(0px)}50%{transform:translateY(-10px)} }
        @keyframes packShake { 0%,100%{transform:rotate(0deg)}20%{transform:rotate(-6deg)}40%{transform:rotate(6deg)}60%{transform:rotate(-4deg)}80%{transform:rotate(4deg)} }
      `}</style>

      <h1 className="text-3xl font-black text-yellow-400 self-start w-full">🎴 Open Pack</h1>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* ── Featured: Combo Pack ─────────────────────────────────── */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "linear-gradient(160deg,rgba(251,191,36,0.10) 0%,rgba(5,8,20,1) 100%)",
        border: "2px solid rgba(251,191,36,0.35)",
        borderRadius: 24,
        boxShadow: "0 0 40px rgba(251,191,36,0.15)",
        padding: "20px 20px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", letterSpacing: "0.08em" }}>✨ PACK COMBO</span>
          <span style={{ fontSize: 11, background: "rgba(251,191,36,0.15)", color: "#fbbf24", borderRadius: 8, padding: "2px 8px", fontWeight: 700 }}>FEATURED</span>
        </div>
        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
          Guarantees <strong style={{ color: "#fff" }}>1 Trainer + 1 Pokémon</strong> of the same type.<br/>
          Trainer comes with starter Pokémon already equipped.
        </p>
        <div style={{
          animation: isOpening && openingType === "combo"
            ? "packShake 0.4s ease-in-out 3"
            : "packFloat 4s ease-in-out infinite",
        }}>
          <PackCardVisual accent="#fbbf24" label="TRAINER + POKÉMON" shimmer icon="🎴" />
        </div>
        {/* Rarity odds */}
        <div style={{ width: "100%", display: "flex", gap: 6, justifyContent: "center" }}>
          {(["common","rare","epic","legendary"] as Rarity[]).map(r => (
            <div key={r} style={{ textAlign: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RARITY_CFG[r].color, margin: "0 auto 2px" }} />
              <div style={{ fontSize: 9, color: "#6b7280" }}>{RARITY_CFG[r].pct}</div>
            </div>
          ))}
        </div>
        {isOpening && openingType === "combo" ? (
          <div className="text-center">
            <div className="text-4xl animate-spin inline-block">✨</div>
            <p className="text-gray-400 mt-2 animate-pulse font-bold text-sm">Opening...</p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
            <button
              className="btn-yellow text-lg px-8 py-3 font-black flex-1"
              style={{ borderRadius: 14 }}
              onClick={() => askOpen("combo")}
              disabled={tokens < 150 || isOpening}
            >
              Open Pack
            </button>
            <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" }}>150 $PKG</span>
          </div>
        )}
      </div>

      {/* ── Secondary: Trainer + Pokémon packs ────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 380 }}>

        {/* Trainer Pack */}
        <div style={{
          background: "linear-gradient(160deg,rgba(96,165,250,0.08) 0%,rgba(5,8,20,1) 100%)",
          border: "1.5px solid rgba(96,165,250,0.25)",
          borderRadius: 18,
          padding: "16px 14px 14px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#60a5fa", letterSpacing: "0.06em" }}>👤 TRAINER</span>
          <p style={{ fontSize: 10, color: "#6b7280", textAlign: "center", lineHeight: 1.5 }}>
            Trainer only.<br/>Pokémon <strong style={{ color: "#9ca3af" }}>not</strong> included.
          </p>
          <div style={{ animation: isOpening && openingType === "trainer" ? "packShake 0.4s ease-in-out 3" : "packFloat 4.5s ease-in-out infinite" }}>
            <PackCardVisual accent="#60a5fa" label="TRAINER PACK" shimmer icon="👤" />
          </div>
          {isOpening && openingType === "trainer" ? (
            <div className="text-3xl animate-spin">✨</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <button
                className="btn-gray text-sm px-3 py-2 font-black flex-1"
                style={{ borderRadius: 10 }}
                onClick={() => askOpen("trainer")}
                disabled={tokens < 80 || isOpening}
              >
                Open Pack
              </button>
              <span style={{ color: "#60a5fa", fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}>80 $PKG</span>
            </div>
          )}
        </div>

        {/* Pokémon Pack */}
        <div style={{
          background: "linear-gradient(160deg,rgba(34,197,94,0.08) 0%,rgba(5,8,20,1) 100%)",
          border: "1.5px solid rgba(34,197,94,0.25)",
          borderRadius: 18,
          padding: "16px 14px 14px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#4ade80", letterSpacing: "0.06em" }}>🐾 POKÉMON</span>
          <p style={{ fontSize: 10, color: "#6b7280", textAlign: "center", lineHeight: 1.5 }}>
            1 Pokémon Lv. 1.<br/>Rarity = evolution potential.
          </p>
          <div style={{ animation: isOpening && openingType === "pokemon" ? "packShake 0.4s ease-in-out 3" : "packFloat 3.5s ease-in-out infinite" }}>
            <PackCardVisual accent="#4ade80" label="POKÉMON PACK" shimmer icon="🐾" />
          </div>
          {isOpening && openingType === "pokemon" ? (
            <div className="text-3xl animate-spin">✨</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <button
                className="btn-gray text-sm px-3 py-2 font-black flex-1"
                style={{ borderRadius: 10 }}
                onClick={() => askOpen("pokemon")}
                disabled={tokens < 60 || isOpening}
              >
                Open Pack
              </button>
              <span style={{ color: "#4ade80", fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}>60 $PKG</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14, padding: "12px 16px",
      }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: "#6b7280", letterSpacing: "0.1em", marginBottom: 8 }}>
          WIN RATE MULTIPLIERS
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(RARITY_CFG) as [Rarity, typeof RARITY_CFG[Rarity]][]).map(([key, cfg]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{cfg.mult}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
