# Core Mechanics

## Game Loop

- The map is a procedurally generated winding maze. Goblins enter from the left edge and march toward the castle on the right.
- The game alternates between a **prep phase** (30 seconds to place towers) and an **active phase** (enemies spawn and march).
- A wave ends when all enemies are defeated. You then receive factory income and enter the next prep phase.
- Every **3 waves** you earn **+1 Skill Point**.
- Every **5 waves** is a **Boss Wave**. A warning appears one wave before.

## Resources

| Resource | Starting Value | How to Gain |
|---|---|---|
| Gold 💰 | 200 | Kill enemies, factory income, events, selling towers |
| Lives ❤️ | 20 | Reinforcements event, Robot AI heal, Thick Walls skill |
| Skill Points ⚡ | 0 | +1 every 3 waves, random events |

- Enemies deal **1 life** on reaching the castle; bosses deal **3 lives**.
- Lives cap at **30**.
- Gold cannot go below 0.

## Selling Towers

- Any placed tower or support can be sold for **50% of its base cost**.
- Upgrades are not refunded.

## Upgrades

- Click a placed tower to open its tooltip. Upgrade options are randomized each wave from: **+DMG**, **+Range**, or **-Cooldown**.
- Upgrade cost scales with the tower's base cost and current level.

## Factory Income

- Each **Factory** generates gold at the end of every wave: `10 + level × 8` gold.
- A **Monkey** support boosts all factories by **+25% each** (stacks per monkey).
- The **Gold Rush** skill multiplies total income by **×1.3**.
- The **Mega Factory** skill multiplies total income by **×1.5** (stacks with Gold Rush).

## Random Events

A random event triggers mid-wave with a **40% chance** after wave 1. See `events.md`.

## Camera Controls

| Action | Control |
|---|---|
| Pan | Drag (mouse or single finger) / WASD / Arrow keys |
| Zoom | Mouse wheel / Pinch gesture |

Zoom range: **fit-whole-map** to **4×**. The world is always **20×12 tiles**.
