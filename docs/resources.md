# Resources

Resources are collectable materials that exist alongside gold. They are shown in the HUD between the wave label and the factory income counter.

## Current Resources

| Resource | Icon | Color | Has Node |
|---|---|---|---|
| Stone | 🪨 | Grey | Yes (3 per map) |
| Sticks | 🪵 | Brown | No |

Adding a new resource requires one entry in `RTYPES` and one in `NTYPES` in `js/resources.js`.

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
   sticks: { icon: '🪵', name: 'Sticks', clr: '#92400e' },
   ```
2. Add a matching node type to `NTYPES`:
   ```js
   branch: { resource: 'sticks', count: 5, chance: 0.30, yield: 1, wobble: 16, cooldown: 10 },
   ```
3. That's it — the HUD, save/load, and placement system pick it up automatically.
