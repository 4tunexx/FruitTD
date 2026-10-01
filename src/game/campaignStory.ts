/** A short, authored chapter after each five-stage campaign sector. */
const CHAPTERS: readonly [string, string][] = [
  ['The First Signal', 'The fallen orchard was no accident. A pulse is travelling through its roots.'],
  ['Beneath the Rind', 'Your scouts uncover a buried irrigation line carrying the blight toward the town.'],
  ['Broken Harvest', 'The old farms burn their stores, but infected fruit keeps marching through the smoke.'],
  ['The Greenhouse', 'A sealed greenhouse opens from within. Someone has been growing the outbreak.'],
  ['Night Watch', 'The wall survives a long night. Beyond it, the trees begin to move together.'],
  ['The Lost Convoy', 'A supply convoy never reached the gate. Its last radio call came from the river.'],
  ['River of Pulp', 'The river runs bright with juice. Purifying it will take more than sharp blades.'],
  ['The Orchard Crown', 'A crown-shaped seed appears in the wreckage, marked with the old growers’ seal.'],
  ['Roots in Stone', 'The infection has crossed stone roads and climbed into the city foundations.'],
  ['The City Gate', 'Families shelter behind the last gate. Hold it while the evacuation begins.'],
  ['The Seed Vault', 'Records in the seed vault point to a forgotten experiment beneath the orchard.'],
  ['A Second Bloom', 'The blight learns from every defeat. New growth wraps the fallen in harder armor.'],
  ['The Silent Farm', 'No scouts return from the silent farm. Only a repeating distress signal remains.'],
  ['The Old Engine', 'An ancient pumping engine still feeds the roots. Cut its supply and press on.'],
  ['The Black Canopy', 'The sky vanishes beneath the canopy. The wall’s lamps guide the next advance.'],
  ['Last Harvest', 'The surviving growers join the defense, carrying maps of the orchard’s heart.'],
  ['The Heartwood', 'Every corrupted root leads here. The heartwood beats like a machine.'],
  ['The Final Gate', 'The path to the source opens, but the largest horde yet waits at its threshold.'],
  ['Before Dawn', 'Your crew prepares one last defense. At sunrise, there will be no retreat.'],
  ['A New Season', 'The source falls silent. The wall stands, and the first clean seed takes root.'],
];

export function campaignStory(clearedStage: number): { chapter: number; title: string; text: string } | null {
  if (!Number.isInteger(clearedStage) || clearedStage < 5 || clearedStage > 100 || clearedStage % 5 !== 0) return null;
  const chapter = clearedStage / 5;
  const [title, text] = CHAPTERS[chapter - 1];
  return { chapter, title, text };
}
