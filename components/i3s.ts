// Streaming reader for Esri I3S 1.7 integrated meshes (node pages, Draco geometry, JPEG textures) in a projected CRS.
// Node meshes are placed in Earth-centred (ECEF) coordinates so they slot into the same anchor frame as 3D Tiles.
import * as THREE from 'three';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import proj4 from 'proj4';
import {WGS84_ELLIPSOID} from '3d-tiles-renderer';

type Obb={center:[number,number,number];halfSize:[number,number,number];quaternion:[number,number,number,number]};
type RawNode={index:number;obb:Obb;children?:number[];lodThreshold?:number;mesh?:{geometry:{resource:number};material:{resource:number}}};
type Node=RawNode&{ecef:THREE.Vector3;radius:number;frame:THREE.Matrix4;state:'none'|'loading'|'ready'|'failed';object?:THREE.Mesh;used:number};
const rad=Math.PI/180;
let draco:DRACOLoader|null=null;
const dracoLoader=()=>{if(!draco){draco=new DRACOLoader();draco.setDecoderPath('/flight/draco/');draco.preload();}return draco;};

export class I3SSource{
 group=new THREE.Group();private nodes=new Map<number,Node>();private pages=new Map<number,Promise<void>|true>();private perPage=64;private ready:Promise<void>;
 private queue:Node[]=[];private active=0;private toWgs:(p:[number,number])=>[number,number];private frame=0;
 maxJobs=32;budget=900;
 constructor(private base:string,crs:string,private geoid:number,private material:(map:THREE.Texture)=>THREE.Material){
  this.toWgs=proj4(crs,'WGS84').forward as (p:[number,number])=>[number,number];
  this.ready=fetch(`${base}?f=json`).then(r=>r.json()).then((l:{nodePages?:{nodesPerPage:number}})=>{this.perPage=l.nodePages?.nodesPerPage??64;}).then(()=>this.page(0));
 }
 private page(p:number){const have=this.pages.get(p);if(have)return have===true?Promise.resolve():have;
  const pr=fetch(`${this.base}/nodepages/${p}`).then(r=>r.json()).then((d:{nodes:RawNode[]})=>{for(const n of d.nodes)this.nodes.set(n.index,this.prepare(n));this.pages.set(p,true);}).catch(()=>{this.pages.delete(p);});
  this.pages.set(p,pr);return pr;}
 /** Node frame: east/north/up at the node centre, rotated by UTM grid convergence and scaled by the point scale factor. */
 private prepare(n:RawNode):Node{const [e,nn,z]=n.obb.center,[lon,lat]=this.toWgs([e,nn]),[lon2,lat2]=this.toWgs([e,nn+100]);
  const dN=(lat2-lat)*110540,dE=(lon2-lon)*111320*Math.cos(lat*rad),gamma=Math.atan2(dE,dN),k=100/Math.hypot(dE,dN);
  const frame=WGS84_ELLIPSOID.getEastNorthUpFrame(lat*rad,lon*rad,z+this.geoid,new THREE.Matrix4()).multiply(new THREE.Matrix4().makeRotationZ(-gamma)).multiply(new THREE.Matrix4().makeScale(1/k,1/k,1));
  const ecef=new THREE.Vector3().setFromMatrixPosition(frame);return{...n,ecef,radius:Math.hypot(...n.obb.halfSize),frame,state:'none',used:0};}
 private load(n:Node){n.state='loading';this.active++;const r=n.mesh!.geometry.resource;
  Promise.all([fetch(`${this.base}/nodes/${r}/geometries/1`).then(x=>{if(!x.ok)throw new Error(String(x.status));return x.arrayBuffer();}),
   fetch(`${this.base}/nodes/${n.mesh!.material.resource}/textures/0`).then(x=>x.blob()).then(b=>createImageBitmap(b,{imageOrientation:'none'}))])
  .then(([buf,img])=>new Promise<[THREE.BufferGeometry,ImageBitmap]>((res,rej)=>dracoLoader().parse(buf,g=>res([g,img]),rej)))
  .then(([geo,img])=>{const pos=geo.getAttribute('position') as THREE.BufferAttribute;
    // vertices are stored relative to the node's OBB centre; guard against absolute coordinates just in case
    if(pos.count&&Math.abs(pos.getX(0))>5e4){const [cx,cy,cz]=n.obb.center;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)-cx,pos.getY(i)-cy,pos.getZ(i)-cz);}
    geo.computeBoundingSphere();const tex=new THREE.Texture(img);tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.needsUpdate=true;
    const mesh=new THREE.Mesh(geo,this.material(tex));mesh.matrixAutoUpdate=false;mesh.matrix.copy(n.frame);mesh.frustumCulled=false;mesh.visible=false;mesh.userData.node=n.index;
    this.group.add(mesh);n.object=mesh;n.state='ready';})
  .catch(()=>{n.state='failed';}).finally(()=>{this.active--;});}
 private unload(n:Node){const o=n.object;if(!o)return;this.group.remove(o);o.geometry.dispose();const m=o.material as THREE.MeshBasicMaterial;m.map?.dispose();(m.map?.image as ImageBitmap|undefined)?.close?.();m.dispose();n.object=undefined;n.state='none';}
 /** Choose nodes by projected screen area against their lodThreshold, keep parents until children are ready. */
 update(camera:THREE.PerspectiveCamera,height:number){this.frame++;const nodes=this.nodes,root=nodes.get(0);if(!root){void this.ready;return;}
  const toLocal=this.group.matrixWorld,frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const focal=height/(2*Math.tan(camera.fov*rad/2)),cam=camera.position,tmp=new THREE.Vector3(),sphere=new THREE.Sphere(),wanted:Node[]=[],show=new Set<Node>();
  const pageOf=(i:number)=>Math.floor(i/this.perPage);
  const visit=(n:Node,shownAncestor:boolean):void=>{tmp.copy(n.ecef).applyMatrix4(toLocal);sphere.set(tmp,n.radius);if(!frustum.intersectsSphere(sphere))return;
   const dist=Math.max(1,tmp.distanceTo(cam)-n.radius),px=2*n.radius*focal/dist,refine=!n.mesh||(n.children?.length&&px*px>(n.lodThreshold??0));
   // skip-LOD: only the target level is fetched (the map shows through until it arrives); coarser meshes already
   // in memory still bridge the gap while their children load
   n.used=this.frame;const target=!(refine&&n.children?.length);if(n.mesh&&target&&n.state==='none')wanted.push(n);
   const selfShown=!!n.mesh&&n.state==='ready';
   if(refine&&n.children?.length){const kids:Node[]=[];let missing=false;for(const c of n.children){const k=nodes.get(c);if(!k){void this.page(pageOf(c));missing=true;continue;}kids.push(k);}
    // node switching: draw children only once every visible child with a mesh is ready
    const ready=!missing&&kids.every(k=>!k.mesh||k.state==='ready'||k.state==='failed');
    if(!ready&&selfShown&&!shownAncestor){show.add(n);for(const k of kids)visit(k,true);return;}
    for(const k of kids)visit(k,shownAncestor);if(!ready&&!selfShown)return;return;}
   if(selfShown&&!shownAncestor)show.add(n);};
  visit(root,false);
  for(const n of nodes.values())if(n.object)n.object.visible=show.has(n);
  // fetch the largest-on-screen nodes first
  wanted.sort((a,b)=>{tmp.copy(a.ecef).applyMatrix4(toLocal);const da=tmp.distanceTo(cam)/a.radius;tmp.copy(b.ecef).applyMatrix4(toLocal);return da-tmp.distanceTo(cam)/b.radius;});
  for(const n of wanted){if(this.active>=this.maxJobs)break;this.load(n);}
  // evict least recently used meshes over budget
  const loaded=[...nodes.values()].filter(n=>n.object);if(loaded.length>this.budget){loaded.sort((a,b)=>a.used-b.used);for(const n of loaded.slice(0,loaded.length-this.budget))if(n.used<this.frame)this.unload(n);}}
 dispose(){for(const n of this.nodes.values())this.unload(n);this.nodes.clear();}
}
