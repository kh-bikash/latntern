// Original procedural aircraft, built with three.js and exported in-browser to glTF for the globe.
// Axes follow the bundled Cesium Air model: nose +Z, up +Y, span ±X, metres.
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
type Spec={kind:'trainer'|'jet'};
const urls=new Map<string,Promise<string>>();
function livery(kind:'trainer'|'jet'){const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d')!;
 // u runs nose→tail around the lathe (v), so paint along the length on the x axis.
 x.fillStyle='#f4f6f7';x.fillRect(0,0,1024,256);
 if(kind==='jet'){x.fillStyle='#c7ccd1';x.fillRect(0,170,1024,86);x.fillStyle='#b4202a';x.fillRect(0,150,1024,14);x.fillStyle='#1d3557';x.fillRect(0,164,1024,8);
  x.fillStyle='#22272d';for(let i=0;i<34;i++){const px=170+i*22.5;if(px>590&&px<610)continue;x.beginPath();x.roundRect(px,104,9,14,4);x.fill();}
  x.fillStyle='#384049';for(const d of [150,600,905])x.fillRect(d,96,14,40);x.fillStyle='#16191c';x.beginPath();x.moveTo(28,98);x.lineTo(70,92);x.lineTo(74,116);x.lineTo(30,118);x.fill();
  x.fillStyle='#b4202a';x.font='bold 34px Arial';x.fillText('HINODE',360,80);x.fillStyle='#1d3557';x.font='bold 16px Arial';x.fillText('JA200H',880,150);}
 else{x.fillStyle='#d23c2f';x.fillRect(0,150,1024,16);x.fillStyle='#24476b';x.fillRect(0,166,1024,10);x.fillStyle='#1b2228';x.beginPath();x.moveTo(250,60);x.lineTo(520,54);x.lineTo(540,128);x.lineTo(240,130);x.fill();x.fillStyle='#24476b';x.font='bold 30px Arial';x.fillText('JA4180',640,120);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;}
/** Fuselage of revolution from (z, radius) stations, with a squashed vertical scale. */
function fuselage(stations:[number,number][],mat:THREE.Material,yScale=1){const pts=stations.map(([z,r])=>new THREE.Vector2(Math.max(.001,r),z));const g=new THREE.LatheGeometry(pts,40);g.rotateY(Math.PI/2);
 // Lathe revolves around +Y; reorient so the axis is +Z (nose forward) and remap UVs to run along the length.
 const pos=g.attributes.position as THREE.BufferAttribute,uv=g.attributes.uv as THREE.BufferAttribute,zs=stations.map(s=>s[0]),zmin=Math.min(...zs),zmax=Math.max(...zs);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const ang=Math.atan2(x,z);pos.setXYZ(i,x,z*yScale,y);uv.setXY(i,1-(y-zmin)/(zmax-zmin),.5-Math.cos(ang)*.5);}
 g.computeVertexNormals();return new THREE.Mesh(g,mat);}
/** Tapered, swept lifting surface with a thick rounded airfoil section. */
function surface(span:number,rootChord:number,tipChord:number,sweep:number,dihedral:number,thick:number,mat:THREE.Material,vertical=false){
 const sec=[[1,0],[.95,.012],[.75,.045],[.5,.06],[.3,.062],[.15,.052],[.05,.034],[0,0],[.05,-.022],[.15,-.03],[.3,-.032],[.5,-.03],[.75,-.02],[.95,-.006]],n=sec.length,steps=6,pos:number[]=[],idx:number[]=[];
 for(let k=0;k<=steps;k++){const t=k/steps,chord=rootChord+(tipChord-rootChord)*t,s=span*t,le=-Math.tan(sweep)*s;for(const [u,v] of sec){const z=le-u*chord+rootChord*.25,y=v*chord*thick;if(vertical)pos.push(y,s,z);else pos.push(s,y+Math.tan(dihedral)*s,z);}}
 for(let k=0;k<steps;k++)for(let i=0;i<n;i++){const a=k*n+i,b=k*n+(i+1)%n,c=(k+1)*n+i,d=(k+1)*n+(i+1)%n;idx.push(a,c,b,b,c,d);}
 const tip=steps*n;pos.push(...pos.slice(tip*3,tip*3+3));for(let i=1;i<n-1;i++)idx.push(tip,tip+i,tip+i+1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return new THREE.Mesh(g,mat);}
function mirror(m:THREE.Mesh){const o=m.clone();o.scale.x=-1;o.geometry=m.geometry.clone();const p=o.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<p.count;i++)p.setX(i,-p.getX(i));const idx=o.geometry.index!;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+1));idx.setX(i+1,a);}o.scale.x=1;o.geometry.computeVertexNormals();return o;}
function wheel(r:number,w:number,mat:THREE.Material){const g=new THREE.CylinderGeometry(r,r,w,20);g.rotateZ(Math.PI/2);return new THREE.Mesh(g,mat);}
function buildJet(){const root=new THREE.Group();root.name='NB-200';
 const paint=new THREE.MeshStandardMaterial({map:livery('jet'),metalness:.35,roughness:.38}),white=new THREE.MeshStandardMaterial({color:'#eef1f3',metalness:.3,roughness:.4}),grey=new THREE.MeshStandardMaterial({color:'#9aa3ab',metalness:.7,roughness:.3}),dark=new THREE.MeshStandardMaterial({color:'#1a1d21',metalness:.4,roughness:.6}),tail=new THREE.MeshStandardMaterial({color:'#b4202a',metalness:.3,roughness:.4}),chrome=new THREE.MeshStandardMaterial({color:'#d9dde1',metalness:1,roughness:.18});
 const L=37.6,r=1.98,body=fuselage([[L/2,0],[L/2-.25,.55],[L/2-.9,1.15],[L/2-2,1.62],[L/2-3.6,1.92],[L/2-6,r],[-L/2+11,r],[-L/2+6,1.6],[-L/2+3,1.0],[-L/2+.6,.42],[-L/2,.15]],paint,1.05);body.position.y=.15;root.add(body);
 const wing=surface(16.4,6.1,1.5,25*Math.PI/180,5.5*Math.PI/180,1.05,white);wing.position.set(1.95,-1.05,1.6);root.add(wing,mirror(wing));
 for(const s of [-1,1]){const wl=surface(2.3,1.5,.6,38*Math.PI/180,0,.8,tail,true);wl.position.set(s*18.2,.55,-6.3);root.add(wl);}
 const stab=surface(6.1,3.6,1.3,30*Math.PI/180,6*Math.PI/180,.9,white);stab.position.set(.3,.95,-14.4);root.add(stab,mirror(stab));
 const fin=surface(5.9,5.6,1.8,36*Math.PI/180,0,1,tail,true);fin.position.set(0,1.95,-12.2);root.add(fin);
 for(const s of [-1,1]){const nac=fuselage([[2.2,.95],[2,1.08],[.5,1.12],[-1.2,1.0],[-2.4,.62],[-2.9,.32]],white);nac.position.set(s*5.75,-1.75,4.4);root.add(nac);const fan=new THREE.Mesh(new THREE.CircleGeometry(.98,32),dark);fan.position.set(s*5.75,-1.75,6.55);root.add(fan);
  const spinner=new THREE.Mesh(new THREE.ConeGeometry(.28,.5,20),chrome);spinner.rotation.x=Math.PI/2;spinner.position.set(s*5.75,-1.75,6.75);root.add(spinner);const pylon=new THREE.Mesh(new THREE.BoxGeometry(.3,1.1,3.6),white);pylon.position.set(s*5.75,-.75,3.3);root.add(pylon);
  const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.33,.5,.8,20),grey);exhaust.rotation.x=Math.PI/2;exhaust.position.set(s*5.75,-1.75,1.3);root.add(exhaust);}
 const belly=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),white);belly.scale.set(1.9,.8,5.5);belly.position.set(0,-1.3,1.8);root.add(belly);
 const gear=new THREE.Group();gear.name='gear';const strut=(x:number,z:number,h:number,n:number,rw:number)=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,h,10),chrome);s.position.set(x,-1.2-h/2+.3,z);gear.add(s);for(let k=0;k<n;k++){const w=wheel(rw,.4,dark);w.position.set(x+(k-(n-1)/2)*.55,-1.2-h+.3,z);gear.add(w);}};
 strut(-3.8,-.6,1.95,2,.58);strut(3.8,-.6,1.95,2,.58);strut(0,13.6,1.8,2,.38);root.add(gear);
 const lights=new THREE.Group();lights.name='lights';root.add(lights);root.position.y=0;return root;}
function buildTrainer(){const root=new THREE.Group();root.name='Kestrel';
 const paint=new THREE.MeshStandardMaterial({map:livery('trainer'),metalness:.15,roughness:.45}),white=new THREE.MeshStandardMaterial({color:'#f2f4f5',metalness:.15,roughness:.45}),red=new THREE.MeshStandardMaterial({color:'#d23c2f',metalness:.2,roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#15191c',roughness:.7}),glass=new THREE.MeshStandardMaterial({color:'#20303c',metalness:.6,roughness:.08,transparent:true,opacity:.85}),metal=new THREE.MeshStandardMaterial({color:'#b9bec3',metalness:.85,roughness:.3});
 const body=fuselage([[3.1,.05],[3.0,.35],[2.6,.55],[1.8,.66],[.6,.7],[-.6,.66],[-2,.48],[-3.6,.28],[-4.9,.14],[-5.2,.06]],paint,1.25);body.position.y=.15;root.add(body);
 const cabin=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),glass);cabin.scale.set(.62,.55,1.5);cabin.position.set(0,.85,.55);root.add(cabin);
 const wing=surface(5.5,1.62,1.12,0,1.7*Math.PI/180,1.2,white);wing.position.set(.5,1.42,.95);root.add(wing,mirror(wing));const tipR=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.8),red);tipR.position.set(6.05,1.6,.45);root.add(tipR);
 for(const s of [-1,1]){const st=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,3.1,8),white);st.position.set(s*1.7,.6,.35);st.rotation.z=s*-1.15;root.add(st);}
 const stab=surface(1.8,1.05,.7,8*Math.PI/180,0,.9,white);stab.position.set(.2,.35,-4.4);root.add(stab,mirror(stab));const fin=surface(1.65,1.4,.75,32*Math.PI/180,0,.9,red,true);fin.position.set(0,.55,-4.0);root.add(fin);
 const spinner=new THREE.Mesh(new THREE.ConeGeometry(.2,.45,20),red);spinner.rotation.x=Math.PI/2;spinner.position.set(0,.2,3.3);root.add(spinner);
 const prop=new THREE.Group();prop.name='prop';prop.position.set(0,.2,3.2);for(const s of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(.09,.95,.03),dark);b.position.y=s*.5;b.rotation.y=s*.25;prop.add(b);}root.add(prop);
 const gear=new THREE.Group();gear.name='gear';for(const s of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.9,.18),metal);leg.position.set(s*.95,-.55,-.15);leg.rotation.z=s*.55;gear.add(leg);const w=wheel(.27,.16,dark);w.position.set(s*1.2,-.95,-.15);gear.add(w);const fair=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),red);fair.scale.set(.15,.24,.42);fair.position.set(s*1.2,-.92,-.15);gear.add(fair);}
 const nl=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.75,8),metal);nl.position.set(0,-.55,2.35);gear.add(nl);const nw=wheel(.2,.12,dark);nw.position.set(0,-.95,2.35);gear.add(nw);root.add(gear);return root;}
/** Ground contact of each model below its origin (m), for placing wheels on the runway. */
export const MODEL_GROUND:Record<string,number>={trainer:1.22,jet:3.43,twin:2.3};
export function aircraftModelUrl(kind:Spec['kind']){let u=urls.get(kind);if(u)return u;u=new Promise<string>((resolve,reject)=>{const scene=new THREE.Scene();scene.add(kind==='jet'?buildJet():buildTrainer());new GLTFExporter().parse(scene,r=>resolve(URL.createObjectURL(new Blob([r as ArrayBuffer],{type:'model/gltf-binary'}))),e=>reject(e),{binary:true});});urls.set(kind,u);return u;}
