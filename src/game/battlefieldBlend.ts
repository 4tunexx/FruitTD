import { Color, MeshBasicMaterial } from 'three';

export type BattlefieldEdgeBlend = 'all-edges' | 'outer-edges';

const SHADOW_TINT = new Color(0x171a1d);

/** Darkens image edges into the surrounding FruitTD charcoal without dimming units or HUD. */
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
      float battleEdgeX = 1.0 - smoothstep(0.0, 0.22, min(battleUv.x, 1.0 - battleUv.x));
      float battleEdgeYDistance = ${mode === 'outer-edges' ? 'battleUv.y' : 'min(battleUv.y, 1.0 - battleUv.y)'};
      float battleEdgeY = 1.0 - smoothstep(0.0, ${mode === 'outer-edges' ? '0.16' : '0.22'}, battleEdgeYDistance);
      float battleCloudShape = sin(battleUv.x * 18.0 + sin(battleUv.y * 11.0)) * cos(battleUv.y * 16.0 + sin(battleUv.x * 9.0));
      float battleCloud = smoothstep(-0.7, 0.9, battleCloudShape);
      float battleEdgeShadow = max(battleEdgeX, battleEdgeY) * mix(0.82, 1.0, battleCloud);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${tint}, battleEdgeShadow);`,
    );
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}:fruittd-cloud-edge-v1:${mode}`;
  material.needsUpdate = true;
  return material;
}
