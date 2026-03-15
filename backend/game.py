"""
Game logic: costs, validation, wave generation, income calculation.
Mirror of the JS game definitions — keep in sync with js/towers.js, js/enemies.js etc.
"""
import math
import random

# Tower base costs
TOWER_COSTS = {
    "squirrel": 40, "lion": 60, "penguin": 55, "fish": 75,
    "seahorse": 65, "lizard": 85, "heron": 70,
}
SUPPORT_COSTS = {
    "clam": 80, "beehive": 90, "clown": 100, "monkey": 70, "robot": 110,
}
ALL_TOWER_COSTS = {**TOWER_COSTS, **SUPPORT_COSTS}

SPELL_COSTS = {
    "nuke": 200, "volcano": 150, "freeze": 120,
    "heal": 50, "goldBoost": 40, "lightning": 80, "rage": 60,
}

PLAYER_SKILL_COSTS = {
    "sharpShot": 1, "thickWalls": 1, "goldRush": 1, "quickDraw": 1, "spellMaster": 1,
    "beeKeeper": 2, "doomCannon": 2, "greed": 2, "clownMaster": 2,
    "robotOverclock": 3, "megaFactory": 3,
}
PLAYER_SKILL_TIERS = {
    "sharpShot": 1, "thickWalls": 1, "goldRush": 1, "quickDraw": 1, "spellMaster": 1,
    "beeKeeper": 2, "doomCannon": 2, "greed": 2, "clownMaster": 2,
    "robotOverclock": 3, "megaFactory": 3,
}

TOWER_SKILL_COSTS = {"A": 1, "B": 1, "C": 2}
TOWER_SKILL_EXCLUSIONS = {
    "squirrel": {"A": "B", "B": "A"},
    "lion":     {"A": "B", "B": "A"},
    "penguin":  {"A": "B", "B": "A"},
    "fish":     {"A": "B", "B": "A"},
    "seahorse": {"A": "B", "B": "A"},
    "lizard":   {"A": "B", "B": "A"},
    "heron":    {"A": "B", "B": "A"},
}

# Enemy kill rewards
ENEMY_REWARDS = {
    "normal": 4, "fast": 3, "tank": 8, "berserker": 7,
    "shaman": 6, "stealth": 5, "healer": 6, "swarm": 1, "shield": 9,
    "boss": 0,  # boss reward handled separately: 50 + wave*5
}
# Lives lost when an enemy leaks
ENEMY_LIVES_COST = {"boss": 3, "default": 1}


def factory_income(towers: list, player_skills: list) -> int:
    monkey_count = sum(1 for t in towers if t.type == "monkey")
    total = 0
    for t in towers:
        if t.type == "factory":
            inc = 10 + t.level * 8
            if monkey_count > 0:
                inc = math.floor(inc * (1 + monkey_count * 0.25))
            total += inc
    if "goldRush" in player_skills:
        total = math.floor(total * 1.3)
    if "megaFactory" in player_skills:
        total = math.floor(total * 1.5)
    return total


def sell_value(tower_type: str) -> int:
    cost = ALL_TOWER_COSTS.get(tower_type, 50) if tower_type != "factory" else 50
    return math.floor(cost * 0.5)


def upgrade_cost(tower_type: str, current_level: int) -> int:
    base = ALL_TOWER_COSTS.get(tower_type, 50)
    return math.floor(base * 0.5 * (1 + current_level * 0.4))


def factory_place_cost(current_factory_count: int) -> int:
    return 50 + current_factory_count * 25


def spell_cost(spell: str, player_skills: list) -> int:
    base = SPELL_COSTS.get(spell, 9999)
    if "spellMaster" in player_skills:
        return math.floor(base * 0.75)
    return base


def can_buy_player_skill(skill: str, owned_skills: list) -> tuple[bool, str]:
    if skill not in PLAYER_SKILL_COSTS:
        return False, "Unknown skill"
    if skill in owned_skills:
        return False, "Already owned"
    tier = PLAYER_SKILL_TIERS[skill]
    if tier == 2:
        tier1_owned = sum(1 for s in owned_skills if PLAYER_SKILL_TIERS.get(s) == 1)
        if tier1_owned < 2:
            return False, "Need 2 tier-1 skills first"
    if tier == 3:
        tier2_owned = sum(1 for s in owned_skills if PLAYER_SKILL_TIERS.get(s) == 2)
        if tier2_owned < 2:
            return False, "Need 2 tier-2 skills first"
    return True, ""


def can_buy_tower_skill(skill: str, tower_type: str, owned_skills: list) -> tuple[bool, str]:
    excl = TOWER_SKILL_EXCLUSIONS.get(tower_type, {})
    if excl.get(skill) in owned_skills:
        return False, "Blocked by exclusive skill"
    if skill == "C" and "A" not in owned_skills and "B" not in owned_skills:
        return False, "Need A or B first"
    if skill in owned_skills:
        return False, "Already owned"
    return True, ""


def gen_wave(wave: int) -> dict:
    is_boss = wave % 5 == 0 and wave > 0
    enemies = []

    if is_boss:
        enemies.append({"type": "boss", "count": 1})
        minion_count = math.floor(3 + wave * 0.5)
        types = ["normal", "fast", "berserker"]
        for i in range(minion_count):
            enemies.append({"type": types[i % 3], "count": 1})
    else:
        avail = ["normal"]
        if wave >= 2: avail.append("fast")
        if wave >= 3: avail.append("tank")
        if wave >= 4: avail.append("berserker")
        if wave >= 5: avail.append("shaman")
        if wave >= 6: avail.append("stealth")
        if wave >= 7: avail.append("healer")
        if wave >= 8: avail.append("swarm")
        if wave >= 9: avail.append("shield")
        cnt = math.floor(6 + wave * 2.2 + wave ** 1.1)
        counts: dict[str, int] = {}
        for _ in range(cnt):
            tp = random.choice(avail)
            if tp == "swarm":
                counts["swarm"] = counts.get("swarm", 0) + 4
            else:
                counts[tp] = counts.get(tp, 0) + 1
        enemies = [{"type": t, "count": c} for t, c in counts.items()]

    return {"wave": wave, "is_boss": is_boss, "enemies": enemies}


def validate_wave_complete(
    wave: int,
    kills: dict[str, int],
    leaks: dict[str, int],
    towers: list,
    player_skills: list,
    current_gold: int,
    current_lives: int,
) -> tuple[int, int, int]:
    """Returns (new_gold, new_lives, new_skill_pts_earned)."""

    # Gold from kills
    greed = "greed" in player_skills
    kill_gold = 0
    for enemy_type, count in kills.items():
        if enemy_type == "boss":
            kill_gold += (50 + wave * 5) * count
        else:
            reward = ENEMY_REWARDS.get(enemy_type, 0)
            kill_gold += reward * count
            if greed:
                kill_gold += 3 * count

    # Factory income
    inc = factory_income(towers, player_skills)

    # Lives lost from leaks
    lives_lost = 0
    for enemy_type, count in leaks.items():
        cost = ENEMY_LIVES_COST["boss"] if enemy_type == "boss" else ENEMY_LIVES_COST["default"]
        lives_lost += cost * count

    new_gold = current_gold + kill_gold + inc
    new_lives = max(0, current_lives - lives_lost)

    # Skill point every 3 waves
    skill_pts_earned = 1 if wave % 3 == 0 else 0

    return new_gold, new_lives, skill_pts_earned
