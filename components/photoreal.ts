// Photogrammetry scenery: streams open 3D meshes (OGC 3D Tiles or Esri I3S) into the three.js layer.
// Sources live in Earth-centred coordinates under one east-north-up anchor frame (metres) near the camera, which the
// layer places in mercator space; the anchor follows the camera so mercator distortion stays negligible.
import * as THREE from 'three';
import {TilesRenderer,WGS84_ELLIPSOID} from '3d-tiles-renderer';
import type {ThreeLayer,Placed} from './threeLayer';
import {PHOTOREAL,type PhotorealRegion} from '@/lib/photoreal';
import {convertGltf1B3dm,isGltf1B3dm} from './gltf1';
import {I3SSource} from './i3s';

const rad=Math.PI/180,R_EARTH=6371000;
/** 3D Tiles coarser than this (metres) stay hidden: the satellite/orthophoto map is sharper until detail streams in. */
const MAX_SHOWN_ERROR=40;
export type CameraPose={lat:number;lon:number;alt:number;heading:number;pitch:number;roll:number;fov:number;aspect:number;width:number;height:number};

type Shared={day:{value:number};anchor:{value:THREE.Vector2};curv:{value:number};cam:{value:THREE.Vector3};k:{value:number};bias:{value:number}};
/** Unlit photo texture (the light is baked into the imagery), dimmed with daylight. The layer is a flat mercator world
 *  while the mesh frame is tangent at the anchor, so distant vertices are lifted by d²/2R; the colour pass also pulls
 *  vertices toward the camera (8 m + 1 % of range) so the mesh wins over the coarser map terrain it covers. */
function flatEarthMaterial(map:THREE.Texture|null,u:Shared){const m=new THREE.MeshBasicMaterial({map,toneMapped:false,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uDay:u.day,uAnchor:u.anchor,uCurv:u.curv,uCam:u.cam,uK:u.k,uBias:u.bias});
  sh.vertexShader=sh.vertexShader.replace('void main() {','uniform vec2 uAnchor;\nuniform float uCurv;\nuniform vec3 uCam;\nuniform float uK;\nuniform float uBias;\nvoid main() {').replace('#include <project_vertex>',[
   'vec4 mvPosition=modelMatrix*vec4(transformed,1.0);','vec2 dd=mvPosition.xy-uAnchor;','mvPosition.z+=dot(dd,dd)*uCurv;',
   'vec3 toCam=uCam-mvPosition.xyz;float dist=length(toCam);mvPosition.xyz+=uBias*toCam/max(dist,1e-12)*min(dist*.5,8.0*uK+dist*.01);',
   'mvPosition=viewMatrix*mvPosition;','gl_Position=projectionMatrix*mvPosition;'].join('\n'));
  sh.fragmentShader=sh.fragmentShader.replace('void main() {','uniform float uDay;\nvoid main() {').replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=uDay;');};
 return m;}

/** A streaming mesh source whose `group` holds Earth-centred (ECEF) content. */
interface Source{group:THREE.Object3D;update(cam:THREE.PerspectiveCamera,width:number,height:number):void;dispose():void}
function tilesSource(region:PhotorealRegion,u:Shared,cam:THREE.PerspectiveCamera):Source{
 // Open servers are latency-bound: request more tiles in parallel and skip siblings.
 const tiles=new TilesRenderer(region.url);tiles.errorTarget=12;tiles.fetchOptions={mode:'cors'};tiles.loadSiblings=false;tiles.downloadQueue.maxJobsPerOrigin=48;
 if(region.gltf1)tiles.registerPlugin({name:'GLTF1_B3DM',parseTile:(buffer:ArrayBuffer,tile:unknown,ext:string,url:string,signal:AbortSignal)=>isGltf1B3dm(buffer)?(tiles as unknown as {parseTile:(...a:unknown[])=>Promise<unknown>}).parseTile(convertGltf1B3dm(buffer),tile as never,ext,url,signal):null} as never);
 tiles.addEventListener('load-model',(e:{scene:THREE.Object3D;tile:{geometricError:number}})=>{const coarse=e.tile.geometricError>MAX_SHOWN_ERROR;e.scene.traverse(o=>{if(coarse)o.visible=false;const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const old=mesh.material as THREE.MeshStandardMaterial;mesh.material=flatEarthMaterial(old.map??null,u);old.dispose();});});
 tiles.setCamera(cam);
 return{group:tiles.group,update:(c,w,h)=>{tiles.setResolution(c,w,h);tiles.update();},dispose:()=>tiles.dispose()};}
function i3sSource(region:PhotorealRegion,u:Shared):Source{const src=new I3SSource(region.url,region.crs!,region.geoid,map=>flatEarthMaterial(map,u));if(typeof window!=='undefined')(window as unknown as {__i3s?:I3SSource}).__i3s=src;
 return{group:src.group,update:(c,_w,h)=>src.update(c,h),dispose:()=>src.dispose()};}

class RegionTiles{
 src:Source;enu=new THREE.Group();placed:Placed;anchor={lat:0,lon:0};lod=new THREE.PerspectiveCamera(40,1,1,15000);
 u:Shared={day:{value:1},anchor:{value:new THREE.Vector2()},curv:{value:0},cam:{value:new THREE.Vector3()},k:{value:0},bias:{value:0}};
 offset=0;ref:{lat:number;lon:number;elevation:number}|null=null;private calibratedAt=0;calibrations=0;private ray=new THREE.Raycaster();
 constructor(public region:PhotorealRegion,layer:ThreeLayer){
  this.src=region.format==='i3s'?i3sSource(region,this.u):tilesSource(region,this.u,this.lod);
  this.enu.add(this.src.group);this.src.group.matrixAutoUpdate=false;this.placed=layer.add(this.enu,{visible:false});}
 /** Move the ENU anchor (sea-level metres) and rebuild ECEF→ENU, folding in the geoid height. */
 setAnchor(lat:number,lon:number){this.anchor={lat,lon};this.placed.lat=lat;this.placed.lon=lon;this.placed.alt=-this.offset;
  const frame=WGS84_ELLIPSOID.getEastNorthUpFrame(lat*rad,lon*rad,this.region.geoid,new THREE.Matrix4());this.src.group.matrix.copy(frame).invert();}
 /** LOD selection runs in a rigid metre frame (anchor ENU, 15 km far plane: the map carries the horizon beyond);
  *  the layer then re-applies its mercator placement. */
 update(pose:CameraPose,day:number,layer:ThreeLayer){
  const dx=(pose.lon-this.anchor.lon)*Math.cos(pose.lat*rad)*111320,dy=(pose.lat-this.anchor.lat)*110540;
  if(Math.hypot(dx,dy)>1500||!this.anchor.lat)this.setAnchor(pose.lat,pose.lon);
  const ex=(pose.lon-this.anchor.lon)*Math.cos(pose.lat*rad)*111320,ny=(pose.lat-this.anchor.lat)*110540;
  this.lod.fov=pose.fov;this.lod.aspect=pose.aspect;this.lod.updateProjectionMatrix();
  // camera looks north along +Y with +Z up, then heading (clockwise), pitch (up) and roll
  this.lod.quaternion.setFromEuler(new THREE.Euler(Math.PI/2+pose.pitch*rad,-pose.roll*rad,-pose.heading*rad,'ZXY'));
  this.lod.position.set(ex,ny,pose.alt+this.offset);this.lod.updateMatrixWorld(true);
  this.enu.matrixWorld.identity();this.src.group.updateMatrixWorld(true);
  this.src.update(this.lod,pose.width,pose.height);this.calibrate();
  // curvature / bias uniforms in layer (mercator, centre-relative) units; the layer re-places the ENU frame after this
  const a=layer.merc(this.anchor.lon,this.anchor.lat,0),c=layer.merc(layer.center.lon,layer.center.lat,0),k=a.meterInMercatorCoordinateUnits();
  this.u.anchor.value.set(a.x-c.x,a.y-c.y);this.u.curv.value=1/(2*R_EARTH*k);this.u.day.value=day;this.u.k.value=k;
  const cm=layer.merc(pose.lon,pose.lat,pose.alt);this.u.cam.value.set(cm.x-c.x,cm.y-c.y,cm.z-c.z);}
 /** NRW heights are sea-level (DHHN2016) already; other meshes are not reliably consistent: measure the mesh at the reference runway and shift it
  *  so the real runway sits at the published elevation (the frame is rigid here, so the ray is in anchor metres). */
 private calibrate(){const r=this.ref,now=performance.now();if(!r||this.region.format==='i3s'||now-this.calibratedAt<1500||this.calibrations>40)return;this.calibratedAt=now;
  const x=(r.lon-this.anchor.lon)*Math.cos(r.lat*rad)*111320,y=(r.lat-this.anchor.lat)*110540;this.ray.set(new THREE.Vector3(x,y,9000),new THREE.Vector3(0,0,-1));this.ray.far=2e4;
  const hit=this.ray.intersectObject(this.src.group,true).find(h=>h.object.visible!==false);if(!hit)return;const off=hit.point.z-r.elevation;if(Math.abs(off)>20)return;this.calibrations++;this.offset=off;this.placed.alt=-this.offset;}
 dispose(layer:ThreeLayer){layer.remove(this.placed,false);this.src.dispose();}
}

/** Owns the regions; only the region under (or near) the camera streams. */
export class Photoreal{
 active:RegionTiles|null=null;private ref:{lat:number;lon:number;elevation:number}|null=null;
 constructor(private layer:ThreeLayer){if(typeof window!=='undefined')(window as unknown as {__hinodePhoto?:Photoreal}).__hinodePhoto=this;}
 /** Ground reference (a runway in the region) used to calibrate the mesh height. */
 setReference(r:{lat:number;lon:number;elevation:number}|null){const same=r&&this.ref&&r.lat===this.ref.lat&&r.lon===this.ref.lon;this.ref=r;if(this.active&&!same){this.active.ref=r;this.active.calibrations=0;}}
 /** Bias toggle for the layer's passes: on for the colour pass, off for the depth-only pass. */
 setBias(on:boolean){if(this.active)this.active.u.bias.value=on?1:0;}
 /** Called from the layer before drawing: pick the region, update LOD and placement. */
 frame(pose:CameraPose|null,day:number):THREE.Object3D|null{if(!this.layer.renderer||!pose)return null;
  const region=PHOTOREAL.find(r=>pose.lat>r.bounds[0]-.15&&pose.lat<r.bounds[1]+.15&&pose.lon>r.bounds[2]-.2&&pose.lon<r.bounds[3]+.2)??null;
  if(this.active&&this.active.region!==region){this.active.dispose(this.layer);this.active=null;}
  if(region&&!this.active){this.active=new RegionTiles(region,this.layer);this.active.ref=this.ref;}
  if(!this.active)return null;this.active.placed.visible=true;this.active.update(pose,day,this.layer);return this.active.enu;}
 get region(){return this.active?.region??null;}
}
