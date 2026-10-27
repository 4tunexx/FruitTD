import { applyPowerStatus, applyWeaponStatus, tickBurn, type CombatStatus } from './combatStatus';
import { turretAllowed } from './turretLoadout';
import { turretVictims } from './turretTargets';
import { mapPowerEnvelope, equippedPower, powerTargets, powerDamageMultiplier, appendPowerCast, type PowerCast } from './powerCombat';
import { pvpTowerLevel, pvpTowerStats, pvpUpgradeCost, pvpSellRefund, PVP_MAX_TOWER_LEVEL, type PvpConfig } from './pvp';
import type { HeroId } from './heroes';
import { towerLevelFromXp } from './towerProgression';
export interface CoopPlayer { turretLoadout?:string[]; userId: string; name: string; hero: HeroId; abilityLoadout?: string[]; abilityRanks?: Record<string, number>; abilityReadyAt?: Record<string, number>; sequence: number; lastSeenAt: number; lastSlashAt: number; kills: number; lastStroke?: { from: Point; to: Point; at: number } }
export interface Point { x: number; y: number }
export interface CoopFruit extends CombatStatus { id: string; type: string; x: number; y: number; hp: number; maxHp?:number; sliceOnly?:boolean; slowUntil?:number; slowMultiplier?:number; boss: boolean }
export interface CoopMatch { proposal?: { id:string; command:{type:'build';tower:string;cell:number}|{type:'upgrade'|'sell';towerId:string}; proposerId:string; approvals:string[]; rejections:string[]; expiresAt:number }; lastSpend?:{userId:string;label:string;cost:number;at:number}; wallMaxHealth?:number; towerXp?: number; powerCasts?: PowerCast[]; id: string; revision: number; status: 'waiting'|'countdown'|'playing'|'boss-intro'|'complete'; phaseUntil: number; players: CoopPlayer[]; wave: number; wallHealth: number; fruts: number; score: number; kills: number; fruits: CoopFruit[]; remainingSpawns: number; spawnAt: number; serial: number; towers: Array<{ id: string; type: string; cell: number; lastFiredAt: number; level?:number }>; mainLastFiredAt: number; completedWaves: number; reason?: string }
export interface CoopConfig { bossEveryWaves: number; baseWaveSize: number; extraPerWave: number; spawnGapMs: number; intermissionMs: number; bossIntroMs: number; coinsPerKill: number; coinsPerWave: number; gemsEveryWaves: number; xpPerKill: number; towerXpPerWave: number; rewardCoinCap: number; bladeDamage: number; bladeRadius: number; bladeCooldownMs: number; bossHealthMultiplier: number; bossSpeedMultiplier: number; fruitSpeedMultiplier: number }
export const DEFAULT_COOP_CONFIG: CoopConfig = { bossEveryWaves: 6, baseWaveSize: 10, extraPerWave: 2, spawnGapMs: 700, intermissionMs: 2200, bossIntroMs: 5500, coinsPerKill: 1, coinsPerWave: 10, gemsEveryWaves: 5, xpPerKill: 2, towerXpPerWave: 25, rewardCoinCap: 3000, bladeDamage: 35, bladeRadius: .65, bladeCooldownMs: 100, bossHealthMultiplier: 12, bossSpeedMultiplier: .35, fruitSpeedMultiplier: .65 };
export function normalizeCoopConfig(raw: unknown): CoopConfig {
  const row = raw && typeof raw === 'object' ? raw as Partial<CoopConfig> : {};
  return Object.fromEntries(Object.entries(DEFAULT_COOP_CONFIG).map(([key, fallback]) => {
    const value = Number(row[key as keyof CoopConfig]);
    const fractional = key.endsWith('Multiplier') || key === 'bladeRadius';
    const zeroAllowed = ['extraPerWave', 'coinsPerKill', 'coinsPerWave', 'xpPerKill', 'towerXpPerWave', 'rewardCoinCap'].includes(key);
    const min = fractional ? .05 : zeroAllowed ? 0 : key.includes('Ms') ? 100 : 1;
    const max = key.includes('Ms') ? 60000 : key === 'rewardCoinCap' ? 10000 : key === 'bladeDamage' ? 1000 : key === 'bladeRadius' ? 2 : 100;
    return [key, Number.isFinite(value) ? Math.max(min, Math.min(max, fractional ? value : Math.floor(value))) : fallback];
  })) as unknown as CoopConfig;
}
export function newCoopMatch(id: string, player: CoopPlayer, balance: PvpConfig): CoopMatch { return { towerXp: 0, id, revision: 0, status: 'waiting', phaseUntil: 0, players: [player], wave: 1, wallHealth: balance.wallHealth, wallMaxHealth:balance.wallHealth, fruts: 100, score: 0, kills: 0, fruits: [], remainingSpawns: 0, spawnAt: 0, serial: 0, towers: [], mainLastFiredAt: 0, completedWaves: 0 }; }
export const COOP_MAX_PLAYERS=4;
export function joinCoopMatch(match: CoopMatch, player: CoopPlayer, now: number): void {
  if(match.status!=='waiting'||match.players.length>=COOP_MAX_PLAYERS||match.players.some(p=>p.userId===player.userId)) throw new Error('Room is unavailable.');
  match.players.push(player);
  if(match.players.length===COOP_MAX_PLAYERS){match.status='countdown';match.phaseUntil=now+3000;}
  match.revision++;
}
export type CoopCommand = {type:'start'} | { type:'slash'; from:Point; to:Point } | { type:'build'; tower:string; cell:number } | { type:'ability'; abilityId:string } | { type:'leave' } | {type:'upgrade'|'sell';towerId:string} | {type:'vote';proposalId:string;approve:boolean};
type SpendingCommand=Extract<CoopCommand,{type:'build'|'upgrade'|'sell'}>;
function spend(match:CoopMatch,player:CoopPlayer,command:SpendingCommand,now:number,balance:PvpConfig):void {
  if(command.type==='build'){
    if(!turretAllowed(command.tower,player.turretLoadout))throw new Error('Equip this turret in Inventory before the match.');
    const stats=balance.towers[command.tower];if(!stats||!Number.isInteger(command.cell)||command.cell<121||command.cell>128||match.towers.some(t=>t.cell===command.cell))throw new Error('Choose an empty wall pad.');
    if(match.fruts<stats.cost)throw new Error('Not enough shared Fruts.');
    match.fruts-=stats.cost;match.towers.push({id:`${match.id}:${command.cell}`,type:command.tower,cell:command.cell,lastFiredAt:now,level:1});match.lastSpend={userId:player.userId,label:`Built ${command.tower}`,cost:stats.cost,at:now};
  }else{
    const tower=match.towers.find(t=>t.id===command.towerId);const base=tower&&balance.towers[tower.type];if(!tower||!base)throw new Error('Choose a shared tower.');
    const level=pvpTowerLevel(tower.level);
    if(command.type==='upgrade'){if(level>=PVP_MAX_TOWER_LEVEL)throw new Error('Tower is fully upgraded.');const cost=pvpUpgradeCost(base.cost,level);if(match.fruts<cost)throw new Error('Not enough shared Fruts.');match.fruts-=cost;tower.level=level+1;match.lastSpend={userId:player.userId,label:`Upgraded ${tower.type}`,cost,at:now};}
    else{const refund=pvpSellRefund(base.cost,level);match.fruts+=refund;match.towers=match.towers.filter(t=>t!==tower);match.lastSpend={userId:player.userId,label:`Sold ${tower.type}`,cost:-refund,at:now};}
  }
}
function voteRequired(match:CoopMatch,command:SpendingCommand,balance:PvpConfig):boolean {
  if(match.players.length<2)return false;
  if(command.type==='sell')return true;
  if(command.type==='build')return (balance.towers[command.tower]?.cost??0)>=150;
  const tower=match.towers.find(t=>t.id===command.towerId);return tower? pvpUpgradeCost(balance.towers[tower.type]?.cost??0,tower.level)>=150:false;
}
const distance = (p:Point, a:Point, b:Point) => { const dx=b.x-a.x,dy=b.y-a.y; const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))); return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy); };
export function applyCoopCommand(match:CoopMatch,userId:string,sequence:number,command:CoopCommand,now:number,balance:PvpConfig,config:CoopConfig=DEFAULT_COOP_CONFIG):void {
  const player=match.players.find(p=>p.userId===userId); if(!player) throw new Error('Not a room member.');
  if(!Number.isSafeInteger(sequence)||sequence!==player.sequence+1) throw new Error('Stale command. Refresh the match.');
  if(command.type==='start') {
    if(match.status!=='waiting'||match.players[0]?.userId!==userId||match.players.length<2)throw new Error('The host can start with two to four players.');
    match.status='countdown';match.phaseUntil=now+3000;
  }
  else if(command.type==='leave') {
    if(match.status==='waiting'&&match.players[0]?.userId!==userId)match.players=match.players.filter(member=>member.userId!==userId);
    else if(match.status==='waiting'||match.players.length===1){match.status='complete';match.reason='left';}
    else {match.players=match.players.filter(member=>member.userId!==userId);match.proposal=undefined;}
  }
  else {
    if(match.status!=='playing'&&match.status!=='boss-intro'&&!(match.status==='countdown'&&['build','upgrade','sell','vote'].includes(command.type))) throw new Error('Wait for the match to start.');
    if(command.type==='build'||command.type==='upgrade'||command.type==='sell') {
      if(command.type==='build'){
        if(!balance.towers[command.tower])throw new Error('Choose a tower.');
        if(!turretAllowed(command.tower,player.turretLoadout))throw new Error('Equip this turret in Inventory before the match.');
        if(!Number.isInteger(command.cell)||command.cell<121||command.cell>128||match.towers.some(t=>t.cell===command.cell))throw new Error('Choose an empty wall pad.');
      }else{
        const tower=match.towers.find(t=>t.id===command.towerId);
        if(!tower||!balance.towers[tower.type])throw new Error('Choose a shared tower.');
        if(command.type==='upgrade'&&pvpTowerLevel(tower.level)>=PVP_MAX_TOWER_LEVEL)throw new Error('Tower is fully upgraded.');
      }
      if(voteRequired(match,command,balance)){
        if(match.proposal&&match.proposal.expiresAt>now)throw new Error('A team vote is already open.');
        match.proposal={id:`${userId}:${sequence}`,command,proposerId:userId,approvals:[userId],rejections:[],expiresAt:now+6000};
      }else spend(match,player,command,now,balance);
    } else if(command.type==='vote') {
      const proposal=match.proposal;if(!proposal||proposal.id!==command.proposalId||proposal.expiresAt<=now)throw new Error('That vote has expired.');
      if(proposal.approvals.includes(userId)||proposal.rejections.includes(userId))throw new Error('You already voted.');
      (command.approve?proposal.approvals:proposal.rejections).push(userId);
      const majority=Math.floor(match.players.length/2)+1;
      if(proposal.approvals.length>=majority){match.proposal=undefined;const proposer=match.players.find(p=>p.userId===proposal.proposerId);if(!proposer)throw new Error('Proposer left the room.');spend(match,proposer,proposal.command,now,balance);}
      else if(proposal.rejections.length>=majority)match.proposal=undefined;
    } else if(command.type==='ability') {
      const {ability,stats}=equippedPower(command.abilityId,player.hero,player.abilityLoadout,player.abilityRanks);
      if(now<(player.abilityReadyAt?.[ability.id]??0))throw new Error('That power is cooling down.');
      if(match.fruts<stats.cost)throw new Error('Not enough shared Fruts.');
      const envelope=mapPowerEnvelope({x:5,y:13.5},{minX:0,maxX:10,minY:0,maxY:14});
      const targets=powerTargets(match.fruits.filter(f=>f.hp>0&&f.type!=='explosive'&&!f.sliceOnly),ability,f=>f,envelope);
      if(!targets.length&&(!stats.healFraction||match.wallHealth>=(match.wallMaxHealth??balance.wallHealth)))throw new Error('No vulnerable targets.');
      match.fruts-=stats.cost;player.abilityReadyAt??={};player.abilityReadyAt[ability.id]=now+stats.cooldownMs;
      match.wallHealth=Math.min(match.wallMaxHealth??balance.wallHealth,match.wallHealth+(match.wallMaxHealth??balance.wallHealth)*stats.healFraction);
      match.powerCasts=appendPowerCast(match.powerCasts,{id:`${userId}:${sequence}`,abilityId:ability.id,at:now,rank:stats.rank,targets:targets.map(f=>({x:f.x,y:f.y}))});
      for(const fruit of targets){applyPowerStatus(fruit,ability,now,stats.slowMs,stats.damage);fruit.hp-=stats.damage*powerDamageMultiplier(fruit,envelope);if(stats.slowMs){fruit.slowUntil=Math.max(fruit.slowUntil??0,now+stats.slowMs);fruit.slowMultiplier=stats.slowMultiplier;}}
      const killed=match.fruits.filter(f=>f.hp<=0);player.kills+=killed.length;collectKills(match,balance);
    } else if(command.type==='slash') {
      for(const p of [command.from,command.to]) if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>10||p.y<0||p.y>14) throw new Error('Invalid blade stroke.');
      if(Math.hypot(command.from.x-command.to.x,command.from.y-command.to.y)<.15||now-player.lastSlashAt<config.bladeCooldownMs) throw new Error('Swipe across the fruit.');
      player.lastSlashAt=now; player.lastStroke={from:command.from,to:command.to,at:now};
      for(const fruit of match.fruits) if(distance(fruit,command.from,command.to)<=config.bladeRadius) {
        if(fruit.type==='explosive')match.wallHealth=Math.max(0,match.wallHealth-Math.max(1,Math.round((balance.attacks.explosive?.wallDamage??0)*.2)));
        else fruit.hp-=config.bladeDamage;
      }
      const killed=match.fruits.filter(f=>f.hp<=0); player.kills+=killed.length;
      collectKills(match,balance);
    } else throw new Error('Unsupported command.');
  }
  if(match.wallHealth<=0&&match.status!=='complete'){match.status='complete';match.reason='wall';}
  player.sequence=sequence; player.lastSeenAt=now; match.revision++;
}
function collectKills(match:CoopMatch,balance:PvpConfig):void { for(const f of match.fruits.filter(f=>f.hp<=0)) {match.kills++;match.score+=f.boss?300:10;match.fruts+=balance.attacks[f.type]!.rewardFruts;} match.fruits=match.fruits.filter(f=>f.hp>0); }
export function coopFruitMaxHealth(baseHealth:number,boss:boolean,wave:number,players:number,config:CoopConfig):number {
  return baseHealth*(boss?config.bossHealthMultiplier*Math.max(1,players/2):1)*(1+Math.floor(wave/8)*.2);
}
export function coopMainStats(match:Pick<CoopMatch,'towerXp'>,balance:PvpConfig) {
  const upgrades=towerLevelFromXp(match.towerXp??0)-1;
  return {...balance.mainTower,damage:Math.round(balance.mainTower.damage*(1+upgrades*.1)),range:balance.mainTower.range+upgrades*.2};
}
export function advanceCoopMatch(match:CoopMatch,dt:number,now:number,balance:PvpConfig,config:CoopConfig):void {
  if(match.status==='waiting'||match.status==='complete') return;
  if(match.proposal&&now>=match.proposal.expiresAt)match.proposal=undefined;
  match.players=match.players.filter(p=>now-p.lastSeenAt<=balance.reconnectGraceSeconds*1000);
  if(!match.players.length){match.status='complete';match.reason='disconnect';match.revision++;return;}
  const delta=Math.max(0,Math.min(dt,.25));
  match.fruts+=balance.incomePerSecond*delta;
  if(match.status==='countdown'||match.status==='boss-intro') {
    if(now<match.phaseUntil) {match.revision++;return;}
    const boss=match.status==='boss-intro'; match.status='playing'; match.remainingSpawns=boss?1:Math.min(100,Math.round((config.baseWaveSize+(match.wave-1)*config.extraPerWave)*Math.max(1,match.players.length/2))); match.spawnAt=now;
  }
  if(match.remainingSpawns>0&&now>=match.spawnAt) {
    const boss=match.wave%(config.bossEveryWaves+1)===0;
    const kind=boss?'armored':match.serial%7===0?'armored':match.serial%4===0?'swift':'normal'; const stats=balance.attacks[kind]!;
    // Stable server-generated spawn positions; clients cannot choose fruit or rewards.
    const serial=++match.serial;
    const maxHp=coopFruitMaxHealth(stats.health,boss,match.wave,match.players.length,config);
    match.fruits.push({id:`${match.id}:${serial}`,type:kind,x:boss?5:1+(serial*37%80)/10,y:0,hp:maxHp,maxHp,boss,sliceOnly:boss?Math.floor(match.wave/(config.bossEveryWaves+1))%2===0:match.wave>=7&&serial%9===0});
    match.remainingSpawns--;match.spawnAt=now+config.spawnGapMs;
  }
  for(const fruit of match.fruits){fruit.hp-=tickBurn(fruit,now);fruit.maxHp??=Math.max(fruit.hp,coopFruitMaxHealth(balance.attacks[fruit.type]!.health,fruit.boss,match.wave,match.players.length,config));}
  for(const fruit of match.fruits) fruit.y+=balance.attacks[fruit.type]!.speed*delta*(fruit.boss?config.bossSpeedMultiplier:config.fruitSpeedMultiplier)*(now<(fruit.slowUntil??0)?fruit.slowMultiplier??.45:1);
  const fire=(x:number,y:number,stats:{damage:number;range:number;cooldownMs:number},last:number,type='main',level=1):boolean=>{
    if(now-last<stats.cooldownMs) return false;
    const fruit=match.fruits.filter(f=>f.hp>0&&!f.sliceOnly&&Math.hypot(f.x-x,f.y-y)<=stats.range).sort((a,b)=>b.y-a.y)[0]; if(!fruit)return false;
    const behavior=balance.towers[type]?.chassis||type;
    const victims=turretVictims(balance.towers[type]?.chassis||type,{x,y},fruit,match.fruits.filter(f=>f.hp>0&&!f.sliceOnly),f=>f,stats.range,level);
    for(const target of victims){applyWeaponStatus(target,behavior,now,stats.damage);target.hp-=Math.round(stats.damage*(target===fruit||behavior!=='sprinkler'?1:.65));
      if(behavior==='sprinkler'){target.slowUntil=Math.max(target.slowUntil||0,now+1200);target.slowMultiplier=.55;}
      if(behavior==='railgun')target.y=Math.max(0,target.y-.45);
    }
    return true;
  };
  for(const tower of match.towers) if(fire(tower.cell%10+.5,Math.floor(tower.cell/10)+.5,pvpTowerStats(balance.towers[tower.type]!,tower.level),tower.lastFiredAt,tower.type,tower.level)) tower.lastFiredAt=now;
  if(fire(5,13.5,coopMainStats(match,balance),match.mainLastFiredAt)) match.mainLastFiredAt=now;
  collectKills(match,balance);
  for(const f of match.fruits.filter(f=>f.y>=13.5))match.wallHealth=Math.max(0,match.wallHealth-balance.attacks[f.type]!.wallDamage*(f.boss?2.5:1));
  match.fruits=match.fruits.filter(f=>f.y<13.5);
  if(match.wallHealth<=0){match.status='complete';match.reason='wall';}
  else if(!match.remainingSpawns&&!match.fruits.length){match.completedWaves++;match.towerXp=(match.towerXp??0)+config.towerXpPerWave;match.wave++;match.status=match.wave%(config.bossEveryWaves+1)===0?'boss-intro':'countdown';match.phaseUntil=now+(match.status==='boss-intro'?config.bossIntroMs:config.intermissionMs);}
  const maximum=balance.wallHealth+25*(towerLevelFromXp(match.towerXp??0)-1);
  if(maximum>(match.wallMaxHealth??balance.wallHealth)){match.wallHealth+=maximum-(match.wallMaxHealth??balance.wallHealth);match.wallMaxHealth=maximum;}
  match.revision++;
}
export function coopRewards(match:CoopMatch,config:CoopConfig):{coins:number;gems:number;xp:number;towerXp:number} {
  if(match.completedWaves<1)return {coins:0,gems:0,xp:0,towerXp:0};
  return {coins:Math.min(config.rewardCoinCap,match.kills*config.coinsPerKill+match.completedWaves*config.coinsPerWave),gems:Math.floor(match.completedWaves/config.gemsEveryWaves),xp:Math.min(10000,match.kills*config.xpPerKill),towerXp:Math.min(10000,match.completedWaves*config.towerXpPerWave)};
}
