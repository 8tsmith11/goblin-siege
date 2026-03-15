from pydantic import BaseModel
from typing import Optional

# Auth
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# Tower
class TowerOut(BaseModel):
    id: str
    type: str
    x: int
    y: int
    level: int
    has_laser: bool
    laser_lvl: int
    laser_range: float
    owned_skills: list[str]
    disabled: bool

# Game state
class GameStateOut(BaseModel):
    gold: int
    lives: int
    wave: int
    phase: str
    skill_pts: int
    player_skills: list[str]
    towers: list[TowerOut]

# Wave
class EnemyEntry(BaseModel):
    type: str
    count: int

class WaveOut(BaseModel):
    wave: int
    is_boss: bool
    enemies: list[EnemyEntry]

class KillReport(BaseModel):
    kills: dict[str, int]   # {enemy_type: count}
    leaks: dict[str, int]   # {enemy_type: count} — types that reached the end

class WaveCompleteOut(BaseModel):
    gold: int
    lives: int
    skill_pts: int
    wave: int

# Tower actions
class PlaceTowerIn(BaseModel):
    type: str
    x: int
    y: int

class PlaceTowerOut(BaseModel):
    tower: TowerOut
    gold: int

class GoldOut(BaseModel):
    gold: int

class SkillPtsOut(BaseModel):
    skill_pts: int

class TowerSkillIn(BaseModel):
    skill: str   # 'A', 'B', or 'C'

# Spells
class CastSpellIn(BaseModel):
    spell: str

class CastSpellOut(BaseModel):
    gold: int
    effect: Optional[dict] = None   # extra data the frontend might need
