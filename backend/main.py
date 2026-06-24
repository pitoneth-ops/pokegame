import uuid, time, json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import create_tables, get_db
from models import Player, PlayerTrainer, PlayerTransaction
from game_logic import (
    roll_trainer_rarity, pick_trainer_char, pick_initial_pokemon, trainer_to_dict,
    do_battle, do_gym_battle, do_elite4_battle, do_burn, do_buy_pokemon,
    do_unlock_level_tier, do_equip_from_bag, do_unequip_to_bag,
    do_release_from_bag, do_expand_bag, bag_to_list,
    do_use_stone, get_items_dict,
    open_trainer_pack, open_pokemon_pack, do_swap_type,
)
from pokemon_data import (
    NPCS, PACK_COST, START_TOKENS, TRAINER_TIERS, RARITY_ORDER,
    ELITE4_REWARD, MARKETPLACE_POKEMON_COST, GYM_LEADERS_ORDER,
    LEVEL_UNLOCK_COSTS, BAG_EXPAND_COSTS, ROUTES,
    TRAINER_PACK_COST, POKEMON_PACK_COST, COMBO_PACK_COST,
    NPC_SPRITE_POOLS, TYPE_SWAP_COST, PACK_PRICES_USD,
    GYM_REWARDS_USD, BAG_EXPAND_COSTS_USD, NPC_REWARDS_USD,
)

app = FastAPI(title="PokeGame API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()
    from database import engine
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE players ADD COLUMN items TEXT DEFAULT ''"))
            conn.commit()
        except Exception:
            pass  # column already exists


# ── Request bodies ────────────────────────────────────────────────────────────

class CreateBody(BaseModel):
    name: str

class BattleBody(BaseModel):
    npc_id:     int
    trainer_id: int
    route_id:   int = 1

class UseStoneBody(BaseModel):
    bag_index:  int
    stone_name: str

class BurnBody(BaseModel):
    rarity: str

class EquipBody(BaseModel):
    bag_index:  int
    trainer_id: int

class UnequipBody(BaseModel):
    poke_index: int
    trainer_id: int | None = None

class SwapTypeBody(BaseModel):
    new_type: str

class DepositVerifyBody(BaseModel):
    signature: str
    wallet: str   # player's Solana public key

class WithdrawBody(BaseModel):
    amount: int
    wallet: str   # player's Solana public key

class PackPayBody(BaseModel):
    signature: str
    wallet: str
    quote_id: str = ""  # optional — old clients without quote still work


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_player(name: str, db: Session) -> Player:
    p = db.query(Player).filter(Player.name == name).first()
    if not p:
        raise HTTPException(404, "player not found")
    return p


def _active_trainer(player: Player):
    for t in player.trainers:
        if t.is_active:
            return t
    if player.trainers:
        player.trainers[0].is_active = True
        return player.trainers[0]
    return None


def _usd_to_tokens(usd: float) -> int:
    try:
        from solana_client import get_token_price_usd
        price = get_token_price_usd()
        if price and price > 0:
            return max(1, round(usd / price))
    except Exception:
        pass
    return max(1, round(usd * 1_000_000))


def _player_dict(player: Player) -> dict:
    active  = _active_trainer(player)
    counts  = {r: sum(1 for t in player.trainers if t.rarity == r) for r in RARITY_ORDER}
    gym_idx = player.badges
    if gym_idx < len(GYM_LEADERS_ORDER):
        _g = GYM_LEADERS_ORDER[gym_idx]
        _reward = _usd_to_tokens(GYM_REWARDS_USD[gym_idx]) if gym_idx < len(GYM_REWARDS_USD) else _g["reward"]
        current_gym = {**_g, "reward": _reward}
    else:
        current_gym = None
    bag_count   = len([x for x in (player.pokemon_bag or "").split(",") if x.strip()])
    return {
        "name":             player.name,
        "tokens":           player.tokens,
        "wins":             player.wins,
        "losses":           player.losses,
        "gym_wins":         player.gym_wins,
        "badges":           player.badges,
        "elite4_wins":      player.elite4_wins,
        "elite4_available": player.badges >= 8,
        "gym_passes":       player.gym_passes or 0,
        "current_gym":      current_gym,
        "gym_available":    (player.gym_passes or 0) > 0 and player.badges < 8,
        "trainer_count":    len(player.trainers),
        "counts":           counts,
        "active_trainer":   trainer_to_dict(active) if active else None,
        "bag_count":        bag_count,
        "bag_capacity":     player.bag_capacity or 10,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/player/create")
def create_player(body: CreateBody, db: Session = Depends(get_db)):
    if db.query(Player).filter(Player.name == body.name).first():
        raise HTTPException(400, "name already exists")
    player = Player(name=body.name, tokens=START_TOKENS)
    db.add(player)
    db.commit()
    db.refresh(player)
    return {"ok": True, "player": _player_dict(player)}


@app.get("/player/{name}")
def get_player(name: str, db: Session = Depends(get_db)):
    return _player_dict(_get_player(name, db))


def _create_trainer_row(player: Player, db: Session, rarity: str, pokemon_ids: str,
                         char_type: str, char_name: str, trainer_type: str) -> PlayerTrainer:
    trainer = PlayerTrainer(
        player_id    = player.id,
        rarity       = rarity,
        pokemon_ids  = pokemon_ids,
        is_active    = (len(player.trainers) == 0),
        char_type    = char_type,
        char_name    = char_name,
        trainer_type = trainer_type,
    )
    db.add(trainer)
    db.commit()
    db.refresh(trainer)
    return trainer


def _record_tx(db: Session, player_id: int, tx_type: str, description: str,
               tokens_delta: int = 0, meta: dict = None):
    from datetime import datetime, timezone
    tx = PlayerTransaction(
        player_id    = player_id,
        tx_type      = tx_type,
        description  = description,
        tokens_delta = tokens_delta,
        meta         = json.dumps(meta or {}),
        created_at   = datetime.now(timezone.utc),
    )
    db.add(tx)


def _verify_pack_payment(body: PackPayBody, cost: int):
    from solana_client import verify_deposit_tx
    result = verify_deposit_tx(body.signature, body.wallet)
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    if result["amount"] < cost:
        raise HTTPException(400, f"insufficient payment (need {cost} $PKG, got {result['amount']})")


_PACK_FALLBACK = {"combo": COMBO_PACK_COST, "trainer": TRAINER_PACK_COST, "pokemon": POKEMON_PACK_COST}

# In-memory quote store: quote_id → {amount, pack_key, expires}
_quotes: dict = {}


def _cleanup_quotes():
    now = time.time()
    for qid in [k for k, v in list(_quotes.items()) if v["expires"] < now]:
        _quotes.pop(qid, None)


def _verify_pack_payment_quote(body: PackPayBody, pack_key: str):
    from solana_client import verify_deposit_tx, get_token_price_usd
    _cleanup_quotes()

    # Verify the on-chain transaction FIRST — tokens never lost even if quote expired
    result = verify_deposit_tx(body.signature, body.wallet)
    if not result["ok"]:
        raise HTTPException(400, result["error"])

    # Determine required amount: quote → USD fallback → token fallback
    quote = _quotes.pop(body.quote_id, None) if body.quote_id else None
    if quote and time.time() <= quote["expires"] and quote["pack_key"] == pack_key:
        min_tokens = quote["amount"]
    else:
        price = get_token_price_usd()
        if price and price > 0:
            min_tokens = max(1, int(PACK_PRICES_USD[pack_key] / price * 0.50))  # 50% tolerance
        else:
            min_tokens = max(1, _PACK_FALLBACK[pack_key] // 2)

    if result["amount"] < min_tokens:
        raise HTTPException(400, f"sent {result['amount']} $PKG, need at least {min_tokens}")


@app.post("/player/{name}/pack")
def open_pack(name: str, body: PackPayBody, db: Session = Depends(get_db)):
    """Combo pack — paid with real SPL tokens from wallet."""
    player = _get_player(name, db)
    _verify_pack_payment_quote(body, "combo")
    rarity                             = roll_trainer_rarity()
    char_type, char_name, trainer_type = pick_trainer_char(rarity)
    initial_pokemon                    = pick_initial_pokemon(trainer_type)
    trainer = _create_trainer_row(player, db, rarity, initial_pokemon, char_type, char_name, trainer_type)
    _record_tx(db, player.id, "pack_combo", f"Combo Pack — {rarity} trainer {char_name}", 0, {
        "rarity": rarity, "trainer_name": char_name, "trainer_type": trainer_type,
    })
    db.commit()
    return {"ok": True, "tokens": player.tokens, "trainer": trainer_to_dict(trainer)}


@app.post("/player/{name}/pack/trainer")
def open_trainer_pack_endpoint(name: str, body: PackPayBody, db: Session = Depends(get_db)):
    """Trainer-only pack — paid with real SPL tokens from wallet."""
    player = _get_player(name, db)
    _verify_pack_payment_quote(body, "trainer")
    rarity                             = roll_trainer_rarity()
    char_type, char_name, trainer_type = pick_trainer_char(rarity)
    trainer = _create_trainer_row(player, db, rarity, "", char_type, char_name, trainer_type)
    _record_tx(db, player.id, "pack_trainer", f"Trainer Pack — {rarity} trainer {char_name}", 0, {
        "rarity": rarity, "trainer_name": char_name, "trainer_type": trainer_type,
    })
    db.commit()
    return {"ok": True, "tokens": player.tokens, "trainer": trainer_to_dict(trainer)}


@app.post("/player/{name}/pack/pokemon")
def open_pokemon_pack_endpoint(name: str, body: PackPayBody, db: Session = Depends(get_db)):
    """Pokémon-only pack — paid with real SPL tokens from wallet."""
    player = _get_player(name, db)
    _verify_pack_payment_quote(body, "pokemon")
    result = open_pokemon_pack(player)
    if "error" in result:
        raise HTTPException(400, result["error"])
    poke = result.get("pokemon", {})
    _record_tx(db, player.id, "pack_pokemon", f"Pokémon Pack — {poke.get('name', '?')} ({result.get('rarity', '?')})", 0, {
        "rarity": result.get("rarity"), "pokemon_name": poke.get("name"),
        "pokemon_type": poke.get("type1"), "pokemon_id": poke.get("id"),
    })
    db.commit()
    return result


@app.get("/player/{name}/trainers")
def list_trainers(name: str, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    return [trainer_to_dict(t) for t in player.trainers]


@app.post("/player/{name}/trainers/{tid}/activate")
def activate_trainer(name: str, tid: int, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    for t in player.trainers:
        t.is_active = (t.id == tid)
    db.commit()
    return {"ok": True}


@app.post("/player/{name}/trainers/{tid}/swap-type")
def swap_trainer_type(name: str, tid: int, body: SwapTypeBody, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = next((t for t in player.trainers if t.id == tid), None)
    if not trainer:
        raise HTTPException(400, "trainer not found")
    result = do_swap_type(player, trainer, body.new_type)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return result


@app.get("/npc-sprites")
def get_npc_sprites():
    return NPC_SPRITE_POOLS


@app.post("/player/{name}/battle")
def battle(name: str, body: BattleBody, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = next((t for t in player.trainers if t.id == body.trainer_id), None)
    if not trainer:
        raise HTTPException(400, "trainer not found")
    result = do_battle(player, body.npc_id, trainer, body.route_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return result


@app.post("/player/{name}/gym")
def gym_battle(name: str, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = _active_trainer(player)
    if not trainer:
        raise HTTPException(400, "no active trainer")
    result = do_gym_battle(player, trainer)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return result


@app.post("/player/{name}/elite4")
def elite4_battle(name: str, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = _active_trainer(player)
    if not trainer:
        raise HTTPException(400, "no active trainer")
    result = do_elite4_battle(player, trainer)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return result


@app.post("/player/{name}/burn")
def burn_trainers(name: str, body: BurnBody, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    result = do_burn(player, body.rarity, player.trainers)
    if "error" in result:
        raise HTTPException(400, result["error"])
    burn_ids    = set(result["burn_ids"])
    next_rarity = result["next_rarity"]
    for t in list(player.trainers):
        if t.id in burn_ids:
            db.delete(t)
    char_type, char_name, trainer_type = pick_trainer_char(next_rarity)
    new_trainer = PlayerTrainer(
        player_id    = player.id,
        rarity       = next_rarity,
        pokemon_ids  = pick_initial_pokemon(trainer_type),
        is_active    = False,
        char_type    = char_type,
        char_name    = char_name,
        trainer_type = trainer_type,
    )
    db.add(new_trainer)
    db.commit()
    db.refresh(new_trainer)
    return {"ok": True, "burned": 3, "new_trainer": trainer_to_dict(new_trainer)}


@app.post("/player/{name}/trainers/{tid}/buy-pokemon")
def buy_pokemon(name: str, tid: int, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = next((t for t in player.trainers if t.id == tid), None)
    if not trainer:
        raise HTTPException(400, "trainer not found")
    result = do_buy_pokemon(player, trainer)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["trainer"] = trainer_to_dict(trainer)
    return result


@app.post("/player/{name}/trainers/{tid}/unlock-level")
def unlock_level_tier(name: str, tid: int, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = next((t for t in player.trainers if t.id == tid), None)
    if not trainer:
        raise HTTPException(400, "trainer not found")
    result = do_unlock_level_tier(player, trainer)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["trainer"] = trainer_to_dict(trainer)
    return result


# ── Bag endpoints ─────────────────────────────────────────────────────────────

@app.get("/player/{name}/bag")
def get_bag(name: str, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    return {
        "pokemon":      bag_to_list(player),
        "count":        len(bag_to_list(player)),
        "capacity":     player.bag_capacity or 10,
        "expand_cost":  _usd_to_tokens(BAG_EXPAND_COSTS_USD[player.bag_capacity or 10]) if (player.bag_capacity or 10) in BAG_EXPAND_COSTS_USD else None,
    }


@app.post("/player/{name}/bag/equip")
def equip_from_bag(name: str, body: EquipBody, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = next((t for t in player.trainers if t.id == body.trainer_id), None)
    if not trainer:
        raise HTTPException(400, "trainer not found")
    result = do_equip_from_bag(player, trainer, body.bag_index)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["trainer"] = trainer_to_dict(trainer)
    result["bag"]     = bag_to_list(player)
    return result


@app.post("/player/{name}/bag/unequip")
def unequip_to_bag(name: str, body: UnequipBody, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    if body.trainer_id is not None:
        trainer = next((t for t in player.trainers if t.id == body.trainer_id), None)
        if not trainer:
            raise HTTPException(400, "trainer not found")
    else:
        trainer = _active_trainer(player)
    if not trainer:
        raise HTTPException(400, "no active trainer")
    result = do_unequip_to_bag(player, trainer, body.poke_index)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["trainer"] = trainer_to_dict(trainer)
    result["bag"]     = bag_to_list(player)
    return result


@app.post("/player/{name}/bag/release/{bag_index}")
def release_from_bag(name: str, bag_index: int, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    result = do_release_from_bag(player, bag_index)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["bag"] = bag_to_list(player)
    return result


@app.post("/player/{name}/bag/expand")
def expand_bag(name: str, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    result = do_expand_bag(player)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return result


@app.get("/npcs")
def list_npcs():
    return [
        {**npc, "base_reward": _usd_to_tokens(NPC_REWARDS_USD.get(npc["id"], 0.05))}
        for npc in NPCS
    ]


@app.get("/gyms")
def list_gyms():
    return [
        {**gym, "reward": _usd_to_tokens(GYM_REWARDS_USD[i]) if i < len(GYM_REWARDS_USD) else gym["reward"]}
        for i, gym in enumerate(GYM_LEADERS_ORDER)
    ]


@app.get("/routes")
def list_routes():
    return ROUTES


@app.get("/player/{name}/items")
def get_items(name: str, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    return get_items_dict(player)


@app.post("/player/{name}/bag/use-stone")
def use_stone(name: str, body: UseStoneBody, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    result = do_use_stone(player, body.bag_index, body.stone_name)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    result["bag"] = bag_to_list(player)
    return result


# ── Market / price oracle ─────────────────────────────────────────────────────

@app.get("/market/quote/{pack_key}")
def get_pack_quote(pack_key: str):
    if pack_key not in PACK_PRICES_USD:
        raise HTTPException(400, "invalid pack type")
    _cleanup_quotes()
    from solana_client import get_token_price_usd
    price = get_token_price_usd()
    amount = max(1, int(PACK_PRICES_USD[pack_key] / price)) if (price and price > 0) else _PACK_FALLBACK[pack_key]
    qid = uuid.uuid4().hex[:16]
    _quotes[qid] = {"amount": amount, "pack_key": pack_key, "expires": time.time() + 90}
    return {"quote_id": qid, "token_amount": amount, "expires_in": 90}


@app.get("/market/price")
def market_price():
    from solana_client import get_token_price_usd
    from pokemon_data import TYPE_SWAP_COST_USD
    price = get_token_price_usd()
    if price and price > 0:
        return {
            "price_usd": price,
            "pack_prices_usd": PACK_PRICES_USD,
            "pack_prices_tokens": {k: max(1, int(v / price)) for k, v in PACK_PRICES_USD.items()},
            "swap_type_cost_usd": TYPE_SWAP_COST_USD,
            "swap_type_cost_tokens": max(1, round(TYPE_SWAP_COST_USD / price)),
            "oracle": "live",
        }
    return {
        "price_usd": None,
        "pack_prices_usd": PACK_PRICES_USD,
        "pack_prices_tokens": _PACK_FALLBACK,
        "swap_type_cost_usd": TYPE_SWAP_COST_USD,
        "swap_type_cost_tokens": None,
        "oracle": "unavailable",
    }


# ── Solana token endpoints ────────────────────────────────────────────────────

@app.get("/wallet/info")
def wallet_info():
    from solana_client import get_token_info
    return get_token_info()


@app.get("/wallet/balance/{wallet}")
def wallet_balance(wallet: str):
    from solana_client import get_wallet_token_balance
    return get_wallet_token_balance(wallet)


@app.get("/wallet/debug/{wallet}")
def wallet_debug(wallet: str):
    """Raw RPC debug — tests all balance lookup strategies."""
    from solana_client import _rpc, TOKEN_MINT_STR, _TOKEN_2022_PROGRAM, _TOKEN_PROGRAM, get_wallet_token_balance
    results = {"computed_balance": get_wallet_token_balance(wallet)}

    # Mint-direct lookup
    try:
        resp = _rpc("getTokenAccountsByOwner", [wallet, {"mint": TOKEN_MINT_STR}, {"encoding": "jsonParsed"}])
        accs = (resp.get("result") or {}).get("value") or []
        results["mint_lookup"] = {"count": len(accs), "error": resp.get("error"),
            "accounts": [{"pubkey": a.get("pubkey"),
                          "amount": a.get("account",{}).get("data",{}).get("parsed",{}).get("info",{}).get("tokenAmount",{}).get("uiAmount")}
                         for a in accs]}
    except Exception as e:
        results["mint_lookup"] = {"error": str(e)}

    # Program-based lookups (show only SCAM accounts)
    for prog in [_TOKEN_2022_PROGRAM, _TOKEN_PROGRAM]:
        try:
            resp = _rpc("getTokenAccountsByOwner", [wallet, {"programId": prog}, {"encoding": "jsonParsed"}])
            accs = (resp.get("result") or {}).get("value") or []
            scam = [{"pubkey": a.get("pubkey"),
                     "mint":   a.get("account",{}).get("data",{}).get("parsed",{}).get("info",{}).get("mint"),
                     "amount": a.get("account",{}).get("data",{}).get("parsed",{}).get("info",{}).get("tokenAmount",{}).get("uiAmount")}
                    for a in accs if a.get("account",{}).get("data",{}).get("parsed",{}).get("info",{}).get("mint") == TOKEN_MINT_STR]
            results[f"prog_{prog[:8]}"] = {"total_accounts": len(accs), "scam_found": len(scam), "scam": scam, "error": resp.get("error")}
        except Exception as e:
            results[f"prog_{prog[:8]}"] = {"error": str(e)}
    return results


@app.post("/player/{name}/deposit/verify")
def deposit_verify(name: str, body: DepositVerifyBody, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    from solana_client import verify_deposit_tx
    result = verify_deposit_tx(body.signature, body.wallet)
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    player.tokens += result["amount"]
    _record_tx(db, player.id, "deposit", f"Deposited {result['amount']:,} $PKG", result["amount"], {
        "amount": result["amount"], "signature": body.signature, "wallet": body.wallet,
    })
    db.commit()
    return {"ok": True, "amount": result["amount"], "tokens": player.tokens}


@app.post("/player/{name}/withdraw")
def withdraw(name: str, body: WithdrawBody, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    if body.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    if player.tokens < body.amount:
        raise HTTPException(400, f"not enough tokens (need {body.amount})")
    player.tokens -= body.amount
    db.commit()
    from solana_client import send_spl_tokens
    result = send_spl_tokens(body.wallet, body.amount)
    if not result["ok"]:
        player.tokens += body.amount
        db.commit()
        raise HTTPException(500, result["error"])
    _record_tx(db, player.id, "withdraw", f"Withdrew {body.amount:,} $PKG to wallet", -body.amount, {
        "amount": body.amount, "wallet": body.wallet, "signature": result["signature"],
    })
    db.commit()
    return {"ok": True, "signature": result["signature"], "tokens": player.tokens}


@app.get("/player/{name}/history")
def get_history(name: str, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    txs = (
        db.query(PlayerTransaction)
        .filter(PlayerTransaction.player_id == player.id)
        .order_by(PlayerTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": tx.id,
            "type": tx.tx_type,
            "description": tx.description,
            "tokens_delta": tx.tokens_delta,
            "meta": json.loads(tx.meta or "{}"),
            "created_at": tx.created_at.isoformat() if tx.created_at else "",
        }
        for tx in txs
    ]


# ── Dev ───────────────────────────────────────────────────────────────────────

@app.post("/dev/add-tokens/{name}/{amount}")
def dev_add_tokens(name: str, amount: int, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    player.tokens += amount
    db.commit()
    return {"tokens": player.tokens}


@app.post("/dev/add-gym-passes/{name}/{amount}")
def dev_add_gym_passes(name: str, amount: int, db: Session = Depends(get_db)):
    player = _get_player(name, db)
    player.gym_passes = (player.gym_passes or 0) + amount
    db.commit()
    return {"gym_passes": player.gym_passes}


@app.post("/dev/add-xp/{name}/{amount}")
def dev_add_xp(name: str, amount: int, db: Session = Depends(get_db)):
    player  = _get_player(name, db)
    trainer = _active_trainer(player)
    if not trainer:
        raise HTTPException(400, "no active trainer")
    trainer.xp = (trainer.xp or 0) + amount
    db.commit()
    return {"xp": trainer.xp}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
