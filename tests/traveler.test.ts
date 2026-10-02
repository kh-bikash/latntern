import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildTraveler,advanceTraveler} from '../components/GroundedWorld';
import {groundHeight,WORLD_SCALE} from '../lib/ground';
import {spawn} from '../lib/adventure';

test('the shipped humanoid rig retains human scale, grounded feet and blended locomotion after cloning',async()=>{
 // Decode the actual shipped mesh, skeleton and clips. Textures are omitted only
 // because this test checks transforms in Node, where no image decoder exists.
 const bytes=fs.readFileSync('public/models/traveler-motion.glb'),jsonLength=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 data.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+jsonLength).toString('base64');delete data.images;delete data.textures;
 for(const m of data.materials){delete m.normalTexture;delete m.pbrMetallicRoughness.baseColorTexture;}
 const previous=globalThis.ProgressEvent;
 if(!previous)globalThis.ProgressEvent=class extends Event{constructor(type:string,options:ProgressEventInit={}){super(type);Object.assign(this,options);}} as unknown as typeof ProgressEvent;
 try{
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(data),''),actor=buildTraveler(asset,0),p=spawn(0),dt=1/60;
  assert(actor.visual.scale.y>.5&&actor.visual.scale.y<2,'Cloned skin binds must be updated before measuring height');
  assert.equal(actor.feet.length,2);assert(actor.clearance.every(y=>y>.04&&y<.25));
  const check=()=>{actor.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(actor.root,true),floor=groundHeight(0,p.x/WORLD_SCALE,p.y/WORLD_SCALE);
   assert(b.max.y-b.min.y>1.4&&b.max.y-b.min.y<2.1,'Character must remain human sized');assert(b.min.y-floor>-.19&&b.min.y-floor<.2,'Boots must stay near the rendered ground');
  };
  for(let n=0;n<90;n++)advanceTraveler(actor,p,dt,true,0);check();assert(actor.actions[0].getEffectiveWeight()>.95);
  for(let n=0;n<100;n++){p.x+=80*dt;p.facing=1;advanceTraveler(actor,p,dt,true,0);if(n%20===0)check();}assert(actor.actions[1].getEffectiveWeight()>.95);
  for(let n=0;n<100;n++){p.x-=175*dt;p.facing=3;advanceTraveler(actor,p,dt,true,0);if(n%20===0)check();}assert(actor.actions[2].getEffectiveWeight()>.95);
  for(let n=0;n<90;n++)advanceTraveler(actor,p,dt,true,0);check();assert(actor.actions[0].getEffectiveWeight()>.95);
 }finally{if(!previous)delete (globalThis as {ProgressEvent?:typeof ProgressEvent}).ProgressEvent;}
});
