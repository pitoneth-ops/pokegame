import { useState } from "react";

const SPRITE_URL = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

const TYPE_DATA: Record<string, {
  emoji: string; color: string; bg: string; border: string; pokemon: number[];
}> = {
  Normal:   { emoji: "⬜", color: "#A8A878", bg: "rgba(168,168,120,0.13)", border: "rgba(168,168,120,0.35)", pokemon: [143, 40,  52] },
  Fire:     { emoji: "🔥", color: "#F08030", bg: "rgba(240,128,48,0.13)",  border: "rgba(240,128,48,0.40)",  pokemon: [6,   59,  38] },
  Water:    { emoji: "💧", color: "#6890F0", bg: "rgba(104,144,240,0.13)", border: "rgba(104,144,240,0.40)", pokemon: [9,   130, 54] },
  Grass:    { emoji: "🌿", color: "#78C850", bg: "rgba(120,200,80,0.13)",  border: "rgba(120,200,80,0.40)",  pokemon: [3,   45,  103] },
  Electric: { emoji: "⚡", color: "#F8D030", bg: "rgba(248,208,48,0.13)",  border: "rgba(248,208,48,0.40)",  pokemon: [26,  100, 125] },
  Ice:      { emoji: "❄️", color: "#98D8D8", bg: "rgba(152,216,216,0.13)", border: "rgba(152,216,216,0.40)", pokemon: [131, 124, 91] },
  Fighting: { emoji: "🥊", color: "#C03028", bg: "rgba(192,48,40,0.13)",   border: "rgba(192,48,40,0.40)",   pokemon: [68,  106, 107] },
  Poison:   { emoji: "☠️", color: "#A040A0", bg: "rgba(160,64,160,0.13)",  border: "rgba(160,64,160,0.40)",  pokemon: [94,  34,  110] },
  Ground:   { emoji: "🌍", color: "#E0C068", bg: "rgba(224,192,104,0.13)", border: "rgba(224,192,104,0.40)", pokemon: [51,  112, 28] },
  Flying:   { emoji: "🦅", color: "#A890F0", bg: "rgba(168,144,240,0.13)", border: "rgba(168,144,240,0.40)", pokemon: [18,  142, 12] },
  Psychic:  { emoji: "🔮", color: "#F85888", bg: "rgba(248,88,136,0.13)",  border: "rgba(248,88,136,0.40)",  pokemon: [150, 65,  122] },
  Bug:      { emoji: "🐛", color: "#A8B820", bg: "rgba(168,184,32,0.13)",  border: "rgba(168,184,32,0.40)",  pokemon: [123, 127, 15] },
  Rock:     { emoji: "🪨", color: "#B8A038", bg: "rgba(184,160,56,0.13)",  border: "rgba(184,160,56,0.40)",  pokemon: [76,  95,  141] },
  Ghost:    { emoji: "👻", color: "#705898", bg: "rgba(112,88,152,0.13)",  border: "rgba(112,88,152,0.40)",  pokemon: [94,  93,  92] },
  Dragon:   { emoji: "🐉", color: "#7038F8", bg: "rgba(112,56,248,0.13)",  border: "rgba(112,56,248,0.40)",  pokemon: [149, 148, 147] },
  Dark:     { emoji: "🌑", color: "#9B8B70", bg: "rgba(112,88,72,0.13)",   border: "rgba(112,88,72,0.40)",   pokemon: [197, 198, 215] },
  Steel:    { emoji: "⚙️", color: "#B8B8D0", bg: "rgba(184,184,208,0.13)", border: "rgba(184,184,208,0.40)", pokemon: [208, 212, 205] },
  Fairy:    { emoji: "✨", color: "#EE99AC", bg: "rgba(238,153,172,0.13)", border: "rgba(238,153,172,0.40)", pokemon: [36,  40,  35] },
};

const SUPER_EFF: Record<string, string[]> = {
  Normal: [],
  Fire:     ["Grass","Ice","Bug","Steel"],
  Water:    ["Fire","Ground","Rock"],
  Grass:    ["Water","Ground","Rock"],
  Electric: ["Water","Flying"],
  Ice:      ["Grass","Ground","Flying","Dragon"],
  Fighting: ["Normal","Ice","Rock","Dark","Steel"],
  Poison:   ["Grass","Fairy"],
  Ground:   ["Fire","Electric","Poison","Rock","Steel"],
  Flying:   ["Grass","Fighting","Bug"],
  Psychic:  ["Fighting","Poison"],
  Bug:      ["Grass","Psychic","Dark"],
  Rock:     ["Fire","Ice","Flying","Bug"],
  Ghost:    ["Psychic","Ghost"],
  Dragon:   ["Dragon"],
  Dark:     ["Psychic","Ghost"],
  Steel:    ["Ice","Rock","Fairy"],
  Fairy:    ["Fighting","Dragon","Dark"],
};

const NOT_EFF: Record<string, string[]> = {
  Normal:   ["Rock","Steel","Ghost"],
  Fire:     ["Water","Fire","Rock","Dragon"],
  Water:    ["Water","Grass","Dragon"],
  Grass:    ["Fire","Grass","Poison","Flying","Bug","Dragon","Steel"],
  Electric: ["Grass","Electric","Dragon","Ground"],
  Ice:      ["Water","Ice","Steel"],
  Fighting: ["Poison","Flying","Psychic","Bug","Fairy"],
  Poison:   ["Poison","Ground","Rock","Ghost"],
  Ground:   ["Grass","Bug"],
  Flying:   ["Electric","Rock","Steel"],
  Psychic:  ["Steel","Dark"],
  Bug:      ["Fire","Fighting","Flying","Ghost","Steel","Fairy"],
  Rock:     ["Fighting","Ground","Steel"],
  Ghost:    ["Dark"],
  Dragon:   ["Steel"],
  Dark:     ["Fighting","Dark","Fairy"],
  Steel:    ["Fire","Water","Electric","Steel"],
  Fairy:    ["Fire","Poison","Steel"],
};

function getWeaknesses(type: string): string[] {
  return Object.entries(SUPER_EFF)
    .filter(([, targets]) => targets.includes(type))
    .map(([attacker]) => attacker);
}

function getResistances(type: string): string[] {
  return Object.entries(NOT_EFF)
    .filter(([, targets]) => targets.includes(type))
    .map(([attacker]) => attacker);
}

function TypePill({ name, size = "sm" }: { name: string; size?: "xs" | "sm" }) {
  const t = TYPE_DATA[name];
  if (!t) return null;
  return (
    <span style={{
      background: t.bg, border: `1px solid ${t.border}`, color: t.color,
      padding: size === "xs" ? "1px 5px" : "2px 8px",
      borderRadius: 9999, fontSize: size === "xs" ? 10 : 11,
      fontWeight: 700, whiteSpace: "nowrap" as const,
      display: "inline-flex", alignItems: "center", gap: 2, letterSpacing: "0.01em",
    }}>
      {t.emoji} {name}
    </span>
  );
}

function EffRow({ label, labelColor, types }: { label: string; labelColor: string; types: string[] }) {
  if (types.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: labelColor, fontWeight: 700, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, alignItems: "flex-end" }}>
        {types.map(n => (
          <div key={n} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
            <img src={SPRITE_URL(TYPE_DATA[n]?.pokemon[0] ?? 1)} alt={n}
                 style={{ width: 36, height: 36, imageRendering: "pixelated" as const,
                          filter: `drop-shadow(0 2px 4px ${TYPE_DATA[n]?.bg ?? "transparent"})` }} />
            <TypePill name={n} size="xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeCard({ type, expanded, onClick }: { type: string; expanded: boolean; onClick: () => void }) {
  const t = TYPE_DATA[type];
  const superEff = SUPER_EFF[type] ?? [];
  const notEff   = NOT_EFF[type]   ?? [];
  const weakTo   = getWeaknesses(type);
  const resistTo = getResistances(type);

  return (
    <div
      onClick={onClick}
      style={{
        background: expanded
          ? "linear-gradient(160deg, #0f0f22 0%, #0c0c18 100%)"
          : "linear-gradient(145deg, #0e0e1c, #0c0c18)",
        border: `1.5px solid ${expanded ? t.border : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        transition: "all 0.25s ease",
        boxShadow: expanded
          ? `0 0 28px ${t.bg}, 0 8px 32px rgba(0,0,0,0.6)`
          : "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* Type header */}
      <div style={{
        background: `linear-gradient(135deg, ${t.bg} 0%, transparent 100%)`,
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${expanded ? t.border : "rgba(255,255,255,0.05)"}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{t.emoji}</span>
        <span style={{ color: t.color, fontWeight: 900, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
          {type}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Sprite */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: expanded ? "14px 8px 6px" : "10px 8px 4px", gap: 4,
        background: expanded ? `radial-gradient(ellipse at center, ${t.bg} 0%, transparent 70%)` : undefined,
        minHeight: expanded ? 90 : 70,
      }}>
        {(expanded ? t.pokemon : [t.pokemon[0]]).map(id => (
          <img key={id} src={SPRITE_URL(id)} alt=""
               style={{ width: expanded ? 68 : 72, height: expanded ? 68 : 72,
                        imageRendering: "pixelated" as const,
                        filter: `drop-shadow(0 4px 10px ${t.bg})`, transition: "all 0.25s" }} />
        ))}
      </div>

      {/* Collapsed: brief matchup */}
      {!expanded && (
        <div style={{ padding: "4px 12px 12px" }}>
          {superEff.length > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                💪 Strong against
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 3 }}>
                {superEff.slice(0, 4).map(n => <TypePill key={n} name={n} size="xs" />)}
                {superEff.length > 4 && <span style={{ fontSize: 10, color: "#6b7280" }}>+{superEff.length - 4}</span>}
              </div>
            </div>
          )}
          {notEff.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: "#f87171", fontWeight: 700, marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                😰 Weak when attacking
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 3 }}>
                {notEff.slice(0, 3).map(n => <TypePill key={n} name={n} size="xs" />)}
                {notEff.length > 3 && <span style={{ fontSize: 10, color: "#6b7280" }}>+{notEff.length - 3}</span>}
              </div>
            </div>
          )}
          {superEff.length === 0 && notEff.length === 0 && (
            <p style={{ fontSize: 10, color: "#6b7280", textAlign: "center" as const, paddingTop: 4 }}>Neutral damage against all</p>
          )}
        </div>
      )}

      {/* Expanded: full matchup */}
      {expanded && (
        <div style={{ padding: "6px 14px 14px" }}>
          <EffRow label="💪 Attacks strong (90% win chance)" labelColor="#4ade80" types={superEff} />
          <EffRow label="😰 Attacks weak (10% win chance)"  labelColor="#f87171" types={notEff} />
          {(weakTo.length > 0 || resistTo.length > 0) && (
            <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
              <EffRow label="⚠️ Vulnerable to (takes 90%)" labelColor="#fbbf24" types={weakTo} />
              <EffRow label="🛡 Resists (takes 10%)"       labelColor="#94a3b8" types={resistTo} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Types() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const types = Object.keys(TYPE_DATA);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="card text-center" style={{ background: "linear-gradient(135deg, #0f0f2e, #0c0c1a)", padding: "20px 24px" }}>
        <h1 className="text-3xl font-black text-white mb-2">📊 Type Chart</h1>
        <p className="text-gray-400 text-sm">Tap any type to see full matchup details</p>
      </div>

      {/* Quick-filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setExpanded(expanded === t ? null : t)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                     transform: expanded === t ? "scale(1.1)" : "scale(1)", transition: "transform 0.15s" }}
          >
            <TypePill name={t} />
          </button>
        ))}
        {expanded && (
          <button
            onClick={() => setExpanded(null)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                     borderRadius: 9999, padding: "2px 10px", fontSize: 11, color: "#6b7280",
                     cursor: "pointer", fontWeight: 700 }}
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Types grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {types.map(t => (
          <TypeCard key={t} type={t} expanded={expanded === t} onClick={() => setExpanded(expanded === t ? null : t)} />
        ))}
      </div>

      {/* Legend */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <p className="text-xs text-gray-500 font-black mb-2 tracking-wider">BATTLE SYSTEM LEGEND</p>
        <div className="space-y-1" style={{ fontSize: 11 }}>
          <p style={{ color: "#6b7280" }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>💪 Strong against (90%)</span>
            {" "}— attacks with a 90% win chance in battle
          </p>
          <p style={{ color: "#6b7280" }}>
            <span style={{ color: "#f87171", fontWeight: 700 }}>😰 Weak when attacking (10%)</span>
            {" "}— attacks with only a 10% win chance
          </p>
          <p style={{ color: "#6b7280" }}>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>⚠️ Vulnerable to</span>
            {" "}— these types have a 90% win chance against you
          </p>
          <p style={{ color: "#6b7280" }}>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>🛡 Resists</span>
            {" "}— these types have only 10% against you
          </p>
        </div>
      </div>
    </div>
  );
}
