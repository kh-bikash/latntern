// three.js scene drawn inside MapLibre as a custom 3D layer. Objects are placed by longitude, latitude and
// altitude in metres; matrices are built relative to a moving centre in double precision so nothing jitters.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {CustomLayerInterface,CustomRenderMethodInput,Map as MapLibreMap} from 'maplibre-gl';
import type {CameraPose} from './photoreal';
export type Placed={obj:THREE.Object3D;lon:number;lat:number;alt:number;heading:number;pitch:number;roll:number;scale:number;visible:boolean};
type MercFn=(lon:number,lat:number,alt:number)=>{x:number;y:number;z:number;meterInMercatorCoordinateUnits:()=>number};
const Z_UP=new THREE.Matrix4().makeRotationX(Math.PI/2);
export class ThreeLayer implements CustomLayerInterface{
 id='three';type='custom' as const;renderingMode='3d' as const;
 scene=new THREE.Scene();camera=new THREE.Camera();renderer?:THREE.WebGLRenderer;placed=new Set<Placed>();center={lon:0,lat:0};sun=new THREE.DirectionalLight('#fff4e0',2.4);hemi=new THREE.HemisphereLight('#dbe8f5','#4b4a44',1.1);
 day=1;private warned=false;private depthOnly=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide});photoreal?:{frame:(pose:CameraPose|null,day:number)=>THREE.Object3D|null;setReference:(r:{lat:number;lon:number;elevation:number}|null)=>void;get region():{id:string}|null};private map?:MapLibreMap;private tmp=new THREE.Matrix4();private s=new THREE.Matrix4();private r=new THREE.Matrix4();private e=new THREE.Euler();
 constructor(readonly merc:MercFn){this.hemi.position.set(0,0,1);this.scene.add(this.sun,this.sun.target,this.hemi);this.scene.matrixAutoUpdate=false;}
 onAdd(map:MapLibreMap,gl:WebGLRenderingContext|WebGL2RenderingContext){this.map=map;this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl as WebGL2RenderingContext,antialias:true});this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  // studio environment for aircraft reflections (photogrammetry tiles are unlit and ignore it)
  const pm=new THREE.PMREMGenerator(this.renderer);this.scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;this.scene.environmentIntensity=.55;pm.dispose();this.renderer.resetState();}
 add(obj:THREE.Object3D,init:Partial<Placed>={}):Placed{obj.matrixAutoUpdate=false;this.scene.add(obj);const p:Placed={obj,lon:0,lat:0,alt:0,heading:0,pitch:0,roll:0,scale:1,visible:true,...init};this.placed.add(p);return p;}
 remove(p:Placed,disposeMaterials=true){this.scene.remove(p.obj);this.placed.delete(p);p.obj.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();const mats=disposeMaterials&&m.material?(Array.isArray(m.material)?m.material:[m.material]):[];for(const mt of mats){for(const v of Object.values(mt))if(v instanceof THREE.Texture)v.dispose();mt.dispose();}});}
 /** Sun direction from azimuth/elevation in degrees, for model and building lighting. */
 setSun(azimuth:number,elevation:number,day:number){const a=azimuth*Math.PI/180,e=Math.max(-.2,elevation*Math.PI/180);this.sun.position.set(Math.sin(a)*Math.cos(e),-Math.cos(a)*Math.cos(e),Math.sin(e)).multiplyScalar(1e-3);this.sun.intensity=2.6*day;this.hemi.intensity=.25+.95*day;this.day=day;}
 /** Camera pose read back from MapLibre (works for every camera mode and the planner preview). */
 pose():CameraPose|null{const map=this.map;if(!map)return null;type Tr={getCameraLngLat:()=>{lat:number;lng:number};getCameraAltitude:()=>number;fov:number};const mm=map as unknown as {transform?:Tr;_camera?:{transform?:Tr}},tr=mm.transform??mm._camera?.transform,cv=map.getCanvas();if(!tr?.getCameraLngLat){if(!this.warned){this.warned=true;console.warn('pose: no transform',Object.keys(map).filter(k=>/trans|camera/i.test(k)).join(','));}return null;}const ll=tr.getCameraLngLat();
  return{lat:ll.lat,lon:ll.lng,alt:tr.getCameraAltitude(),heading:map.getBearing(),pitch:map.getPitch()-90,roll:(map as unknown as {getRoll?:()=>number}).getRoll?.()??0,fov:tr.fov,aspect:cv.width/Math.max(1,cv.height),width:cv.width,height:cv.height};}
 render(_gl:WebGL2RenderingContext|WebGLRenderingContext,opts:CustomRenderMethodInput){if(!this.renderer)return;const c=this.merc(this.center.lon,this.center.lat,0);
  this.camera.projectionMatrix.fromArray(opts.defaultProjectionData.mainMatrix as unknown as number[]).multiply(this.tmp.makeTranslation(c.x,c.y,c.z));this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  const photo=this.photoreal?.frame(this.pose(),this.day)??null;
  for(const p of this.placed){p.obj.visible=p.visible;if(!p.visible)continue;const m=this.merc(p.lon,p.lat,p.alt),k=m.meterInMercatorCoordinateUnits()*p.scale;
   // ENU body rotation: heading clockwise from north, pitch nose-up, roll right-wing-down; then metres → mercator (y points south).
   this.e.set(p.pitch,p.roll,-p.heading*Math.PI/180,'ZXY');this.r.makeRotationFromEuler(this.e);
   p.obj.matrix.makeTranslation(m.x-c.x,m.y-c.y,m.z-c.z).multiply(this.s.makeScale(k,-k,k)).multiply(this.r);p.obj.matrixWorldNeedsUpdate=true;}
  this.scene.updateMatrixWorld(true);this.renderer.resetState();
  if(photo&&photo.visible){
   // 1) the mesh alone, biased toward the camera so it covers the map's coarser terrain;
   // 2) its true (unbiased) depth; 3) everything else, so aircraft sit on and behind real buildings correctly.
   const shown:THREE.Object3D[]=[];for(const c of this.scene.children)if(c!==photo&&c.visible&&!(c as THREE.Light).isLight){shown.push(c);c.visible=false;}
   this.renderer.render(this.scene,this.camera);
   _gl.depthMask(true);_gl.clear(_gl.DEPTH_BUFFER_BIT);this.renderer.resetState();
   this.scene.overrideMaterial=this.depthOnly;this.renderer.render(this.scene,this.camera);this.scene.overrideMaterial=null;
   for(const c of shown)c.visible=true;photo.visible=false;this.renderer.render(this.scene,this.camera);photo.visible=true;
  }else this.renderer.render(this.scene,this.camera);}
 onRemove(){this.renderer?.dispose();}
 repaint(){this.map?.triggerRepaint();}
}
/** Wrap a glTF scene (Y-up) so its nose points north, up is +Z and the origin is its gear contact reference. */
export function wrapModel(gltf:THREE.Object3D,noseAft:boolean){const g=new THREE.Group();const inner=new THREE.Group();inner.add(gltf);inner.matrixAutoUpdate=false;inner.matrix.copy(Z_UP);if(!noseAft)inner.matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI));g.add(inner);return g;}
