export type SkillId = 'edge' | 'reach' | 'flow' | 'steel' | 'storm';

export interface SkillDef {
  id: SkillId;
  name: string;
  blurb: string;
  max: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'edge', name: 'Edge', blurb: 'Your slash hits harder.', max: 3 },
  { id: 'reach', name: 'Reach', blurb: 'Wider cut. Easier multi-hits.', max: 3 },
  { id: 'flow', name: 'Flow', blurb: 'Super juice fills faster.', max: 3 },
  { id: 'steel', name: 'Steel', blurb: 'Turrets deal more damage.', max: 3 },
  { id: 'storm', name: 'Storm', blurb: 'Super blow wrecks a bigger pack.', max: 3 },
];

export type SkillMap = Record<SkillId, number>;

export function emptySkills(): SkillMap {
  return { edge: 0, reach: 0, flow: 0, steel: 0, storm: 0 };
}

export function skillRank(skills: SkillMap, id: SkillId): number {
  return skills[id] ?? 0;
}
