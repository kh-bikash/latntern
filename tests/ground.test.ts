import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundHeight,WORLD_SCALE as S} from '../lib/ground';
import {makeGroundGeometry} from '../lib/groundMesh';
import {pathsFor,walkable} from '../lib/worldLayout';

test('terrain contact agrees with raycast triangles along walking routes in all sixteen regions',()=>{
 const ray=new THREE.Raycaster(),material=new THREE.MeshBasicMaterial();
 for(let realm=0;realm<16;realm++){
  const geometry=makeGroundGeometry(realm),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
  for(const path of pathsFor(realm))for(let i=1;i<path.length;i++)for(let n=0;n<15;n++){
   const t=n/15,x=(path[i-1].x*(1-t)+path[i].x*t)/S+.075,z=(path[i-1].y*(1-t)+path[i].y*t)/S+.11;
   assert(walkable(realm,{x:x*S,y:z*S}));ray.set(new THREE.Vector3(x,12,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];
   assert(hit,`Missing ground in region ${realm}`);assert(Math.abs(hit.point.y-groundHeight(realm,x,z))<.00001,`Floating ground contact in region ${realm}`);
   assert(groundHeight(realm,x,z)>0,'Walking trails stay above water');
   assert(Math.abs(groundHeight(realm,x+.15,z)-groundHeight(realm,x-.15,z))<.16,'Trail slopes permit natural footsteps');
  }
  geometry.dispose();
 }material.dispose();
});
