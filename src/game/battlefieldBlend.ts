import { Color, MeshBasicMaterial } from 'three';

export type BattlefieldEdgeBlend = 'all-edges' | 'outer-edges';

const SHADOW_TINT = new Color(0x171a1d);

/** Dissolves image edges into the surrounding FruitTD charcoal without dimming units or HUD. */
export function blendBattlefieldEdges(
  material: MeshBasicMaterial,
  mode: BattlefieldEdgeBlend = 'all-edges',
): MeshBasicMaterial {
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  const tint = `vec3(${SHADOW_TINT.r.toFixed(6)},${SHADOW_TINT.g.toFixed(6)},${SHADOW_TINT.b.toFixed(6)})`;

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec2 battleUv = vMapUv;
      float battleEdgeXDistance = min(battleUv.x, 1.0 - battleUv.x);
      float battleEdgeYDistance = ${mode === 'outer-edges' ? 'battleUv.y' : 'min(battleUv.y, 1.0 - battleUv.y)'};
      float battleEdgeDistance = min(battleEdgeXDistance, battleEdgeYDistance);
      float battleCloudShape = sin(battleUv.x * 18.0 + sin(battleUv.y * 11.0)) * cos(battleUv.y * 16.0 + sin(battleUv.x * 9.0));
      float battleCloud = smoothstep(-0.7, 0.9, battleCloudShape);
      float battleCloudDistance = battleEdgeDistance + battleCloudShape * 0.035;
      float battleEdgeVisibility = smoothstep(-0.025, 0.30, battleCloudDistance) * smoothstep(0.0, 0.035, battleEdgeDistance);
      float battleEdgeShadow = (1.0 - battleEdgeVisibility) * mix(0.78, 1.0, battleCloud);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${tint}, battleEdgeShadow);
      diffuseColor.a *= battleEdgeVisibility;`,
    );
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}:fruittd-cloud-edge-v1:${mode}`;
  material.transparent = true;
  material.depthWrite = false;
  material.needsUpdate = true;
  return material;
}
