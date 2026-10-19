import { Camera, Object3D, Quaternion } from 'three';

const parentRotation = new Quaternion();
const cameraRotation = new Quaternion();

/** Only portrait art rotates; world positions, collision and floor decals stay fixed. */
export function faceCombatPortraits(root: Object3D, camera: Camera): void {
  camera.updateMatrixWorld();
  camera.getWorldQuaternion(cameraRotation);
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!object.userData.combatPortrait) return;
    object.parent?.getWorldQuaternion(parentRotation);
    if (!object.parent) parentRotation.identity();
    object.quaternion.copy(parentRotation.invert()).multiply(cameraRotation);
    if(object.userData.combatRoll)object.rotateZ(object.userData.combatRoll);
    object.updateMatrixWorld(true);
  });
}
