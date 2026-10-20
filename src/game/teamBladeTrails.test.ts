import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Mesh} from 'three';
import {TeamBladeTrails} from './teamBladeTrails';
test('three remote teammate slashes coexist, expire and release departed players',()=>{
 const team=new TeamBladeTrails(),point=(x:number,y:number)=>new Vector3(x,.8,y);
 const strokes=['one','two','three','four'].map((userId,index)=>({userId,stroke:{from:{x:0,y:index},to:{x:3,y:index},at:1000}}));
 team.sync(strokes,point);assert.equal(team.group.children.length,9,'at most three remote trails');
 const lines=team.group.children.filter((_,index)=>index%3===0) as Mesh[];
 assert.ok(lines.every(line=>line.geometry.drawRange.count>0));
 team.update(.05,1400);assert.ok(lines.every(line=>line.geometry.drawRange.count===0));
 team.sync(strokes.slice(0,1),point);assert.equal(team.group.children.length,3);
 team.dispose();assert.equal(team.group.children.length,0);
});
