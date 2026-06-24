import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { getBag, listTrainers } from "../api";

const GEN1: Record<number, string> = {
  1:"Bulbasaur",2:"Ivysaur",3:"Venusaur",4:"Charmander",5:"Charmeleon",6:"Charizard",
  7:"Squirtle",8:"Wartortle",9:"Blastoise",10:"Caterpie",11:"Metapod",12:"Butterfree",
  13:"Weedle",14:"Kakuna",15:"Beedrill",16:"Pidgey",17:"Pidgeotto",18:"Pidgeot",
  19:"Rattata",20:"Raticate",21:"Spearow",22:"Fearow",23:"Ekans",24:"Arbok",
  25:"Pikachu",26:"Raichu",27:"Sandshrew",28:"Sandslash",29:"Nidoran♀",30:"Nidorina",
  31:"Nidoqueen",32:"Nidoran♂",33:"Nidorino",34:"Nidoking",35:"Clefairy",36:"Clefable",
  37:"Vulpix",38:"Ninetales",39:"Jigglypuff",40:"Wigglytuff",41:"Zubat",42:"Golbat",
  43:"Oddish",44:"Gloom",45:"Vileplume",46:"Paras",47:"Parasect",48:"Venonat",
  49:"Venomoth",50:"Diglett",51:"Dugtrio",52:"Meowth",53:"Persian",54:"Psyduck",
  55:"Golduck",56:"Mankey",57:"Primeape",58:"Growlithe",59:"Arcanine",60:"Poliwag",
  61:"Poliwhirl",62:"Poliwrath",63:"Abra",64:"Kadabra",65:"Alakazam",66:"Machop",
  67:"Machoke",68:"Machamp",69:"Bellsprout",70:"Weepinbell",71:"Victreebel",72:"Tentacool",
  73:"Tentacruel",74:"Geodude",75:"Graveler",76:"Golem",77:"Ponyta",78:"Rapidash",
  79:"Slowpoke",80:"Slowbro",81:"Magnemite",82:"Magneton",83:"Farfetchd",84:"Doduo",
  85:"Dodrio",86:"Seel",87:"Dewgong",88:"Grimer",89:"Muk",90:"Shellder",
  91:"Cloyster",92:"Gastly",93:"Haunter",94:"Gengar",95:"Onix",96:"Drowzee",
  97:"Hypno",98:"Krabby",99:"Kingler",100:"Voltorb",101:"Electrode",102:"Exeggcute",
  103:"Exeggutor",104:"Cubone",105:"Marowak",106:"Hitmonlee",107:"Hitmonchan",108:"Lickitung",
  109:"Koffing",110:"Weezing",111:"Rhyhorn",112:"Rhydon",113:"Chansey",114:"Tangela",
  115:"Kangaskhan",116:"Horsea",117:"Seadra",118:"Goldeen",119:"Seaking",120:"Staryu",
  121:"Starmie",122:"Mr. Mime",123:"Scyther",124:"Jynx",125:"Electabuzz",126:"Magmar",
  127:"Pinsir",128:"Tauros",129:"Magikarp",130:"Gyarados",131:"Lapras",132:"Ditto",
  133:"Eevee",134:"Vaporeon",135:"Jolteon",136:"Flareon",137:"Porygon",138:"Omanyte",
  139:"Omastar",140:"Kabuto",141:"Kabutops",142:"Aerodactyl",143:"Snorlax",
  144:"Articuno",145:"Zapdos",146:"Moltres",147:"Dratini",148:"Dragonair",149:"Dragonite",
  150:"Mewtwo",151:"Mew",
};

const LEGENDARY_IDS = new Set([144, 145, 146, 150, 151]);

function sprite(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export default function Pokedex() {
  const { playerName } = useGameStore();
  const [ownedIds, setOwned] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!playerName) return;
    setLoading(true);
    Promise.all([getBag(playerName), listTrainers(playerName)])
      .then(([bag, trainers]) => {
        const ids = new Set<number>();
        bag.pokemon.forEach(p => ids.add(p.id));
        trainers.forEach(t => t.pokemon.forEach(p => ids.add(p.id)));
        setOwned(ids);
      })
      .finally(() => setLoading(false));
  }, [playerName]);

  if (!playerName) {
    return (
      <div className="text-center py-24">
        <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
      </div>
    );
  }

  const caught = ownedIds.size;
  const pct    = Math.round((caught / 151) * 100);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">📖 Pokédex</h1>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
             style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span className="text-yellow-400 font-black text-lg">{caught}</span>
          <span className="text-gray-500 text-sm">/151 caught</span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Completion</span>
          <span className="font-bold text-yellow-400">{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 9999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, #f59e0b, #ef4444, #a855f7)",
            borderRadius: 9999, transition: "width 0.6s ease",
            boxShadow: "0 0 10px rgba(245,158,11,0.4)",
          }} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 animate-pulse">Loading Pokédex...</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
          gap: 8,
        }}>
          {Array.from({ length: 151 }, (_, i) => i + 1).map(id => {
            const owned = ownedIds.has(id);
            const name  = GEN1[id] ?? `#${id}`;
            const isLeg = LEGENDARY_IDS.has(id);
            const num   = String(id).padStart(3, "0");

            return (
              <div
                key={id}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                title={`#${num} ${name}${owned ? " ✓" : ""}`}
                style={{
                  borderRadius: 12,
                  padding: "8px 4px 5px",
                  background: owned
                    ? isLeg
                      ? "linear-gradient(145deg,rgba(168,85,247,0.18),rgba(245,158,11,0.12),rgba(5,8,20,0.9))"
                      : "linear-gradient(145deg,rgba(245,158,11,0.12),rgba(5,8,20,0.85))"
                    : "rgba(12,12,24,0.7)",
                  border: `1px solid ${
                    owned
                      ? isLeg ? "rgba(168,85,247,0.5)" : "rgba(245,158,11,0.3)"
                      : "rgba(255,255,255,0.04)"
                  }`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  cursor: "default",
                  transition: "all 0.15s",
                  transform: hovered === id && owned ? "scale(1.1) translateY(-2px)" : "scale(1)",
                  boxShadow: hovered === id && owned
                    ? isLeg
                      ? "0 4px 20px rgba(168,85,247,0.4)"
                      : "0 4px 16px rgba(245,158,11,0.3)"
                    : "none",
                }}
              >
                <img
                  src={sprite(id)}
                  alt={name}
                  loading="lazy"
                  style={{
                    width: 52, height: 52,
                    imageRendering: "pixelated",
                    filter: owned
                      ? isLeg ? "drop-shadow(0 0 6px rgba(168,85,247,0.6))" : "none"
                      : "grayscale(1) brightness(0.25)",
                    transition: "filter 0.2s",
                  }}
                />
                <p style={{
                  fontSize: 8, fontWeight: 900,
                  color: owned ? (isLeg ? "#c084fc" : "#fbbf24") : "#1f2937",
                  fontFamily: "'Press Start 2P', monospace",
                  letterSpacing: 0,
                }}>
                  #{num}
                </p>
                {owned && (
                  <p style={{
                    fontSize: 6.5, color: isLeg ? "#d8b4fe" : "#9ca3af",
                    textAlign: "center", maxWidth: "100%",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontFamily: "'Press Start 2P', monospace", lineHeight: 1.3,
                    padding: "0 2px",
                  }}>
                    {name}
                  </p>
                )}
                {!owned && (
                  <p style={{
                    fontSize: 6.5, color: "#1f2937",
                    fontFamily: "'Press Start 2P', monospace",
                  }}>???</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pt-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }} />
          <span>Caught</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.5)" }} />
          <span>Legendary</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(12,12,24,0.7)", border: "1px solid rgba(255,255,255,0.04)" }} />
          <span>Not caught</span>
        </div>
      </div>
    </div>
  );
}
