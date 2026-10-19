import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';

export const COMBAT_GOLD = 0xffe394;
export type CombatTokenKind = 'fruit' | 'boss' | 'tower' | 'hero';

/** Temporary portrait frames share one visual language in every battle renderer. */
export function combatTokenFrame(radius: number, kind: CombatTokenKind = 'fruit'): Group {
  const group = new Group();
  group.name = 'combat-token-frame';
  const add = (mesh: Mesh, name: string, z: number) => {
    mesh.name = name;
    mesh.position.z = z;
    mesh.userData.combatFrame = true;
    group.add(mesh);
    return mesh;
  };
  const material = (color: number) => new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, depthWrite: false });
  add(new Mesh(new CircleGeometry(radius * 1.23, 48), material(0x141519)), 'token-back', -.035).renderOrder = -1;
  const rim = add(new Mesh(new RingGeometry(radius * 1.08, radius * 1.19, 48), material(COMBAT_GOLD)), 'token-rim', .015);
  rim.renderOrder = 2;
  const boss = add(new Mesh(new RingGeometry(radius * 1.27, radius * 1.33, 48), material(COMBAT_GOLD)), 'token-boss-rim', .015);
  boss.renderOrder = 2;
  setCombatTokenKind(group, kind);
  return group;
}

export function setCombatTokenKind(frame: Group, kind: CombatTokenKind): void {
  frame.userData.tokenKind = kind;
  const boss = frame.getObjectByName('token-boss-rim');
  if (boss) boss.visible = kind === 'boss';
}
