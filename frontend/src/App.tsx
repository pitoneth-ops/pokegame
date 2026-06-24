import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useGameStore } from "./store";
import { getPlayer, createPlayer, getWalletInfo } from "./api";
import { IconHome, IconPack, IconTrainer, IconGym, IconTypes, IconBattle, IconBox, IconPvp, IconAchievements, IconPokedex, IconWiki, IconMarketplace } from "./components/Icons";
import Home from "./pages/Home";
import Pack from "./pages/Pack";
import MyTrainers from "./pages/MyPokemon";
import Battle from "./pages/Battle";
import Gyms from "./pages/Gyms";
import Types from "./pages/Types";
import Bag from "./pages/Bag";
import Pokedex from "./pages/Pokedex";
import Wiki from "./pages/Wiki";

const NAV_ITEMS = [
  { to: "/",            label: "Profile",    Icon: IconHome,         locked: false },
  { to: "/pack",        label: "Pack",       Icon: IconPack,         locked: false },
  { to: "/trainers",    label: "Trainers",   Icon: IconTrainer,      locked: false },
  { to: "/battle",      label: "Battle",     Icon: IconBattle,       locked: false },
  { to: "/bag",         label: "Box",        Icon: IconBox,          locked: false },
  { to: "/gyms",        label: "Gyms",       Icon: IconGym,          locked: false },
  { to: "/pokedex",     label: "Pokédex",    Icon: IconPokedex,      locked: false },
  { to: "/types",       label: "Types",      Icon: IconTypes,        locked: false },
  { to: "/wiki",        label: "Wiki",       Icon: IconWiki,         locked: false },
  { to: "/marketplace", label: "Market",     Icon: IconMarketplace,  locked: true  },
  { to: "/pvp",         label: "PvP",        Icon: IconPvp,          locked: true  },
  { to: "/achievements",label: "Medals",     Icon: IconAchievements, locked: true  },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in">
      <div className="text-5xl">🔒</div>
      <h2 className="text-2xl font-black text-white">{label}</h2>
      <p className="text-gray-500 text-sm">This feature is coming soon. Stay tuned!</p>
    </div>
  );
}

function WalletButton() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) return <div className="text-xs text-gray-400 px-3 py-2">Connecting...</div>;

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className="flex items-center gap-2">
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer"
          style={{ background: "rgba(20,241,149,0.08)", border: "1px solid rgba(20,241,149,0.2)" }}
          title={addr}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#14f195", display: "inline-block" }} />
          <span className="text-green-400 text-xs font-mono font-bold">{addr.slice(0, 4)}…{addr.slice(-4)}</span>
        </div>
        <button onClick={() => disconnect()} className="btn-gray text-xs py-1.5 px-3">Sign Out</button>
      </div>
    );
  }

  return (
    <button onClick={() => setVisible(true)} className="btn-yellow text-xs py-1.5 px-4 font-bold flex items-center gap-1.5">
      <span>🔗</span><span>Connect Wallet</span>
    </button>
  );
}

function fmtBal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Nav() {
  const { playerName } = useGameStore();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const nav = useNavigate();
  const [lockedToast, setLockedToast] = useState(false);
  const [walletBal, setWalletBal] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) { setWalletBal(null); return; }
    let alive = true;
    getWalletInfo().then(async info => {
      if (!alive || !info.treasury) return;
      try {
        const mint = new PublicKey(info.mint);
        const prog = new PublicKey(info.token_program || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        const ata  = await getAssociatedTokenAddress(mint, publicKey, false, prog);
        const bal  = await connection.getTokenAccountBalance(ata);
        if (alive) setWalletBal(Number(bal.value.uiAmount) ?? 0);
      } catch { if (alive) setWalletBal(0); }
    }).catch(() => { if (alive) setWalletBal(0); });
    return () => { alive = false; };
  }, [connected, publicKey?.toBase58()]);

  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
      isActive ? "text-orange-900 shadow-lg" : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
    }` + (isActive ? " nav-active" : "");

  function handleLockedClick() {
    setLockedToast(true);
    setTimeout(() => setLockedToast(false), 2000);
  }

  return (
    <nav
      className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
      style={{ background: "rgba(7,7,15,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => nav("/")}>
        <img src="/icon.svg" className="w-9 h-9 rounded-xl" alt="logo" style={{ imageRendering: "pixelated" }} />
        <span className="font-black text-lg tracking-tight hidden sm:inline"
              style={{ background: "linear-gradient(135deg, #FF8C00, #FF4500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          PokeGame
        </span>
      </div>

      {/* Nav links */}
      {playerName && (
        <div className="flex items-center gap-0.5">
          {NAV_ITEMS.map(({ to, label, Icon, locked }) =>
            locked ? (
              <button
                key={to}
                onClick={handleLockedClick}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-600 transition-all relative"
              >
                <Icon size={18} />
                <span className="hidden lg:inline">{label}</span>
                <span className="absolute -top-0.5 -right-0.5 text-[8px]">🔒</span>
              </button>
            ) : (
              <NavLink key={to} to={to} className={cls}>
                <Icon size={18} />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            )
          )}
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3">
        {playerName && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
               style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span className="text-yellow-400 font-black text-sm">
              {walletBal === null ? "…" : fmtBal(walletBal)} $PKG
            </span>
          </div>
        )}
        <WalletButton />
      </div>

      {/* Coming soon toast */}
      {lockedToast && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-300 animate-slide-up"
             style={{ background: "rgba(20,20,35,0.95)", border: "1px solid rgba(255,255,255,0.12)", whiteSpace: "nowrap" }}>
          🔒 Coming Soon · Stay tuned!
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const { playerName, setPlayer, logout } = useGameStore();
  const { publicKey, connected } = useWallet();
  const wasConnected = useRef(false);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const key = publicKey.toBase58();
    getPlayer(key)
      .then(setPlayer)
      .catch(() => createPlayer(key).then(r => setPlayer(r.player)).catch(() => {}));
  }, [connected, publicKey?.toBase58()]);

  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
    } else if (wasConnected.current && playerName) {
      logout();
      wasConnected.current = false;
    }
  }, [connected]);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/pack"         element={<Pack />} />
          <Route path="/trainers"     element={<MyTrainers />} />
          <Route path="/gyms"         element={<Gyms />} />
          <Route path="/types"        element={<Types />} />
          <Route path="/battle"       element={<Battle />} />
          <Route path="/bag"          element={<Bag />} />
          <Route path="/pokedex"      element={<Pokedex />} />
          <Route path="/wiki"         element={<Wiki />} />
          <Route path="/marketplace"  element={<ComingSoon label="Marketplace" />} />
          <Route path="/pvp"          element={<ComingSoon label="PvP Battles" />} />
          <Route path="/achievements" element={<ComingSoon label="Achievements" />} />
        </Routes>
      </main>
    </div>
  );
}
