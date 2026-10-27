import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Matrix4,Vector3} from 'three';
import {JuiceSystem} from './juice';

test('PvP juice remains at deaths beyond the Casual arena bounds',()=>{
  const juice=new JuiceSystem(100,200);
  juice.burst(0,1,40,'orange',new Vector3(1,0,0));
  juice.update(1/60);
  const matrix=new Matrix4();juice.mesh.getMatrixAt(0,matrix);
  const position=new Vector3().setFromMatrixPosition(matrix);
  assert.ok(position.z>39 && position.z<41);
  juice.reset();juice.update(0);juice.mesh.getMatrixAt(0,matrix);
  assert.equal(new Vector3().setFromMatrixPosition(matrix).y,-20);
  juice.mesh.geometry.dispose();(juice.mesh.material as import('three').MeshBasicMaterial).dispose();
});
