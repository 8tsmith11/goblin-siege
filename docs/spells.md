# Spells

Spells are cast from the **Spells** tab in the bottom panel. They can only be used during the **active phase** (while enemies are marching). Each spell costs gold.

The **Spell Master** player skill reduces all spell costs by **25%**.

| Spell | Icon | Base Cost | Effect |
|---|---|---|---|
| Nuke | ☢️ | 200 💰 | Damages ALL enemies on the map |
| Volcano | 🌋 | 150 💰 | Creates a lava zone for 2 waves |
| Freeze | ❄️ | 120 💰 | Freezes all enemies for 3 seconds |
| Lightning | ⚡ | 80 💰 | Strikes the strongest enemy and stuns it |
| Rage | 🔥 | 60 💰 | Boosts all tower damage and fire rate |

---

## ☢️ Nuke

- Deals `50 + wave × 15` damage to every enemy currently on the map.
- Cannot be dodged — hits stealth, bosses, and all types.

## 🌋 Volcano

- Places a lava zone centered on the current average enemy position.
- Burns nearby enemies for **2 full waves**.
- Only one volcano can be active at a time.

## ❄️ Freeze

- Freezes all **non-boss** enemies in place for **180 ticks** (~3 seconds at 60 fps).
- Frozen enemies cannot be healed by healers or move at all.
- Cannot be cast if a freeze is already active.

## ⚡ Lightning

- Targets the **highest-HP** enemy currently alive.
- Deals `40 + wave × 8` damage.
- Stuns the target for **60 ticks**.

## 🔥 Rage

- Permanently boosts **all currently placed towers**:
  - **+30% damage** (applied once to current dmg value)
  - **−20% cooldown** (fire rate increased; minimum cooldown of 5 ticks)
- Effect is permanent for the towers that exist at cast time.
