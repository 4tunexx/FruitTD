import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { characterPortrait } from './characterPortraits';
import { combatTokenFrame } from './combatTokens';
import { DefenderMotion } from './defenderMotion';
import { heroDef, type HeroId } from './heroes';

function makeActor(trim:number) {
  const group=new Group();
  const portrait=new Mesh(new CircleGeometry(.72,40),new MeshBasicMaterial({color:0xffffff,map:characterPortrait('jiju'),side:DoubleSide}));
  portrait.position.y=.85;portrait.userData.combatPortrait=true;portrait.add(combatTokenFrame(.72,'hero'));
  const marker=new Mesh(new RingGeometry(.58,.65,32),new MeshBasicMaterial({color:trim,side:DoubleSide,transparent:true,opacity:.75,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;marker.position.y=.03;group.add(portrait,marker);
  return {group,portrait,motion:new DefenderMotion(portrait,'hero',trim)};
}

export class CoopActors {
  readonly group=new Group();
  private readonly one=makeActor(0xffdc72);
  private readonly two=makeActor(0x93c5fd);
  readonly playerOne=this.one.group;
  readonly playerTwo=this.two.group;
  private readonly targetOne=new Vector3();
  private readonly targetTwo=new Vector3();

  constructor(){this.group.add(this.playerOne,this.playerTwo);this.group.visible=false;this.reset();}
  reset():void {
    this.targetOne.set(-3,0,-5.5);this.targetTwo.set(3,0,-5.5);
    this.playerOne.position.copy(this.targetOne);this.playerTwo.position.copy(this.targetTwo);
  }
  setVisible(visible:boolean):void{this.group.visible=visible;}
  setPlayerOneHero(hero:HeroId):void {
    (this.one.portrait.material as MeshBasicMaterial).map=characterPortrait(hero);
    (this.one.portrait.material as MeshBasicMaterial).needsUpdate=true;
    this.one.motion.setHero(hero,heroDef(hero).color);
  }
  attackPlayerOne():void{this.one.motion.fire();}
  attackPlayerTwo():void{this.two.motion.fire();}
  movePlayerOne(x:number,z:number):void{this.targetOne.set(x,0,z);}
  movePlayerTwo(x:number,z:number):void{this.targetTwo.set(x,0,z);}
  update(dt:number):void {
    if(!this.group.visible)return;
    const blend=1-Math.exp(-dt*14);
    this.playerOne.position.lerp(this.targetOne,blend);this.playerTwo.position.lerp(this.targetTwo,blend);
    this.one.motion.update(dt);this.two.motion.update(dt);
  }
}
