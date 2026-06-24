import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useGameStore } from "../store";
import { doWithdraw, getHistory, type TransactionEntry } from "../api";

const PS = "https://play.pokemonshowdown.com/sprites/trainers";

// ─── Withdraw Modal ──────────────────────────────────────────────────────────

function WithdrawModal({
  balance, playerName, walletPubkey, onClose, onSuccess,
}: {
  balance: number;
  playerName: string;
  walletPubkey: string;
  onClose: () => void;
  onSuccess: (newTokens: number) => void;
}) {
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig]     = useState("");
  const [error, setError]     = useState("");

  const requested = Math.min(parseInt(amount) || 0, balance);

  async function handleWithdraw() {
    if (requested <= 0)  { setError("Enter a valid amount."); return; }
    if (!walletPubkey)   { setError("Wallet not connected."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await doWithdraw(playerName, requested, walletPubkey);
      setTxSig(res.signature);
      onSuccess(res.tokens);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}
         onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="w-full max-w-sm animate-slide-up"
           style={{ background: "#16162a", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden" }}>

        <div className="flex items-center justify-between px-6 py-5"
             style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="font-black text-white text-lg">Withdraw $PKG</p>
            <p className="text-gray-500 text-xs mt-0.5">Send farmed tokens to your wallet</p>
          </div>
          <button onClick={onClose} disabled={loading}
                  className="text-gray-600 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full transition-colors">×</button>
        </div>

        <div className="p-6 space-y-5">
          {txSig ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-black text-white text-xl">Sent!</p>
                <p className="text-gray-400 text-sm mt-1">Tokens are on the way to your wallet</p>
              </div>
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer"
                 className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                 style={{ background: "rgba(20,241,149,0.08)", border: "1px solid rgba(20,241,149,0.2)", color: "#14f195" }}>
                View on Solscan ↗
              </a>
              <button onClick={onClose} className="btn-gray w-full py-3">Done</button>
            </div>
          ) : loading ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-4xl animate-spin inline-block">⟳</div>
              <p className="text-white font-bold">Sending tokens…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                   style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                <span className="text-gray-400 text-sm">Farmed balance</span>
                <span className="font-black text-yellow-400 text-lg">{balance.toLocaleString()} $PKG</span>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-bold block mb-2">Amount to withdraw</label>
                <div className="flex gap-2">
                  <input type="number" min="1" max={balance} value={amount}
                         onChange={e => { setAmount(e.target.value); setError(""); }}
                         placeholder="0"
                         className="flex-1 text-2xl font-black text-white py-4 px-4 rounded-2xl"
                         style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", outline: "none" }} />
                  <button onClick={() => setAmount(String(balance))}
                          className="px-4 rounded-2xl text-xs font-black"
                          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                    MAX
                  </button>
                </div>
              </div>

              <div className="rounded-xl px-4 py-3 text-xs text-gray-500"
                   style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="flex justify-between">
                  <span>Destination</span>
                  <span className="font-mono text-gray-300">{walletPubkey.slice(0, 6)}…{walletPubkey.slice(-4)}</span>
                </p>
              </div>

              {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}

              <div className="flex gap-3">
                <button onClick={onClose} className="btn-gray flex-1 py-3">Cancel</button>
                <button onClick={handleWithdraw} disabled={requested <= 0 || !walletPubkey}
                        className="flex-1 py-3 rounded-2xl font-black text-base transition-all"
                        style={{
                          background: requested <= 0 || !walletPubkey ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#14f195,#0ea472)",
                          color: requested <= 0 || !walletPubkey ? "#4b5563" : "#000",
                          cursor: requested <= 0 || !walletPubkey ? "not-allowed" : "pointer",
                        }}>
                  {requested > 0 ? `Withdraw ${requested.toLocaleString()}` : "Withdraw"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Gym leaders ─────────────────────────────────────────────────────────────

const GYM_LEADERS_DATA = [
  { name: "Brock",     sprite: `${PS}/brock.png`,    emoji: "🪨", badge: "Boulder"  },
  { name: "Misty",     sprite: `${PS}/misty.png`,    emoji: "💧", badge: "Cascade"  },
  { name: "Lt. Surge", sprite: `${PS}/lt-surge.png`, emoji: "⚡", badge: "Thunder"  },
  { name: "Erika",     sprite: `${PS}/erika.png`,    emoji: "🌿", badge: "Rainbow"  },
  { name: "Koga",      sprite: `${PS}/koga.png`,     emoji: "☠️", badge: "Soul"     },
  { name: "Sabrina",   sprite: `${PS}/sabrina.png`,  emoji: "🔮", badge: "Marsh"    },
  { name: "Blaine",    sprite: `${PS}/blaine.png`,   emoji: "🔥", badge: "Volcano"  },
  { name: "Giovanni",  sprite: `${PS}/giovanni.png`, emoji: "🌍", badge: "Earth"    },
];

// ─── Main page ────────────────────────────────────────────────────────────────

const RARITY_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  common:    { bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.3)",  color: "#9ca3af", label: "Common"    },
  rare:      { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",   color: "#60a5fa", label: "Rare"      },
  epic:      { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)",   color: "#c084fc", label: "Epic"      },
  legendary: { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",   color: "#fbbf24", label: "Legendary" },
};

function txIcon(type: string) {
  if (type === "pack_combo")   return "🎴";
  if (type === "pack_trainer") return "🧑‍🏫";
  if (type === "pack_pokemon") return "🔮";
  if (type === "deposit")      return "💰";
  if (type === "withdraw")     return "💸";
  return "📋";
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const { playerName, player, setPlayer } = useGameStore();
  const { connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [history, setHistory] = useState<TransactionEntry[]>([]);

  const walletPubkey = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!playerName) return;
    getHistory(playerName).then(setHistory).catch(() => {});
  }, [playerName]);

  if (playerName && player) {
    const badges = player.badges ?? 0;
    const at     = player.active_trainer;

    const displayName = player.name.length > 20
      ? `${player.name.slice(0, 4)}…${player.name.slice(-4)}`
      : player.name;

    const stars = Math.min(Math.max(1, Math.ceil((badges + 1) / 3)), 3);

    return (
      <div className="space-y-5 animate-fade-in">
        {withdrawOpen && (
          <WithdrawModal
            balance={player.tokens}
            playerName={playerName}
            walletPubkey={walletPubkey}
            onClose={() => setWithdrawOpen(false)}
            onSuccess={tokens => { if (player) setPlayer({ ...player, tokens }); }}
          />
        )}

        {/* ── GBA TRAINER CARD ── */}
        <div style={{
          borderRadius: 12, overflow: "hidden",
          border: "3px solid #1A50A0",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(100,180,255,0.15)",
          fontFamily: "'Press Start 2P', monospace",
        }}>
          <div style={{
            background: "linear-gradient(90deg, #CC1010 0%, #A80808 100%)",
            padding: "7px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#FFE0E0", fontSize: 9, letterSpacing: 2 }}>⊙ TRAINER CARD ⊙</span>
            <span style={{ color: "#FFD700", fontSize: 13, letterSpacing: 2 }}>
              {"★".repeat(stars)}{"☆".repeat(3 - stars)}
            </span>
          </div>

          <div style={{
            background: "linear-gradient(160deg, #4880C8 0%, #2C5EA8 50%, #1E4890 100%)",
            padding: "14px 16px",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 7, color: "#A8D0FF", marginBottom: 6 }}>
                ID No.&nbsp;&nbsp;<span style={{ color: "#FFFFFF" }}>#{player.name.slice(-6).toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 7, color: "#A8D0FF", marginBottom: 10 }}>
                NAME&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#FFFFFF" }}>{displayName}</span>
              </div>

              <div style={{ borderTop: "1px solid rgba(200,230,255,0.25)", marginBottom: 10 }} />

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 7, color: "#A8D0FF" }}>FARMED</span>
                <div style={{
                  background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)",
                  borderRadius: 6, padding: "2px 7px",
                  fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, fontWeight: 900,
                  color: "#FCD34D",
                }}>
                  {player.tokens.toLocaleString()} $PKG
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(200,230,255,0.25)", marginBottom: 10 }} />

              <button
                onClick={() => setWithdrawOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(20,241,149,0.10)", border: "1px solid rgba(20,241,149,0.35)",
                  borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                  color: "#14f195", letterSpacing: 1, marginBottom: 10,
                }}
              >
                ↑ WITHDRAW $PKG
              </button>

              <div style={{ borderTop: "1px solid rgba(200,230,255,0.25)", marginBottom: 10 }} />

              <div style={{ display: "flex", gap: 20, marginBottom: 6 }}>
                <div style={{ fontSize: 7, color: "#A8D0FF" }}>
                  WINS&nbsp;&nbsp;<span style={{ color: "#80FF80" }}>{player.wins}</span>
                </div>
                <div style={{ fontSize: 7, color: "#A8D0FF" }}>
                  LOSS&nbsp;&nbsp;<span style={{ color: "#FF9090" }}>{player.losses}</span>
                </div>
              </div>

              <div style={{ fontSize: 7, color: "#A8D0FF", marginBottom: 10 }}>
                BADGES&nbsp;<span style={{ color: "#FFD700" }}>{badges}/8</span>
                {(player.elite4_wins ?? 0) > 0 && (
                  <span style={{ color: "#E080FF", marginLeft: 12 }}>CHAMPION×{player.elite4_wins}</span>
                )}
              </div>

              <div style={{ borderTop: "1px solid rgba(200,230,255,0.25)", marginBottom: 10 }} />

              <div style={{ fontSize: 7, color: "#A8D0FF" }}>
                NETWORK&nbsp;<span style={{ color: "#14F195" }}>◎ SOLANA</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
              {at?.char?.sprite ? (
                <img src={at.char.sprite} alt={at.char.name}
                     style={{ height: 96, imageRendering: "pixelated", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }} />
              ) : (
                <img src="https://play.pokemonshowdown.com/sprites/trainers/youngster.png" alt="trainer"
                     style={{ height: 88, imageRendering: "pixelated", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }} />
              )}
              {at?.char && (
                <span style={{ fontSize: 6, color: "#C0E0FF", marginTop: 4, textAlign: "center" }}>{at.char.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── GYM BADGES ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-white text-sm uppercase tracking-wide">Gym Badges</h3>
            <span className={`text-sm font-black ${badges >= 8 ? "text-yellow-400" : "text-gray-500"}`}>{badges}/8</span>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {GYM_LEADERS_DATA.map((gym, i) => {
              const earned = i < badges;
              const next   = i === badges && !player.elite4_available;
              return (
                <div key={i} title={`${gym.name} — ${gym.badge} Badge`}
                     className={`aspect-square rounded-full flex items-center justify-center border-2 transition-all overflow-hidden ${
                       earned ? "border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/25"
                       : next  ? "border-yellow-600/30 bg-yellow-900/10 animate-pulse"
                       : "border-gray-800 bg-gray-900 grayscale opacity-25"
                     }`}>
                  {earned || next ? (
                    <img src={gym.sprite} alt={gym.name} className="w-full h-full object-cover"
                         style={{ imageRendering: "pixelated" }}
                         onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="text-base">{gym.emoji}</span>
                  )}
                </div>
              );
            })}
          </div>

          {!player.elite4_available && player.current_gym && (
            <div className="mt-4 flex items-center gap-3 rounded-xl p-3"
                 style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <img src={GYM_LEADERS_DATA[badges]?.sprite} alt={player.current_gym.name}
                   className="h-10 w-auto flex-shrink-0" style={{ imageRendering: "pixelated" }}
                   onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-xs truncate">Next: {player.current_gym.name}</p>
                <p className="text-gray-500 text-xs">{player.current_gym.city} · {player.current_gym.type}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-green-400 text-xs font-black">🎫 {player.gym_passes}</span>
                <span className="text-gray-600 text-xs">tickets</span>
              </div>
            </div>
          )}

          {player.elite4_available && (
            <div className="mt-4 rounded-xl p-4 text-center"
                 style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)" }}>
              <p className="text-purple-300 font-black">🏆 ELITE FOUR UNLOCKED!</p>
              <p className="text-gray-500 text-xs mt-1">Head to Battle to challenge them</p>
            </div>
          )}

          {!player.elite4_available && (
            <p className="text-gray-700 text-xs mt-3 text-center">
              {8 - badges} badge{8 - badges !== 1 ? "s" : ""} remaining to challenge the Elite Four
            </p>
          )}
        </div>

        {/* ── TRANSACTION HISTORY ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-white text-sm uppercase tracking-wide">Transaction History</h3>
            <span className="text-gray-600 text-xs">{history.length > 0 ? `${history.length} recent` : ""}</span>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-700 text-xs text-center py-6">No transactions yet — buy a pack or withdraw to see history here.</p>
          ) : (
            <div className="space-y-2">
              {history.map(tx => {
                const rStyle = tx.meta.rarity ? RARITY_STYLE[tx.meta.rarity] ?? RARITY_STYLE.common : null;
                return (
                  <div key={tx.id}
                       className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                       style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-xl flex-shrink-0 mt-0.5">{txIcon(tx.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-xs font-bold truncate">{tx.description}</span>
                        {rStyle && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: rStyle.bg, border: `1px solid ${rStyle.border}`, color: rStyle.color }}>
                            {rStyle.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {tx.meta.trainer_type && (
                          <span className="text-gray-500 text-[10px]">Type: {tx.meta.trainer_type}</span>
                        )}
                        {tx.meta.pokemon_name && !tx.meta.trainer_type && (
                          <span className="text-gray-500 text-[10px]">{tx.meta.pokemon_type}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 gap-1">
                      {tx.tokens_delta !== 0 && (
                        <span className={`text-xs font-black ${tx.tokens_delta > 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx.tokens_delta > 0 ? "+" : ""}{tx.tokens_delta.toLocaleString()} $PKG
                        </span>
                      )}
                      <span className="text-gray-700 text-[10px]">{fmtDate(tx.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Landing ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 animate-fade-in">
      <div className="text-center">
        <div className="flex justify-center gap-0.5 mb-6">
          {[25, 150, 149, 6, 130, 248, 143, 95].map(id => (
            <img key={id} src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
                 className="w-14 h-14" alt="" style={{ imageRendering: "pixelated" }} />
          ))}
        </div>
        <h1 className="font-pixel mb-4 tracking-tight"
            style={{ fontSize: "clamp(28px, 6vw, 52px)", background: "linear-gradient(160deg, #FF8C00 0%, #FF5500 60%, #FF2200 100%)",
                     WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 24px rgba(255,120,0,0.5))" }}>
          PokeGame
        </h1>
        <p className="text-gray-400 text-base">Collect trainers · dominate gyms · conquer Kanto</p>
      </div>

      <div className="card w-full max-w-sm text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
               style={{ background: "linear-gradient(135deg, rgba(20,241,149,0.15), rgba(153,69,255,0.15))", border: "1px solid rgba(20,241,149,0.25)" }}>◎</div>
        </div>
        <div>
          <h2 className="text-xl font-black text-white mb-1">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm">Your Solana wallet is your game identity.<br/>No account creation needed.</p>
        </div>
        {connecting ? (
          <div className="py-3 text-green-400 font-bold text-sm animate-pulse">Connecting to wallet…</div>
        ) : connected ? (
          <div className="py-3 text-green-400 font-bold text-sm animate-pulse">Loading your profile…</div>
        ) : (
          <button onClick={() => setVisible(true)} className="btn-yellow w-full py-3 text-base font-black">
            🔗 Connect Wallet
          </button>
        )}
        <div className="pt-1 border-t border-white/5">
          <p className="text-gray-600 text-xs mb-3">Supported wallets</p>
          <div className="flex justify-center gap-6 text-xs text-gray-500">
            {[{ name: "Phantom", color: "#ab9ff2" }, { name: "Solflare", color: "#fc8f2d" }].map(w => (
              <div key={w.name} className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: w.color, display: "inline-block" }} />
                <span>{w.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-md text-xs text-gray-500">
        {["🎴 Open trainer packs", "⚔️ Battle NPCs & collect drops", "🏟️ Conquer 8 gyms", "👑 Challenge the Elite Four"].map(f => (
          <span key={f} className="px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
