from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import create_tables, get_db
from models import Player, PlayerTrainer
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
    NPC_SPRITE_POOLS, TYPE_SWAP_COST,
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


def _player_dict(player: Player) -> dict:
    active  = _active_trainer(player)
    counts  = {r: sum(1 for t in player.trainers if t.rarity == r) for r in RARITY_ORDER}
    gym_idx = player.badges
    current_gym = GYM_LEADERS_ORDER[gym_idx] if gym_idx < len(GYM_LEADERS_ORDER) else None
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


@app.post("/player/{name}/pack")
def open_pack(name: str, db: Session = Depends(get_db)):
    """Combo pack — trainer + type-matched Pokémon."""
    player = _get_player(name, db)
    cost = COMBO_PACK_COST
    if player.tokens < cost:
        raise HTTPException(400, f"not enough tokens (need {cost})")
    player.tokens -= cost
    rarity                             = roll_trainer_rarity()
    char_type, char_name, trainer_type = pick_trainer_char(rarity)
    initial_pokemon                    = pick_initial_pokemon(trainer_type)
    trainer = _create_trainer_row(player, db, rarity, initial_pokemon, char_type, char_name, trainer_type)
    db.commit()
    return {"ok": True, "tokens": player.tokens, "trainer": trainer_to_dict(trainer)}


@app.post("/player/{name}/pack/trainer")
def open_trainer_pack_endpoint(name: str, db: Session = Depends(get_db)):
    """Trainer-only pack — no Pokémon assigned."""
    player = _get_player(name, db)
    if player.tokens < TRAINER_PACK_COST:
        raise HTTPException(400, f"not enough tokens (need {TRAINER_PACK_COST})")
    player.tokens -= TRAINER_PACK_COST
    rarity                             = roll_trainer_rarity()
    char_type, char_name, trainer_type = pick_trainer_char(rarity)
    trainer = _create_trainer_row(player, db, rarity, "", char_type, char_name, trainer_type)
    db.commit()
    return {"ok": True, "tokens": player.tokens, "trainer": trainer_to_dict(trainer)}


@app.post("/player/{name}/pack/pokemon")
def open_pokemon_pack_endpoint(name: str, db: Session = Depends(get_db)):
    """Pokémon-only pack — goes to bag at Lv 1."""
    player = _get_player(name, db)
    result = open_pokemon_pack(player)
    if "error" in result:
        raise HTTPException(400, result["error"])
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
        "expand_cost":  BAG_EXPAND_COSTS.get(player.bag_capacity or 10),
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
    return NPCS


@app.get("/gyms")
def list_gyms():
    return GYM_LEADERS_ORDER


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
