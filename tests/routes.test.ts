import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTES} from '../lib/routes';
import {platformsFor,trialsFor,FLOOR,spawn} from '../lib/adventure';
import {stepBody,type Body} from '../lib/adventurePhysics';

test('sixteen distinct routes retain climbable paths to every mandatory wish and shrine',()=>{
 assert.equal(new Set(ROUTES.map(r=>r.centers.join(','))).size,16);
 for(let realm=0;realm<16;realm++){
  const platforms=platformsFor(realm);
  // Conservatively connect one-way platforms using less than the base jump height
  // and less than its horizontal range. Mandatory objects allow a 115px reach.
  const reachable=new Set(platforms.map((p,i)=>p.y===FLOOR?i:-1).filter(i=>i>=0));
  let changed=true;
  while(changed){changed=false;platforms.forEach((p,i)=>{if(reachable.has(i))return;for(const j of reachable){const q=platforms[j],rise=q.y-p.y,gap=Math.max(0,p.x-q.x-q.w,q.x-p.x-p.w);if(rise>=0&&rise<=170&&gap<=180){reachable.add(i);changed=true;break;}}});}
  for(const t of trialsFor(realm)){
   const objects=['embers','rescue'].includes(t.kind)?t.embers.flat():t.sockets;
   for(const object of objects)assert(platforms.some((p,i)=>reachable.has(i)&&Math.abs(p.y-object.y)<115&&object.x>=p.x-100&&object.x<=p.x+p.w+100),`${realm}/${t.kind} has an inaccessible objective`);
  }
 }
});
test('ice preserves momentum and airborne wind changes jumps without lifting grounded players',()=>{
 const fresh=():Body=>({...spawn(0),vx:250,vy:0,coyote:.1,jumpBuffer:0});
 const stone=fresh(),ice=fresh();
 for(let i=0;i<20;i++){stepBody(stone,[],1/60,0,false,false,4100,true);stepBody(ice,[],1/60,0,false,false,4100,true,false,{traction:.3,wind:0});}
 assert(ice.x>stone.x+25);assert(ice.grounded);
 const calm=fresh(),windy=fresh();
 for(let i=0;i<30;i++){stepBody(calm,[],1/60,0,i===0,false,4100,true);stepBody(windy,[],1/60,0,i===0,false,4100,true,false,{traction:1,wind:85});}
 assert(windy.x>calm.x+20);assert(Math.abs(windy.y-calm.y)<1);
});
