export const TRANSLATIONS = [
  { text: '...kha...',                          full: false },
  { text: '...eth...',                          full: false },
  { text: '...she...',                          full: false },
  { text: '...we...',                           full: false },
  { text: 'We kha eth.',                        full: true  },
  { text: '...walks...',                        full: false },
  { text: '...we walk...',                      full: false },
  { text: '...she waits...',                    full: false },
  { text: 'We walk because she waits.',         full: true  },
  { text: '...not enemies...',                  full: false },
  { text: '...do not look at the towers...',    full: false },
  { text: 'They are afraid of us.',             full: true  },
];

export const BESTIARY = {
  // Stone Age Enemies
  normal: { 
    name: "Determined Grunt", icon: "👺", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "The most common of the beasts. It walks the path with a steady gait, neither hurried nor hesitant. Observation suggests it does not choose to walk — it simply does, the way water flows downhill. Easily dispatched. Drops: occasional wood scraps.",
  },
  fast: {
    name: "Frantic Scurrier", icon: "👺", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A smaller variant, quick and low to the ground. Moves in bursts — sprinting, pausing, sprinting. It seems afraid, though of what is unclear. It is not afraid of your towers. It was afraid before it arrived.",
  },
  tank: {
    name: "Stubborn Brute", icon: "👹", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Considerably larger than other beasts. Thick-skinned. Slow. It absorbs punishment with what can only be described as indifference. Other creatures walk behind it, as if it is clearing the way. This may be cooperation. We have not confirmed whether the beasts cooperate.",
  },
  berserker: {
    name: "Furious Charger", icon: "😤", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Agitated. Moves with purpose and apparent anger. It is unclear what it is angry about — the towers, the path, or something else entirely. Hits hard if it reaches the walls. Recommend elimination at range.",
  },
  shaman: {
    name: "Whispering Shaman", icon: "🧙", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A beast that vocalizes more than others. The vocalizations are rhythmic — possibly ritualistic. When near other creatures, it seems to... encourage them. Towers adjacent to a Shaman's path report minor calibration drift. Coincidence, presumably.",
  },
  stealth: {
    name: "Quiet Shadow", icon: "👤", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Difficult to observe. The creature does not become invisible — rather, attention slides off it. You look directly at it and your eyes move elsewhere. The Lab's instruments detect it, but the naked eye struggles. Recommend Watchtower or Insightful Seahorse for detection.",
  },
  healer: {
    name: "Gentle Mender", icon: "💚", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "This entry has been revised. Initially classified as hostile. However, the Mender does not attack, does not approach the castle with apparent intent, and directs its energy toward healing nearby creatures — including, on two documented occasions, our own structures. Its allegiance is unclear. It heals indiscriminately. Recommend caution but not malice.",
  },
  swarm: {
    name: "Swarming Mite", icon: "🐜", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "Tiny. Numerous. Individually insignificant. Collectively, they are the most common cause of breach. They do not appear to be the same species as other beasts — they may be parasites, or symbionts, or something else. They die easily. There are always more.",
  },
  shield: {
    name: "Resolute Guardian", icon: "🛡️", cls: "🔴 Hostile", clr: "#ef4444",
    desc: "A beast carrying — or perhaps wearing — a shield of unknown material. The shield absorbs considerable damage before the creature itself is vulnerable. Where did it get the shield? We did not provide it. The shield is not natural. Someone made it. The craftsmanship is disturbingly competent.",
  },
  


  // Bosses
  herald: {
    name: "Proud Herald", icon: "📯", cls: "🔴 Hostile — BOSS", clr: "#ef4444", boss: true,
    desc: "The first of the large ones. It announced its arrival one wave before it appeared. This is either a courtesy or a taunt — the distinction may not exist for this creature. Heavily armored. Slow. Killed without extraordinary difficulty. But it was not trying to be difficult. It was trying to be seen.",
    stats: ""
  },
  fog: {
    name: "Considerate Fog", icon: "🌫️", cls: "🟣 Unknown", clr: "#a855f7", boss: true,
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
  curious_auditor: {
    name: "Curious Auditor", icon: "🏛️", cls: "🟣 Unknown — BOSS", clr: "#ef4444", boss: true,
    desc: "I've classified this one as Unknown because I'm not certain it's hostile. It did not attack the castle. It walked the path and charged us for defending ourselves. Each tower shot cost one gold while it was alive. This is not combat. This is taxation. Whether taxation constitutes hostility is a philosophical question I am not equipped to answer.",
    stats: ""
  },
  patient_watcher: {
    name: "The Patient Watcher", icon: "🔮", cls: "🟣 Unknown — BOSS", clr: "#7c3aed", boss: true,
    desc: "It moved between our towers for what felt like a long time. It never attacked. We thought it was confused. Then someone shot it. It stopped being patient. It didn't attack us until we hurt it. I think that matters.",
    stats: ""
  },
  spider_mother: {
    name: "The Spider Mother", icon: "🕷️", cls: "🟡 Neutral", clr: "#a855f7",
    desc: "She came when the flag was raised and the stone was there. She did not acknowledge the towers. She walked to the stone, took it, and left. The only thing she said was 'thank you.' Just before she disappeared into the forest. She has not been seen since. Neither have any of her children.",
    stats: ""
  },
  grateful_spider: {
    name: "Grateful Spider", icon: "🕷️", cls: "🟢 Allied", clr: "#22c55e",
    desc: "One of hers. Left behind. Perhaps on purpose — the Spider Mother's way of saying the matter was settled. It shoots webs and slows the horde. Once per wave it will coat a stretch of path in silk. We did not train it. It already knew what to do.",
    stats: ""
  },

  // Allied Towers / Entities
  squirrel: {
    name: "Thoughtful Squirrel", icon: "🐿️", cls: "🟢 Allied", clr: "#22c55e",
    desc: "A trained creature that throws stones at the beasts. Prefers to target the weakest enemy. Long range. Patient. Has been observed watching the path during prep phase with an expression that I am not qualified to interpret.",
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
  clown: {
    name: "Magnificent Clown", icon: "🤡", cls: "🟢 Allied", clr: "#22c55e",
    desc: "It reverses them. They walk forward, and then they walk backward, and then they walk forward again. The Clown finds this hilarious.",
    stats: ""
  },

  // NPCs
  pip: {
    name: "Pip", icon: "🧳", cls: "🟡 Neutral", clr: "#eab308",
    desc: "A merchant. Appears during preparation phases. Sells tools, resources, and information. Origin unknown. Clientele unknown (he references 'other customers' but will not elaborate). The quality of his goods is consistent. The source of his goods is not documented. I have chosen not to investigate.",
    stats: ""
  },
  
  geologist: {
    name: "Fascinated Geologist", icon: "💎", cls: "🟡 Neutral", clr: "#a78bfa",
    desc: "It does not attack. It does not appear to notice us at all. It walks with purpose — stopping at interesting tiles, pocketing whatever it finds with an air of professional detachment. Our best attempts at communication have produced only a faint gemstone-clinking sound. It is unclear whether it understands it is on a battlefield. It takes what it finds. It leaves from where it came. It has never been observed to deal damage to the walls. Some staff have started calling it 'the collector'. The name has stuck.",
  },
  spider: {
    name: "Yearning Spider", icon: "🕷️", cls: "🔴 Hostile", clr: "#8b5cf6",
    desc: "Large, slow, and quiet. It moves with an odd deliberateness — not threatening, but focused, as if it has somewhere important to be. When killed, it does something extraordinary: the body ruptures and smaller, frantic versions scatter outward. They quickly orient themselves and resume the path, sometimes at a more advanced point than the original. Research has not determined what they 'yearn' for. The scribe insists the name is correct.",
  },

  // Mystery Door
  sleepy_door: {
    name: "???", icon: "🚪", cls: "🟣 Unknown", clr: "#a855f7",
    desc: "[This entry is locked. The subject has not been observed. The entry was present when the Bestiary was opened for the first time. It was already here.]",
    stats: ""
  }
};

// Returns the scribe's entry for a specific wave number, or null if none.
// Used by the feed log to post entries as they unlock.
export function getScribeEntry(wave, state) {
  const hasLab = state.towers?.some(t => t.type === 'lab') || state.bSen?.has('lab');
  const entries = {
    1:  () => 'I should start writing again. One more time.',
    3:  () => hasLab ? 'They built a lab.' : null,
    5:  () => 'The first boss. They survived. They always survive the first one.',
    8:  () => null,
    10: () => !hasLab ? "No lab yet. Interesting. Most build one. Whatever they know that the others didn\u2019t, I hope it\u2019s worth knowing." : "They\u2019re building faster now. It\u2019s beautiful in a way. The way an avalanche is beautiful.",
    12: () => 'The ground shook. It always shakes at this point.',
    15: () => "The fog came. You can't fight fog. The towers kept shooting, but they were shooting at their own shadows.",
    17: () => state.bSen?.has('curious_auditor') ? "After the fog, something new. It didn't kill \u2014 it taxed. Every shot cost them. Some stopped shooting. I don't know if that was wise or cowardice." : null,
    23: () => 'They translated the first sounds. Give it time.',
    20: () => `The Ledger appeared. The number was ${state._kills || 0}. I wrote it down.`,
    22: () => "There was a sound. ~40Hz. It didn't come from the goblins. The Lab recorded it. No one else reacted. We are beginning to think the Lab understands something we don't.",
    25: () => null,
    32: () => state.bSen?.has('patient_watcher') && state.watcherEscaped ? "It left. Untouched. We stared at it for thirty seconds and it walked out the back. I've never seen anything leave before." : state.bSen?.has('patient_watcher') && !state.watcherEscaped ? "It moved like it had nowhere to be. Then they hurt it. That was a mistake." : null,
  };
  return entries[wave]?.() ?? null;
}

export function getScribeLogs(state) {
  const w = state.wave || 0;
  let logs = [];
  if (w >= 2) logs.push({ w: 'Wave 1', t: 'I should start writing again. One more time.' });
  if (w >= 4) {
    const hasLab3 = state.towers?.some(t => t.type === 'lab') || state.bSen?.has('lab');
    if (hasLab3) logs.push({ w: 'Wave 3', t: 'They built a lab.' });
  }
  if (w >= 6) logs.push({ w: 'Wave 5', t: "The first boss. They survived. They always survive the first one." });
  if (w >= 11) {
    const hasLab10 = state.towers?.some(t => t.type === 'lab') || state.bSen?.has('lab');
    logs.push({ w: 'Wave 10', t: !hasLab10 ? "No lab yet. Interesting. Most build one. Whatever they know that the others didn't, I hope it's worth knowing." : "They're building faster now. It's beautiful in a way. The way an avalanche is beautiful." });
  }
  if (w >= 13) logs.push({ w: 'Wave 12', t: "The ground shook. It always shakes at this point." });
  if (w >= 16) logs.push({ w: 'Wave 15', t: "The fog came. You can't fight fog. The towers kept shooting, but they were shooting at their own shadows." });
  if (w >= 24) logs.push({ w: 'Wave 23', t: 'They translated the first sounds. Give it time.' });
  if (w >= 21) logs.push({ w: 'Wave 20', t: `The Ledger appeared. The number was ${(state._kills||0)}. I wrote it down.` });
  if (w >= 23) logs.push({ w: 'Wave 22', t: "There was a sound. ~40Hz. It didn't come from the goblins. The Lab recorded it. No one else reacted. We are beginning to think the Lab understands something we don't." });
  if (w >= 18 && state.bSen?.has('curious_auditor')) logs.push({ w: '~Wave 17', t: "After the fog, something new. It didn't kill — it taxed. Every shot cost them. Some stopped shooting. I don't know if that was wise or cowardice." });
  if (w >= 27 && state.bSen?.has('spider')) logs.push({ w: '~Wave 24', t: "The spiders arrived. They didn't go for the towers. They went for something we hadn't built yet." });
  if (w >= 30 && state.bSen?.has('patient_watcher') && state.watcherEscaped) logs.push({ w: '~Wave 30', t: "It left. Untouched. It moved between our walls for thirty seconds and no one fired. I've never seen anything leave before." });
  if (w >= 30 && state.bSen?.has('patient_watcher') && !state.watcherEscaped) logs.push({ w: '~Wave 30', t: "It moved like it had nowhere to be. Then they hurt it. That was a mistake. Once hurt, it came for the gate like everything else." });
  if (w >= 30 && state.spiderRitualDone) logs.push({ w: 'Ritual', t: "She came. She took what she needed. She said thank you. The old builders knew this would happen. They always did. There are no more spiders." });
  else if (w >= 35 && state.bSen?.has('spider') && !state.spiderRitualDone) logs.push({ w: '~Wave 35+', t: "The spiders keep coming. The flag was never raised. The stone was never made. It will keep happening." });
  if (w >= 40) logs.push({ w: 'Wave 39', t: "They are coming for the stones. All of them, this time." });
  if (w >= 41) logs.push({ w: 'Wave 40', t: "Every last one. Collectors, to the core. The Weight of Bones." });

  if (logs.length === 0) return "";
  
  const html = logs.map(l => 
    `<div style="display:flex; gap:16px; padding-bottom:12px; border-bottom:1px solid rgba(168,85,247,0.2);">
      <div style="min-width:75px; font-weight:bold; color:#c084fc;">${l.w}</div>
      <div style="flex:1; line-height:1.4;">${l.t}</div>
    </div>`
  ).join('');

  return `<div class='scribe-logs' style='margin-top:4px; padding:12px; background:rgba(0,0,0,0.2); border-left:3px solid #a855f7; border-radius:4px; font-family:"Courier New", Courier, monospace; font-size:14px; color:#e2e8f0; display:flex; flex-direction:column; gap:12px;'>${html}</div>`;
}
