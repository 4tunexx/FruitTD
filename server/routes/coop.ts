import { Router, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Rest } from 'ably';
import { getCollection as defaultCollection } from '../db';
import { resolveRequestUser as defaultResolveUser } from '../auth';
import { creditClaimReward as defaultCreditReward } from '../claimWallet';
import { mergeAdminConfig } from '../../src/services/admin';
import { newCoopMatch, joinCoopMatch, applyCoopCommand, advanceCoopMatch, coopRewards, normalizeCoopConfig, type CoopMatch, type CoopPlayer } from '../../src/game/onlineCoop';
import { HEROES } from '../../src/game/heroes';
export function createCoopService(deps: { collection?: typeof defaultCollection; resolveUser?: typeof defaultResolveUser; creditReward?: typeof defaultCreditReward; publish?: (channel: string, room: unknown) => Promise<void>; token?: (params: { clientId: string; ttl: number; capability: string }) => Promise<unknown> } = {}) {
const getCollection = deps.collection ?? defaultCollection;
const resolveRequestUser = deps.resolveUser ?? defaultResolveUser;
const creditClaimReward = deps.creditReward ?? defaultCreditReward;
const coopRouter=Router();
type Room=CoopMatch & {public:boolean;updatedAt:Date;expiresAt:Date;settled?:boolean;seenBy?:string[];activePlayers?:string[]};
let publisher:Rest|null=null;let authority:ReturnType<typeof setInterval>|null=null;let ticking=false;
const fail=(res:Response,code:number,error:string)=>res.status(code).json({success:false,error});
async function config(){const row=await(await getCollection<any>('admin_config')).findOne({configKey:'game_config'});const balance=mergeAdminConfig(row).pvpConfig;delete balance.towers.catcher;return {balance,coop:normalizeCoopConfig(row?.coopConfig)};}
async function publish(room:Room){try{if(deps.publish){await deps.publish(`fruittd-coop-${room.id}`,room);return;}if(!process.env.ABLY_API_KEY)return;publisher??=new Rest({key:process.env.ABLY_API_KEY});await publisher.channels.get(`fruittd-coop-${room.id}`).publish('match.snapshot',room);}catch(error){console.error('Co-op publish failed',error);}}
async function settle(room:Room){if(room.status!=='complete'||room.settled)return;const cfg=await config();const reward=coopRewards(room,cfg.coop);
 for(const player of room.players){if(room.completedWaves<1)continue;await creditClaimReward(player.userId,`coop:${room.id}`,{coins:reward.coins,gems:reward.gems,xp:{[player.hero]:reward.xp},towerXp:reward.towerXp,games:1,bestWave:room.completedWaves,highScore:room.score});
 const board=await getCollection<any>('leaderboards');
 const record={userId:player.userId,nickname:player.name,avatar:'',hero:player.hero,mode:'coop',score:room.score,wave:room.completedWaves,fruitsSliced:room.kills,maxCombo:0,createdAt:new Date()};
 await board.updateOne({userId:player.userId,mode:'coop'},{$setOnInsert:record},{upsert:true});
 await board.updateOne({userId:player.userId,mode:'coop',$or:[{score:{$lt:room.score}},{score:room.score,wave:{$lt:room.completedWaves}}]},{$set:record});
 if(room.completedWaves>=6){await(await getCollection<any>('achievements')).updateOne({userId:player.userId,achievementId:'coop_first_team_run'},{$set:{unlocked:true,unlockedAt:new Date(),progress:1,maxProgress:1},$setOnInsert:{claimed:false}},{upsert:true});await(await getCollection<any>('badges')).updateOne({userId:player.userId,badgeId:'coop-team-slicer'},{$set:{unlocked:true,unlockedAt:new Date(),progress:1,maxProgress:1}},{upsert:true});}}
 await(await getCollection<Room>('coop_matches')).updateOne({id:room.id},{$set:{settled:true}});room.settled=true;
}
async function tick(room:Room,now:number){if(room.status==='complete')return room;const cfg=await config();const revision=room.revision;
 if(room.status==='waiting') {
  if(now-room.players[0]!.lastSeenAt<=cfg.balance.reconnectGraceSeconds*1000)return room;
  room.status='complete';room.reason='disconnect';room.revision++;
 }
 let remaining=Math.min(2,Math.max(0,(now-room.updatedAt.getTime())/1000));let at=now-remaining*1000;
 while(remaining>0&&(room as Room).status!=='complete'){const dt=Math.min(.2,remaining);at+=dt*1000;advanceCoopMatch(room,dt,at,cfg.balance,cfg.coop);remaining-=dt;}
 room.updatedAt=new Date(now);if((room as Room).status==='complete')delete room.activePlayers;const saved=await(await getCollection<Room>('coop_matches')).replaceOne({id:room.id,revision},room);if(!saved.modifiedCount)return null;void publish(room);if((room as Room).status==='complete')await settle(room);return room;
}
async function player(user:NonNullable<Awaited<ReturnType<typeof resolveRequestUser>>>):Promise<CoopPlayer>{
 const save=await(await getCollection<any>('cloud_saves')).findOne({userId:user.userId});const hero=save?.saveData?.hero;
 return {userId:user.userId,name:String(user.nickname||'Slicer').slice(0,64),hero:HEROES.some(h=>h.id===hero)?hero:'jiju',sequence:0,lastSeenAt:Date.now(),lastSlashAt:0,kills:0};
}
coopRouter.get('/status',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in to play online Co-op.');try{
 const rooms=await getCollection<Room>('coop_matches');let room=await rooms.findOne({'players.userId':user.userId,expiresAt:{$gt:new Date()},$or:[{status:{$ne:'complete'}},{status:'complete',seenBy:{$ne:user.userId}}]});
 if(room){await rooms.updateOne({id:room.id},{$set:{'players.$[self].lastSeenAt':Date.now()},$inc:{revision:1}},{arrayFilters:[{'self.userId':user.userId}]});room=await rooms.findOne({id:room.id});if(room){await tick(room,Date.now());room=await rooms.findOne({id:room.id});if(room?.status==='complete')await settle(room);}}
 const cfg=await config();res.json({success:true,room,balance:cfg.balance,coop:cfg.coop,yourId:user.userId});
 }catch(error){console.error('Co-op status failed',error);fail(res,503,'Co-op storage is unavailable.');}});
coopRouter.post('/create',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in first.');try{
 await(await getCollection<Room>('coop_matches')).updateOne({activePlayers:user.userId,expiresAt:{$lte:new Date()}},{$unset:{activePlayers:''},$set:{status:'complete',reason:'expired'}});
 const rooms=await getCollection<Room>('coop_matches');const existing=await rooms.findOne({'players.userId':user.userId,status:{$ne:'complete'},expiresAt:{$gt:new Date()}});if(existing)return fail(res,409,'Leave your current room first.');
 const cfg=await config();const self=await player(user);
 if(req.body?.public===true){const open=await rooms.findOne({public:true,status:'waiting','players.0.lastSeenAt':{$gt:Date.now()-cfg.balance.reconnectGraceSeconds*1000},'players.userId':{$ne:user.userId},expiresAt:{$gt:new Date()}});if(open){const revision=open.revision;joinCoopMatch(open,self,Date.now());open.activePlayers=open.players.map(p=>p.userId);open.updatedAt=new Date();const updated=await rooms.replaceOne({id:open.id,revision,status:'waiting'},open);if(updated.modifiedCount){void publish(open);return res.json({success:true,room:open});}}}
 const room:Room={...newCoopMatch(randomUUID().replace(/-/g,'').slice(0,10),self,cfg.balance),public:req.body?.public===true,activePlayers:[user.userId],updatedAt:new Date(),expiresAt:new Date(Date.now()+2*60*60*1000)};await rooms.insertOne(room);res.json({success:true,room});
 }catch(error){if((error as {code?:number}).code===11000)return fail(res,409,'You already have an active Co-op room.');console.error('Co-op room creation failed',error);fail(res,503,'Could not create the room.');}});
coopRouter.post('/join',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in first.');try{
 await(await getCollection<Room>('coop_matches')).updateOne({activePlayers:user.userId,expiresAt:{$lte:new Date()}},{$unset:{activePlayers:''},$set:{status:'complete',reason:'expired'}});
 const rooms=await getCollection<Room>('coop_matches');if(await rooms.findOne({'players.userId':user.userId,status:{$ne:'complete'},expiresAt:{$gt:new Date()}}))return fail(res,409,'Leave your current room first.');
 const id=String(req.body?.code||'').trim().toLowerCase();if(!/^[a-f0-9]{10}$/.test(id))return fail(res,400,'Enter the 10-character room code.');const room=await rooms.findOne({id,status:'waiting',expiresAt:{$gt:new Date()}});if(!room)return fail(res,404,'Room is full or no longer available.');const revision=room.revision;joinCoopMatch(room,await player(user),Date.now());room.activePlayers=room.players.map(p=>p.userId);room.updatedAt=new Date();const saved=await rooms.replaceOne({id,revision,status:'waiting'},room);if(!saved.modifiedCount)return fail(res,409,'Another player joined this room.');void publish(room);res.json({success:true,room});
 }catch(error){if((error as {code?:number}).code===11000)return fail(res,409,'You already have an active Co-op room.');console.error('Co-op join failed',error);fail(res,503,'Could not join the room.');}});
coopRouter.post('/:id/command',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in first.');try{
 const rooms=await getCollection<Room>('coop_matches');const room=await rooms.findOne({id:req.params.id,'players.userId':user.userId,expiresAt:{$gt:new Date()}});if(!room)return fail(res,404,'Room is unavailable.');if(room.status==='complete')return fail(res,409,'Match has finished.');
 const cfg=await config();const revision=room.revision;try{applyCoopCommand(room,user.userId,req.body.sequence,req.body.command,Date.now(),cfg.balance,cfg.coop);}catch(error){return fail(res,400,error instanceof Error?error.message:'Invalid action.');}
 if((room as Room).status==='complete')delete room.activePlayers;const saved=await rooms.replaceOne({id:room.id,revision},room);if(!saved.modifiedCount)return fail(res,409,'Match updated. Try the action again.');void publish(room);await settle(room);res.json({success:true,room});
 }catch(error){console.error('Co-op command failed',error);fail(res,503,'Could not apply the action.');}});
coopRouter.post('/:id/ack',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in first.');await(await getCollection<Room>('coop_matches')).updateOne({id:req.params.id,status:'complete','players.userId':user.userId},{$addToSet:{seenBy:user.userId}});res.json({success:true});});
coopRouter.post('/:id/token',async(req,res)=>{const user=await resolveRequestUser(req);if(!user)return fail(res,401,'Sign in first.');const room=await(await getCollection<Room>('coop_matches')).findOne({id:req.params.id,'players.userId':user.userId,status:{$ne:'complete'},expiresAt:{$gt:new Date()}});if(!room)return fail(res,404,'Room unavailable.');if(!process.env.ABLY_API_KEY&&!deps.token)return fail(res,503,'Realtime service is not configured.');try{const params={clientId:user.userId,ttl:60000,capability:JSON.stringify({[`fruittd-coop-${room.id}`]:['subscribe']})};let token:unknown;if(deps.token)token=await deps.token(params);else{publisher??=new Rest({key:process.env.ABLY_API_KEY!});token=await publisher.auth.createTokenRequest(params);}res.json(token);}catch(error){console.error('Co-op token failed',error);fail(res,503,'Could not authorize realtime.');}});
function startCoopAuthority(){if(authority)return;authority=setInterval(async()=>{if(ticking)return;ticking=true;try{const rooms=await(await getCollection<Room>('coop_matches')).find({status:{$in:['waiting','countdown','playing','boss-intro']},expiresAt:{$gt:new Date()}}).limit(100).toArray();for(const room of rooms)await tick(room,Date.now());}catch(error){console.error('Co-op authority failed',error);}finally{ticking=false;}},200);authority.unref?.();}
return { router: coopRouter, startAuthority: startCoopAuthority };
}
const service = createCoopService();
export const coopRouter = service.router;
export const startCoopAuthority = service.startAuthority;
