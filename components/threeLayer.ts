// three.js scene drawn inside MapLibre as a custom 3D layer. Objects are placed by longitude, latitude and
// altitude in metres; matrices are built relative to a moving centre in double precision so nothing jitters.
import * as THREE from 'three';
import type {CustomLayerInterface,CustomRenderMethodInput,Map as MapLibreMap} from 'maplibre-gl';
export type Placed={obj:THREE.Object3D;lon:number;lat:number;alt:number;heading:number;pitch:number;roll:number;scale:number;visible:boolean};
type MercFn=(lon:number,lat:number,alt:number)=>{x:number;y:number;z:number;meterInMercatorCoordinateUnits:()=>number};
const Z_UP=new THREE.Matrix4().makeRotationX(Math.PI/2);
export class ThreeLayer implements CustomLayerInterface{
 id='three';type='custom' as const;renderingMode='3d' as const;
 scene=new THREE.Scene();camera=new THREE.Camera();renderer?:THREE.WebGLRenderer;placed=new Set<Placed>();center={lon:0,lat:0};sun=new THREE.DirectionalLight('#fff4e0',2.4);hemi=new THREE.HemisphereLight('#dbe8f5','#4b4a44',1.1);
 private map?:MapLibreMap;private tmp=new THREE.Matrix4();private s=new THREE.Matrix4();private r=new THREE.Matrix4();private e=new THREE.Euler();
 constructor(private merc:MercFn){this.hemi.position.set(0,0,1);this.scene.add(this.sun,this.sun.target,this.hemi);this.scene.matrixAutoUpdate=false;}
 onAdd(map:MapLibreMap,gl:WebGLRenderingContext|WebGL2RenderingContext){this.map=map;this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl as WebGL2RenderingContext,antialias:true});this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;}
 add(obj:THREE.Object3D,init:Partial<Placed>={}):Placed{obj.matrixAutoUpdate=false;this.scene.add(obj);const p:Placed={obj,lon:0,lat:0,alt:0,heading:0,pitch:0,roll:0,scale:1,visible:true,...init};this.placed.add(p);return p;}
 remove(p:Placed,disposeMaterials=true){this.scene.remove(p.obj);this.placed.delete(p);p.obj.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();const mats=disposeMaterials&&m.material?(Array.isArray(m.material)?m.material:[m.material]):[];for(const mt of mats){for(const v of Object.values(mt))if(v instanceof THREE.Texture)v.dispose();mt.dispose();}});}
 /** Sun direction from azimuth/elevation in degrees, for model and building lighting. */
 setSun(azimuth:number,elevation:number,day:number){const a=azimuth*Math.PI/180,e=Math.max(-.2,elevation*Math.PI/180);this.sun.position.set(Math.sin(a)*Math.cos(e),-Math.cos(a)*Math.cos(e),Math.sin(e)).multiplyScalar(1e-3);this.sun.intensity=2.6*day;this.hemi.intensity=.25+.95*day;}
 render(_gl:WebGL2RenderingContext|WebGLRenderingContext,opts:CustomRenderMethodInput){if(!this.renderer)return;const c=this.merc(this.center.lon,this.center.lat,0);
  this.camera.projectionMatrix.fromArray(opts.defaultProjectionData.mainMatrix as unknown as number[]).multiply(this.tmp.makeTranslation(c.x,c.y,c.z));this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  for(const p of this.placed){p.obj.visible=p.visible;if(!p.visible)continue;const m=this.merc(p.lon,p.lat,p.alt),k=m.meterInMercatorCoordinateUnits()*p.scale;
   // ENU body rotation: heading clockwise from north, pitch nose-up, roll right-wing-down; then metres → mercator (y points south).
   this.e.set(p.pitch,p.roll,-p.heading*Math.PI/180,'ZXY');this.r.makeRotationFromEuler(this.e);
   p.obj.matrix.makeTranslation(m.x-c.x,m.y-c.y,m.z-c.z).multiply(this.s.makeScale(k,-k,k)).multiply(this.r);p.obj.matrixWorldNeedsUpdate=true;}
  this.scene.updateMatrixWorld(true);this.renderer.resetState();this.renderer.render(this.scene,this.camera);}
 onRemove(){this.renderer?.dispose();}
 repaint(){this.map?.triggerRepaint();}
}
/** Wrap a glTF scene (Y-up) so its nose points north, up is +Z and the origin is its gear contact reference. */
export function wrapModel(gltf:THREE.Object3D,noseAft:boolean){const g=new THREE.Group();const inner=new THREE.Group();inner.add(gltf);inner.matrixAutoUpdate=false;inner.matrix.copy(Z_UP);if(!noseAft)inner.matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI));g.add(inner);return g;}
