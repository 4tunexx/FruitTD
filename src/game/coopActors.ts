import { DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, RingGeometry } from 'three';

function makeActor(color: number, trim: number): Group {
  const actor = new Group();
  const body = new Mesh(new PlaneGeometry(0.6, 0.8), new MeshLambertMaterial({ color, side: DoubleSide }));
  body.position.y = 0.62;
  const head = new Mesh(new PlaneGeometry(0.46, 0.46), new MeshLambertMaterial({ color: 0xf4d9b3, side: DoubleSide }));
  head.position.y = 1.17;
  const hood = new Mesh(new PlaneGeometry(0.56, 0.32), new MeshLambertMaterial({ color: trim, side: DoubleSide }));
  hood.position.y = 1.42;
  const leftArm = new Mesh(new PlaneGeometry(0.15, 0.54), new MeshLambertMaterial({ color, side: DoubleSide }));
  leftArm.position.set(-0.34, 0.76, 0);
  leftArm.rotation.z = -0.4;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.34;
  rightArm.rotation.z = 0.4;
  const blade = new Mesh(new PlaneGeometry(0.14, 0.78), new MeshBasicMaterial({ color: trim, side: DoubleSide }));
  blade.position.set(0.49, 0.85, 0);
  blade.rotation.z = -0.72;
  const marker = new Mesh(new RingGeometry(0.37, 0.45, 24), new MeshBasicMaterial({ color: trim, side: 2, transparent: true, opacity: 0.8 }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.035;
  actor.add(body, head, hood, leftArm, rightArm, blade, marker);
  return actor;
}

export class CoopActors {
  readonly group = new Group();
  readonly playerOne = makeActor(0x5da72f, 0xa3e635);
  readonly playerTwo = makeActor(0x2563aa, 0x93c5fd);

  constructor() {
    this.group.add(this.playerOne, this.playerTwo);
    this.group.visible = false;
    this.reset();
  }

  reset(): void {
    this.playerOne.position.set(-3, 0, -5.5);
    this.playerTwo.position.set(3, 0, -5.5);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setPlayerOneColor(color: number): void {
    const body = this.playerOne.children[0] as Mesh;
    (body.material as MeshLambertMaterial).color.setHex(color);
    const leftArm = this.playerOne.children[3] as Mesh;
    const rightArm = this.playerOne.children[4] as Mesh;
    (leftArm.material as MeshLambertMaterial).color.setHex(color);
    (rightArm.material as MeshLambertMaterial).color.setHex(color);
  }

  movePlayerOne(x: number, z: number): void {
    this.playerOne.position.set(x, 0, z);
  }

  movePlayerTwo(x: number, z: number): void {
    this.playerTwo.position.set(x, 0, z);
  }
}
