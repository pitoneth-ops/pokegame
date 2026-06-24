import random
from datetime import datetime, timezone, timedelta
from pokemon_data import (
    POKEMON_DATA, TRAINER_TIERS, BASE_WIN_RATES, NPC_WIN_CAPS, NPCS,
    RARITY_ORDER, SPRITE_URL, ELITE4_REWARD, BURN_COST,
    TRAINER_CHARS, RARITY_CHARS,
    SUPER_EFFECTIVE, NOT_VERY_EFFECTIVE,
    POKEMON_BY_TYPE, GYM_LEADERS_ORDER, ELITE4_MEMBERS_DATA,
    NPC_DROP_RATES, NPC_LEVEL_RANGES,
    MARKETPLACE_POKEMON_COST,
    XP_BASE, XP_GROWTH, NPC_XP_RANGES,
    POKEMON_SLOT_MILESTONES, LEVEL_UNLOCK_COSTS, BAG_EXPAND_COSTS,
    ROUTES, STONE_EVOLUTIONS, STONE_DATA,
    TRAINER_PACK_COST, POKEMON_PACK_COST, COMBO_PACK_COST,
    TYPE_SWAP_COST, POKEMON_PACK_POOLS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Pokémon entry helpers  ("id:level" format in comma-separated strings)
# ─────────────────────────────────────────────────────────────────────────────

def parse_entries(raw: str) -> list[dict]:
    result = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            pid, lvl = part.split(":", 1)
            result.append({"id": int(pid), "level": int(lvl)})
        else:
            result.append({"id": int(part), "level": 5})   # legacy compat
    return result


def serialize_entries(entries: list[dict]) -> str:
    return ",".join(f"{e['id']}:{e['level']}" for e in entries)


# ─────────────────────────────────────────────────────────────────────────────
# Type matchup
# ─────────────────────────────────────────────────────────────────────────────

def get_type_matchup(attacker: str, defender: str) -> float:
    if defender in SUPER_EFFECTIVE.get(attacker, []):
        return 0.90
    if defender in NOT_VERY_EFFECTIVE.get(attacker, []):
        return 0.10
    return 0.50


# ─────────────────────────────────────────────────────────────────────────────
# Level / XP system
# ─────────────────────────────────────────────────────────────────────────────

def xp_for_level(level: int) -> int:
    """XP needed to advance FROM this level to the next."""
    return int(XP_BASE * (XP_GROWTH ** (level - 1)))


def compute_level(total_xp: int, max_level: int) -> tuple[int, int, int]:
    """
    Returns (current_level, xp_in_current_level, xp_needed_for_next).
    Level is capped at max_level.
    """
    level, xp_used = 1, 0
    while level < max_level:
        needed = xp_for_level(level)
        if total_xp < xp_used + needed:
            break
        xp_used += needed
        level += 1
    xp_in = total_xp - xp_used
    xp_next = xp_for_level(level) if level < max_level else 0
    return level, xp_in, xp_next


def get_pokemon_slots(level: int) -> int:
    """Trainer Pokémon slots based on level milestones (1 + 1 per milestone)."""
    slots = 1 + sum(1 for m in POKEMON_SLOT_MILESTONES if level >= m)
    return min(slots, 6)


def award_xp(trainer, amount: int):
    trainer.xp = (trainer.xp or 0) + amount


def unlock_info(max_level_unlocked: int) -> tuple[int | None, int | None]:
    """Next (target_max, cost) or (None, None) if capped."""
    for cap, cost in LEVEL_UNLOCK_COSTS.items():
        if max_level_unlocked < cap:
            return cap, cost
    return None, None


# ─────────────────────────────────────────────────────────────────────────────
# Trainer character
# ─────────────────────────────────────────────────────────────────────────────

def pick_trainer_char(rarity: str) -> tuple:
    """Returns (char_type, char_name, trainer_type).
    Legendary trainers get trainer_type='Universal' (no type restriction)."""
    char_type = random.choice(RARITY_CHARS[rarity])
    char      = TRAINER_CHARS[char_type]
    char_name = random.choice(char["names"])
    if rarity == "legendary":
        trainer_type = "Universal"
    else:
        trainer_type = random.choice(char["types"])
    return char_type, char_name, trainer_type


def get_char_data(char_type: str, trainer_id: int, char_name: str) -> dict | None:
    if not char_type or char_type not in TRAINER_CHARS:
        return None
    rng  = random.Random(trainer_id * 137 + 42)
    char = TRAINER_CHARS[char_type]
    return {
        "type":     char_type,
        "label":    char["display_name"],
        "sprite":   char["sprite"],
        "name":     char_name,
        "age":      rng.randint(*char["age_range"]),
        "city":     rng.choice(char["cities"]),
        "hobby":    rng.choice(char["hobbies"]),
        "quote":    rng.choice(char["quotes"]),
        "fav_type": rng.choice(char["types"]),
        "gender":   char["gender"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Initial Pokémon (level 5, respects type / Universal)
# ─────────────────────────────────────────────────────────────────────────────

def pick_initial_pokemon(trainer_type: str) -> str:
    if trainer_type == "Universal":
        pool = TRAINER_TIERS["legendary"]["pokemon_pool"]
    else:
        pool = POKEMON_BY_TYPE.get(trainer_type, POKEMON_BY_TYPE["Normal"])
    return f"{random.choice(pool)}:5"


# ─────────────────────────────────────────────────────────────────────────────
# Battles-per-day system
# ─────────────────────────────────────────────────────────────────────────────

def _battles_per_day(rarity: str) -> int:
    return TRAINER_TIERS.get(rarity, {}).get("battles_per_day", 1)


def _window_reset(trainer) -> bool:
    """True if the 24-h window has expired (battles should reset)."""
    reset_at = trainer.battles_reset_at or ""
    if not reset_at:
        return True
    rt = datetime.fromisoformat(reset_at)
    if rt.tzinfo is None:
        rt = rt.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) >= rt


def battle_available(trainer) -> bool:
    if _window_reset(trainer):
        return True
    return (trainer.battles_used_today or 0) < _battles_per_day(trainer.rarity)


def battles_remaining(trainer) -> int:
    per_day = _battles_per_day(trainer.rarity)
    if _window_reset(trainer):
        return per_day
    return max(0, per_day - (trainer.battles_used_today or 0))


def minutes_until_reset(trainer) -> int:
    if battle_available(trainer):
        return 0
    reset_at = trainer.battles_reset_at or ""
    if not reset_at:
        return 0
    rt = datetime.fromisoformat(reset_at)
    if rt.tzinfo is None:
        rt = rt.replace(tzinfo=timezone.utc)
    return max(0, int((rt - datetime.now(timezone.utc)).total_seconds() / 60))


def _use_battle(trainer):
    now = datetime.now(timezone.utc)
    if _window_reset(trainer):
        trainer.battles_used_today = 1
        trainer.battles_reset_at   = (now + timedelta(hours=24)).isoformat()
    else:
        trainer.battles_used_today = (trainer.battles_used_today or 0) + 1
    trainer.last_battle_at = now.isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Rarity helpers
# ─────────────────────────────────────────────────────────────────────────────

def roll_trainer_rarity() -> str:
    r = random.random()
    if r < 0.03:  return "legendary"
    if r < 0.15:  return "epic"
    if r < 0.40:  return "rare"
    return "common"


def get_win_rates(rarity: str) -> list[float]:
    """Win rates scaled by rarity multiplier, capped per NPC difficulty."""
    mult = TRAINER_TIERS.get(rarity, {}).get("multiplier", 1.0)
    return [round(min(cap, r * mult), 4) for r, cap in zip(BASE_WIN_RATES, NPC_WIN_CAPS)]


# ─────────────────────────────────────────────────────────────────────────────
# Team Power
# ─────────────────────────────────────────────────────────────────────────────

def calculate_team_power(trainer) -> float:
    """Sum of (hp+atk+def+spd) × level / 1000 for all equipped Pokémon."""
    equipped = parse_entries(trainer.pokemon_ids)
    if not equipped:
        return 0.0
    total = 0.0
    for e in equipped:
        p = POKEMON_DATA.get(e["id"], {})
        stats = p.get("hp", 45) + p.get("attack", 45) + p.get("defense", 45) + p.get("speed", 45)
        total += stats * e["level"] / 1000
    return round(total, 2)


def power_win_bonus(team_power: float) -> float:
    """Up to +25% win rate bonus at team_power >= 120."""
    return min(0.25, team_power / 120)


def get_win_rates_with_power(rarity: str, team_power: float) -> list[float]:
    base  = get_win_rates(rarity)
    bonus = power_win_bonus(team_power)
    return [round(min(cap, r + bonus), 4) for r, cap in zip(base, NPC_WIN_CAPS)]


# ─────────────────────────────────────────────────────────────────────────────
# Items (stones)
# ─────────────────────────────────────────────────────────────────────────────

def parse_items(raw: str) -> dict:
    items: dict[str, int] = {}
    for part in (raw or "").split(","):
        part = part.strip()
        if ":" in part:
            name, count = part.rsplit(":", 1)
            items[name.strip()] = int(count)
    return items


def serialize_items(items: dict) -> str:
    return ",".join(f"{k}:{v}" for k, v in items.items() if v > 0)


def get_items_dict(player) -> dict:
    return parse_items(getattr(player, "items", "") or "")


# ─────────────────────────────────────────────────────────────────────────────
# Route helper
# ─────────────────────────────────────────────────────────────────────────────

def get_route(route_id: int) -> dict:
    return next((r for r in ROUTES if r["id"] == route_id), ROUTES[0])


# ─────────────────────────────────────────────────────────────────────────────
# Bag helpers
# ─────────────────────────────────────────────────────────────────────────────

def _bag_entries(player) -> list[dict]:
    return parse_entries(player.pokemon_bag or "")


def _try_drop_to_bag(player, trainer, npc_id: int, route_id: int = 1) -> int | None:
    """Try to drop a Pokémon to the player's bag from the route's pool."""
    route    = get_route(route_id)
    base     = NPC_DROP_RATES.get(npc_id, {"pokemon": 0.01})["pokemon"]
    eff_rate = min(0.40, base * route["drop_multiplier"])
    if random.random() >= eff_rate:
        return None

    bag     = _bag_entries(player)
    bag_cap = player.bag_capacity or 10
    if len(bag) >= bag_cap:
        return None

    pool      = route["pokemon_pool"]
    bag_ids   = {e["id"] for e in bag}
    available = [p for p in pool if p not in bag_ids]
    if not available:
        return None

    new_id  = random.choice(available)
    lvl_min, lvl_max = NPC_LEVEL_RANGES.get(npc_id, (5, 15))
    new_lvl = random.randint(lvl_min, lvl_max)
    bag.append({"id": new_id, "level": new_lvl})
    player.pokemon_bag = serialize_entries(bag)
    return new_id


def _try_drop_gym_pass(player, npc_id: int, route_id: int = 1) -> bool:
    route    = get_route(route_id)
    base     = NPC_DROP_RATES.get(npc_id, {"gym_pass": 0.005}).get("gym_pass", 0.005)
    eff_rate = min(0.35, base * route["drop_multiplier"])
    if random.random() < eff_rate:
        player.gym_passes = (player.gym_passes or 0) + 1
        return True
    return False


def _try_drop_stone(player, route: dict) -> str | None:
    stone_rate  = route.get("stone_rate", 0)
    stone_types = route.get("stone_types", [])
    if not stone_types or stone_rate <= 0:
        return None
    if random.random() >= stone_rate:
        return None
    stone_name = random.choice(stone_types)
    items = get_items_dict(player)
    items[stone_name] = items.get(stone_name, 0) + 1
    player.items = serialize_items(items)
    return stone_name


_BACKPACK_DROPS = [
    {"rarity": "legendary", "rate": 0.005, "min": 5000,  "max": 15000},
    {"rarity": "epic",      "rate": 0.02,  "min": 1000,  "max": 3000},
    {"rarity": "common",    "rate": 0.05,  "min": 100,   "max": 1000},
]

def _try_drop_backpack(player) -> dict | None:
    for bp in _BACKPACK_DROPS:
        if random.random() < bp["rate"]:
            tokens_found = random.randint(bp["min"], bp["max"])
            player.tokens += tokens_found
            return {"rarity": bp["rarity"], "tokens": tokens_found}
    return None


def do_use_stone(player, bag_index: int, stone_name: str) -> dict:
    items = get_items_dict(player)
    if items.get(stone_name, 0) <= 0:
        return {"error": f"você não tem {stone_name}"}

    bag = _bag_entries(player)
    if bag_index < 0 or bag_index >= len(bag):
        return {"error": "índice inválido na box"}

    entry   = bag[bag_index]
    old_id  = entry["id"]
    evo_map = STONE_EVOLUTIONS.get(stone_name, {})
    new_id  = evo_map.get(old_id)
    if new_id is None:
        old_p = POKEMON_DATA.get(old_id, {})
        return {"error": f"{old_p.get('name', '?')} não evolui com {stone_name}"}

    entry["id"] = new_id
    bag[bag_index] = entry
    player.pokemon_bag = serialize_entries(bag)

    items[stone_name] -= 1
    player.items = serialize_items(items)

    new_p = POKEMON_DATA.get(new_id, {})
    old_p = POKEMON_DATA.get(old_id, {})
    return {
        "ok":      True,
        "old_name": old_p.get("name", "?"),
        "new_name": new_p.get("name", "?"),
        "new_id":   new_id,
        "items":    items,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Pack functions (trainer-only, pokemon-only, combo)
# ─────────────────────────────────────────────────────────────────────────────

def open_trainer_pack(player, db_add_fn) -> dict:
    """Trainer pack: costs TRAINER_PACK_COST, gives trainer with NO Pokémon."""
    from pokemon_data import TRAINER_PACK_COST as COST
    if player.tokens < COST:
        return {"error": f"tokens insuficientes (precisa {COST})"}
    player.tokens -= COST
    rarity                             = roll_trainer_rarity()
    char_type, char_name, trainer_type = pick_trainer_char(rarity)
    trainer = db_add_fn(rarity, "", char_type, char_name, trainer_type)
    return {"ok": True, "tokens": player.tokens, "trainer": trainer_to_dict(trainer)}


def open_pokemon_pack(player) -> dict:
    """Pokemon pack: costs POKEMON_PACK_COST, gives a Pokémon at Lv 1 in bag."""
    from pokemon_data import POKEMON_PACK_COST as COST
    if player.tokens < COST:
        return {"error": f"tokens insuficientes (precisa {COST})"}

    bag = _bag_entries(player)
    cap = player.bag_capacity or 10
    if len(bag) >= cap:
        return {"error": "box cheia — expanda ou solte um Pokémon"}

    player.tokens -= COST
    rarity = roll_trainer_rarity()
    pool   = POKEMON_PACK_POOLS.get(rarity, POKEMON_PACK_POOLS["common"])
    pid    = random.choice(pool)
    bag.append({"id": pid, "level": 1})
    player.pokemon_bag = serialize_entries(bag)

    p = POKEMON_DATA.get(pid, {})
    return {
        "ok":     True,
        "tokens": player.tokens,
        "rarity": rarity,
        "pokemon": {
            "id":     pid,
            "name":   p.get("name", "?"),
            "type1":  p.get("type1", ""),
            "sprite": SPRITE_URL.format(id=pid),
            "level":  1,
        },
    }


def do_swap_type(player, trainer, new_type: str) -> dict:
    """Change trainer's type specialization. Requires empty Pokémon slots."""
    if (trainer.pokemon_ids or "").strip():
        return {"error": "Remove all Pokémon from this trainer before swapping type"}
    if player.tokens < TYPE_SWAP_COST:
        return {"error": f"Not enough tokens (need {TYPE_SWAP_COST})"}
    player.tokens -= TYPE_SWAP_COST
    trainer.trainer_type = new_type
    return {"ok": True, "tokens": player.tokens, "new_type": new_type}


# ─────────────────────────────────────────────────────────────────────────────
# Battle
# ─────────────────────────────────────────────────────────────────────────────

def do_battle(player, npc_id: int, trainer, route_id: int = 1) -> dict:
    if not battle_available(trainer):
        mins = minutes_until_reset(trainer)
        h, m = divmod(mins, 60)
        per  = _battles_per_day(trainer.rarity)
        return {"error": f"sem batalhas disponíveis ({per}/dia) — reset em {h}h {m}min"}

    npc = next((n for n in NPCS if n["id"] == npc_id), None)
    if npc is None:
        return {"error": "NPC inválido"}

    team_power = calculate_team_power(trainer)
    win_rate   = get_win_rates_with_power(trainer.rarity, team_power)[npc_id - 1]
    if not (trainer.pokemon_ids or "").strip():
        win_rate = 0.0
    won = random.random() < win_rate

    reward = npc["base_reward"] if won else 0
    player.tokens += reward
    if won:
        player.wins   += 1
        trainer.wins  += 1
    else:
        player.losses  += 1
        trainer.losses += 1

    _use_battle(trainer)

    xp_min, xp_max = NPC_XP_RANGES.get(npc_id, (100, 500))
    xp_gained = random.randint(xp_min, xp_max)
    award_xp(trainer, xp_gained)

    route            = get_route(route_id)
    dropped_pokemon  = _try_drop_to_bag(player, trainer, npc_id, route_id)
    dropped_gym_pass = _try_drop_gym_pass(player, npc_id, route_id)
    dropped_stone    = _try_drop_stone(player, route)
    dropped_backpack = _try_drop_backpack(player)

    max_lv  = trainer.max_level_unlocked or 5
    level, xp_in, xp_next = compute_level(trainer.xp or 0, max_lv)
    slots   = get_pokemon_slots(level)

    stone_icon = STONE_DATA.get(dropped_stone, {}).get("icon", "") if dropped_stone else ""

    return {
        "won":              won,
        "reward":           reward,
        "tokens":           player.tokens,
        "npc":              npc["name"],
        "win_rate":         win_rate,
        "team_power":       team_power,
        "battles_remaining": battles_remaining(trainer),
        "battles_per_day":  _battles_per_day(trainer.rarity),
        "xp_gained":        xp_gained,
        "trainer_level":    level,
        "trainer_xp":       trainer.xp or 0,
        "xp_in_level":      xp_in,
        "xp_to_next":       xp_next,
        "dropped_pokemon":  dropped_pokemon,
        "dropped_gym_pass": dropped_gym_pass,
        "dropped_stone":    dropped_stone,
        "dropped_stone_icon": stone_icon,
        "dropped_backpack": dropped_backpack,
        "gym_passes":       player.gym_passes or 0,
        "pokemon_count":    len(parse_entries(trainer.pokemon_ids)),
        "pokemon_slots":    slots,
        "bag_count":        len(_bag_entries(player)),
        "bag_capacity":     player.bag_capacity or 10,
        "items":            get_items_dict(player),
        "route_name":       route["name"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Gym battle
# ─────────────────────────────────────────────────────────────────────────────

def do_gym_battle(player, trainer) -> dict:
    if (player.gym_passes or 0) <= 0:
        return {"error": "You need 1 Battle Gym Ticket to challenge the gym"}

    gym_idx = player.badges
    if gym_idx >= len(GYM_LEADERS_ORDER):
        return {"error": "You already defeated all gyms! Challenge the Elite Four!"}

    gym          = GYM_LEADERS_ORDER[gym_idx]
    trainer_type = getattr(trainer, "trainer_type", "Normal") or "Normal"
    win_rate     = get_type_matchup(trainer_type, gym["type"])

    player.gym_passes -= 1
    won = random.random() < win_rate
    if won:
        player.tokens   += gym["reward"]
        player.gym_wins += 1
        player.wins     += 1
        if player.badges < 8:
            player.badges += 1

    # Gym grants 1 full level of XP
    max_lv = trainer.max_level_unlocked or 5
    cur_lv = compute_level(trainer.xp or 0, max_lv)[0]
    xp_gained = xp_for_level(cur_lv)
    award_xp(trainer, xp_gained)
    new_lv, xp_in, xp_next = compute_level(trainer.xp, max_lv)

    dropped_backpack = _try_drop_backpack(player)

    return {
        "won":              won,
        "reward":           gym["reward"] if won else 0,
        "tokens":           player.tokens,
        "gym_wins":         player.gym_wins,
        "badges":           player.badges,
        "elite4_available": player.badges >= 8,
        "gym":              gym,
        "trainer_type":     trainer_type,
        "win_rate":         win_rate,
        "gym_passes":       player.gym_passes,
        "xp_gained":        xp_gained,
        "trainer_level":    new_lv,
        "dropped_backpack": dropped_backpack,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Elite 4
# ─────────────────────────────────────────────────────────────────────────────

def do_elite4_battle(player, trainer) -> dict:
    if player.badges < 8:
        return {"error": "você precisa de 8 insígnias para desafiar a Elite dos 4"}

    trainer_type = getattr(trainer, "trainer_type", "Normal") or "Normal"
    matchups     = [get_type_matchup(trainer_type, m["type"]) for m in ELITE4_MEMBERS_DATA]
    avg          = sum(matchups) / len(matchups)
    win_rate     = max(0.10, min(0.70, avg * 0.8 + 0.10))

    won = random.random() < win_rate
    if won:
        player.tokens      += ELITE4_REWARD
        player.elite4_wins += 1
        player.badges       = 0

    return {
        "won":          won,
        "reward":       ELITE4_REWARD if won else 0,
        "tokens":       player.tokens,
        "elite4_wins":  player.elite4_wins,
        "badges":       player.badges,
        "win_rate":     win_rate,
        "trainer_type": trainer_type,
        "matchups":     [{"member": m["name"], "type": m["type"], "emoji": m["emoji"],
                          "rate": get_type_matchup(trainer_type, m["type"])}
                         for m in ELITE4_MEMBERS_DATA],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Bag operations
# ─────────────────────────────────────────────────────────────────────────────

def do_equip_from_bag(player, trainer, bag_index: int) -> dict:
    bag = _bag_entries(player)
    if bag_index < 0 or bag_index >= len(bag):
        return {"error": "índice inválido na bag"}

    entry = bag[bag_index]

    # Check trainer slot availability
    max_lv    = trainer.max_level_unlocked or 5
    cur_lv    = compute_level(trainer.xp or 0, max_lv)[0]
    max_slots = get_pokemon_slots(cur_lv)
    equipped  = parse_entries(trainer.pokemon_ids)
    if len(equipped) >= max_slots:
        return {"error": f"Trainer already has {max_slots} Pokémon (level {cur_lv} allows {max_slots} slots — level up for more)"}

    # Check type compatibility
    trainer_type = getattr(trainer, "trainer_type", "Normal") or "Normal"
    if trainer_type != "Universal":
        poke_data = POKEMON_DATA.get(entry["id"], {})
        poke_type = poke_data.get("type1", "Normal")
        if poke_type != trainer_type:
            return {"error": f"{trainer_type} trainer cannot use {poke_type}-type Pokémon"}

    # Move from bag to trainer
    bag.pop(bag_index)
    equipped.append(entry)
    player.pokemon_bag    = serialize_entries(bag)
    trainer.pokemon_ids   = serialize_entries(equipped)

    return {"ok": True, "pokemon_count": len(equipped), "bag_count": len(bag)}


def do_unequip_to_bag(player, trainer, poke_index: int) -> dict:
    equipped = parse_entries(trainer.pokemon_ids)
    if poke_index < 0 or poke_index >= len(equipped):
        return {"error": "invalid index"}

    bag = _bag_entries(player)
    bag_cap = player.bag_capacity or 10
    if len(bag) >= bag_cap:
        return {"error": "Box is full — expand or free up space"}

    entry = equipped.pop(poke_index)
    bag.append(entry)
    player.pokemon_bag   = serialize_entries(bag)
    trainer.pokemon_ids  = serialize_entries(equipped)
    return {"ok": True, "pokemon_count": len(equipped), "bag_count": len(bag)}


def do_release_from_bag(player, bag_index: int) -> dict:
    bag = _bag_entries(player)
    if bag_index < 0 or bag_index >= len(bag):
        return {"error": "invalid index"}
    bag.pop(bag_index)
    player.pokemon_bag = serialize_entries(bag)
    return {"ok": True, "bag_count": len(bag)}


def do_expand_bag(player) -> dict:
    cap = player.bag_capacity or 10
    cost = BAG_EXPAND_COSTS.get(cap)
    if cost is None:
        return {"error": "bag já está no tamanho máximo"}
    if (player.tokens or 0) < cost:
        return {"error": f"tokens insuficientes (precisa {cost})"}
    player.tokens       -= cost
    player.bag_capacity  = cap + 5
    return {"ok": True, "bag_capacity": player.bag_capacity, "tokens": player.tokens}


# ─────────────────────────────────────────────────────────────────────────────
# Level tier unlock
# ─────────────────────────────────────────────────────────────────────────────

def do_unlock_level_tier(player, trainer) -> dict:
    current_cap = trainer.max_level_unlocked or 5
    next_cap, cost = unlock_info(current_cap)
    if next_cap is None:
        return {"error": "Trainer is already at the maximum unlocked level"}
    if (player.tokens or 0) < cost:
        return {"error": f"tokens insuficientes (precisa {cost})"}
    player.tokens               -= cost
    trainer.max_level_unlocked   = next_cap
    max_lv = next_cap
    level, xp_in, xp_next = compute_level(trainer.xp or 0, max_lv)
    return {
        "ok": True,
        "max_level_unlocked": next_cap,
        "tokens": player.tokens,
        "trainer_level": level,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Burn / marketplace
# ─────────────────────────────────────────────────────────────────────────────

def do_burn(player, rarity: str, trainers: list) -> dict:
    idx = RARITY_ORDER.index(rarity)
    if idx >= len(RARITY_ORDER) - 1:
        return {"error": "Legendary trainers cannot be burned"}
    all_of_rarity  = [t for t in trainers if t.rarity == rarity]
    # Only burn trainers with NO Pokémon equipped
    candidates     = [t for t in all_of_rarity if not (t.pokemon_ids or "").strip()]
    if len(all_of_rarity) < BURN_COST:
        return {"error": f"Need {BURN_COST} {rarity} trainers (you have {len(all_of_rarity)})"}
    if len(candidates) < BURN_COST:
        return {"error": f"Remove all Pokémon from at least {BURN_COST} {rarity} trainers first (empty: {len(candidates)}/{BURN_COST})"}
    next_rarity = RARITY_ORDER[idx + 1]
    return {"burn_ids": [t.id for t in candidates[:BURN_COST]], "next_rarity": next_rarity}


def do_buy_pokemon(player, trainer) -> dict:
    trainer_type = getattr(trainer, "trainer_type", "Normal") or "Normal"
    if (player.tokens or 0) < MARKETPLACE_POKEMON_COST:
        return {"error": f"tokens insuficientes (precisa {MARKETPLACE_POKEMON_COST})"}

    if trainer_type == "Universal":
        pool = TRAINER_TIERS["legendary"]["pokemon_pool"]
    else:
        pool = POKEMON_BY_TYPE.get(trainer_type, POKEMON_BY_TYPE["Normal"])

    max_lv    = trainer.max_level_unlocked or 5
    cur_lv    = compute_level(trainer.xp or 0, max_lv)[0]
    max_slots = get_pokemon_slots(cur_lv)
    equipped  = parse_entries(trainer.pokemon_ids)

    if len(equipped) >= max_slots:
        return {"error": f"Trainer already uses {max_slots} slots (level {cur_lv} — reach level 5/10/15 for more)"}

    available = [p for p in pool if p not in [e["id"] for e in equipped]]
    if not available:
        return {"error": "All available Pokémon are already on this trainer"}

    new_id  = random.choice(available)
    new_lvl = random.randint(10, 35)
    equipped.append({"id": new_id, "level": new_lvl})
    trainer.pokemon_ids   = serialize_entries(equipped)
    player.tokens        -= MARKETPLACE_POKEMON_COST

    return {
        "ok":             True,
        "new_pokemon_id": new_id,
        "tokens":         player.tokens,
        "pokemon_count":  len(equipped),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Serialization
# ─────────────────────────────────────────────────────────────────────────────

def trainer_to_dict(t) -> dict:
    tier     = TRAINER_TIERS[t.rarity]
    equipped = parse_entries(t.pokemon_ids)
    pokemon  = []
    for e in equipped:
        pid = e["id"]
        p   = POKEMON_DATA.get(pid, {})
        pokemon.append({
            "id":     pid,
            "name":   p.get("name", "?"),
            "type1":  p.get("type1", ""),
            "sprite": SPRITE_URL.format(id=pid),
            "level":  e["level"],
        })

    char_type    = getattr(t, "char_type",    "") or ""
    char_name    = getattr(t, "char_name",    "") or ""
    trainer_type = getattr(t, "trainer_type", "Normal") or "Normal"

    per_day   = _battles_per_day(t.rarity)
    remaining = battles_remaining(t)
    can_fight = remaining > 0
    mins_left = 0 if can_fight else minutes_until_reset(t)

    max_lv              = t.max_level_unlocked or 5
    total_xp            = t.xp or 0
    level, xp_in, xp_next = compute_level(total_xp, max_lv)
    slots               = get_pokemon_slots(level)
    next_cap, next_cost = unlock_info(max_lv)
    team_power          = calculate_team_power(t)

    return {
        "id":                   t.id,
        "rarity":               t.rarity,
        "label":                tier["label"],
        "emoji":                tier["emoji"],
        "trainer_type":         trainer_type,
        "battles_per_day":      per_day,
        "battles_remaining":    remaining,
        "can_battle":           can_fight,
        "minutes_until_battle": mins_left,
        "next_battle_at":       t.battles_reset_at or "",
        "cooldown_hours":       24.0,
        "level":                level,
        "xp":                   total_xp,
        "xp_in_level":          xp_in,
        "xp_to_next":           xp_next,
        "max_level_unlocked":   max_lv,
        "next_unlock_cap":      next_cap,
        "next_unlock_cost":     next_cost,
        "pokemon_slots":        slots,
        "pokemon_count":        len(equipped),
        "multiplier":           tier["multiplier"],
        "team_power":           team_power,
        "win_rates":            [0.0, 0.0, 0.0, 0.0] if not (t.pokemon_ids or "").strip() else get_win_rates_with_power(t.rarity, team_power),
        "wins":                 t.wins,
        "losses":               t.losses,
        "is_active":            t.is_active,
        "pokemon":              pokemon,
        "char":                 get_char_data(char_type, t.id, char_name),
        "obtained_at":          t.obtained_at.isoformat() if t.obtained_at else "",
    }


def bag_to_list(player) -> list[dict]:
    entries = _bag_entries(player)
    result  = []
    for e in entries:
        pid = e["id"]
        p   = POKEMON_DATA.get(pid, {})
        result.append({
            "id":     pid,
            "name":   p.get("name", "?"),
            "type1":  p.get("type1", ""),
            "sprite": SPRITE_URL.format(id=pid),
            "level":  e["level"],
        })
    return result
