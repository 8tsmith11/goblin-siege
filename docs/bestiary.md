# The Bestiary

The Bestiary is the central lore and encounter-tracking encyclopedia for Goblin Siege. Rather than presenting objective numbers and statistics, the Bestiary leverages an **unreliable narrator**, presenting observations from a shifting cast of in-world researchers, scouts, and autonomous AI agents.

## Unlocking Logic
Entries in the Bestiary are completely hidden by default. They are mapped to a global `state.bSen` tracking Set which serializes to your save file.
*   **Enemies & Bosses**: Unlocked automatically the exact moment they first spawn on the map during the `genWave` sequence.
*   **Towers**: Unlocked the moment you spend gold to successfully construct them on the grid.
*   **Events/NPCs**: Unlocked when their specific event randomly triggers (e.g., Pip the Merchant).
*   **The Sleeping Door**: A pre-seeded `???` mystery entry that defaults to unlocked on every brand-new save file to signify the Bestiary's existence.

## The Lore Engine
The entire script for the Bestiary is completely decoupled from the combat mechanics and is stored in a master dictionary inside `js/bestiary.js`. 
*   **Inconsistencies**: The terminology purposefully shifts between entries ("Beasts," "Creatures," "Entities," "Pilgrims") to mimic multiple conflicting authors logging notes.
*   **Unimplemented Lore**: The dictionary natively holds data for several highly advanced entities (e.g., *The Lonesome Pilgrim*, *Curious Geologist*) that do not yet exist mechanically in the spawning engine. Because the Bestiary strictly requires a spawn trigger to unveil them, these entries remain permanently hidden in-game until their physics and behaviors are formally implemented.

## UI Integration
The Bestiary is accessible via the distinct 📖 book icon anchored to the right side of the main view canvas. Tapping it opens an absolute-positioned overlay (`#beastP`) rendering all your unlocked encounters with dynamically injected color-coded classifications (`Hostile`, `Allied`, `Unknown`).
