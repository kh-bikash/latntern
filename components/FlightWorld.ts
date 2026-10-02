import * as THREE from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {FLIGHT_REGIONS,MISSIONS,missionPoints,type TerrainData,type Aircraft} from '@/lib/flight';

// Original, assembled aircraft: curved fuselage, airfoils, float struts and moving surfaces.
export function buildAircraft(color:string){
 const plane=new THREE.Group();plane.name='Hinode amphibious survey aircraft';
 const paint=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.25}),cream=new THREE.MeshStandardMaterial({color:'#eee8d3',roughness:.4,metalness:.12}),metal=new THREE.MeshStandardMaterial({color:'#29373c',roughness:.4,metalness:.7}),glass=new THREE.MeshPhysicalMaterial({color:'#72abc0',roughness:.12,metalness:.2,transparent:true,opacity:.72,clearcoat:1});
 function ellipsoid(name:string,material:THREE.Material,scale:number[],pos:number[]){const o=new THREE.Mesh(new THREE.SphereGeometry(1,32,18),material);o.name=name;o.scale.set(...scale as [number,number,number]);o.position.set(...pos as [number,number,number]);plane.add(o);return o;}
 function box(name:string,material:THREE.Material,scale:number[],pos:number[],rot=0){const o=new THREE.Mesh(new THREE.BoxGeometry(...scale as [number,number,number]),material);o.name=name;o.position.set(...pos as [number,number,number]);o.rotation.z=rot;plane.add(o);return o;}
 ellipsoid('curved fuselage',cream,[1.35,1.35,6.4],[0,0,.5]);ellipsoid('engine cowling',paint,[1.37,1.3,2.2],[0,-.02,-4.2]);ellipsoid('tinted cockpit',glass,[1.07,1.08,2.45],[0,.96,-.4]);
 // Thin rounded sections, a curved airfoil rather than rectangular blocks.
 for(const side of [-1,1]){ellipsoid('main wing',cream,[8.8,.23,1.65],[side*4.8,1.15,.05]);ellipsoid('wingtip',paint,[1,.26,1.64],[side*12.2,1.15,.05]);ellipsoid('horizontal tail',paint,[3.6,.17,.85],[side*1.8,.65,5.2]);ellipsoid('landing float',metal,[.63,.64,4.4],[side*2,-2.45,-.2]);box('float strut',metal,[.14,2.25,.14],[side*1.7,-1.35,-1.9],side*-.25);box('float strut',metal,[.14,2.25,.14],[side*1.7,-1.35,2],side*-.25);box('wing support',metal,[.11,5.8,.11],[side*3.7,-.75,.3],side*-.95);}
 const fin=ellipsoid('tail fin',paint,[.18,2.1,1.4],[0,1.35,5]);fin.rotation.x=-.22;
 const prop=new THREE.Group();prop.name='rotating propeller';prop.position.set(0,0,-6.25);const hub=new THREE.Mesh(new THREE.SphereGeometry(.4,20,12),metal);prop.add(hub);for(let a=0;a<3;a++){const blade=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),metal);blade.scale.set(.2,1.95,.07);blade.position.set(-Math.sin(a*Math.PI*2/3),Math.cos(a*Math.PI*2/3),0);blade.rotation.z=a*Math.PI*2/3;prop.add(blade);}plane.add(prop);
 const lights=new THREE.Group();for(const side of [-1,1]){const nav=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:side<0?'#ff4646':'#91ffcc'}));nav.position.set(side*12.9,1.2,.1);lights.add(nav);}plane.add(lights);
 // Wingtops carry stripes and a dark roundel for readable identity.
 for(const side of [-1,1]){box('wing stripe',paint,[.7,.035,2.8],[side*8,1.38,.1]);const mark=new THREE.Mesh(new THREE.CircleGeometry(.64,28),paint);mark.rotation.x=-Math.PI/2;mark.position.set(side*10,1.4,.1);plane.add(mark);}
 return {plane,prop};
}
export function terrainGeometry(t:TerrainData){const geo=new THREE.BufferGeometry(),positions=[],uv=[],indices=[],n=t.grid-1;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){positions.push(i/n*t.size,t.heights[j*t.grid+i],j/n*t.size);uv.push(i/n,1-j/n);}for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*t.grid+i;indices.push(a,a+t.grid,a+1,a+1,a+t.grid,a+t.grid+1);}geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;}
export async function buildFlightWorld(t:TerrainData,mission:number){
 const scene=new THREE.Scene(),region=FLIGHT_REGIONS.find(r=>r.id===t.id)!;
 const dawn=region.weather==='dawn'||region.weather==='sunset',fogColor=dawn?'#ced5d6':'#d2e0e4';scene.fog=new THREE.FogExp2(fogColor,region.weather==='mist'?.000095:.000065);
 const sky=new Sky();sky.scale.setScalar(220000);scene.add(sky);const u=sky.material.uniforms;u.turbidity.value=3;u.rayleigh.value=1.7;u.mieCoefficient.value=.004;u.mieDirectionalG.value=.86;const sun=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(dawn?79:55),THREE.MathUtils.degToRad(118));u.sunPosition.value.copy(sun);
 scene.add(new THREE.HemisphereLight('#c9e3ff','#817556',2.2));const key=new THREE.DirectionalLight(dawn?'#fff0cf':'#ffffff',2.3);key.position.copy(sun.clone().multiplyScalar(10000));scene.add(key);
 const texture=await new THREE.TextureLoader().loadAsync(`/flight/terrain/${t.id}.webp`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const terrain=new THREE.Mesh(terrainGeometry(t),new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0}));terrain.name=`Real ${t.name} elevation and aerial photography`;scene.add(terrain);
 // A 3x wider geographic context, with a hole for the detailed central mesh.
 // Only the inner area is playable; the distant hills are also real DEM data.
 const farResponse=await fetch(`/flight/terrain/${t.id}-outer.json`);if(!farResponse.ok)throw new Error('Outer scenery download failed.');const far=await farResponse.json() as Pick<TerrainData,'grid'|'size'|'heights'>;
 const farTexture=await new THREE.TextureLoader().loadAsync(`/flight/terrain/${t.id}-outer.webp`);farTexture.colorSpace=THREE.SRGBColorSpace;farTexture.anisotropy=4;const farGeo=terrainGeometry({...t,...far}),farIndices=[],n=far.grid-1;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(i>=n/3&&i<n*2/3&&j>=n/3&&j<n*2/3)continue;const a=j*far.grid+i;farIndices.push(a,a+far.grid,a+1,a+1,a+far.grid,a+far.grid+1);}farGeo.setIndex(farIndices);farGeo.translate(-t.size,0,-t.size);const farMesh=new THREE.Mesh(farGeo,new THREE.MeshStandardMaterial({map:farTexture,roughness:1}));farMesh.name='Real surrounding terrain';scene.add(farMesh);
 // Actual sea-level water only; mountainous regions never receive a fake water layer.
 if(Math.min(...t.heights)<1){const water=new THREE.Mesh(new THREE.PlaneGeometry(t.size*3,t.size*3),new THREE.MeshPhysicalMaterial({color:'#457a8c',roughness:.35,metalness:.35,transparent:true,opacity:.55}));water.rotation.x=-Math.PI/2;water.position.set(t.size/2,.8,t.size/2);scene.add(water);}
 // Wispy, translucent cloud banks. Their shadows do not hide the geographic detail.
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.22)');gradient.addColorStop(.45,'rgba(255,255,255,.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const cloudTex=new THREE.CanvasTexture(c),clouds=new THREE.Group();for(let i=0;i<16;i++){const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,opacity:region.weather==='mist'?.8:.4}));cloud.position.set((.1+(i*.237)% .8)*t.size,1800+(i%4)*360,(.15+(i*.173)%.75)*t.size);cloud.scale.set(2600,500,1);clouds.add(cloud);}scene.add(clouds);
 const markers=new THREE.Group();scene.add(markers);
 function setMission(m:number){markers.clear();const points=missionPoints(m,t),kind=MISSIONS[Math.min(11,m)].kind;points.forEach((p,i)=>{const target=new THREE.Group();target.position.set(p.x,p.y,p.z);const ring=new THREE.Mesh(new THREE.TorusGeometry(kind==='route'?260:160,kind==='route'?8:4,10,80),new THREE.MeshBasicMaterial({color:'#ffdb81',transparent:true,opacity:kind==='route'?.85:.6}));if(kind!=='route')ring.rotation.x=Math.PI/2;else if(i+1<points.length)ring.rotation.y=Math.atan2(points[i+1].x-p.x,p.z-points[i+1].z);target.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(8,8,450,12),new THREE.MeshBasicMaterial({color:'#ffd78b',transparent:true,opacity:.4,depthWrite:false}));beam.position.y=-225;target.add(beam);markers.add(target);});}
 setMission(mission);
 const local=buildAircraft('#cf584a'),remote=buildAircraft('#347f8e');scene.add(local.plane,remote.plane);remote.plane.visible=false;
 return {scene,terrain,local,remote,markers,clouds,setMission};
}
export function placeAircraft(group:THREE.Group,p:Aircraft){group.position.set(p.x,p.y,p.z);group.rotation.set(p.pitch,p.yaw,-p.roll,'YXZ');}
export function disposeWorld(scene:THREE.Scene){const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}else if(o instanceof THREE.Sprite)materials.add(o.material);});for(const m of materials){for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);m.dispose();}textures.forEach(t=>t.dispose());scene.clear();}
