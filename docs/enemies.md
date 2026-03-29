# Enemies

Goblins spawn from the left edge of the map and march along the procedurally generated path toward the castle. Reaching the castle costs you lives: **1 life** for normal enemies, **3 lives** for bosses.

## Wave Scaling

- **Base HP**: `25 + wave × 20 + wave^1.5 × 5`
- **Base speed**: `0.55 + min(wave × 0.035, 0.9)`
- Each enemy type applies HP and speed multipliers to these base values.
- **Enemy count**: `6 + wave × 2.2 + wave^1.1` per wave (rounded down).

## Enemy Types

| Type | Icon | HP Mult | Speed Mult | Size | Reward | Unlocks |
|---|---|---|---|---|---|---|
| Normal | 👺 | ×1.0 | ×1.0 | 0.30 | 4 💰 | Wave 1 |
| Fast | 👺 | ×0.4 | ×1.6 | 0.24 | 3 💰 | Wave 2 |
| Tank | 👹 | ×2.5 | ×0.6 | 0.45 | 8 💰 | Wave 3 |
| Berserker | 😤 | ×1.8 | ×1.2 | 0.38 | 7 💰 | Wave 4 |
| Shaman | 🧙 | ×1.2 | ×0.9 | 0.33 | 6 💰 | Wave 5 |
| Stealth | 👤 | ×0.6 | ×1.4 | 0.22 | 5 💰 | Wave 6 |
| Healer | 💚 | ×0.8 | ×0.8 | 0.30 | 6 💰 | Wave 7 |
| Swarm | 🐜 | ×0.18 | ×1.7 | 0.18 | 1 💰 | Wave 8 |
| Shield | 🛡️ | ×2.0 | ×0.7 | 0.40 | 9 💰 | Wave 9 |

**Size** = fraction of a tile.

## Special Behaviors

### 👤 Stealth
- Invisible to most towers and cannot be targeted while stealthy.
- Loses stealth after passing 60% of the path.
- The **Seahorse's Deep Insight** (C skill) allows it to see and target stealth enemies.

### 💚 Healer
- Every **60 ticks**, heals all nearby enemies (within 2 tiles) for **3% of their max HP**.
- Emits a cyan particle effect when healing.

### 🐜 Swarm
- Spawns in groups of **4** whenever a swarm entry rolls in wave generation.
- Very low HP and reward — but extremely fast and numerous.

### 😤 Berserker
- No unique special mechanic — simply a faster, higher-HP threat that appears mid-game.

### 🧙 Shaman
- No unique special mechanic in the base game — stat threat only.

---

## 👑 Boss Waves

Every **5 waves** is a boss wave. A warning message appears the wave before.

- **Boss HP**: `bHP × 8 + wave × 50`
- **Boss speed**: `bSpd × 0.35` (very slow)
- **Size**: 0.65 (large)
- **Reward**: `50 + wave × 5` gold
- **Dust Override**: Yields an unscaled `10 🔮` if slain in a Lab's radius.
- **Lives lost on escape**: 3

Bosses are immune to freeze. Each boss wave also includes **3 + wave × 0.5** additional normal/fast/berserker enemies.

Bosses taunt the player with lines like:
> "You think walls can stop ME?!"
> "I've eaten squirrels bigger than your army!"

## Status Effects

| Effect | Source | Behavior |
|---|---|---|
| Slow | Penguin, Seahorse Ink Cloud | Reduces movement speed by a percentage for a duration |
| Freeze | Freeze spell, AI Agent | Halts all non-boss enemies for the duration |
| Stun | Squirrel Mind Blast, Heron Thunderstrike, AI Agent Lightning, player Lightning spell | Stops movement for a set number of ticks |
| Poison | Fish Poison, Lizard Venom Spit | Deals damage per tick for a duration |
| Reversed | Clown support | Enemy walks backward along the path for 80 ticks |
| Stealth | Stealth type, Darkness event | Cannot be targeted by most towers |
| Speed buff | Lizard / Rage Aura | Enemies in Lizard range move 30% faster |
