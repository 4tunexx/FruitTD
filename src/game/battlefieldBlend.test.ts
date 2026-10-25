import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshBasicMaterial } from 'three';
import { blendBattlefieldEdges } from './battlefieldBlend';

test('battlefield map art fades into the platform charcoal with a fixed cloudy edge', () => {
  const material = blendBattlefieldEdges(new MeshBasicMaterial());
  const shader = { vertexShader: '', fragmentShader: '#include <map_fragment>\nvoid main() {}' };

  material.onBeforeCompile(shader as never, {} as never);

  assert.match(shader.fragmentShader, /battleEdgeShadow/);
  assert.match(shader.fragmentShader, /battleCloudShape/);
  assert.match(shader.fragmentShader, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, vec3\(/);
  assert.match(material.customProgramCacheKey(), /fruittd-cloud-edge-v1:all-edges/);
});

test('split PvP maps shade the outer edge without darkening their shared center seam', () => {
  const material = blendBattlefieldEdges(new MeshBasicMaterial(), 'outer-edges');
  const shader = { vertexShader: '', fragmentShader: '#include <map_fragment>\nvoid main() {}' };

  material.onBeforeCompile(shader as never, {} as never);

  assert.match(shader.fragmentShader, /battleEdgeYDistance = battleUv\.y/);
  assert.match(material.customProgramCacheKey(), /fruittd-cloud-edge-v1:outer-edges/);
});
