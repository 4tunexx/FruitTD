import { Camera, Object3D, Quaternion, Vector3 } from 'three';

const parentRotation = new Quaternion();
const cameraRotation = new Quaternion();
const aimDirection=new Vector3();
const cameraInverse=new Quaternion();

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
    const aim=object.userData.combatAim;
    if(aim){
      aimDirection.set(aim.x,0,aim.z).applyQuaternion(cameraInverse.copy(cameraRotation).invert());
      const mechanism=object.children.find(child=>child.name==='turret-aim'||child.name==='tower-mechanism');
      if(mechanism&&aimDirection.lengthSq()>.00001)mechanism.rotation.z=Math.atan2(-aimDirection.x,aimDirection.y);
    }
    object.updateMatrixWorld(true);
  });
}
