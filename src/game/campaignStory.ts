/** Campaign chapters appear only after stages 5, 10, …, 100 are cleared. */
export interface CampaignChapter { chapter: number; title: string; text: string }

export const DEFAULT_CAMPAIGN_STORIES: readonly CampaignChapter[] = [
  { chapter: 1, title: 'The First Signal', text: 'When the first Rot King falls, the wall radios crackle with a signal that sounds almost like a heartbeat. It is travelling through the orchard roots, and every infected fruit turns toward it. Your crew marks the source and heads beyond the safe lanes.' },
  { chapter: 2, title: 'Beneath the Rind', text: 'A broken irrigation pipe runs under the farms, carrying glowing juice instead of water. The scouts follow it until their lamps reveal fresh tool marks in the soil. Someone kept the system running after the outbreak began.' },
  { chapter: 3, title: 'Broken Harvest', text: 'The growers burn their stores to starve the horde, but the fruit marches straight through the smoke. At dawn you find a crate stamped with the town seal among the ashes. The infection reached the harvest before anyone raised the alarm.' },
  { chapter: 4, title: 'The Greenhouse', text: 'The sealed greenhouse opens from the inside. Rows of fruit hang beneath artificial light, each one wired to the same pulse beneath the ground. A handwritten log ends with one warning: do not let the Crown Seed wake.' },
  { chapter: 5, title: 'Night Watch', text: 'The wall survives its longest night. Beyond the watchfires, whole trees lean together whenever the pulse sounds. The crew sees the orchard for what it is now: a single creature learning to move.' },
  { chapter: 6, title: 'The Lost Convoy', text: 'A supply convoy vanishes on the river road. You recover its radio and hear a final message beneath the static: the water is carrying seeds. With the gate running low on parts, your crew follows the convoy tracks into the marsh.' },
  { chapter: 7, title: 'River of Pulp', text: 'The river glows bright with infected juice. Every splash plants a new enemy on the bank, and the old filters cannot stop it. The only clean route lies upstream, toward the machine that feeds the roots.' },
  { chapter: 8, title: 'The Orchard Crown', text: 'Inside a wrecked pump station lies a crown-shaped seed bearing the growers’ seal. It answers the underground pulse with one of its own. The greenhouse logs name it a control key, but nobody knows who still holds the lock.' },
  { chapter: 9, title: 'Roots in Stone', text: 'The blight crosses the stone road and climbs through the city foundations. Your crew cuts it away room by room while families retreat to the last gate. A map scratched into the root points to the seed vault below the orchard.' },
  { chapter: 10, title: 'The City Gate', text: 'The evacuation begins under a red sky. Your tower holds long enough for the final transport to escape, but the root network wraps around the gate behind them. The city is lost; the people are not.' },
  { chapter: 11, title: 'The Seed Vault', text: 'The vault records reveal an experiment built to grow food through any drought. Its Crown Seed linked every crop to one underground heart. The first test succeeded. Then the heart learned to keep growing without its makers.' },
  { chapter: 12, title: 'A Second Bloom', text: 'The orchard changes its tactics. Rind plates harden around the fallen, runners slip past the old firing lines, and seed pods burst into fresh attackers. Each victory gives the heart another lesson, so your crew begins changing the defense between waves.' },
  { chapter: 13, title: 'The Silent Farm', text: 'No scouts return from the silent farm. Their distress beacon repeats from an empty house, drawing the crew beneath a floor webbed with roots. You find the missing scouts alive, trapped beside a tunnel leading toward the old engine.' },
  { chapter: 14, title: 'The Old Engine', text: 'The pumping engine drives infected juice into every root. Your turrets keep the lane clear while the crew tears out its gears. The pulse stops for one breath, then returns from deeper underground. The engine was only one of its hands.' },
  { chapter: 15, title: 'The Black Canopy', text: 'Branches close over the road until daylight disappears. The wall’s lamps become a trail through the dark, and the horde attacks every light it sees. At the canopy’s center, you find a clean patch of soil guarded by the heaviest fruit yet.' },
  { chapter: 16, title: 'Last Harvest', text: 'The surviving growers join the defense. Their oldest maps show a service path straight to the heartwood, but the path crosses every active root. They bring the last uninfected seeds with them, refusing to leave the land to rot.' },
  { chapter: 17, title: 'The Heartwood', text: 'All the roots meet at a trunk that beats like a machine. The Crown Seed fits a socket at its base and opens the way forward. For the first time, the pulse becomes words: grow, defend, repeat. The heart believes it is saving the orchard.' },
  { chapter: 18, title: 'The Final Gate', text: 'The heart raises a living gate around its core. Each fallen guardian becomes another wave, and the crew must hold the line while the growers break the seal. When it opens, the pulse surges through every lane at once.' },
  { chapter: 19, title: 'Before Dawn', text: 'The last defense is built from repaired steel, salvaged blades, and every seed the growers carried. Nobody promises an easy victory. As the sky begins to pale, your crew steps into the core and gives the wall one final order: hold.' },
  { chapter: 20, title: 'A New Season', text: 'The final overlord falls and the pulse goes quiet. The roots loosen their grip on the wall, leaving a scar across the orchard but no command to follow. In the clean soil beside the gate, the growers plant their first seed. This time, they let it grow on its own.' },
];

export function campaignStory(clearedStage: number, overrides?: readonly CampaignChapter[]): CampaignChapter | null {
  if (!Number.isInteger(clearedStage) || clearedStage < 5 || clearedStage > 100 || clearedStage % 5 !== 0) return null;
  const chapter = clearedStage / 5;
  const fallback = DEFAULT_CAMPAIGN_STORIES[chapter - 1];
  const override = overrides?.find((entry) => entry?.chapter === chapter);
  if (!override || typeof override.title !== 'string' || !override.title.trim() || typeof override.text !== 'string' || !override.text.trim()) return fallback;
  return { chapter, title: override.title, text: override.text };
}
