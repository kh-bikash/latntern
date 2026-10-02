import * as THREE from 'three';
import {WIDTH,HEIGHT} from './adventure';
import {groundField,WORLD_SCALE as S,GROUND_COLUMNS as NX,GROUND_ROWS as NZ} from './ground';
import {projectPath,worldSites} from './worldLayout';

export function makeGroundGeometry(realm:number){
 const field=groundField(realm),positions:number[]=[],uvs:number[]=[],weights:number[]=[],indices:number[]=[],sites=worldSites(realm);
 for(let z=0;z<=NZ;z++)for(let x=0;x<=NX;x++){
  const px=x*WIDTH/NX,pz=z*HEIGHT/NZ,q=projectPath(realm,{x:px,y:pz}),d=Math.hypot(px-q.x,pz-q.y),center=Math.hypot(px-900,pz-600);
  positions.push(px/S,field[z*(NX+1)+x],pz/S);uvs.push(x/NX,z/NZ);
  const clearing=Math.max(...sites.map(t=>.65*(1-THREE.MathUtils.smoothstep(Math.hypot(px-t.x,pz-t.y),100,180))));
  weights.push(Math.max(1-THREE.MathUtils.smoothstep(d,38,115),1-THREE.MathUtils.smoothstep(center,110,185),clearing));
 }
 for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++){const a=z*(NX+1)+x,b=a+1,c=a+NX+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('trailWeight',new THREE.Float32BufferAttribute(weights,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
