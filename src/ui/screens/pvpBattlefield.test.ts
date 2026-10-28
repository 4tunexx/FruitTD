import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, OrthographicCamera, Plane, Raycaster, Scene, Vector3 } from 'three';
import { installDomStub } from '../domStub.test-helper';
installDomStub();
(globalThis as any).localStorage = { getItem: () => null };
import { PvpBattlefield, arenaCapturePoint, pvpWorldPoint, pvpArmyPoint } from './pvpBattlefield';
import { DEFAULT_PVP_CONFIG as config, createPvpPlayer } from '../../game/pvp';

test('Co-op screen strokes invert the rendered own-lane coordinates without row jumps',()=>{
  const width=390,height=844,map=config.map;
  const canvas=document.createElement('div');(canvas as any).getBoundingClientRect=()=>({width,height,left:0,top:0});
  const camera=new OrthographicCamera(-20,20,30,-30,.1,200);camera.up.set(0,1,0);camera.position.set(0,54,86);camera.lookAt(0,0,14);camera.updateMatrixWorld(true);
  const field:any=Object.create(PvpBattlefield.prototype);Object.assign(field,{canvas,snapshot:{map,shared:true},camera,ray:new Raycaster(),ground:new Plane(new Vector3(0,1,0),0)});
  for(const y of [0,1,1.99,2,2.01,5,12]){const world=pvpWorldPoint(map,4.2,y,true);const screen=world.clone().project(camera);const point=field.point({clientX:(screen.x+1)*width/2,clientY:(1-screen.y)*height/2});assert.ok(point);assert.ok(Math.abs(point.x-4.2)<.0001);assert.ok(Math.abs(point.y-y)<.0001);}
  assert.ok(pvpWorldPoint(map,4.2,1.999,true).distanceTo(pvpWorldPoint(map,4.2,2.001,true))<.01);
});

test('Arena catch fruit uses the same centered coordinates as its shared capture data',()=>{
  const point=arenaCapturePoint({width:10},5,17);
  assert.equal(point.x,0);
  assert.equal(point.z,17*1.7);
});

test('Arena capture drags follow the pointer on both viewer sides',()=>{
  const width=390,height=844,map=config.map;
  const camera=new OrthographicCamera(-20,20,30,-30,.1,200);camera.position.set(0,75,-48);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  for(const side of ['blue','red'] as const){
    const canvas=document.createElement('div');(canvas as any).getBoundingClientRect=()=>({width,height,left:0,top:0});
    const mesh={position:new Vector3()} as any;
    const field:any=Object.create(PvpBattlefield.prototype);
    Object.assign(field,{canvas,camera,ray:new Raycaster(),ground:new Plane(new Vector3(0,1,0),0),snapshot:{map,yourSide:side},captureDrag:{pointerId:1,itemId:'catch:1',from:{x:4,y:17}},catchMeshes:new Map([['catch:1',mesh]])});
    const target=arenaCapturePoint(map,4,17,side),screen=target.clone().project(camera);
    field.pointerMove({pointerId:1,clientX:(screen.x+1)*width/2,clientY:(1-screen.y)*height/2});
    target.y=1.3;
    assert.ok(mesh.position.distanceTo(target)<1e-4,`${side} capture drag should stay under the pointer`);
  }
});

test('portrait and landscape picking reach every legal hex and exclude path and rival tiles', () => {
  for (const [width, height] of [[375,470],[950,606],[1400,700]]) for (const map of config.maps) for (const side of ['blue', 'red'] as const) {
    const players = [createPvpPlayer('a', 'A', 'blue', config), createPvpPlayer('b', 'B', 'red', config)];
    // Exercise terrain, camera framing and the production picker without a GPU.
    const canvas = document.createElement('div');
    (canvas as any).getBoundingClientRect = () => ({ width, height, left: 0, top: 0 });
    const field: any = Object.create(PvpBattlefield.prototype);
    const scene = new Scene(); const terrain = new Group(); scene.add(terrain);
    Object.assign(field, { element: canvas, canvas, snapshot: { id: 'hex-test', map, yourSide: side, players }, config, terrain, health: new Map(), buildPads: [], mainTowerMaterials: [], wallMaterials: [], heroArt: [], keepMotion:new Map(), renderer: { setSize: () => undefined }, camera: new OrthographicCamera(-20, 20, 30, -30, .1, 200), zoom: 1, focusOwn: false, ray: new Raycaster(), sideColors:{blue:0x38bdf8,red:0xef5350}, cameraX:0,cameraZ:0 });
    field.buildTerrain(map); scene.updateMatrixWorld(true);
    for (const focused of [false, true]) {
      field.focusOwn = focused; field.resize(); field.camera.updateMatrixWorld();
      const view = field.camera.getWorldDirection(new Vector3());
      assert.ok(Math.abs(view.y) > .8 && Math.abs(view.y) < .9, 'camera keeps its 2.5D angle at every aspect ratio');
      if (!focused) for (const own of [true,false]) {
        const base = pvpWorldPoint(map, map.width / 2, map.height - .5, own);
        base.z += own ? -1.7 * 1.5 : 1.7 * 1.5;
        field.cameraZ=base.z;field.resize();base.y = 2; base.project(field.camera);
        assert.ok(Math.abs(base.x) < 1 && Math.abs(base.y) < 1, `${map.id} both bases are reachable vertically`);
      }
      const pick = (cell: number, own: boolean) => {
        const point = pvpWorldPoint(map, cell % map.width + .5, Math.floor(cell / map.width) + .5, own);
        field.cameraZ=point.z;field.resize();point.y = .16; point.project(field.camera);
        if (own && (!focused || map.buildCells.includes(cell))) { assert.ok(Math.abs(point.x) < 1, `${map.id} ${cell} fits phone width`); assert.ok(Math.abs(point.y) < 1, `${map.id} ${cell} fits phone height`); }
        return field.buildCell({ clientX: (point.x + 1) * width / 2, clientY: (1 - point.y) * height / 2 });
      };
      for (const cell of map.buildCells) assert.equal(pick(cell, true), cell, `${map.id}/${side}/${focused} legal hex ${cell}`);
      for (const cell of map.pathCells) assert.equal(pick(cell, true), null, `${map.id} path is reserved`);
      for (const cell of map.buildCells) assert.equal(pick(cell, false), null, 'cannot build in rival territory');
    }
    terrain.traverse((object: any) => { object.geometry?.dispose(); if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); });
  }
});

test('desktop PvP framing keeps your wall at the screen end and every build plot visible',()=>{
 const width=1400,height=700,map=config.map;
 const players=[createPvpPlayer('a','A','blue',config),createPvpPlayer('b','B','red',config)];
 const canvas=document.createElement('div');(canvas as any).getBoundingClientRect=()=>({width,height,left:0,top:0});
 const terrain=new Group(),field:any=Object.create(PvpBattlefield.prototype);
 Object.assign(field,{element:canvas,canvas,snapshot:{id:'desktop-frame',phase:'siege',map,yourSide:'blue',players},config,terrain,health:new Map(),buildPads:[],mainTowerMaterials:[],wallMaterials:[],heroArt:[],keepMotion:new Map(),renderer:{setSize:()=>undefined},camera:new OrthographicCamera(-20,20,30,-30,.1,220),cameraZ:0,framingInitialised:false,drawMinimap:()=>undefined});
 field.buildTerrain(map);
 const projectBase=(own:boolean)=>{
  const cell=map.pathCells.at(-1)!;
  const point=pvpWorldPoint(map,cell%map.width+.5,Math.floor(cell/map.width)+.5,own);
  point.z+=own?1.7*1.5:-1.7*1.5;point.y=2;
  return point.project(field.camera);
 };
 let ownBase=projectBase(true);
 assert.ok(Math.abs(ownBase.y)>.7&&Math.abs(ownBase.y)<1,'your keep sits at the end of the visible territory');
 for(const pad of field.buildPads){const point=pad.position.clone().setY(.16).project(field.camera);assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'every own plot stays visible on PC');}
 field.cameraZ=field.laneMin;field.resize();
 const rivalBase=projectBase(false);
 assert.ok(Math.abs(rivalBase.y)>.7&&Math.abs(rivalBase.y)<1,'the rival keep sits at the end when focused');
 terrain.traverse((object:any)=>{object.geometry?.dispose();if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();});
});

test('PvP touch moves only along the lane, pinch preserves scale, and taps select build pads',()=>{
 const canvas=document.createElement('div');(canvas as any).setPointerCapture=()=>undefined;(canvas as any).getBoundingClientRect=()=>({width:375,height:470,left:0,top:0});const field:any=Object.create(PvpBattlefield.prototype),selected:number[]=[];
 Object.assign(field,{canvas,element:canvas,snapshot:{id:'gesture',map:config.maps[0],yourSide:'red',players:[],shared:false},pointers:new Map(),gesture:null,stroke:null,zoom:1,focusOwn:true,framingInitialised:true,cameraX:0,cameraZ:0,renderer:{setSize:()=>undefined},camera:new OrthographicCamera(-20,20,30,-30,.1,200),ray:new Raycaster(),ground:new Plane(new Vector3(0,1,0),0),buildCell:()=>4,select:(cell:number)=>selected.push(cell),trail:{reset:()=>undefined}});
 field.camera.position.set(0,75,-48);field.camera.lookAt(0,0,0);field.camera.updateProjectionMatrix();field.camera.updateMatrixWorld(true);
 field.snapshot.players=[{side:'red',towers:[{cell:4}]}];const towerPoint=pvpWorldPoint(config.maps[0]!,4%config.maps[0]!.width+.5,Math.floor(4/config.maps[0]!.width)+.5,true);towerPoint.y=1.1;towerPoint.project(field.camera);assert.equal(field.towerCell({clientX:(towerPoint.x+1)*375/2,clientY:(1-towerPoint.y)*470/2}),4,'placed tower is touch-selectable for upgrades');
 field.pointerDown({button:0,pointerId:1,clientX:100,clientY:200});field.pointerUp({pointerId:1,clientX:100,clientY:200});assert.deepEqual(selected,[4]);field.pointerDown({button:0,pointerId:2,clientX:100,clientY:200});field.pointerMove({pointerId:2,clientX:155,clientY:230});field.pointerUp({pointerId:2,clientX:155,clientY:230});assert.equal(selected.length,1);assert.equal(field.camera.position.x,0);const fixedWidth=field.camera.right-field.camera.left;field.pointerDown({button:0,pointerId:3,clientX:100,clientY:200});field.pointerDown({button:0,pointerId:4,clientX:200,clientY:200});field.pointerMove({pointerId:4,clientX:250,clientY:200});assert.equal(field.camera.right-field.camera.left,fixedWidth);field.pointerCancel({pointerId:3});field.pointerCancel({pointerId:4});
});


test('both armies share the same world route in opposite directions across every map',()=>{
 for(const map of config.maps)for(const progress of [-map.pathCells.length,-4,-1,-.7,-.5,-.2,0,4,map.pathCells.length-1]){
  const own=pvpArmyPoint(map,progress,true),opposing=pvpArmyPoint(map,-progress-1,false);assert.ok(own.distanceTo(opposing)<1e-6,`${map.id} same fight position from both teams`);
 }
});


test('both straight roads meet on one centre line without a diagonal seam',()=>{
 for(const map of config.maps)for(const cell of map.pathCells)for(const own of [true,false]){
  const point=pvpWorldPoint(map,cell%map.width+.5,Math.floor(cell/map.width)+.5,own);
  assert.ok(Math.abs(point.x)<1e-9, `${map.id}: road stays straight on both halves`);
 }
});

test('modern placement hexes remain pickable with a barely visible build-only grid',async()=>{
  const {rebuiltPvpConfig}=await import('../../game/pvpRebuild');
  const balance=rebuiltPvpConfig(config);
  for(const side of ['blue','red'])for(const [width,height] of [[390,844],[1440,900]]){
    const map=balance.map,players=[createPvpPlayer('a','A','blue',balance),createPvpPlayer('b','B','red',balance)];
    const canvas=document.createElement('div');(canvas as any).getBoundingClientRect=()=>({width,height,left:0,top:0});
    const field:any=Object.create(PvpBattlefield.prototype),scene=new Scene(),terrain=new Group();scene.add(terrain);
    Object.assign(field,{element:canvas,canvas,snapshot:{id:'v2',rulesVersion:2,map,yourSide:side,players},config:balance,terrain,health:new Map(),buildPads:[],mainTowerMaterials:[],wallMaterials:[],heroArt:[],keepMotion:new Map(),renderer:{setSize:()=>{}},camera:new OrthographicCamera(-20,20,30,-30,.1,200),zoom:1,focusOwn:true,ray:new Raycaster(),sideColors:{blue:0x38bdf8,red:0xef5350},cameraZ:0});
    field.buildTerrain(map);scene.updateMatrixWorld(true);
    assert.equal(field.buildPads.length,map.buildCells.length);
    for(const pad of field.buildPads){
      assert.ok(pad.material.opacity<=.07);
      const point=field.cellPoint(pad.userData.cell,true);field.cameraZ=point.z;field.resize();point.y=.16;point.project(field.camera);
      assert.equal(field.buildCell({clientX:(point.x+1)*width/2,clientY:(1-point.y)*height/2}),pad.userData.cell);
    }
    const grid=terrain.children.find((child:any)=>child.isLineSegments) as any;
    assert.ok(grid);assert.ok(grid.material.opacity<=.035);
    assert.equal(grid.geometry.attributes.position.count,map.buildCells.length*players.length*12,'grid only marks build cells');
    while(terrain.children.length)field.release(terrain.children[0]);
  }
});
