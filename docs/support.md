# Support Structures

Support structures are placed on grass tiles like towers but don't fire projectiles. They appear in the **Towers** tab alongside combat towers.

| Structure | Icon | Cost | Description |
|---|---|---|---|
| Intuitive Clam | 🐚 | 80 | Buffs nearby towers |
| Beehive | 🐝 | 90 | Deploys orbiting bees |
| Magnificent Clown | 🤡 | 100 | Reverses enemy movement |
| Resourceful Monkey | 🐵 | 70 | Boosts factory income |
| AI Agent | 🤖 | 110 | Auto-casts spells |

---

## 🐚 Intuitive Clam

- Emits a buff aura to all non-factory towers within `(level + 1) × 1.5` tiles.
- Buff effect: **+50% damage** and **−15% cooldown** to affected towers (shown with teal border glow).
- Upgrade cost: 35 + level × 20 gold.
- Multiple clams stack their buffs.

## 🐝 Beehive

- Spawns **3 bees** (base) that orbit the hive and sting nearby enemies.
- Each bee deals **4 damage** per sting with a 30-tick cooldown.
- Upgrade: +1 bee, +2 bee damage. Cost: 40 + level × 25 gold.
- The **Bee Keeper** player skill adds +2 bees per hive.
- If the hive is sold, all its bees disappear.

## 🤡 Magnificent Clown

- Periodically **reverses** the movement direction of non-boss enemies within range (default 3 tiles).
- Reversed enemies walk backward for **80 ticks** before resuming normal direction.
- Cooldown: 200 ticks between activations.
- Upgrade (+Range): increases reverse range by 0.5 and duration by 20 ticks. Cost: 40 + level × 25 gold.
- The **Clown Master** player skill doubles reverse duration.

## 🐵 Resourceful Monkey

- Passively increases all **Factory** income by **+25%** per monkey on the field.
- Effect stacks: 2 monkeys = +50% total, 3 = +75%, etc.
- No upgrades, no range. Just place it.

## 🤖 AI Agent

- Every **300 ticks** (150 with **Robot Overclock** skill), auto-casts one of three abilities when 3+ enemies are on the field:
  - **Lightning** — zaps the highest-HP enemy for 20 + wave×5 damage and a short stun.
  - **Freeze** — freezes all enemies for 90 ticks (if not already frozen).
  - **Heal** — restores +1 ❤️ (up to the 30-life cap).
- Multiple robots each cast independently.
