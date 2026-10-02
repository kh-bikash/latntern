import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFlight,joinFlight,getFlight,actFlight,flightTerrain} from '../lib/flightServer';
import {FLIGHT_REGIONS,MISSIONS,flightSpawn,terrainHeight,missionPoints,stepFlight,navigationInput,groundDistance,formationSeconds,type Aircraft} from '../lib/flight';
import {terrainGeometry} from '../components/FlightWorld';

test('real terrain snapshots are distinct, geographic landmarks are inside them, rendered triangles agree with flight grounding',async()=>{
 const seen=new Set<string>();for(let i=0;i<6;i++){const t=await flightTerrain(i);assert.equal(t.id,FLIGHT_REGIONS[i].id);assert(t.lat<t.north&&t.lat>t.south&&t.lon>t.west&&t.lon<t.east);assert(t.size>14000&&t.size<17000);assert.equal(t.heights.length,t.grid*t.grid);seen.add(JSON.stringify(t.heights.slice(0,300)));const geo=terrainGeometry(t),mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();for(let n=0;n<8;n++){const x=(.17+n*.077)*t.size,z=(.18+n*.062)*t.size,ray=new THREE.Raycaster(new THREE.Vector3(x,9000,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert(hit);assert(Math.abs(hit.point.y-terrainHeight(t,x,z))<.001,'aircraft floor must match visible triangle');}geo.dispose();if(i===0)assert(Math.max(...t.heights)>3700&&Math.max(...t.heights)<3800);if(i===2){const p=missionPoints(5,t)[0];assert.equal(terrainHeight(t,p.x,p.z),0,'landing target must be water');}}assert.equal(seen.size,6);
});
test('banking turns, pitch climbs, drag slows, stalls descend and recoveries preserve safe clearance',async()=>{const t=await flightTerrain(0),p=flightSpawn(0,t),base={...p};for(let n=0;n<120;n++)stepFlight(p,1/60,{pitch:.6,roll:.6,throttle:.8,brake:false},t,'pilot',n/60);assert(p.y>base.y+10);assert(p.yaw>base.yaw+.2);assert(p.roll>.4);assert(Math.hypot(p.x-base.x,p.z-base.z)>90);p.speed=18;stepFlight(p,.05,{pitch:0,roll:0,throttle:0,brake:true},t,'pilot',5);assert(p.vertical<0);const speed=p.speed;for(let n=0;n<60;n++)stepFlight(p,1/60,{pitch:0,roll:0,throttle:0,brake:true},t,'pilot',n/60);assert(p.speed<speed);assert.equal(formationSeconds('explorer'),10);assert.equal(formationSeconds('ace'),22);});
test('guidance actually flies the terrain: every route, survey, delivery and sea landing is reachable without terrain contact',async()=>{
 for(let m=0;m<12;m++){const kind=MISSIONS[m].kind;if(kind==='formation')continue;const t=await flightTerrain(Math.floor(m/2)),p=flightSpawn(0,t),points=missionPoints(m,t);let step=0,done=false;
  for(let n=0;n<30000&&!done;n++){const q=points[Math.min(step,points.length-1)],input=navigationInput(p,q,kind,t,n*.05);if(input.land){done=true;break;}stepFlight(p,.05,input,t,'explorer',n*.05);const agl=p.y-terrainHeight(t,p.x,p.z),d=groundDistance(p,q);assert(agl>2.4,`mission ${m} guidance hit terrain`);
   if(kind==='route'&&d<375&&Math.abs(p.y-q.y)<225){step++;done=step===3;}
   else if(kind==='photo'||kind==='drop')done=d<(kind==='photo'?650:450)&&agl>=(kind==='photo'?180:100)&&agl<=(kind==='photo'?900:500);
  }assert(done,`mission ${m} guidance never reaches valid action window`);
 }
});
test('two authenticated pilots can finish all twelve mission types, reconnect and confirm every chapter together',async()=>{
 const now=Date.now;let clock=now();Date.now=()=>clock;try{
  const a=await createFlight('QA Aoi','ace'),b=await joinFlight(a.room.code,'QA Ren');const tokens=[a.token,b.token],code=a.room.code;let room=b.room;const act=async(seat:number,type:string,value?:unknown,mission=room.mission)=>room=await actFlight(code,tokens[seat],{type,value,mission});
  await assert.rejects(()=>getFlight(code,'bad-token'),/Join/);await assert.rejects(()=>joinFlight(code,'Third'),/two pilots/);await assert.rejects(()=>act(0,'continue'),/Finish/);assert(!JSON.stringify(room).includes(a.token));
  const move=async(seat:number,target:{x:number;y:number;z:number},speed=65)=>{for(let n=0;n<100;n++){clock+=2000;const p=room.planes[seat];await act(seat,'move',{...p,...target,pitch:0,roll:0,yaw:0,speed,vertical:0,throttle:.7});const q=room.planes[seat];if(Math.hypot(q.x-target.x,q.z-target.z)<1&&Math.abs(q.y-target.y)<1)return;}throw new Error('Unreachable mission target');};
  await act(0,'move',{...room.planes[0],x:Infinity}).then(()=>assert.fail('invalid position accepted'),()=>{});
  await Promise.all(tokens.map((token,seat)=>actFlight(code,token,{type:'move',value:room.planes[seat],mission:0})));room=await getFlight(code,tokens[0]);
  for(let m=0;m<12;m++){
   assert.equal(room.mission,m);const t=await flightTerrain(Math.floor(m/2)),points=missionPoints(m,t),kind=MISSIONS[m].kind;
   if(kind==='photo'||kind==='drop')await assert.rejects(()=>act(0,'interact'),/closer/);
   if(kind==='route'){for(let seat=0;seat<2;seat++)for(const p of points){await move(seat,p);await act(seat,'check');}}
   else if(kind==='formation'){for(let seat=0;seat<2;seat++)await move(seat,{...points[0],x:points[0].x+seat*70});for(let n=0;n<60&&room.status==='flying';n++){clock+=500;for(let seat=0;seat<2;seat++)await act(seat,'move',room.planes[seat]);await act(0,'check');}assert(room.progress>=22);}
   else{for(let seat=0;seat<2;seat++){await move(seat,points[0],kind==='landing'?30:65);if(kind==='landing'){await act(seat,'move',{...room.planes[seat],y:-5});await act(seat,'check');assert.equal(room.steps[seat],0,'underground landing must be rejected');await move(seat,points[0],30);}await act(seat,kind==='landing'?'check':'interact');}}
   assert.equal(room.status,'briefing',`mission ${m} completable`);await act(0,'continue');assert.equal(room.mission,m);await act(1,'continue');assert.equal(room.mission,m+1);const version=room.version;await act(0,'interact',null,m);assert.equal(room.version,version,'stale action ignored');room=await getFlight(code,tokens[0]);
  }
  assert.equal(room.status,'won');assert.equal(room.completed.length,12);assert.equal((await getFlight(code,tokens[1])).status,'won');
 }finally{Date.now=now;}
});
