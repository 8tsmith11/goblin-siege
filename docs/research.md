# Research & The Lab

The **Lab** (🧪) is the primary gateway to research, lore extraction, and meta-progression in Goblin Siege.

## The Lab Structure
*   **Limitation**: The Lab is a highly unique Support structure possessing a strict **Singleton Limit**. You may only construct *one* Lab per map. Attempting to build a second will trigger an error.
*   **Cost**: 120 Gold.

## The Observation Radius
The Lab's primary integrated mechanic is the **Observation Radius** (`obsRange`), which defaults to 3 tiles.
When an enemy is slain anywhere on the map, the engine calculates the hypotenuse distance between the dying enemy and the active Lab. If the enemy dies *within* the Lab's observation radius, their remains are converted into a premium resource: **🔮 Dust**.

## Dust Generation
Dust is automatically deposited into your global inventory (`state.resources.dust`) via the native `resources.js` abstraction when harvested. The yield is calculated mathematically based on the enemy's tier:
*   **Formula**: `1 + floor(Enemy Reward / 3)`
*   *Example*: A normal goblin (4g reward) yields **2 Dust**. A Tank (8g reward) yields **3 Dust**.
*   **Bosses**: Boss waves feature a hard override, yielding a massive **10 Dust** upon defeat within the observation radius.

## The Future of Research
While the foundational Dust harvesting loop is fully active, the larger **Research Web**, **Logbook Tabs**, and deep **Lab Notes** subsystems are conceptually designed but currently **shelved**. Future implementations will utilize the collected Dust to unlock sprawling Web nodes, translating the "Procession's" language and opening new playable Ages.
