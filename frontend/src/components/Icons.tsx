type P = { size?: number; className?: string };

// ── Type icon — uses Pokémon Showdown type sprites ────────────────────────────
const PS_TYPES = "https://play.pokemonshowdown.com/sprites/types";
export function TypeIcon({ type, height = 18 }: { type: string; height?: number }) {
  if (type === "Universal") return <span style={{ fontSize: height * 0.8, lineHeight: 1 }}>🌈</span>;
  return (
    <img
      src={`${PS_TYPES}/${type}.png`}
      alt={type}
      style={{ height, imageRendering: "auto", verticalAlign: "middle", display: "inline-block" }}
    />
  );
}

// ── PVP — two trainers facing off ─────────────────────────────────────────────
export function IconPvp({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="7" cy="7" r="3" fill="currentColor" opacity=".8"/>
      <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="currentColor" opacity=".8"/>
      <circle cx="17" cy="7" r="3" fill="currentColor" opacity=".8"/>
      <path d="M12 17c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="currentColor" opacity=".8"/>
      <path d="M11 10l2-2-2-2M13 10l-2-2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

// ── Achievements — trophy ─────────────────────────────────────────────────────
export function IconAchievements({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 3h10v9a5 5 0 0 1-10 0V3z" fill="currentColor" opacity=".9"/>
      <path d="M7 6H3a2 2 0 0 0 0 4h4M17 6h4a2 2 0 0 0 0 4h-4" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="17" width="6" height="2" rx="1" fill="currentColor"/>
      <rect x="7" y="19" width="10" height="2" rx="1" fill="currentColor"/>
      <path d="M9.5 8l1.5 3L12 8.5l1 2.5 1.5-3" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Início — Pokemon Center house ────────────────────────────────────────────
export function IconHome({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 11.5L12 3l9 8.5V21H16v-6h-4v6H3z" fill="currentColor" opacity=".9"/>
      <circle cx="12" cy="15.5" r="2.2" fill="none" stroke="white" strokeWidth="1.3"/>
      <line x1="12" y1="13.3" x2="12" y2="17.7" stroke="white" strokeWidth="1.3"/>
      <line x1="9.8" y1="15.5" x2="14.2" y2="15.5" stroke="white" strokeWidth="1.3"/>
    </svg>
  );
}

// ── Pack — booster pack with sparkle ────────────────────────────────────────
export function IconPack({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Card stack */}
      <rect x="7" y="5" width="13" height="17" rx="2" fill="currentColor" opacity=".35"/>
      <rect x="4" y="3" width="13" height="17" rx="2" fill="currentColor" opacity=".65"/>
      <rect x="4" y="3" width="13" height="5" rx="2" fill="currentColor"/>
      {/* Pokeball on card */}
      <circle cx="10.5" cy="14" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="7" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="10.5" cy="14" r="1.2" fill="white" stroke="currentColor" strokeWidth="1"/>
      {/* Sparkle */}
      <path d="M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6z" fill="currentColor"/>
    </svg>
  );
}

// ── Treinadores — Red's cap silhouette (FRLG style) ──────────────────────────
export function IconTrainer({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {/* Cap top */}
      <path d="M4.5 12C4.5 7.5 7.8 5 12 5C16.2 5 19.5 7.5 19.5 12H4.5Z"/>
      {/* Cap brim extending left */}
      <rect x="2" y="11" width="10" height="3" rx="1.5"/>
      {/* Emblem circle on cap front */}
      <circle cx="14" cy="9.5" r="2" fill="none" stroke="white" strokeWidth="1.4"/>
      <circle cx="14" cy="9.5" r="0.7" fill="white"/>
      {/* Head */}
      <circle cx="12" cy="17" r="3.2" fill="currentColor"/>
      {/* Collar / body start */}
      <path d="M8.5 21 Q12 19 15.5 21" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Ginásios — Official Pokemon gym logo: pokeball + bold arrow ──────────────
export function IconGym({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" className={className}>
      {/* Pokeball: center (10,10) radius 9 */}
      {/* Outline circle */}
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
      {/* Horizontal belt (left portion only — right is hidden by arrow) */}
      <line x1="1" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2"/>
      {/* Center button outer ring */}
      <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6"/>
      {/* Center button inner dot */}
      <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
      {/* Arrow: upper-right tip → lower-right base, covers bottom-right area */}
      <path d="M17 2 L26 2 L26 26 L9 26 Z" fill="currentColor"/>
      {/* Re-draw center button on top of arrow */}
      <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
    </svg>
  );
}

// ── GymIcon large (colored, for page headers) ─────────────────────────────────
export function GymIconLarge({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Pokeball outline */}
      <circle cx="40" cy="40" r="36" fill="white" stroke="#111" strokeWidth="6"/>
      {/* Red top half */}
      <path d="M4 40 A36 36 0 0 1 76 40 L57 40 A11 11 0 0 0 23 40 Z" fill="#DC1010"/>
      {/* Belt */}
      <line x1="4" y1="40" x2="76" y2="40" stroke="#111" strokeWidth="6"/>
      {/* Center button */}
      <circle cx="40" cy="40" r="12" fill="white" stroke="#111" strokeWidth="5"/>
      <circle cx="40" cy="40" r="5" fill="#111"/>
      {/* Arrow: bold triangle, lower-right */}
      <path d="M68 8 L100 8 L100 100 L32 100 Z" fill="#111"/>
      {/* Arrow inner white */}
      <path d="M71 14 L95 14 L95 95 L38 95 Z" fill="white"/>
      {/* Re-draw center button over arrow */}
      <circle cx="40" cy="40" r="12" fill="white" stroke="#111" strokeWidth="5"/>
      <circle cx="40" cy="40" r="5" fill="#111"/>
    </svg>
  );
}

// ── Tipos — type chart (magnifier over type plate) ───────────────────────────
export function IconTypes({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Bar chart */}
      <rect x="3"  y="14" width="4" height="7" rx="1" fill="currentColor" opacity=".5"/>
      <rect x="10" y="9"  width="4" height="12" rx="1" fill="currentColor" opacity=".75"/>
      <rect x="17" y="5"  width="4" height="16" rx="1" fill="currentColor"/>
      {/* Trend line */}
      <path d="M5 13 L12 8 L19 4" stroke="currentColor" strokeWidth="1.4"
            strokeDasharray="2 1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Batalha — crossed swords / lightning ─────────────────────────────────────
export function IconBattle({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {/* Sword left (diagonal top-left to center) */}
      <path d="M3 3l5.5 5.5-1 1L3 5.5z"/>
      <path d="M8.5 8.5l-1 1 1.5 1.5 1-1z"/>
      <rect x="2" y="7.5" width="3" height="1.2" rx=".6" transform="rotate(-45 2 7.5)"
            fill="currentColor"/>
      {/* Full left sword blade */}
      <path d="M2 2L11 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M5 2H2V5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Full right sword blade */}
      <path d="M22 2L13 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 2H22V5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Pokeball in center */}
      <circle cx="12" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="7" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="14" r="1.8" fill="white" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="12" cy="14" r=".7" fill="currentColor"/>
    </svg>
  );
}

// ── Backpack loot drops (GBA style, 3 rarities) ──────────────────────────────
export function BackpackCommon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      {/* Strap loop */}
      <rect x="12" y="2" width="8" height="4" rx="2" fill="#2d6e2d"/>
      <rect x="13" y="3" width="6" height="2" fill="#3d9e3d"/>
      {/* Bag body */}
      <rect x="5" y="6" width="22" height="20" rx="4" fill="#3d9e3d"/>
      <rect x="5" y="6" width="22" height="7" rx="3" fill="#2d7a2d"/>
      {/* Body highlight */}
      <rect x="7" y="8" width="5" height="3" rx="1" fill="#5aba5a" opacity="0.6"/>
      {/* Front pocket */}
      <rect x="8" y="17" width="16" height="8" rx="2" fill="#2d7a2d"/>
      <rect x="9" y="18" width="14" height="6" rx="1" fill="#236623"/>
      {/* Pocket zipper */}
      <rect x="14" y="17" width="4" height="2" rx="1" fill="#1a4d1a"/>
      <circle cx="16" cy="18" r="1.5" fill="#5aba5a"/>
      {/* Pokeball clasp */}
      <circle cx="16" cy="13" r="3" fill="white" stroke="#1a4d1a" strokeWidth="1"/>
      <line x1="13" y1="13" x2="19" y2="13" stroke="#1a4d1a" strokeWidth="1"/>
      <circle cx="16" cy="13" r="1.2" fill="#1a4d1a"/>
      {/* Side straps */}
      <rect x="5" y="10" width="2" height="8" rx="1" fill="#236623"/>
      <rect x="25" y="10" width="2" height="8" rx="1" fill="#236623"/>
    </svg>
  );
}

export function BackpackEpic({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      {/* Strap loop */}
      <rect x="12" y="2" width="8" height="4" rx="2" fill="#4a2080"/>
      <rect x="13" y="3" width="6" height="2" fill="#7040c0"/>
      {/* Bag body */}
      <rect x="5" y="6" width="22" height="20" rx="4" fill="#7040c0"/>
      <rect x="5" y="6" width="22" height="7" rx="3" fill="#5030a0"/>
      {/* Shine highlights */}
      <rect x="7" y="8" width="5" height="3" rx="1" fill="#a070e0" opacity="0.7"/>
      <rect x="22" y="7" width="2" height="6" rx="1" fill="#c090ff" opacity="0.4"/>
      {/* Front pocket */}
      <rect x="8" y="17" width="16" height="8" rx="2" fill="#5030a0"/>
      <rect x="9" y="18" width="14" height="6" rx="1" fill="#3d2280"/>
      {/* Pocket zipper */}
      <rect x="14" y="17" width="4" height="2" rx="1" fill="#2a1560"/>
      <circle cx="16" cy="18" r="1.5" fill="#c090ff"/>
      {/* Star clasp */}
      <circle cx="16" cy="13" r="3" fill="#c090ff" stroke="#2a1560" strokeWidth="1"/>
      <line x1="13" y1="13" x2="19" y2="13" stroke="#2a1560" strokeWidth="1"/>
      <circle cx="16" cy="13" r="1.2" fill="#2a1560"/>
      {/* Epic sparkles */}
      <rect x="23" y="8"  width="2" height="2" fill="#e0b0ff" opacity="0.9"/>
      <rect x="7"  y="22" width="2" height="2" fill="#e0b0ff" opacity="0.6"/>
      {/* Side straps */}
      <rect x="5" y="10" width="2" height="8" rx="1" fill="#3d2280"/>
      <rect x="25" y="10" width="2" height="8" rx="1" fill="#3d2280"/>
    </svg>
  );
}

export function BackpackLegendary({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      {/* Strap loop */}
      <rect x="12" y="2" width="8" height="4" rx="2" fill="#9a6800"/>
      <rect x="13" y="3" width="6" height="2" fill="#f0a800"/>
      {/* Bag body */}
      <rect x="5" y="6" width="22" height="20" rx="4" fill="#d4900a"/>
      <rect x="5" y="6" width="22" height="7" rx="3" fill="#b87800"/>
      {/* Gold highlights */}
      <rect x="7" y="8" width="6" height="3" rx="1" fill="#ffe060" opacity="0.8"/>
      <rect x="22" y="7" width="3" height="7" rx="1" fill="#ffe060" opacity="0.5"/>
      {/* Front pocket */}
      <rect x="8" y="17" width="16" height="8" rx="2" fill="#b87800"/>
      <rect x="9" y="18" width="14" height="6" rx="1" fill="#9a6200"/>
      {/* Pocket zipper */}
      <rect x="14" y="17" width="4" height="2" rx="1" fill="#7a4c00"/>
      <circle cx="16" cy="18" r="1.5" fill="#ffe060"/>
      {/* Master Ball clasp */}
      <circle cx="16" cy="13" r="3.2" fill="#c060c0" stroke="#7a4c00" strokeWidth="1"/>
      <path d="M12.8 13 A3.2 3.2 0 0 1 19.2 13 L17.5 13 A1.5 1.5 0 0 0 14.5 13 Z" fill="#e090e0"/>
      <line x1="12.8" y1="13" x2="19.2" y2="13" stroke="#7a4c00" strokeWidth="0.8"/>
      <circle cx="16" cy="13" r="1.3" fill="white" stroke="#7a4c00" strokeWidth="0.6"/>
      <circle cx="16" cy="13" r="0.5" fill="#7a4c00"/>
      {/* Legendary sparkles */}
      <rect x="24" y="7"  width="2" height="2" fill="#ffe060"/>
      <rect x="25" y="9"  width="1" height="1" fill="#ffe060" opacity="0.7"/>
      <rect x="6"  y="23" width="2" height="2" fill="#ffe060"/>
      <rect x="5"  y="21" width="1" height="1" fill="#ffe060" opacity="0.7"/>
      <rect x="24" y="22" width="2" height="2" fill="#ffe060" opacity="0.8"/>
      {/* Side straps */}
      <rect x="5" y="10" width="2" height="8" rx="1" fill="#9a6200"/>
      <rect x="25" y="10" width="2" height="8" rx="1" fill="#9a6200"/>
    </svg>
  );
}

// ── Pokédex — classic red device ─────────────────────────────────────────────
export function IconPokedex({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Device body */}
      <rect x="3" y="2" width="18" height="20" rx="3" fill="currentColor" opacity=".9"/>
      {/* Top half (red) */}
      <rect x="3" y="2" width="18" height="10" rx="3" fill="currentColor"/>
      {/* Screen */}
      <rect x="11" y="4" width="8" height="6" rx="1.5" fill="none" stroke="white" strokeWidth="1.2" opacity=".6"/>
      {/* Pokeball button on top */}
      <circle cx="7" cy="7" r="2.5" fill="none" stroke="white" strokeWidth="1.4"/>
      <line x1="4.5" y1="7" x2="9.5" y2="7" stroke="white" strokeWidth="1.2"/>
      <circle cx="7" cy="7" r="1" fill="white"/>
      {/* Divider line */}
      <line x1="3" y1="12" x2="21" y2="12" stroke="white" strokeWidth="1.5" opacity=".5"/>
      {/* Bottom data dots */}
      <circle cx="7"  cy="16" r="1.5" fill="white" opacity=".5"/>
      <rect x="11" y="14.5" width="7" height="1.5" rx=".75" fill="white" opacity=".35"/>
      <rect x="11" y="17"   width="5" height="1.5" rx=".75" fill="white" opacity=".25"/>
    </svg>
  );
}

// ── Box — Pokemon bag (image 2 style: rounded backpack) ──────────────────────
export function IconBox({ size = 20, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Bag body */}
      <rect x="3" y="9" width="18" height="13" rx="3" fill="currentColor" opacity=".9"/>
      {/* Bag top handle loop */}
      <path d="M8 9V7a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" fill="none"/>
      {/* Front pocket */}
      <rect x="6" y="13" width="12" height="6" rx="2" fill="none" stroke="white" strokeWidth="1.3"/>
      {/* Pocket zipper pull */}
      <circle cx="12" cy="16" r="1.5" fill="white"/>
      <line x1="12" y1="13" x2="12" y2="14.5" stroke="white" strokeWidth="1"/>
      {/* Side belt straps */}
      <line x1="3" y1="13" x2="3" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="21" y1="13" x2="21" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
