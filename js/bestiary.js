export const BESTIARY = {
  // Stone Age Enemies
  normal: { 
    name: "Determined Grunt", icon: "👺", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "The most common of the beasts. It walks the path with a steady gait, neither hurried nor hesitant. Observation suggests it does not choose to walk — it simply does, the way water flows downhill. Easily dispatched. Drops: occasional wood scraps.",
    stats: "HP: Standard | Speed: Standard | Reward: 4g"
  },
  fast: {
    name: "Frantic Scurrier", icon: "👺", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A smaller variant, quick and low to the ground. Moves in bursts — sprinting, pausing, sprinting. It seems afraid, though of what is unclear. It is not afraid of your towers. It was afraid before it arrived.",
    stats: "HP: Low | Speed: High | Reward: 3g"
  },
  tank: {
    name: "Stubborn Brute", icon: "👹", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Considerably larger than other beasts. Thick-skinned. Slow. It absorbs punishment with what can only be described as indifference. Other creatures walk behind it, as if it is clearing the way. This may be cooperation. We have not confirmed whether the beasts cooperate.",
    stats: "HP: Very High | Speed: Low | Reward: 8g"
  },
  berserker: {
    name: "Furious Charger", icon: "😤", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Agitated. Moves with purpose and apparent anger. It is unclear what it is angry about — the towers, the path, or something else entirely. Hits hard if it reaches the walls. Recommend elimination at range.",
    stats: "HP: High | Speed: Above Average | Reward: 7g"
  },
  shaman: {
    name: "Whispering Shaman", icon: "🧙", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A beast that vocalizes more than others. The vocalizations are rhythmic — possibly ritualistic. When near other creatures, it seems to... encourage them. Towers adjacent to a Shaman's path report minor calibration drift. Coincidence, presumably.",
    stats: "HP: Standard | Speed: Below Average | Reward: 6g"
  },
  stealth: {
    name: "Quiet Shadow", icon: "👤", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Difficult to observe. The creature does not become invisible — rather, attention slides off it. You look directly at it and your eyes move elsewhere. The Lab's instruments detect it, but the naked eye struggles. Recommend Watchtower or Insightful Seahorse for detection.",
    stats: "HP: Low | Speed: High | Reward: 5g"
  },
  healer: {
    name: "Gentle Mender", icon: "💚", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "This entry has been revised. Initially classified as hostile. However, the Mender does not attack, does not approach the castle with apparent intent, and directs its energy toward healing nearby creatures — including, on two documented occasions, our own structures. Its allegiance is unclear. It heals indiscriminately. Recommend caution but not malice.",
    stats: "HP: Below Average | Speed: Below Average | Reward: 6g"
  },
  swarm: {
    name: "Swarming Mite", icon: "🐜", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Tiny. Numerous. Individually insignificant. Collectively, they are the most common cause of breach. They do not appear to be the same species as other beasts — they may be parasites, or symbionts, or something else. They die easily. There are always more.",
    stats: "HP: Minimal | Speed: Very High | Reward: 1g"
  },
  shield: {
    name: "Resolute Guardian", icon: "🛡️", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A beast carrying — or perhaps wearing — a shield of unknown material. The shield absorbs considerable damage before the creature itself is vulnerable. Where did it get the shield? We did not provide it. The shield is not natural. Someone made it. The craftsmanship is disturbingly competent.",
    stats: "HP: High | Speed: Below Average | Reward: 9g"
  },
  
  // Future Unimplemented Enemies - Stubbed into Bestiary
  pilgrim: {
    name: "Lonesome Pilgrim", icon: "🕯️", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "It carries a light. Not a weapon — a light. It walks more slowly than other beasts, and it does not deviate from the path. When killed, the light remains. The light heals other creatures that pass near it. I find myself reluctant to document this. The light is warm. The creature was warm. This is not relevant to defense operations. I'm including it anyway.",
    stats: "HP: Above Average | Speed: Low | Reward: 5g"
  },
  digger: {
    name: "Hungry Digger", icon: "⛏️", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A burrowing variant. Circumvents the first barrier on its path by digging beneath it. Specializes in undermining fortifications. Not particularly dangerous on its own, but its tunnels weaken the ground — subsequent creatures move faster over disturbed earth.",
    stats: "HP: Below Average | Speed: Average | Reward: 6g"
  },
  geologist: {
    name: "Curious Geologist", icon: "🪨", cls: "🟡 Neutral", clr: "#eab308",
    desc: "Classification note: this beast does not approach the castle. It walks to resource nodes and extracts material, then departs via the nearest exit. It is, in effect, mining. It is doing what we do. The only difference is that we arrived first. Classified as Neutral because it poses no direct threat to the castle — only to our supply lines. Whether this distinction matters is above my clearance.",
    stats: "HP: Standard | Speed: Below Average | Reward: 7g"
  },

  // Bosses
  herald: {
    name: "Proud Herald", icon: "📯", cls: "🔴 Hostile — BOSS", clr: "#ef4444", boss: true,
    desc: "The first of the large ones. It announced its arrival one wave before it appeared. This is either a courtesy or a taunt — the distinction may not exist for this creature. Heavily armored. Slow. Killed without extraordinary difficulty. But it was not trying to be difficult. It was trying to be seen.",
    stats: ""
  },
  fog: {
    name: "Considerate Fog", icon: "🌫️", cls: "🔴 Hostile — BOSS", clr: "#ef4444", boss: true,
    desc: "There is no beast. There is fog. The fog is the boss. I cannot describe this further without sounding unstable. Recommendation: build Watchtowers. Trust your towers to fire at what you cannot see. I am aware of the irony.",
    stats: ""
  },
  auditor: {
    name: "Curious Auditor", icon: "📋", cls: "🟣 Unknown — BOSS", clr: "#a855f7", boss: true,
    desc: "I've classified this one as Unknown because I'm not certain it's hostile. It did not attack the castle. It walked the path and charged us for defending ourselves. Each tower shot cost gold while it was alive. This is not combat. This is taxation. Whether taxation constitutes hostility is a philosophical question I am not equipped to answer.",
    stats: ""
  },
  boss: { // The generic boss entity entry
    name: "The Vanguard", icon: "👑", cls: "🔴 Hostile — BOSS", clr: "#ef4444", boss: true,
    desc: "A towering figure. It demands passage and does not stop for negotiations. Highly durable.",
    stats: ""
  },

  // Allied Towers / Entities
  squirrel: {
    name: "Thoughtful Squirrel", icon: "🐿️", cls: "🟢 Allied", clr: "#22c55e",
    desc: "A trained beast that throws stones at hostiles. Prefers to target the weakest enemy in range — whether this reflects strategy or mercy is debated. Long range. Patient. Has been observed watching the path during prep phase with an expression that I am not qualified to interpret.",
    stats: ""
  },
  lizard: {
    name: "Abhorrent Lizard", icon: "🦎", cls: "🟢 Allied", clr: "#22c55e",
    desc: "Unpredictable. High damage output. CAUTION: the Lizard's attacks accelerate hostile movement. It is unclear whether this is an unintended consequence or whether the Lizard is doing it on purpose. It has been heard vocalizing during combat. Transcription: 'I DESPISE YOU ALL.' Directed at hostiles? At us? Unclear.",
    stats: ""
  },
  monkey: {
    name: "Resourceful Monkey", icon: "🐵", cls: "🟢 Allied", clr: "#22c55e",
    desc: "Our workforce. Capable of carrying materials, boosting production, and following basic instructions. They work without complaint. They work with enthusiasm. I have begun to wonder whether the enthusiasm is authentic or performed. This is not a useful line of inquiry.",
    stats: ""
  },

  // NPCs
  pip: {
    name: "Pip", icon: "🧳", cls: "🟡 Neutral", clr: "#eab308",
    desc: "A merchant. Appears during preparation phases. Sells tools, resources, and information. Origin unknown. Clientele unknown (he references 'other customers' but will not elaborate). The quality of his goods is consistent. The source of his goods is not documented. I have chosen not to investigate.",
    stats: ""
  },
  scribe: {
    name: "The Scribe", icon: "📓", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "A journal that writes itself. The handwriting is consistent across entries but does not match any known personnel. Entries appear between waves, sometimes between sessions. The journal was not requisitioned. It was present when operations began. The inside cover reads 'Version 847.' I do not know what this means. I do not know who writes in it. I suspect I am being documented as thoroughly as I document others.",
    stats: ""
  },
  
  // Mystery Door
  sleepy_door: {
    name: "???", icon: "🚪", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "[This entry is locked. The subject has not been observed. The entry was present when the Bestiary was opened for the first time. It was already here.]",
    stats: ""
  }
};
