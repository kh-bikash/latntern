// Streams OpenStreetMap 3D scenery (buildings, forests, aprons, taxiways) around the aircraft from OpenFreeMap
// vector tiles. Geometry is built in a worker and drawn as one batched three.js mesh per tile.
import {photorealAt,PHOTOREAL_ONLY} from '@/lib/photoreal';
import * as THREE from 'three';
import {terrainTile} from '@/lib/worldTerrain';
import type {ThreeLayer,Placed} from './threeLayer';
type Result={id:string;latC:number;out?:{color:[number,number,number];pos:Float32Array;nrm:Float32Array;st:Float32Array}[];error?:string};
const Z=14;let tileUrl:Promise<string>|undefined;
const resolveUrl=()=>tileUrl??=fetch('https://tiles.openfreemap.org/planet').then(r=>r.json()).then(j=>String(j.tiles[0])).catch(()=>'https://tiles.openfreemap.org/planet/20260927_080001_pt/{z}/{x}/{y}.pbf');
// Facade shader: window grids per floor, sky-tinted glass by day and randomly lit windows at night.
const VS=`attribute vec2 st;varying vec3 vN;varying vec2 vSt;varying vec3 vC;void main(){vN=normal;vSt=st;vC=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FS=`uniform vec3 uSun;uniform float uDay;varying vec3 vN;varying vec2 vSt;varying vec3 vC;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 n=normalize(vN);vec3 base=vC;vec3 glow=vec3(0.0);
 if(vSt.x>=0.0){vec2 cell=vec2(vSt.x/3.3,vSt.y/3.3);vec2 f=fract(cell);float win=step(0.2,f.x)*step(f.x,0.8)*step(0.28,f.y)*step(f.y,0.86)*step(1.0,cell.y)*(1.0-step(0.94,fract(vSt.x/16.5)));
  vec3 sky=mix(vec3(0.13,0.16,0.2),vec3(0.46,0.56,0.66),0.5+0.5*hash(floor(cell*0.37)));base=mix(base*(0.93+0.07*hash(floor(cell*0.5))),sky*mix(0.22,1.0,uDay),win*0.86);
  float lit=step(0.52,hash(floor(cell)+vec2(floor(vSt.x/41.0),7.0)));glow=win*lit*(1.0-uDay)*mix(vec3(1.0,0.74,0.42),vec3(0.85,0.9,1.0),hash(floor(cell)+3.1))*1.2;}
 float diff=max(dot(n,normalize(uSun)),0.0);gl_FragColor=vec4(base*(mix(0.07,0.36,uDay)+0.9*diff*uDay)+glow,1.0);}`;
export class OsmScenery{private worker:Worker;private tiles=new Map<string,{placed?:Placed;loading:boolean;x:number;y:number}>();private pending=new Map<string,(r:Result)=>void>();private active=0;
 material=new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:FS,vertexColors:true,side:THREE.DoubleSide,uniforms:{uSun:{value:new THREE.Vector3(.3,.4,.8)},uDay:{value:1}}});
 constructor(private layer:ThreeLayer,public quality:'performance'|'balanced'|'high'){this.worker=new Worker('/flight/osm-worker.js',{type:'module'});this.worker.onmessage=(e:MessageEvent<Result>)=>{this.pending.get(e.data.id)?.(e.data);this.pending.delete(e.data.id);};}
 setLight(azimuth:number,elevation:number,day:number){const a=azimuth*Math.PI/180,e=Math.max(.05,elevation*Math.PI/180);(this.material.uniforms.uSun.value as THREE.Vector3).set(Math.sin(a)*Math.cos(e),Math.cos(a)*Math.cos(e),Math.sin(e));this.material.uniforms.uDay.value=day;}
 /** Keep tiles loaded around a position; detail depends on height above ground. */
 update(lat:number,lon:number,agl:number,single=false){
  // inside photogrammetry coverage the real mesh carries the buildings and trees; photoreal-only mode draws no blocks
  if(PHOTOREAL_ONLY||photorealAt(lat,lon)){for(const [k,t] of this.tiles){if(t.placed){this.layer.remove(t.placed,false);t.placed=undefined;}if(!t.loading)this.tiles.delete(k);}return;}
  const n=2**Z,fx=(lon+180)/360*n,fy=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,x0=Math.floor(fx),y0=Math.floor(fy),radius=single||agl>3500?0:this.quality==='high'&&agl<1800?2:1,want=new Set<string>();
  if(agl<6000)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy>radius*radius+1)continue;const x=((x0+dx)%n+n)%n,y=y0+dy,k=`${x}/${y}`;want.add(k);if(!this.tiles.has(k))this.tiles.set(k,{loading:false,x,y});}
  const queue=[...this.tiles.entries()].filter(([k,t])=>want.has(k)&&!t.placed&&!t.loading).sort((a,b)=>Math.hypot(a[1].x+.5-fx,a[1].y+.5-fy)-Math.hypot(b[1].x+.5-fx,b[1].y+.5-fy));
  for(const [k,t] of queue){if(this.active>=2)break;void this.load(k,t);}
  for(const [k,t] of this.tiles){const far=Math.max(Math.abs(t.x-x0),Math.abs(t.y-y0))>radius+1;if(far&&!t.loading){if(t.placed)this.layer.remove(t.placed,false);this.tiles.delete(k);}}}
 private async load(k:string,t:{placed?:Placed;loading:boolean;x:number;y:number}){t.loading=true;this.active++;try{
  const [url,terrain]=await Promise.all([resolveUrl(),terrainTile(t.x,t.y,Z).then(d=>d.heights).catch(()=>null)]);
  const id=`${k}:${Math.random()}`,res=await new Promise<Result>(resolve=>{this.pending.set(id,resolve);this.worker.postMessage({id,url:url.replace('{z}',String(Z)).replace('{x}',String(t.x)).replace('{y}',String(t.y)),x:t.x,y:t.y,z:Z,terrain:terrain?new Float32Array(terrain):null,buildings:true,trees:this.quality!=='performance'});});
  if(!this.tiles.has(k)||res.error||!res.out?.length)return;
  let count=0;for(const o of res.out)count+=o.pos.length/3;const pos=new Float32Array(count*3),nrm=new Float32Array(count*3),st=new Float32Array(count*2),col=new Float32Array(count*3);let at=0;
  for(const o of res.out){const nv=o.pos.length/3;pos.set(o.pos,at*3);nrm.set(o.nrm,at*3);st.set(o.st,at*2);for(let i=0;i<nv;i++){col[(at+i)*3]=o.color[0];col[(at+i)*3+1]=o.color[1];col[(at+i)*3+2]=o.color[2];}at+=nv;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));g.setAttribute('st',new THREE.BufferAttribute(st,2));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,this.material);mesh.frustumCulled=false;const n=2**Z;t.placed=this.layer.add(mesh,{lon:(t.x+.5)/n*360-180,lat:res.latC,alt:0});this.layer.repaint();}catch{}finally{t.loading=false;this.active--;}}
 reset(){for(const t of this.tiles.values())if(t.placed)this.layer.remove(t.placed,false);this.tiles.clear();}
 destroy(){this.worker.terminate();this.reset();}}
