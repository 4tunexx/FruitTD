export const ARENA_W = 22;
export const ARENA_D = 28;
export const MAX_LIVES = 15;
export const MAX_TOWER_LEVEL = 10;
export const PARTICLE_CAP = 180;
export const DROPLETS_PER_SLICE = 12;
export const DROPLETS_MELON = 18;
export const SIM_DT = 1 / 60;
export const IMPACT_FREEZE = 1 / 60;
export const SLICE_Y = 0.75;
export const WALL_Z = -9.2;
export const EXTRA_Z = -7.85;
export const LEAK_Z = -7.5;
export const TILE = 1.4;

export interface PadDef { x: number; z: number; main: boolean; floor: boolean; }
function buildPads(): PadDef[] {
  return [
    { x:-6.2, z:WALL_Z, main:false, floor:false }, { x:-3.8, z:WALL_Z, main:false, floor:false },
    { x:0, z:WALL_Z, main:true, floor:false }, { x:3.8, z:WALL_Z, main:false, floor:false },
    { x:6.2, z:WALL_Z, main:false, floor:false }, { x:-4.8, z:EXTRA_Z, main:false, floor:true },
    { x:-2.2, z:EXTRA_Z, main:false, floor:true }, { x:2.2, z:EXTRA_Z, main:false, floor:true },
    { x:4.8, z:EXTRA_Z, main:false, floor:true },
  ];
}
export const PADS: PadDef[] = buildPads();
export const MAIN_INDEX = PADS.findIndex((p) => p.main);
export function slotIndexAt(x:number,z:number):number { let best=-1,bestD=0.72; for(let i=0;i<PADS.length;i++){const d=Math.hypot(x-PADS[i].x,z-PADS[i].z);if(d<bestD){bestD=d;best=i;}} return best; }
export function slicerCost():number { return 50; }
export function upgradeCost(level:number):number|null { if(level>=MAX_TOWER_LEVEL)return null; return 30 + level*25 + Math.max(0, level-1)*10; }
export function towerStats(level:number,main:boolean):{range:number;damage:number;fireRate:number} {
  const lv=Math.min(MAX_TOWER_LEVEL,Math.max(1,level)); const mul=main?1:0.72;
  return { range:(main?5.2:3.6)+lv*0.45, damage:Math.round((main?10:7)+lv*4*mul), fireRate:(main?1.05:0.85)+lv*0.12 };
}
