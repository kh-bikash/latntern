// Streaming reader for Esri I3S 1.7 integrated meshes (node pages, Draco geometry, JPEG textures) in a projected CRS.
// Node meshes are placed in Earth-centred (ECEF) coordinates so they slot into the same anchor frame as 3D Tiles.
import * as THREE from 'three';
import proj4 from 'proj4';
import {WGS84_ELLIPSOID} from '3d-tiles-renderer';

type Obb={center:[number,number,number];halfSize:[number,number,number];quaternion:[number,number,number,number]};
type RawNode={index:number;obb:Obb;children?:number[];lodThreshold?:number;mesh?:{geometry:{resource:number};material:{resource:number}}};
type Node=RawNode&{ecef:THREE.Vector3;radius:number;frame:THREE.Matrix4;state:'none'|'loading'|'ready'|'failed';object?:THREE.Mesh;used:number};
const rad=Math.PI/180;
// Google's Draco decoder (the module three.js ships), used directly: I3S stores per-node position scale factors
// (i3s-scale_x / i3s-scale_y) in Draco attribute metadata, which three's DRACOLoader discards.
/* eslint-disable @typescript-eslint/no-explicit-any */
let dracoModule:Promise<any>|null=null;
function draco():Promise<any>{if(!dracoModule)dracoModule=new Promise((resolve,reject)=>{const w=window as any;
 const go=()=>fetch('/flight/draco/draco_decoder.wasm').then(r=>r.arrayBuffer()).then(wasmBinary=>w.DracoDecoderModule({wasmBinary})).then(resolve,reject);
 if(w.DracoDecoderModule)return go();const sc=document.createElement('script');sc.src='/flight/draco/draco_wasm_wrapper.js';sc.onload=go;sc.onerror=reject;document.head.appendChild(sc);});
 return dracoModule;}
function decodeI3S(d:any,buf:ArrayBuffer){const dec=new d.Decoder(),db=new d.DecoderBuffer(),mesh=new d.Mesh(),mq=new d.MetadataQuerier();
 try{db.Init(new Int8Array(buf),buf.byteLength);const st=dec.DecodeBufferToMesh(db,mesh);if(!st.ok())throw new Error(st.error_msg());
  const pa=dec.GetAttribute(mesh,dec.GetAttributeId(mesh,d.POSITION)),ta=dec.GetAttributeId(mesh,d.TEX_COORD),n=mesh.num_points();
  const pd=new d.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,pa,pd);const pos=new Float32Array(n*3);for(let i=0;i<n*3;i++)pos[i]=pd.GetValue(i);d.destroy(pd);
  let sx=1,sy=1;const md=dec.GetAttributeMetadata(mesh,dec.GetAttributeId(mesh,d.POSITION));
  if(md&&md.ptr){if(mq.HasEntry(md,'i3s-scale_x'))sx=mq.GetDoubleEntry(md,'i3s-scale_x');if(mq.HasEntry(md,'i3s-scale_y'))sy=mq.GetDoubleEntry(md,'i3s-scale_y');}
  for(let i=0;i<n;i++){pos[i*3]*=sx;pos[i*3+1]*=sy;}
  let uv:Float32Array|null=null;if(ta>=0){const ud=new d.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,dec.GetAttribute(mesh,ta),ud);uv=new Float32Array(n*2);for(let i=0;i<n*2;i++)uv[i]=ud.GetValue(i);d.destroy(ud);}
  const nf=mesh.num_faces(),idx=new Uint32Array(nf*3),ptr=d._malloc(nf*12);dec.GetTrianglesUInt32Array(mesh,nf*12,ptr);idx.set(new Uint32Array(d.HEAPU32.buffer,ptr,nf*3));d._free(ptr);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));if(uv)g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(idx,1));return g;}
 finally{d.destroy(mq);d.destroy(mesh);d.destroy(db);d.destroy(dec);}}

export class I3SSource{
 group=new THREE.Group();private nodes=new Map<number,Node>();private pages=new Map<number,Promise<void>|true>();private perPage=64;private ready:Promise<void>;
 private queue:Node[]=[];private active=0;private toWgs:(p:[number,number])=>[number,number];private frame=0;
 maxJobs=32;budget=900;
 /** >1 relaxes the server's screen-area thresholds: whole-area coverage first, finest leaves only when large on screen. */
 lodFactor=3;
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
  .then(([buf,img])=>draco().then(d=>[decodeI3S(d,buf),img] as [THREE.BufferGeometry,ImageBitmap]))
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
   const dist=Math.max(1,tmp.distanceTo(cam)-n.radius),px=2*n.radius*focal/dist,refine=!n.mesh||(n.children?.length&&px*px>(n.lodThreshold??0)*this.lodFactor);
   // skip-LOD: the target level plus one coarse cover layer (150 m – 2.5 km nodes) is fetched, so gaps show coarse
   // photogrammetry rather than the map's terrain while finer nodes stream in
   n.used=this.frame;const target=!(refine&&n.children?.length),cover=n.radius>=150&&n.radius<=2500;if(n.mesh&&(target||cover)&&n.state==='none')wanted.push(n);
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
