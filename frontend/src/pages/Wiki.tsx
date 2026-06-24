import { useState } from "react";
import { TypeIcon } from "../components/Icons";

const SECTIONS = [
  { id: "start",    label: "Getting Started", icon: "🚀" },
  { id: "trainers", label: "Trainers",         icon: "👤" },
  { id: "battle",   label: "Battles",          icon: "⚔️" },
  { id: "pokemon",  label: "Pokémon & Team",   icon: "🐾" },
  { id: "gyms",     label: "Gyms & Elite 4",   icon: "🏟️" },
  { id: "packs",    label: "Packs",             icon: "🎴" },
  { id: "pkg",      label: "$PKG Economy",      icon: "💎" },
];

const RARITY = [
  { key: "common",    label: "Common",    emoji: "⬜", color: "#9ca3af", mult: "×1.0", bpd: 2,  pct: "60%" },
  { key: "rare",      label: "Rare",      emoji: "🔵", color: "#60a5fa", mult: "×1.2", bpd: 3,  pct: "25%" },
  { key: "epic",      label: "Epic",      emoji: "🟣", color: "#c084fc", mult: "×1.5", bpd: 4,  pct: "12%" },
  { key: "legendary", label: "Legendary", emoji: "🟡", color: "#fbbf24", mult: "×1.85", bpd: 5, pct: "3%"  },
];

const GYM_GUIDE = [
  { name: "Brock",     type: "Rock",     emoji: "🪨", city: "Pewter",    badge: "Boulder",  good: ["Water","Grass","Fighting","Ground","Steel"], bad: ["Normal","Fire","Poison","Flying"] },
  { name: "Misty",     type: "Water",    emoji: "💧", city: "Cerulean",  badge: "Cascade",  good: ["Electric","Grass"],               bad: ["Water","Ice","Dragon"] },
  { name: "Lt. Surge", type: "Electric", emoji: "⚡", city: "Vermilion", badge: "Thunder",  good: ["Ground"],                         bad: ["Electric","Flying","Steel"] },
  { name: "Erika",     type: "Grass",    emoji: "🌿", city: "Celadon",   badge: "Rainbow",  good: ["Fire","Ice","Flying","Bug","Poison"], bad: ["Water","Grass","Ground","Electric"] },
  { name: "Koga",      type: "Poison",   emoji: "☠️", city: "Fuchsia",   badge: "Soul",     good: ["Ground","Psychic"],               bad: ["Grass","Poison","Ghost","Steel"] },
  { name: "Sabrina",   type: "Psychic",  emoji: "🔮", city: "Saffron",   badge: "Marsh",    good: ["Bug","Ghost","Dark"],             bad: ["Steel"] },
  { name: "Blaine",    type: "Fire",     emoji: "🔥", city: "Cinnabar",  badge: "Volcano",  good: ["Water","Ground","Rock"],          bad: ["Fire","Grass","Ice","Dragon","Steel"] },
  { name: "Giovanni",  type: "Ground",   emoji: "🌍", city: "Viridian",  badge: "Earth",    good: ["Water","Grass","Ice"],            bad: ["Poison","Rock","Steel"] },
];

const ELITE4 = [
  { name: "Lorelei", type: "Ice",     emoji: "🧊", good: ["Fire","Fighting","Rock","Steel"], bad: ["Ice","Water"] },
  { name: "Bruno",   type: "Fighting",emoji: "🥊", good: ["Flying","Psychic","Fairy"],       bad: ["Normal","Ice","Rock","Dark","Steel"] },
  { name: "Agatha",  type: "Ghost",   emoji: "👻", good: ["Ghost","Dark"],                   bad: ["Normal","Fight"] },
  { name: "Lance",   type: "Dragon",  emoji: "🐉", good: ["Ice","Dragon","Fairy"],           bad: ["Fire","Water","Electric"] },
];

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl p-4 mb-3"
         style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${accent ?? "rgba(255,255,255,0.07)"}` }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
      <span>{icon}</span>{title}
    </h2>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="font-bold text-sm" style={{ color: color ?? "#fff" }}>{value}</span>
    </div>
  );
}

// ── Section content ───────────────────────────────────────────────────────────

function SectionStart() {
  const steps = [
    { n: 1, title: "Connect Your Wallet", body: "Your Solana wallet address is your game identity — no account needed. Supports Phantom and Solflare." },
    { n: 2, title: "Get Your First Pack", body: "Open a Combo Pack ($7 USD) to receive 1 Trainer + 1 Pokémon already equipped. Pack prices are fixed in USD — token amount is calculated at the live market rate." },
    { n: 3, title: "Battle NPCs", body: "Head to the Arena and battle NPCs to earn $PKG rewards. Each trainer gets a set number of battles per day." },
    { n: 4, title: "Collect Gym Tickets", body: "Gym Tickets drop randomly from NPC battles. Use them to challenge Gym Leaders and earn badges." },
    { n: 5, title: "Conquer All 8 Gyms", body: "Defeat all 8 Gym Leaders to unlock the Elite Four. Win the Elite Four for a $1,000 USD reward (paid in $PKG at live rate)." },
  ];
  return (
    <div>
      <SectionTitle icon="🚀" title="Getting Started" />
      <p className="text-gray-400 text-sm mb-4">PokeGame is a Pokémon-inspired trading card battle game on Solana. Collect trainers, build your team, and earn $PKG tokens.</p>
      <div className="space-y-3">
        {steps.map(s => (
          <div key={s.n} className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs"
                 style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
              {s.n}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{s.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
      <Card accent="rgba(20,241,149,0.15)">
        <p className="text-xs text-green-400 font-bold mb-1">💡 Pro Tip</p>
        <p className="text-gray-400 text-xs">Battle the easiest NPC (Youngster Joey) repeatedly to accumulate $PKG before upgrading. Use the Combo Pack for the best value when starting out. All rewards and prices are in USD — $PKG token amounts update in real time with the market price.</p>
      </Card>
    </div>
  );
}

function SectionTrainers() {
  return (
    <div>
      <SectionTitle icon="👤" title="Trainers" />
      <p className="text-gray-400 text-sm mb-4">Trainers are the core unit of your roster. Each trainer has a rarity, type specialization, and limited battles per day.</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {RARITY.map(r => (
          <div key={r.key} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${r.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <span>{r.emoji}</span>
              <span className="font-black text-sm" style={{ color: r.color }}>{r.label}</span>
              <span className="text-gray-600 text-xs ml-auto">{r.pct}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Win Mult</span><span style={{ color: r.color }}>{r.mult}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Battles/Day</span><span className="text-white">{r.bpd}</span></div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🔥 Burn System</p>
        <p className="text-gray-400 text-xs">Burn <strong className="text-white">5 trainers of the same rarity</strong> (with no Pokémon equipped) to receive 1 trainer of the next rarity up. Common → Rare → Epic → Legendary.</p>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🌈 Type Specialization</p>
        <p className="text-gray-400 text-xs mb-2">Each trainer has a type (Fire, Water, Psychic…). Only Pokémon of that type can be assigned to them. <strong className="text-yellow-400">Legendary</strong> trainers are Universal — they accept any type.</p>
        <p className="text-gray-400 text-xs">Trainer type also determines <strong className="text-white">Gym win rate</strong> via type matchup. Choose your type carefully before challenging gyms.</p>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">⭐ Leveling</p>
        <p className="text-gray-400 text-xs">Trainers gain XP every battle (win or lose). Leveling up unlocks more Pokémon slots. Spend $PKG to unlock higher level caps (5 → 10 → 15…).</p>
      </Card>
    </div>
  );
}

function SectionBattle() {
  return (
    <div>
      <SectionTitle icon="⚔️" title="Battle System" />
      <p className="text-gray-400 text-sm mb-4">Every battle is decided by win rate probability. Build a stronger team to increase your odds.</p>

      <Card accent="rgba(139,92,246,0.2)">
        <p className="font-bold text-purple-300 text-sm mb-2">📐 Win Rate Formula</p>
        <div className="rounded-lg p-3 text-center" style={{ background: "rgba(0,0,0,0.4)", fontFamily: "monospace" }}>
          <p className="text-white text-xs">Win Rate = Base × Multiplier + Team Power Bonus</p>
          <p className="text-gray-500 text-xs mt-1">Team Power Bonus: up to +25% at power ≥ 120</p>
        </div>
      </Card>

      <p className="text-white font-bold text-sm mb-2">NPC Difficulty</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { name: "Youngster Joey", diff: "Easy",   base: 35, reward: "$0.05", emoji: "👦" },
          { name: "Lass Karen",     diff: "Medium", base: 20, reward: "$0.20", emoji: "👧" },
          { name: "Biker Mondo",    diff: "Hard",   base: 11, reward: "$0.75", emoji: "🏍️" },
          { name: "Elite Trainer",  diff: "Expert", base: 3,  reward: "$2.50", emoji: "🧙" },
        ].map(n => (
          <div key={n.name} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-xl mb-1">{n.emoji}</div>
            <p className="font-bold text-white text-xs">{n.name}</p>
            <p className="text-gray-500 text-xs">{n.diff}</p>
            <p className="text-xs mt-1"><span className="text-gray-400">Base win: </span><span className="text-yellow-400 font-bold">{n.base}%</span></p>
            <p className="text-xs"><span className="text-gray-400">Reward: </span><span className="text-green-400 font-bold">{n.reward} USD</span></p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-3">* Base win rate is for Common trainers (×1.0). Higher rarities multiply this up before caps. Rewards are in USD — $PKG amount updates with market price.</p>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🗺️ Routes</p>
        <p className="text-gray-400 text-xs">Routes multiply drop rates for Pokémon, Gym Tickets, and Evolution Stones. Higher routes require badges but yield much better loot. Route doesn't affect win rate — only drops.</p>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🎒 Drops</p>
        <ul className="text-gray-400 text-xs space-y-1">
          <li>• <span className="text-green-400">Pokémon</span> — added to your Box (hold up to 10 by default)</li>
          <li>• <span className="text-yellow-400">Gym Ticket</span> — required to challenge Gym Leaders</li>
          <li>• <span className="text-purple-400">Evolution Stone</span> — use in Box to evolve eligible Pokémon</li>
          <li>• <span className="text-orange-400">Backpack</span> — bonus $PKG drop ($0.50 – $15.00 USD at live rate)</li>
        </ul>
      </Card>
    </div>
  );
}

function SectionPokemon() {
  return (
    <div>
      <SectionTitle icon="🐾" title="Pokémon & Team Power" />
      <p className="text-gray-400 text-sm mb-4">Pokémon assigned to a trainer increase Team Power, which directly boosts win rate in battles.</p>

      <Card accent="rgba(59,130,246,0.2)">
        <p className="font-bold text-blue-300 text-sm mb-2">⚡ Team Power Formula</p>
        <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.4)", fontFamily: "monospace" }}>
          <p className="text-white text-xs text-center">Power = Σ (HP + ATK + DEF + SPD) × Level ÷ 1000</p>
        </div>
        <p className="text-gray-500 text-xs mt-2">At Team Power ≥ 120 you reach the full +25% win rate bonus. Build a 6-Pokémon team with high-stat, high-level Pokémon to maximize this.</p>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🎰 How to Get Pokémon</p>
        <ul className="text-gray-400 text-xs space-y-1">
          <li>• <span className="text-white">Battle drops</span> — random Pokémon from the route's pool</li>
          <li>• <span className="text-white">Pokémon Pack</span> — $3 USD for 1 Pokémon (Lv. 1)</li>
          <li>• <span className="text-white">Combo Pack</span> — $7 USD, includes trainer + type-matched Pokémon</li>
          <li>• <span className="text-white">Marketplace</span> — buy specific Pokémon (coming soon)</li>
        </ul>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🔬 Evolution Stones</p>
        <p className="text-gray-400 text-xs mb-2">Evolution Stones drop from advanced Routes. Select a Pokémon in your Box and use a stone to evolve it into a stronger form — permanently boosting its stats and Team Power contribution.</p>
        <div className="flex gap-2 flex-wrap">
          {[["🔥","Fire Stone"],["💧","Water Stone"],["⚡","Thunder Stone"],["🌿","Leaf Stone"],["🌙","Moon Stone"]].map(([e,n]) => (
            <span key={n as string} className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {e} {n}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🎒 Box Management</p>
        <p className="text-gray-400 text-xs">Your Box holds Pokémon not currently on any trainer. Default capacity: 10 slots. Expand with $PKG. Equip Pokémon to a compatible trainer, or release them to free up space.</p>
      </Card>
    </div>
  );
}

function SectionGyms() {
  return (
    <div>
      <SectionTitle icon="🏟️" title="Gyms & Elite Four" />
      <p className="text-gray-400 text-sm mb-4">Gym battles are purely based on type matchup. Your win rate depends on how your trainer's type performs against the Gym Leader's type.</p>

      <Card accent="rgba(245,158,11,0.2)">
        <p className="font-bold text-yellow-400 text-sm mb-2">📊 Type Matchup Win Rates</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg p-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <p className="text-green-400 font-black text-lg">90%</p>
            <p className="text-gray-400">Super Effective</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <p className="text-yellow-400 font-black text-lg">50%</p>
            <p className="text-gray-400">Neutral</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <p className="text-red-400 font-black text-lg">10%</p>
            <p className="text-gray-400">Not Effective</p>
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-2">Each attempt costs 1 Gym Ticket. Tickets drop from NPC battles.</p>
      </Card>

      <p className="text-white font-bold text-sm mb-2">Gym Leaders</p>
      <div className="space-y-2 mb-4">
        {GYM_GUIDE.map((g, i) => (
          <div key={g.name} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-600 text-xs font-bold w-4">{i + 1}</span>
              <span className="text-xl">{g.emoji}</span>
              <div className="flex-1">
                <span className="font-black text-white text-sm">{g.name}</span>
                <span className="text-gray-500 text-xs ml-2">{g.city} · {g.badge} Badge</span>
              </div>
              <TypeIcon type={g.type} height={16} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-green-400 font-bold mb-1">✓ Good types (90%)</p>
                <div className="flex flex-wrap gap-1">
                  {g.good.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>{t}</span>)}
                </div>
              </div>
              <div>
                <p className="text-red-400 font-bold mb-1">✗ Bad types (10%)</p>
                <div className="flex flex-wrap gap-1">
                  {g.bad.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>{t}</span>)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card accent="rgba(168,85,247,0.2)">
        <p className="font-black text-purple-300 text-sm mb-2">👑 Elite Four</p>
        <p className="text-gray-400 text-xs mb-3">Unlock after collecting all 8 badges. Win rate = average of type matchups vs all 4 members × 0.8 + 0.1. Winning gives <strong className="text-green-400">$1,000 USD</strong> (paid in $PKG at the live market rate) and resets your badges for another cycle.</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {ELITE4.map(m => (
            <div key={m.name} className="rounded-lg p-2" style={{ background: "rgba(168,85,247,0.08)" }}>
              <div className="text-2xl mb-1">{m.emoji}</div>
              <p className="text-white text-xs font-bold">{m.name}</p>
              <p className="text-gray-500 text-xs">{m.type}</p>
              <p className="text-green-400 text-xs mt-1">{m.good[0]}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SectionPacks() {
  return (
    <div>
      <SectionTitle icon="🎴" title="Pack System" />
      <p className="text-gray-400 text-sm mb-4">Packs are the main way to acquire new Trainers and Pokémon. Each pack gives a random rarity result.</p>

      <div className="space-y-3 mb-4">
        {[
          { name: "Combo Pack", cost: "$7.00", icon: "✨", color: "#fbbf24", desc: "1 Trainer + 1 type-matched Pokémon already equipped. Best value for new players.", badge: "FEATURED" },
          { name: "Trainer Pack", cost: "$3.00", icon: "👤", color: "#60a5fa", desc: "1 Trainer only — no Pokémon. Good when you need more trainers for specific types." },
          { name: "Pokémon Pack", cost: "$3.00", icon: "🐾", color: "#4ade80", desc: "1 Pokémon (Lv. 1) added to your Box. Rarity determines evolution potential." },
        ].map(p => (
          <div key={p.name} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${p.color}30` }}>
            <div className="flex items-center gap-2 mb-1">
              <span>{p.icon}</span>
              <span className="font-black text-white">{p.name}</span>
              {p.badge && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color }}>{p.badge}</span>}
              <span className="ml-auto font-black" style={{ color: p.color }}>{p.cost} USD</span>
            </div>
            <p className="text-gray-500 text-xs">{p.desc}</p>
          </div>
        ))}
      </div>

      <Card>
        <p className="font-bold text-white text-sm mb-2">🎲 Rarity Odds</p>
        <div className="space-y-2">
          {RARITY.map(r => (
            <div key={r.key} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
              <span className="text-sm" style={{ color: r.color }}>{r.label}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full" style={{ width: r.pct, background: r.color, opacity: 0.7 }} />
              </div>
              <span className="text-gray-400 text-xs w-8 text-right">{r.pct}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SectionPkg() {
  return (
    <div>
      <SectionTitle icon="💎" title="$PKG Economy" />
      <p className="text-gray-400 text-sm mb-4">$PKG is the in-game token used for everything: packs, upgrades, and withdrawals to your Solana wallet.</p>

      <Card accent="rgba(251,191,36,0.1)">
        <p className="text-xs text-yellow-400 font-bold mb-2">🔮 Oracle Pricing</p>
        <p className="text-gray-400 text-xs">All rewards and prices are fixed in USD. The actual $PKG token amount is calculated in real time from the live market price — so values stay consistent in dollar terms regardless of token price volatility.</p>
      </Card>

      <p className="text-white font-bold text-sm mb-2 mt-4">Earning $PKG</p>
      <Card>
        <div className="space-y-2">
          {[
            ["NPC Battles",    "$0.05 – $2.50 per win (oracle)", "#4ade80"],
            ["Gym Leaders",    "$50 – $500 per win (oracle)", "#fbbf24"],
            ["Gym 1 (Brock)",  "$50 USD reward", "#fbbf24"],
            ["Gym 8 (Giovanni)","$500 USD reward", "#fbbf24"],
            ["Elite Four",     "$1,000 USD (champion reward)", "#c084fc"],
            ["Backpack Drops", "$0.50 – $15.00 (random drop)", "#fb923c"],
            ["Pokémon Drops",  "$0.20 – $5.00 per Pokémon", "#60a5fa"],
          ].map(([label, value, color]) => (
            <div key={label as string} className="flex justify-between items-center text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-bold" style={{ color: color as string }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-white font-bold text-sm mb-2 mt-4">Spending $PKG</p>
      <Card>
        <div className="space-y-2">
          {[
            ["Combo Pack",       "$7.00 USD"],
            ["Trainer Pack",     "$3.00 USD"],
            ["Pokémon Pack",     "$3.00 USD"],
            ["Box Expansion",    "$1 → $2 → $4 → $8 USD per +5 slots"],
            ["Level Cap Unlock", "$3 → $6 → $12 → $24 USD per tier"],
            ["Burn (Common)",    "$3.00 USD"],
            ["Burn (Rare)",      "$5.00 USD"],
            ["Burn (Epic)",      "$10.00 USD"],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="text-white font-bold">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card accent="rgba(20,241,149,0.15)">
        <p className="font-bold text-green-400 text-sm mb-2">◎ On-Chain Integration</p>
        <p className="text-gray-400 text-xs mb-2">$PKG exists as a real Solana SPL token. Your in-game balance is stored securely in the game database for fast, gas-free gameplay.</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: "rgba(20,241,149,0.05)", border: "1px solid rgba(20,241,149,0.15)" }}>
            <span className="text-green-400">↓</span>
            <span className="text-gray-300"><strong className="text-white">Deposit</strong> — send $PKG from your wallet to top up your in-game balance</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: "rgba(20,241,149,0.05)", border: "1px solid rgba(20,241,149,0.15)" }}>
            <span className="text-green-400">↑</span>
            <span className="text-gray-300"><strong className="text-white">Withdraw</strong> — move earned $PKG from your game balance to your Solana wallet</span>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-2">Deposit/Withdraw available from your Profile page.</p>
      </Card>
    </div>
  );
}

const SECTION_CONTENT: Record<string, React.ReactNode> = {
  start:    <SectionStart />,
  trainers: <SectionTrainers />,
  battle:   <SectionBattle />,
  pokemon:  <SectionPokemon />,
  gyms:     <SectionGyms />,
  packs:    <SectionPacks />,
  pkg:      <SectionPkg />,
};

export default function Wiki() {
  const [active, setActive] = useState("start");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">📖 Wiki</h1>
          <p className="text-gray-500 text-sm">Complete game guide</p>
        </div>
      </div>

      {/* Section tabs — scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: active === s.id ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active === s.id ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: active === s.id ? "#fbbf24" : "#6b7280",
            }}
          >
            <span>{s.icon}</span>
            <span className="whitespace-nowrap">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div key={active} className="animate-fade-in">
        {SECTION_CONTENT[active]}
      </div>

      {/* Navigation footer */}
      <div className="flex justify-between pt-2">
        {(() => {
          const idx = SECTIONS.findIndex(s => s.id === active);
          return (
            <>
              <button
                onClick={() => idx > 0 && setActive(SECTIONS[idx - 1].id)}
                disabled={idx === 0}
                className="text-sm text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
              >
                ← {idx > 0 ? SECTIONS[idx - 1].label : ""}
              </button>
              <button
                onClick={() => idx < SECTIONS.length - 1 && setActive(SECTIONS[idx + 1].id)}
                disabled={idx === SECTIONS.length - 1}
                className="text-sm text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
              >
                {idx < SECTIONS.length - 1 ? SECTIONS[idx + 1].label : ""} →
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}
