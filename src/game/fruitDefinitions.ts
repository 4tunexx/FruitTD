import { applyBalanceRows } from './contentBalance';

export type FruitKind = 'watermelon' | 'lemon' | 'orange' | 'banana' | 'strawberry' | 'pineapple' | 'kiwi' | 'bomb' | 'apple';
export type FruitFamily = 'lemon' | 'berry' | 'melon' | 'bomb';

export interface FruitDef {
  kind: FruitKind; family: FruitFamily; radius: number; speed: number; color: number; emissive: number;
  juice: number; splash: number; score: number; droplets: number; skin: [number, number]; flesh: [number, number];
  stretch: [number, number, number]; hp: number;
}

export const FRUIT_DEFS: Record<FruitKind, FruitDef> = {
  watermelon: { kind: 'watermelon', family: 'melon', radius: 1.05, speed: 2.05, color: 0x3dff7a, emissive: 0x146628, juice: 0xff3355, splash: 0x3ad15c, score: 55, droplets: 280, skin: [0, 0], flesh: [1, 0], stretch: [1, 1, 1], hp: 90 },
  lemon: { kind: 'lemon', family: 'lemon', radius: 0.72, speed: 3.2, color: 0xfff56d, emissive: 0xaa8800, juice: 0xffee33, splash: 0xfff056, score: 12, droplets: 220, skin: [4, 0], flesh: [5, 0], stretch: [1, 0.92, 1.08], hp: 24 },
  orange: { kind: 'orange', family: 'lemon', radius: 0.74, speed: 3.0, color: 0xff8a1a, emissive: 0x883300, juice: 0xff6611, splash: 0xff8a1a, score: 14, droplets: 220, skin: [0, 2], flesh: [1, 2], stretch: [1, 1, 1], hp: 30 },
  banana: { kind: 'banana', family: 'lemon', radius: 0.7, speed: 3.6, color: 0xffe566, emissive: 0x886600, juice: 0xffee88, splash: 0xffe566, score: 16, droplets: 200, skin: [2, 1], flesh: [3, 1], stretch: [0.45, 0.45, 1.35], hp: 26 },
  strawberry: { kind: 'strawberry', family: 'berry', radius: 0.58, speed: 5.1, color: 0xff3d8f, emissive: 0x880044, juice: 0xff2266, splash: 0xff3355, score: 18, droplets: 220, skin: [6, 1], flesh: [3, 3], stretch: [0.9, 1.05, 0.9], hp: 18 },
  pineapple: { kind: 'pineapple', family: 'lemon', radius: 0.82, speed: 2.6, color: 0xffd24d, emissive: 0x886600, juice: 0xffcc33, splash: 0xffd24d, score: 22, droplets: 240, skin: [6, 0], flesh: [7, 0], stretch: [0.85, 1.15, 0.85], hp: 48 },
  kiwi: { kind: 'kiwi', family: 'berry', radius: 0.6, speed: 4.4, color: 0x88aa33, emissive: 0x334400, juice: 0x88ff44, splash: 0x8fbf3a, score: 15, droplets: 200, skin: [2, 2], flesh: [3, 2], stretch: [1, 0.88, 1], hp: 22 },
  bomb: { kind: 'bomb', family: 'bomb', radius: 0.62, speed: 4.0, color: 0x2a1c14, emissive: 0x331100, juice: 0x44ff22, splash: 0x2a2a2a, score: 24, droplets: 160, skin: [6, 2], flesh: [7, 2], stretch: [1, 1, 1], hp: 55 },
  apple: { kind: 'apple', family: 'berry', radius: 0.72, speed: 3.4, color: 0xff3838, emissive: 0x660808, juice: 0xffeebb, splash: 0xff3838, score: 18, droplets: 220, skin: [4, 3], flesh: [5, 3], stretch: [1, 0.95, 1], hp: 26 },
};

const DEFAULT_FRUITS = structuredClone(FRUIT_DEFS);

/** Published balance applies to subsequent spawns; [] restores shipped values. */
export function setFruitBalance(rows: unknown): void {
  applyBalanceRows(FRUIT_DEFS, DEFAULT_FRUITS, rows, {radius:[0.2,3], speed:[0.1,20], hp:[1,100000], score:[0,10000], droplets:[0,500], color:[0,0xffffff], emissive:[0,0xffffff], juice:[0,0xffffff], splash:[0,0xffffff]}, {health:'hp'});
}
