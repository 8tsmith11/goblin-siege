# Resources & Ground Loot

Resources are collectable materials that exist alongside gold. They are shown in the HUD between the wave label and the factory income counter.

## Current Resources

| Resource | Icon | Color | Has Node |
|---|---|---|---|
| Stone | 🪨 | Grey | Yes (3 per map) |
| Wood | 🪵 | Brown | No (Dropped by Enemies) |

Adding a new resource requires one entry in `RTYPES` and optionally one in `NTYPES` in `js/resources.js`.

---

## Ground Loot Stacks

Enemies have designated `drops` tables. When they die, there is a chance they drop one of their items on the ground.
Ground loot operates on a stacking system integrated into the global `grid`:
- **Placement**: Dropped items sit directly on top of tiles (`stacks` array per cell). 
- **Stacking Limits**: Maximum of 64 items per individual stack.
- **Tile Limits**: A single physical tile can hold up to 4 distinct stacks. A newly created stack is assigned completely at random to one of the 4 unoccupied corners of the grid cell.
- **Destruction**: If a tile is completely full (4 maxed stacks), any newly dropped item onto that tile is destroyed.
- **Looting**: Clicking exactly on a stack removes **1 item** from the physical stack and adds it to your inventory. 

Visually, items will scale upwards slightly as the pile grows, and display a bold counter badge (e.g., `x4`) next to them to preserve CPU framing budgets over drawing layers.

---

## Enemy Drop Tables

Loot configurations per enemy are defined inside `ETYPES` (`js/enemies.js`):

| Enemy | Drop Table |
|---|---|
| Normal | 15% Wood |
| Fast | 20% Wood |
| Tank | 30% Stone |
| Berserker | 25% Wood |
| Shaman | None |
| Stealth | 20% Wood |
| Healer | 15% Wood |
| Shield | 35% Stone |
| Boss | 100% Wood, Stone |

---

## Resource Nodes

Resource nodes are interactive objects placed on grass tiles at the start of each game. They are distinct from towers and do not block paths or tower placement.

If a tower is placed on a node tile, the node is removed.

### 🪨 Stone Node

| Property | Value |
|---|---|
| Nodes per map | 3 |
| Drop chance | 20% per click |
| Yield | 1 stone |
| Cooldown | 12 ticks between clicks |

**Clicking a stone node:**
1. Plays a mining sound.
2. Triggers a wobble animation (8 ticks).
3. Rolls a 20% chance — on success, adds 1 🪨 to inventory and shows a floating "+1 🪨" gain label.

---

## Floating Gain Text

`mkGain(worldPx, worldPy, icon, amount, color)` in `js/ui.js` is the reusable function for displaying item gain feedback. It:
- Converts world pixel coordinates to screen space (accounts for zoom/pan).
- Creates a `.fltG` DOM element that floats upward and fades out over ~1 second.
- Is distinct from `mkF` (used for damage numbers) — larger font, longer duration, different animation.

Call it from any code that grants a resource to the player.

---

## Adding a New Resource

1. Add an entry to `RTYPES` in `js/resources.js`:
   ```js
   wood: { icon: '🪵', name: 'Wood', clr: '#92400e' },
   ```
2. (Optional) Add a matching node type to `NTYPES`:
   ```js
   branch: { resource: 'wood', count: 5, chance: 0.30, yield: 1, wobble: 16, cooldown: 10 },
   ```
3. (Optional) Add drop logic to `ETYPES` in `js/enemies.js`:
   ```js
   drops: [{ type: 'wood', chance: 0.25 }]
   ```
4. That's it — the HUD, save/load, placement system, and stacking mechanic pick it up automatically.
