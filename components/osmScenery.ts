// Streams OpenStreetMap 3D scenery (buildings, forests, aprons, taxiways) around the aircraft from
// OpenFreeMap vector tiles. Geometry is built in a worker and drawn as batched Cesium primitives.
import type * as Cesium from 'cesium';
import {terrainTile} from '@/lib/worldTerrain';
type C=typeof Cesium;
type Result={id:string;latC:number;out?:{color:[number,number,number];pos:Float32Array;nrm:Float32Array;st:Float32Array}[];error?:string};
// Facade shader: window grids per floor, sky-tinted glass by day and randomly lit windows at night.
const VS=`in vec3 position3DHigh;in vec3 position3DLow;in vec3 normal;in vec2 st;in vec4 color;in float batchId;out vec3 v_positionEC;out vec3 v_normalEC;out vec2 v_st;out vec4 v_color;
void main(){vec4 p=czm_computePosition();v_positionEC=(czm_modelViewRelativeToEye*p).xyz;v_normalEC=czm_normal*normal;v_st=st;v_color=color;gl_Position=czm_modelViewProjectionRelativeToEye*p;}`;
const FS=`in vec3 v_positionEC;in vec3 v_normalEC;in vec2 v_st;in vec4 v_color;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 n=normalize(v_normalEC);if(!gl_FrontFacing)n=-n;vec3 up=normalize(czm_normal*vec3(0.0,0.0,1.0));float day=smoothstep(-0.1,0.18,dot(normalize(czm_sunDirectionEC),up));vec3 base=v_color.rgb;vec3 glow=vec3(0.0);
 if(v_st.x>=0.0){vec2 cell=vec2(v_st.x/3.3,v_st.y/3.3);vec2 f=fract(cell);float win=step(0.2,f.x)*step(f.x,0.8)*step(0.28,f.y)*step(f.y,0.86)*step(1.0,cell.y);float bay=step(0.94,fract(v_st.x/16.5));win*=1.0-bay;
  vec3 sky=mix(vec3(0.12,0.15,0.19),vec3(0.42,0.52,0.62),clamp(0.5+0.5*dot(reflect(normalize(v_positionEC),n),up),0.0,1.0));base=mix(base*(0.92+0.08*hash(floor(cell*0.5))),sky*mix(0.25,1.0,day),win*0.88);
  float lit=step(0.52,hash(floor(cell)+vec2(floor(v_st.x/41.0),7.0)));glow=win*lit*(1.0-day)*mix(vec3(1.0,0.74,0.42),vec3(0.85,0.9,1.0),hash(floor(cell)+3.1))*1.15;}
 float diff=max(dot(n,normalize(czm_lightDirectionEC)),0.0);vec3 col=base*(mix(0.06,0.34,day)+0.9*diff*day)+glow;out_FragColor=vec4(col,1.0);}`;
const Z=14;let tileUrl:Promise<string>|undefined;
const resolveUrl=()=>tileUrl??=fetch('https://tiles.openfreemap.org/planet').then(r=>r.json()).then(j=>String(j.tiles[0])).catch(()=>'https://tiles.openfreemap.org/planet/20260927_080001_pt/{z}/{x}/{y}.pbf');
export class OsmScenery{private worker:Worker;private tiles=new Map<string,{prim?:Cesium.Primitive;loading:boolean;x:number;y:number}>();private pending=new Map<string,(r:Result)=>void>();private active=0;quality:'performance'|'balanced'|'high';
 constructor(private C:C,private scene:Cesium.Scene,quality:'performance'|'balanced'|'high'){this.quality=quality;this.worker=new Worker('/flight/osm-worker.js',{type:'module'});this.worker.onmessage=(e:MessageEvent<Result>)=>{this.pending.get(e.data.id)?.(e.data);this.pending.delete(e.data.id);};}
 /** Keep tiles loaded around a position; detail depends on height above ground. */
 update(lat:number,lon:number,agl:number){const n=2**Z,fx=(lon+180)/360*n,fy=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,x0=Math.floor(fx),y0=Math.floor(fy),radius=agl>3500?0:this.quality==='high'&&agl<1800?2:1,want=new Set<string>();
  if(agl<6000)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy>radius*radius+1)continue;const x=((x0+dx)%n+n)%n,y=y0+dy,k=`${x}/${y}`;want.add(k);if(!this.tiles.has(k))this.tiles.set(k,{loading:false,x,y});}
  // Nearest tiles first, two at a time, so the area under the aircraft fills in quickly.
  const queue=[...this.tiles.entries()].filter(([k,t])=>want.has(k)&&!t.prim&&!t.loading).sort((a,b)=>Math.hypot(a[1].x+.5-fx,a[1].y+.5-fy)-Math.hypot(b[1].x+.5-fx,b[1].y+.5-fy));
  for(const [k,t] of queue){if(this.active>=2)break;void this.load(k,t);}
  for(const [k,t] of this.tiles){const far=Math.max(Math.abs(t.x-x0),Math.abs(t.y-y0))>radius+1;if(far&&!t.loading){if(t.prim&&!t.prim.isDestroyed())this.scene.primitives.remove(t.prim);this.tiles.delete(k);}}}
 private async load(k:string,t:{prim?:Cesium.Primitive;loading:boolean;x:number;y:number}){t.loading=true;this.active++;try{
  const [url,terrain]=await Promise.all([resolveUrl(),terrainTile(t.x,t.y,Z).then(d=>d.heights).catch(()=>null)]);
  const id=`${k}:${Math.random()}`,res=await new Promise<Result>(resolve=>{this.pending.set(id,resolve);this.worker.postMessage({id,url:url.replace('{z}',String(Z)).replace('{x}',String(t.x)).replace('{y}',String(t.y)),x:t.x,y:t.y,z:Z,terrain:terrain?new Float32Array(terrain):null,buildings:true,trees:this.quality!=='performance'});});
  if(!this.tiles.has(k)||res.error||!res.out?.length)return;const C=this.C,n=2**Z,lonC=(t.x+.5)/n*360-180;
  const instances=res.out.map(o=>{const pos=new Float64Array(o.pos);return new C.GeometryInstance({geometry:new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:pos}),normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:o.nrm}),st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:o.st})} as unknown as Cesium.GeometryAttributes,indices:(()=>{const n=pos.length/3,ix=n>65535?new Uint32Array(n):new Uint16Array(n);for(let k=0;k<n;k++)ix[k]=k;return ix;})(),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(pos as unknown as number[])}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(new C.Color(o.color[0],o.color[1],o.color[2],1))}});});
  const prim=new C.Primitive({geometryInstances:instances,appearance:new C.Appearance({vertexShaderSource:VS,fragmentShaderSource:FS,translucent:false,closed:false,renderState:{depthTest:{enabled:true},depthMask:true}}),modelMatrix:C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lonC,res.latC,0)),asynchronous:false,compressVertices:false,allowPicking:false,releaseGeometryInstances:true,shadows:this.quality==='high'?C.ShadowMode.ENABLED:C.ShadowMode.DISABLED});
  t.prim=this.scene.primitives.add(prim);}catch{}finally{t.loading=false;this.active--;}}
 reset(){for(const t of this.tiles.values())if(t.prim&&!t.prim.isDestroyed())this.scene.primitives.remove(t.prim);this.tiles.clear();}
 destroy(){this.worker.terminate();for(const t of this.tiles.values())if(t.prim&&!t.prim.isDestroyed())this.scene.primitives.remove(t.prim);this.tiles.clear();}}
