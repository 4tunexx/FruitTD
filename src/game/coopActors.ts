import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, RingGeometry, SphereGeometry } from 'three';

function makeActor(color: number, trim: number): Group {
  const actor = new Group();
  const body = new Mesh(new CylinderGeometry(0.26, 0.34, 0.7, 8), new MeshLambertMaterial({ color }));
  body.position.y = 0.62;
  const head = new Mesh(new SphereGeometry(0.23, 10, 8), new MeshLambertMaterial({ color: 0xf4d9b3 }));
  head.position.y = 1.17;
  const hood = new Mesh(new ConeGeometry(0.28, 0.32, 8), new MeshLambertMaterial({ color: trim }));
  hood.position.y = 1.42;
  const leftArm = new Mesh(new CylinderGeometry(0.075, 0.095, 0.54, 6), new MeshLambertMaterial({ color }));
  leftArm.position.set(-0.34, 0.76, 0);
  leftArm.rotation.z = -0.4;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.34;
  rightArm.rotation.z = 0.4;
  const blade = new Mesh(new ConeGeometry(0.07, 0.78, 6), new MeshBasicMaterial({ color: trim }));
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
