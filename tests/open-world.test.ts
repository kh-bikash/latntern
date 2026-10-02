import test from 'node:test';
import assert from 'node:assert/strict';
import {trialsFor,shardPoints,pagePoints,inspectPoints,spawn,WIDTH,HEIGHT,type Point} from '../lib/adventure';
import {stepWorld,exitsFor,type WorldBody} from '../lib/openWorld';
import {pathsFor,walkPath,walkable} from '../lib/worldLayout';
import {residentFor} from '../lib/quests';
import {createAdventure,joinAdventure,actAdventure,getAdventure} from '../lib/adventureServer';

test('every region has connected walking routes to every puzzle, collectible, resident and exit',()=>{
 assert.equal(new Set(Array.from({length:16},(_,i)=>JSON.stringify(pathsFor(i)))).size,16);
 for(let realm=0;realm<16;realm++){
  const objects:Point[]=[...shardPoints(realm),...pagePoints(realm),...inspectPoints(realm),residentFor(realm),...exitsFor(realm)];
  for(const t of trialsFor(realm)){objects.push(...t.sockets,...t.embers.flat());if(t.kind==='bells')for(let n=0;n<3;n++)objects.push({x:t.x+(n-1)*110,y:t.y});if(t.kind==='runes')for(let n=0;n<4;n++)objects.push({x:t.x-165+n*110,y:t.y});}
  for(const p of objects){assert(walkable(realm,p),`${realm}: object off navigable land ${JSON.stringify(p)}`);const path=walkPath(realm,spawn(0),p);assert(path.length||Math.hypot(p.x-spawn(0).x,p.y-spawn(0).y)<60,`${realm}: no walking route ${JSON.stringify(p)}`);if(path.length)assert(Math.hypot(path.at(-1)!.x-p.x,path.at(-1)!.y-p.y)<60);}
  for(const exit of exitsFor(realm))assert(exitsFor(exit.realm).some(e=>e.realm===realm),'Every region trail is reversible');
 }
});

test('free movement supports four directions, normalized diagonals, running, stopping and dodge cooldown',()=>{
 const fresh=():WorldBody=>({x:900,y:600,vx:0,vy:0,direction:2,dash:0,cooldown:0,moving:false});
 const east=fresh(),diagonal=fresh(),north=fresh(),running=fresh();for(let i=0;i<60;i++){stepWorld(east,1/60,1,0,false,false);stepWorld(diagonal,1/60,1,1,false,false);stepWorld(north,1/60,0,-1,false,false);stepWorld(running,1/60,1,0,true,false);}
 assert(east.x>1080);assert(north.y<420);assert.equal(north.direction,0);assert.equal(east.direction,1);assert(running.x>east.x+80);assert(Math.abs(Math.hypot(diagonal.x-900,diagonal.y-600)-(east.x-900))<1);
 for(let i=0;i<60;i++)stepWorld(east,1/60,0,0,false,false);assert(Math.abs(east.vx)<1);assert(!east.moving);
 const dash=fresh();stepWorld(dash,.05,0,0,false,true);assert(dash.dash>0&&dash.cooldown>1);const cooldown=dash.cooldown;stepWorld(dash,.05,0,0,false,true);assert(dash.cooldown<cooldown,'Repeated dodge cannot restart cooldown');assert(dash.y>600,'Stationary dodge uses current facing');
 const bounds=fresh();for(let i=0;i<1000;i++)stepWorld(bounds,.02,1,1,true,false);assert(bounds.x<=WIDTH-35&&bounds.y<=HEIGHT-35);
});

test('two players freely travel before solving missions and retain out-of-order puzzle progress on return',async()=>{
 const original=Date.now;let clock=original();Date.now=()=>clock;
 try{
  const a=await createAdventure('Explorer A'),b=await joinAdventure(a.room.code,'Explorer B'),tokens=[a.token,b.token];let room=b.room;
  const act=async(seat:number,type:string,value:unknown)=>room=await actAdventure(room.code,tokens[seat],{type,value});
  const move=async(seat:number,p:Point)=>{for(let n=0;n<20;n++){clock+=500;await act(seat,'move',{...p,realm:room.realm,facing:2,grounded:true,moving:true});if(Math.hypot(room.players[seat].x-p.x,room.players[seat].y-p.y)<1)return;}throw Error('Cannot reach '+JSON.stringify(p));};
  await assert.rejects(()=>act(0,'travel',15),/marked trail/);
  const bells=trialsFor(0)[3],note=bells.melodies[0][0];await move(0,{x:bells.x+(note-1)*110,y:bells.y});await act(0,'interact',{crossing:3,payload:note});assert.equal(room.trials[3].notes[0],1);assert(!room.trials[0].solved,'A later puzzle can be started first');
  const south=exitsFor(0).find(e=>e.realm===4)!;await move(0,south);await act(0,'travel',4);assert.equal(room.realm,0,'One player cannot force region travel');await assert.rejects(()=>act(1,'travel',4),/marked trail/);await move(1,south);await act(1,'travel',4);assert.equal(room.realm,4);assert(room.trials.every(t=>!t.solved));assert.deepEqual(room.visited,[0,4]);
  const entry=room.players[0],version=room.version;room=await actAdventure(room.code,tokens[0],{type:'move',value:{x:900,y:1100,realm:0,moving:true,grounded:true}});assert.deepEqual(room.players[0],entry,'A delayed movement from the previous region cannot displace the arrival');assert.equal(room.version,version);room=await actAdventure(room.code,tokens[0],{type:'interact',value:{crossing:0},realm:0});assert.equal(room.version,version,'Old region interactions are ignored');
  const north=exitsFor(4).find(e=>e.realm===0)!;await move(0,north);await move(1,north);await act(0,'travel',0);await act(1,'travel',0);assert.equal(room.realm,0);assert.equal(room.trials[3].notes[0],1,'Unfinished mysteries survive travel');assert.equal((await getAdventure(room.code,a.token)).archive?.[0][3].notes[0],1,'Progress survives reload');
 }finally{Date.now=original;}
});
