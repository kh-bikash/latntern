// Photogrammetry scenery: streams open 3D Tiles meshes into the three.js layer.
// The tileset lives in an east-north-up frame (metres) anchored near the camera, which the layer then places in
// mercator space; the anchor follows the camera so mercator distortion stays negligible where you are looking.
import * as THREE from 'three';
import {TilesRenderer} from '3d-tiles-renderer';
import {WGS84_ELLIPSOID} from '3d-tiles-renderer';
import type {ThreeLayer,Placed} from './threeLayer';
import {PHOTOREAL,type PhotorealRegion} from '@/lib/photoreal';
import {convertGltf1B3dm,isGltf1B3dm} from './gltf1';

const rad=Math.PI/180,R_EARTH=6371000;
/** Tiles coarser than this (metres) stay hidden: the satellite/orthophoto map is sharper until detail streams in. */
const MAX_SHOWN_ERROR=40;
export type CameraPose={lat:number;lon:number;alt:number;heading:number;pitch:number;roll:number;fov:number;aspect:number;width:number;height:number};

type Shared={day:{value:number};anchor:{value:THREE.Vector2};curv:{value:number};cam:{value:THREE.Vector3};k:{value:number}};
/** Unlit photo texture (the light is baked into the imagery), dimmed with daylight. The layer is a flat mercator
 *  world while the mesh frame is tangent at the anchor, so lift distant vertices by d²/2R to stay on the flat map. */
function flatEarthMaterial(map:THREE.Texture|null,u:Shared){const m=new THREE.MeshBasicMaterial({map,toneMapped:false,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{sh.uniforms.uDay=u.day;sh.uniforms.uAnchor=u.anchor;sh.uniforms.uCurv=u.curv;sh.uniforms.uCam=u.cam;sh.uniforms.uK=u.k;
  sh.vertexShader=sh.vertexShader.replace('void main() {','uniform vec2 uAnchor;\nuniform float uCurv;\nvoid main() {').replace('#include <project_vertex>',
   'vec4 mvPosition=modelMatrix*vec4(transformed,1.0);\nvec2 dd=mvPosition.xy-uAnchor;\nmvPosition.z+=dot(dd,dd)*uCurv;\nmvPosition=viewMatrix*mvPosition;\ngl_Position=projectionMatrix*mvPosition;');
  sh.fragmentShader=sh.fragmentShader.replace('void main() {','uniform float uDay;\nvoid main() {').replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=uDay;');};
 return m;}

class RegionTiles{
 tiles:TilesRenderer;enu=new THREE.Group();placed:Placed;anchor={lat:0,lon:0};lod=new THREE.PerspectiveCamera(40,1,1,15000);u:Shared={day:{value:1},anchor:{value:new THREE.Vector2()},curv:{value:0},cam:{value:new THREE.Vector3()},k:{value:0}};offset=0;ref:{lat:number;lon:number;elevation:number}|null=null;private calibratedAt=0;calibrations=0;private ray=new THREE.Raycaster();
 constructor(public region:PhotorealRegion,layer:ThreeLayer,renderer:THREE.WebGLRenderer){
  // Open servers are latency-bound: request more tiles in parallel, skip siblings, and stop the mesh at 15 km
  // (the LOD camera's far plane); the satellite map carries the horizon beyond.
  this.tiles=new TilesRenderer(region.url);this.tiles.errorTarget=12;this.tiles.fetchOptions={mode:'cors'};this.tiles.loadSiblings=false;this.tiles.downloadQueue.maxJobsPerOrigin=48;
  if(region.gltf1)this.tiles.registerPlugin({name:'GLTF1_B3DM',parseTile:(buffer:ArrayBuffer,tile:unknown,ext:string,url:string,signal:AbortSignal)=>isGltf1B3dm(buffer)?(this.tiles as unknown as {parseTile:(...a:unknown[])=>Promise<unknown>}).parseTile(convertGltf1B3dm(buffer),tile as never,ext,url,signal):null} as never);
  this.tiles.addEventListener('load-model',(e:{scene:THREE.Object3D;tile:{geometricError:number}})=>{const coarse=e.tile.geometricError>MAX_SHOWN_ERROR;e.scene.traverse(o=>{if(coarse)o.visible=false;const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const old=mesh.material as THREE.MeshStandardMaterial;const mat=flatEarthMaterial(old.map??null,this.u);old.dispose();mesh.material=mat;});});
  this.tiles.setCamera(this.lod);void renderer;
  this.enu.add(this.tiles.group);this.tiles.group.matrixAutoUpdate=false;
  this.placed=layer.add(this.enu,{visible:false});
 }
 /** Move the ENU anchor (sea-level metres) and rebuild ECEF→ENU, folding in the geoid height. */
 setAnchor(lat:number,lon:number){this.anchor={lat,lon};this.placed.lat=lat;this.placed.lon=lon;this.placed.alt=0;
  const frame=WGS84_ELLIPSOID.getEastNorthUpFrame(lat*rad,lon*rad,this.region.geoid,new THREE.Matrix4());this.tiles.group.matrix.copy(frame).invert();}
 /** LOD selection runs in a rigid metre frame (anchor ENU), then the layer re-applies its mercator placement. */
 update(pose:CameraPose,day:number,renderer:THREE.WebGLRenderer,layer:ThreeLayer){
  const dx=(pose.lon-this.anchor.lon)*Math.cos(pose.lat*rad)*111320,dy=(pose.lat-this.anchor.lat)*110540;
  if(Math.hypot(dx,dy)>1500||!this.anchor.lat)this.setAnchor(pose.lat,pose.lon);
  const ex=(pose.lon-this.anchor.lon)*Math.cos(pose.lat*rad)*111320,ny=(pose.lat-this.anchor.lat)*110540;
  this.lod.fov=pose.fov;this.lod.aspect=pose.aspect;this.lod.updateProjectionMatrix();
  // camera looks north along +Y with +Z up, then heading (clockwise), pitch (up) and roll
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2+pose.pitch*rad,-pose.roll*rad,-pose.heading*rad,'ZXY'));
  this.lod.position.set(ex,ny,pose.alt);this.lod.quaternion.copy(q);this.lod.updateMatrixWorld(true);
  this.enu.matrixWorld.identity();this.tiles.group.updateMatrixWorld(true);
  this.tiles.setResolution(this.lod,pose.width,pose.height);this.tiles.update();this.calibrate();
  // curvature uniforms in layer (mercator, centre-relative) units; the layer re-places the ENU frame after this
  const a=layer.merc(this.anchor.lon,this.anchor.lat,0),c=layer.merc(layer.center.lon,layer.center.lat,0),k=a.meterInMercatorCoordinateUnits();
  this.u.anchor.value.set(a.x-c.x,a.y-c.y);this.u.curv.value=1/(2*R_EARTH*k);this.u.day.value=day;this.u.k.value=k;
  const cm=layer.merc(pose.lon,pose.lat,pose.alt);this.u.cam.value.set(cm.x-c.x,cm.y-c.y,cm.z-c.z);
 }
 /** Mesh heights are not reliably ellipsoidal across datasets: measure the mesh at the reference airport and shift
  *  it so the real runway sits at the published elevation (the frame is rigid here, so the ray is in anchor metres). */
 private calibrate(){const r=this.ref,now=performance.now();if(!r||now-this.calibratedAt<1500||this.calibrations>40)return;this.calibratedAt=now;
  const x=(r.lon-this.anchor.lon)*Math.cos(r.lat*rad)*111320,y=(r.lat-this.anchor.lat)*110540;this.ray.set(new THREE.Vector3(x,y,9000),new THREE.Vector3(0,0,-1));this.ray.far=2e4;
  const hit=this.ray.intersectObject(this.tiles.group,true)[0];if(!hit)return;this.calibrations++;this.offset=hit.point.z-r.elevation;this.placed.alt=-this.offset;}
 dispose(layer:ThreeLayer){layer.remove(this.placed,false);this.tiles.dispose();}
}

/** Owns the regions; only the region under (or near) the camera streams. */
export class Photoreal{
 active:RegionTiles|null=null;private ref:{lat:number;lon:number;elevation:number}|null=null;
 /** Ground reference (an airport in the region) used to calibrate the mesh height. */
 setReference(r:{lat:number;lon:number;elevation:number}|null){const same=r&&this.ref&&r.lat===this.ref.lat&&r.lon===this.ref.lon;this.ref=r;if(this.active&&!same){this.active.ref=r;this.active.calibrations=0;}}
 constructor(private layer:ThreeLayer){if(typeof window!=='undefined')(window as unknown as {__hinodePhoto?:Photoreal}).__hinodePhoto=this;}
 /** Called from the layer before drawing: pick the region, update LOD and placement. */
 frame(pose:CameraPose|null,day:number):THREE.Object3D|null{const renderer=this.layer.renderer;if(!renderer||!pose)return null;
  const region=PHOTOREAL.find(r=>pose.lat>r.bounds[0]-.15&&pose.lat<r.bounds[1]+.15&&pose.lon>r.bounds[2]-.2&&pose.lon<r.bounds[3]+.2)??null;
  if(this.active&&this.active.region!==region){this.active.dispose(this.layer);this.active=null;}
  if(region&&!this.active){this.active=new RegionTiles(region,this.layer,renderer);this.active.ref=this.ref;}
  if(!this.active)return null;this.active.placed.visible=true;this.active.update(pose,day,renderer,this.layer);return this.active.enu;}
 get region(){return this.active?.region??null;}
}
