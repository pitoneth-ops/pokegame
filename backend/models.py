from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()


class Player(Base):
    __tablename__ = "players"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, unique=True, index=True)
    tokens      = Column(Integer, default=500)
    wins        = Column(Integer, default=0)
    losses      = Column(Integer, default=0)
    gym_wins    = Column(Integer, default=0)
    badges      = Column(Integer, default=0)
    elite4_wins = Column(Integer, default=0)
    gym_passes   = Column(Integer, default=0)
    pokemon_bag  = Column(String,  default="")   # "id:level,..." unequipped drops
    bag_capacity = Column(Integer, default=10)
    items        = Column(String,  default="")   # "Fire Stone:2,Moon Stone:1" inventory
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trainers = relationship("PlayerTrainer", back_populates="player")


class PlayerTrainer(Base):
    __tablename__ = "player_trainers"

    id             = Column(Integer, primary_key=True, index=True)
    player_id      = Column(Integer, ForeignKey("players.id"))
    rarity         = Column(String)           # common | rare | epic | legendary
    pokemon_ids    = Column(String)           # comma-separated, starts as 1, grows to 6
    wins           = Column(Integer, default=0)
    losses         = Column(Integer, default=0)
    is_active      = Column(Boolean, default=False)
    last_battle_at     = Column(String,  default="")
    battles_used_today = Column(Integer, default=0)
    battles_reset_at   = Column(String,  default="")
    xp                 = Column(Integer, default=0)
    max_level_unlocked = Column(Integer, default=5)   # cap; starts at 5 (free tier)
    trainer_type       = Column(String,  default="Normal")
    char_type          = Column(String,  default="")
    char_name          = Column(String,  default="")
    obtained_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player = relationship("Player", back_populates="trainers")
