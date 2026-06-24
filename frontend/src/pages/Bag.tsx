import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { getBag, equipFromBag, releaseFromBag, expandBag, listTrainers, getItems, useStone } from "../api";
import type { BagPokemon, Trainer } from "../api";

const STONE_DATA: Record<string, { icon: string; color: string }> = {
  "Fire Stone":    { icon: "🔥", color: "#ef4444" },
  "Water Stone":   { icon: "💧", color: "#3b82f6" },
  "Thunder Stone": { icon: "⚡", color: "#eab308" },
  "Leaf Stone":    { icon: "🌿", color: "#22c55e" },
  "Moon Stone":    { icon: "🌙", color: "#a855f7" },
};

const TYPE_COLORS: Record<string, string> = {
  Normal:"#A8A878",Fire:"#F08030",Water:"#6890F0",Grass:"#78C850",
  Electric:"#F8D030",Ice:"#98D8D8",Fighting:"#C03028",Poison:"#A040A0",
  Ground:"#E0C068",Flying:"#A890F0",Psychic:"#F85888",Bug:"#A8B820",
  Rock:"#B8A038",Ghost:"#705898",Dragon:"#7038F8",Dark:"#9B8B70",
  Steel:"#B8B8D0",Fairy:"#EE99AC",
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#888";
  return (
    <span style={{
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      padding: "1px 6px",
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 700,
    }}>{type}</span>
  );
}

export default function Bag() {
  const { playerName, player, setPlayer } = useGameStore();
  const [bag, setBag]           = useState<BagPokemon[]>([]);
  const [capacity, setCapacity] = useState(10);
  const [expandCost, setExpandCost] = useState<number | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);   // bag index
  const [pickTrainer, setPickTrainer] = useState(false);
  const [pickStone, setPickStone]   = useState(false);
  const [items, setItems]           = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const nav = useNavigate();

  async function refresh() {
    if (!playerName) return;
    const [b, ts, it] = await Promise.all([getBag(playerName), listTrainers(playerName), getItems(playerName)]);
    setBag(b.pokemon);
    setCapacity(b.capacity);
    setExpandCost(b.expand_cost ?? null);
    setTrainers(ts);
    setItems(it);
  }

  useEffect(() => { if (playerName) refresh(); }, [playerName]);

  if (!playerName) return (
    <div className="text-center py-24">
      <button className="btn-yellow" onClick={() => nav("/")}>Connect Wallet</button>
    </div>
  );

  async function handleEquip(trainerIndex: number) {
    if (selected === null || !playerName) return;
    const tid = trainers[trainerIndex].id;
    setLoading(true);
    try {
      await equipFromBag(playerName, selected, tid);
      setMsg({ text: "Pokémon equipped!", ok: true });
      setSelected(null);
      setPickTrainer(false);
      await refresh();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Error equipping", ok: false });
    } finally { setLoading(false); }
  }

  async function handleRelease(idx: number) {
    if (!playerName) return;
    setLoading(true);
    try {
      await releaseFromBag(playerName, idx);
      setMsg({ text: "Pokémon released.", ok: true });
      setSelected(null);
      await refresh();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Erro", ok: false });
    } finally { setLoading(false); }
  }

  async function handleExpand() {
    if (!playerName) return;
    setLoading(true);
    try {
      const r = await expandBag(playerName);
      setCapacity(r.bag_capacity);
      setMsg({ text: `Box expanded to ${r.bag_capacity} slots!`, ok: true });
      await refresh();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Erro", ok: false });
    } finally { setLoading(false); }
  }

  async function handleUseStone(stoneName: string) {
    if (selected === null || !playerName) return;
    setLoading(true);
    try {
      const r = await useStone(playerName, selected, stoneName);
      setMsg({ text: `${r.old_name} evoluiu para ${r.new_name}! ✨`, ok: true });
      setItems(r.items);
      setBag(r.bag);
      setSelected(null);
      setPickStone(false);
      setPickTrainer(false);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail ?? "Não é possível evoluir", ok: false });
    } finally { setLoading(false); }
  }

  // Build grid: rows of 5
  const COLS = 5;
  const rows = Math.ceil(capacity / COLS);
  const slots = Array.from({ length: rows * COLS });

  const sel = selected !== null ? bag[selected] : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📦 Pokémon Box</h1>
          <p className="text-gray-500 text-sm mt-1">{bag.length}/{capacity} slots · battle drops</p>
        </div>
        {expandCost && (
          <button
            className="btn-yellow text-xs px-4"
            onClick={handleExpand}
            disabled={loading || (player?.tokens ?? 0) < expandCost}
          >
            +5 slots · {expandCost.toLocaleString()} $PKG
          </button>
        )}
      </div>

      {/* Notification */}
      {msg && (
        <div className="rounded-xl px-4 py-2.5 text-sm font-bold animate-slide-up"
             style={{
               background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
               border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
               color: msg.ok ? "#4ade80" : "#f87171",
             }}>
          {msg.text}
        </div>
      )}

      {/* Stones inventory */}
      {Object.keys(items).filter(k => items[k] > 0).length > 0 && (
        <div className="card" style={{ border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.04)" }}>
          <p className="text-xs text-purple-400 font-black mb-3 tracking-wider">🪨 PEDRAS DE EVOLUÇÃO</p>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(items).filter(([, count]) => count > 0).map(([name, count]) => {
              const sd = STONE_DATA[name];
              return (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: `${sd?.color ?? "#888"}15`,
                  border: `1px solid ${sd?.color ?? "#888"}40`,
                  borderRadius: 12, padding: "8px 14px",
                }}>
                  <span style={{ fontSize: 22 }}>{sd?.icon ?? "💎"}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: sd?.color ?? "#888" }}>{name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{count}× available</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">Select a Pokémon in the Box to use a stone</p>
        </div>
      )}

      {/* GBA Box */}
      <div style={{
        background: "linear-gradient(160deg, #0d1832 0%, #0a1220 50%, #0d1832 100%)",
        border: "2px solid rgba(100,160,255,0.25)",
        borderRadius: 16,
        padding: "0 0 8px",
        boxShadow: "0 0 40px rgba(60,100,200,0.15), inset 0 0 60px rgba(0,0,30,0.5)",
        overflow: "hidden",
      }}>
        {/* Box title bar — GBA style */}
        <div style={{
          background: "linear-gradient(90deg, #1a3a6e, #2a4a9e, #1a3a6e)",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "2px solid rgba(100,160,255,0.3)",
        }}>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: "0.1em" }}>
            ◀ BOX 1 ▶
          </span>
          <span style={{ color: "rgba(180,210,255,0.7)", fontSize: 11 }}>
            {bag.length}/{capacity}
          </span>
        </div>

        {/* Grid */}
        <div style={{ padding: "12px 10px 4px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 6,
          }}>
            {slots.map((_, i) => {
              const poke = bag[i];
              const isSel = selected === i;
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (poke) {
                      setSelected(isSel ? null : i);
                      setPickTrainer(false);
                      setPickStone(false);
                      setMsg(null);
                    }
                  }}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: poke ? "pointer" : "default",
                    background: isSel
                      ? "rgba(100,180,255,0.25)"
                      : poke
                        ? "rgba(20,40,80,0.6)"
                        : "rgba(10,20,40,0.4)",
                    border: isSel
                      ? "2px solid rgba(100,200,255,0.9)"
                      : poke
                        ? "1px solid rgba(80,140,220,0.3)"
                        : "1px dashed rgba(60,100,160,0.25)",
                    boxShadow: isSel
                      ? "0 0 14px rgba(100,200,255,0.5), inset 0 0 8px rgba(100,200,255,0.1)"
                      : undefined,
                    transition: "all 0.15s",
                    padding: 4,
                    position: "relative",
                  }}
                >
                  {poke ? (
                    <>
                      <img
                        src={poke.sprite}
                        alt={poke.name}
                        style={{ width: "72%", height: "72%", imageRendering: "pixelated",
                                 filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
                      />
                      <span style={{
                        position: "absolute",
                        bottom: 2,
                        right: 3,
                        fontSize: 8,
                        fontWeight: 900,
                        color: "rgba(200,230,255,0.85)",
                        letterSpacing: "0.02em",
                      }}>
                        Lv.{poke.level}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 16, opacity: 0.15 }}>○</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Pokémon detail panel */}
      {sel && (
        <div className="card animate-slide-up" style={{
          background: "linear-gradient(145deg, #0e1630, #0a1020)",
          border: "1px solid rgba(100,160,255,0.3)",
        }}>
          <div className="flex items-center gap-4">
            <div style={{
              background: "rgba(20,40,80,0.6)",
              border: "1px solid rgba(100,160,220,0.3)",
              borderRadius: 12,
              padding: 8,
            }}>
              <img src={sel.sprite} alt={sel.name}
                   style={{ width: 64, height: 64, imageRendering: "pixelated",
                            filter: "drop-shadow(0 2px 8px rgba(100,160,255,0.4))" }} />
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-lg">{sel.name}</p>
              <div className="flex gap-2 mt-1">
                <TypeBadge type={sel.type1} />
                <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700 }}>Lv.{sel.level}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                className="btn-yellow text-sm px-4"
                onClick={() => { setPickTrainer(true); setPickStone(false); setMsg(null); }}
                disabled={loading}
              >
                ⚔️ Equip
              </button>
              {Object.keys(items).filter(k => items[k] > 0).length > 0 && (
                <button
                  className="text-sm px-4 rounded-xl font-black transition-all"
                  style={{
                    background: "rgba(168,85,247,0.15)",
                    border: "1px solid rgba(168,85,247,0.4)",
                    color: "#c084fc",
                    padding: "8px 14px",
                  }}
                  onClick={() => { setPickStone(true); setPickTrainer(false); setMsg(null); }}
                  disabled={loading}
                >
                  🪨 Evolve
                </button>
              )}
              <button
                className="btn-red text-sm px-3"
                onClick={() => handleRelease(selected!)}
                disabled={loading}
              >
                🗑
              </button>
            </div>
          </div>

          {/* Stone picker */}
          {pickStone && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(168,85,247,0.2)" }}>
              <p className="text-xs text-purple-400 font-black mb-3 tracking-wider">CHOOSE A STONE</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(items).filter(([, cnt]) => cnt > 0).map(([name, count]) => {
                  const sd = STONE_DATA[name];
                  return (
                    <button
                      key={name}
                      onClick={() => handleUseStone(name)}
                      disabled={loading}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{
                        background: `${sd?.color ?? "#888"}15`,
                        border: `1px solid ${sd?.color ?? "#888"}40`,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{sd?.icon ?? "💎"}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: sd?.color ?? "#888" }}>{name}</div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{count}× available</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setPickStone(false)} className="btn-gray w-full mt-3 text-sm">
                Cancel
              </button>
            </div>
          )}

          {/* Trainer picker */}
          {pickTrainer && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(100,160,255,0.15)" }}>
              <p className="text-xs text-gray-400 font-black mb-3 tracking-wider">CHOOSE A TRAINER</p>
              <div className="space-y-2">
                {trainers.map((t, idx) => {
                  const slots     = t.pokemon_slots;
                  const equipped  = t.pokemon_count;
                  const hasFreeSlot = equipped < slots;
                  const typeOk    = t.trainer_type === "Universal" ||
                                    t.trainer_type === sel.type1;
                  const canEquip  = hasFreeSlot && typeOk;
                  return (
                    <button
                      key={t.id}
                      disabled={!canEquip || loading}
                      onClick={() => handleEquip(idx)}
                      className="w-full text-left rounded-xl p-3 transition-all"
                      style={{
                        background: canEquip
                          ? "rgba(34,197,94,0.08)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${canEquip ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
                        opacity: canEquip ? 1 : 0.45,
                        cursor: canEquip ? "pointer" : "not-allowed",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {t.char && (
                            <img src={t.char.sprite} alt="" style={{ height: 36, imageRendering: "pixelated" }} />
                          )}
                          <div>
                            <p className="font-bold text-white text-sm">
                              {t.char?.name ?? t.label}
                              <span className="ml-2 text-xs text-blue-400">Lv.{t.level}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Tipo: <span style={{ color: TYPE_COLORS[t.trainer_type] ?? "#888" }}>{t.trainer_type}</span>
                              {" · "}{equipped}/{slots} Pokémon
                            </p>
                          </div>
                        </div>
                        {!canEquip && (
                          <span className="text-xs text-red-400 font-bold">
                            {!hasFreeSlot ? "No slot" : "Incompatible type"}
                          </span>
                        )}
                        {canEquip && (
                          <span className="text-xs text-green-400 font-bold">✓ Disponível</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setPickTrainer(false)} className="btn-gray w-full mt-3 text-sm">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {bag.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4 opacity-30">📭</div>
          <p className="text-gray-500 text-lg font-bold">Empty Box</p>
          <p className="text-gray-600 text-sm mt-2">Pokémon dropped in battles appear here</p>
          <button className="btn-red mt-4" onClick={() => nav("/battle")}>⚔️ Go to Battles</button>
        </div>
      )}

      {/* Info */}
      <div className="card text-xs text-gray-600 space-y-1">
        <p>• Drops go to the box — equip on trainers with free slots</p>
        <p>• Trainers gain +1 slot at levels 5, 10, 15, 20 and 25</p>
        <p>• Universal (Legendary) trainers can equip any type</p>
        <p>• Expand the box for tokens to store more Pokémon</p>
      </div>
    </div>
  );
}
