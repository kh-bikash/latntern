import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure,joinAdventure,getAdventure,actAdventure} from '../lib/adventureServer';
import {WIDTH,escortPoint,trialsFor,shardPoints,pagePoints,inspectPoints,type Point} from '../lib/adventure';
import {residentFor,rewardBalance} from '../lib/quests';
test('complete cooperative campaign, rewards, choices, concurrency, and persistence',async()=>{
 const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
 try{
  const a=await createAdventure('Aoi test','expert'),b=await joinAdventure(a.room.code,'Ren test');let room=b.room;const tokens=[a.token,b.token],code=room.code;
  const act=async(seat:number,type:string,value:unknown=null)=>{room=await actAdventure(code,tokens[seat],{type,value});return room;};
  const move=async(seat:number,point:Point,grounded=true)=>{for(let n=0;n<30;n++){clock+=400;await act(seat,'move',{...point,facing:1,moving:true,grounded});if(Math.hypot(room.players[seat].x-point.x,room.players[seat].y-point.y)<1)return;}throw Error('Unreachable position '+JSON.stringify(point));};
  await assert.rejects(()=>joinAdventure(code,'Third player'),/two travelers/);await assert.rejects(()=>getAdventure(code,'bad-token'),/Join/);await assert.rejects(()=>act(0,'advance'),/crossings/);
  await assert.rejects(()=>act(0,'interact'),/closer/);assert(!JSON.stringify(room).includes(a.token),'session secrets must never be returned');
  clock+=500;await Promise.all(tokens.map((token,seat)=>actAdventure(code,token,{type:'emote',value:seat?'Ready!':'Follow me'})));room=await getAdventure(code,a.token);assert.deepEqual(room.emotes,['Follow me','Ready!']);
  const allKinds=new Set<string>();
  for(let realm=0;realm<16;realm++){
   for(let index=0;index<4;index++){
    const t=trialsFor(realm,room.difficulty)[index];allKinds.add(t.kind);
    const interact=(seat:number,payload:unknown=null)=>act(seat,'interact',{crossing:index,payload});
    if(t.kind==='mirrors')for(let seat=0;seat<2;seat++){await move(seat,t.sockets[seat]);for(let n=0;n<t.targets[seat];n++)await interact(seat);}
    else if(t.kind==='bells')for(let seat=0;seat<2;seat++){const wrong=(t.melodies[seat][0]+1)%3;await move(seat,{x:t.x+(wrong-1)*110,y:t.y});await interact(seat,wrong);assert.equal(room.trials[index].notes[seat],0);for(const note of t.melodies[seat]){await move(seat,{x:t.x+(note-1)*110,y:t.y});await interact(seat,note);}}
    else if(t.kind==='runes'){const wrong=(t.targets[0]+1)%4;await move(0,{x:t.x-165+wrong*110,y:t.y});await interact(0,wrong);assert.deepEqual(room.trials[index].notes,[0,0]);for(let seat=0;seat<2;seat++){await move(seat,{x:t.x-165+t.targets[seat]*110,y:t.y});await interact(seat,t.targets[seat]);}}
    else if(t.kind==='embers'||t.kind==='rescue'){for(let seat=0;seat<2;seat++)for(let piece=0;piece<2;piece++){await move(seat,t.embers[seat][piece]);await interact(seat,piece);}}
    if(!room.trials[index].solved){
     for(let n=0;n<300&&!room.trials[index].solved;n++){
      clock+=500;
      for(let seat=0;seat<2;seat++){let p=t.kind==='escort'?escortPoint(t,room.trials[index].progress):t.sockets[seat];await move(seat,p,t.kind!=='guardian');await interact(seat);if(room.trials[index].solved)break;}
     }
    }
    assert(room.trials[index].solved,`Crossing ${realm}/${index}: ${t.kind} must be completable`);
    // A delayed retry must not accidentally operate the following crossing.
    if(index<3){const version=room.version;await interact(0);assert.equal(room.version,version);}
   }
   for(const p of shardPoints(realm)){await move(0,p);await act(0,'shard',p.id);await act(0,'shard',p.id);}
   for(const p of pagePoints(realm)){await move(0,p);await act(0,'page',p.id);}
   for(const p of inspectPoints(realm)){await move(0,p);await act(0,'inspect',p.id);}
   await move(0,residentFor(realm));await act(0,'quest');const balance=rewardBalance(room);await act(0,'quest');assert.equal(rewardBalance(room),balance,'Quest rewards must be awarded once');
   assert(room.quests.includes(residentFor(realm).id),`Resident quest ${realm} must be achievable`);
   if(realm===0){await act(0,'upgrade','wind');assert.equal(room.upgrades.wind,1);await assert.rejects(()=>act(0,'upgrade','wind'),/complete/);await act(0,'upgrade','sight');}
   if(realm===1)await act(0,'upgrade','bond');
   if(realm===2){await act(0,'upgrade','bond');assert.equal(room.upgrades.bond,2);}
   await move(0,{x:WIDTH-210,y:600});await move(1,{x:WIDTH-210,y:600});if(realm===15){await act(0,'choice','share');await act(1,'choice','guard');}
   await act(0,'advance');assert.equal(room.realm,realm,'One player cannot change the realm');await act(1,'advance');assert.equal(room.realm,Math.min(15,realm+1));
   room=await getAdventure(code,tokens[0]);assert.equal(room.pages.length,(realm+1)*2);
  }
  assert.equal(allKinds.size,10);assert.equal(room.status,'won');assert.equal(room.shards.length,96);assert.equal(room.pages.length,32);assert.equal(room.discoveries.length,48);assert.equal(room.quests.length,16);assert.equal(room.completed.length,16);assert.deepEqual(room.choices,['share','guard']);assert.equal((await getAdventure(code,tokens[1])).status,'won');
 }finally{Date.now=realNow;}
});
test('difficulty changes meaningful challenge requirements',()=>{const normal=trialsFor(4,'adventure').find(t=>t.kind==='bells')!,expert=trialsFor(4,'expert').find(t=>t.kind==='bells')!;assert.equal(expert.melodies[0].length,normal.melodies[0].length+2);});
