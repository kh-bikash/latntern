import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {WIDTH,HEIGHT,REALMS,trialsFor,escortPoint,type CampaignRoom,type Traveler,type Point} from '@/lib/adventure';
import {pathsFor,projectPath,walkable} from '@/lib/worldLayout';
import {groundHeight,WORLD_SCALE as S} from '@/lib/ground';
import {makeGroundGeometry} from '@/lib/groundMesh';
import {residentFor} from '@/lib/quests';

type Target=Point&{id:string;type:string;crossing?:number;value:unknown};
export type Actor={root:THREE.Group;visual:THREE.Group;model:THREE.Object3D;mixer:THREE.AnimationMixer;actions:THREE.AnimationAction[];feet:THREE.Object3D[];clearance:number[];base:number;last:THREE.Vector2;angle:number;planted:(THREE.Vector3|null)[]};
type Decoration={root:THREE.Group;type:string;seed:number};
const UP=new THREE.Vector3(0,1,0);
const themes=[
 {ground:0x8a9e76,sky:0xaebfc0,trees:'cedar',water:false,dusk:true},
 {ground:0x9c9a85,sky:0xb4c7d2,trees:'cedar',water:false,dusk:false},
 {ground:0x789069,sky:0x99bfb4,trees:'bamboo',water:false,dusk:false},
 {ground:0x839a86,sky:0xa5c6cb,trees:'cedar',water:true,dusk:false},
 {ground:0x818b85,sky:0x8797a4,trees:'cedar',water:false,dusk:true},
 {ground:0x96a28b,sky:0x9cbdc9,trees:'cedar',water:true,dusk:false},
 {ground:0xb9b098,sky:0xb0cbd7,trees:'cedar',water:true,dusk:false},
 {ground:0x898678,sky:0xa6b6c5,trees:'cedar',water:false,dusk:true},
 {ground:0xe1e7e3,sky:0xb4cfdb,trees:'cedar',water:false,dusk:false},
 {ground:0xc6d6d4,sky:0x9eb9c4,trees:'cedar',water:false,dusk:false},
 {ground:0x9c8667,sky:0xc1b6a0,trees:'maple',water:false,dusk:true},
 {ground:0x99a58a,sky:0xb2c7bc,trees:'maple',water:true,dusk:false},
 {ground:0x8a8894,sky:0x667582,trees:'rock',water:false,dusk:true},
 {ground:0x7c9594,sky:0x849cad,trees:'rock',water:true,dusk:true},
 {ground:0xaab18b,sky:0xc1c5b1,trees:'maple',water:false,dusk:false},
 {ground:0xb0b390,sky:0xdac9ae,trees:'maple',water:false,dusk:false},
];

function seeded(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function aim(bone:THREE.Object3D,child:THREE.Object3D,target:THREE.Vector3){
 const origin=bone.getWorldPosition(new THREE.Vector3()),from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 const rotation=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
 bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
function legTo(foot:THREE.Object3D,goal:THREE.Vector3,forward:THREE.Vector3){
 const calf=foot.parent!,thigh=calf.parent!,hip=thigh.getWorldPosition(new THREE.Vector3()),knee=calf.getWorldPosition(new THREE.Vector3()),ankle=foot.getWorldPosition(new THREE.Vector3());
 const a=hip.distanceTo(knee),b=knee.distanceTo(ankle),line=goal.clone().sub(hip),len=THREE.MathUtils.clamp(line.length(),Math.abs(a-b)+.001,a+b-.001);line.normalize();
 const pole=forward.clone().addScaledVector(line,-forward.dot(line)).normalize(),along=(a*a+len*len-b*b)/(2*len),lift=Math.sqrt(Math.max(0,a*a-along*along));
 aim(thigh,calf,hip.clone().addScaledVector(line,along).addScaledVector(pole,lift));aim(calf,foot,hip.addScaledVector(line,len));
}

/** The actual gameplay scene. Every prop and avatar uses the terrain's coordinate
 * system, perspective projection, depth buffer and physical light/shadow. */
export class GroundedWorld{
 readonly renderer:THREE.WebGLRenderer;
 readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(48,1,.1,160);
 private ground!:THREE.Mesh;private actors:Actor[]=[];private resident?:Actor;private fox?:{root:THREE.Group;mixer:THREE.AnimationMixer;walk:THREE.AnimationAction;idle:THREE.AnimationAction};
 private decorations=new Map<string,Decoration>();private textures:THREE.Texture[]=[];private mats=new Set<THREE.Material>();private geos=new Set<THREE.BufferGeometry>();private disposed=false;
 private windUniform={value:0};private water?:THREE.Mesh;private sun=new THREE.DirectionalLight(0xffeed7,3);private lamps:THREE.PointLight[]=[];private lastTime=0;private initializedCamera=false;
 private ray=new THREE.Raycaster();private vegetation:THREE.InstancedMesh[]=[];private theme;private w=1;private h=1;private residentPoint;
 private materials!:Record<string,THREE.MeshStandardMaterial>;private sky?:THREE.Texture;
 private trialRings=new Map<number,THREE.Mesh>();private weather?:THREE.Points|THREE.LineSegments;private weatherHomes:number[]=[];
 constructor(private holder:HTMLElement,readonly realm:number,private seat:number){
  this.theme=themes[realm];this.residentPoint=residentFor(realm);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.domElement.className='grounded-renderer';this.renderer.domElement.setAttribute('aria-hidden','true');holder.prepend(this.renderer.domElement);
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=this.theme.dusk?1.25:1.08;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.scene.background=new THREE.Color(this.theme.sky);this.scene.fog=new THREE.Fog(this.theme.sky,24,80);
  this.scene.add(new THREE.HemisphereLight(0xd5e6ef,0x47483a,this.theme.dusk?1.9:2.1));
  this.sun.position.set(-12,23,8);this.sun.intensity=this.theme.dusk?2.1:3;this.sun.castShadow=true;
  this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.1,far:65});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;this.scene.add(this.sun,this.sun.target);
 }
 private material(options:THREE.MeshStandardMaterialParameters){const m=new THREE.MeshStandardMaterial(options);this.mats.add(m);return m;}
 private mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=this.scene){this.geos.add(g);const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 private box(parent:THREE.Object3D,size:[number,number,number],at:[number,number,number],m:THREE.Material){const o=this.mesh(new THREE.BoxGeometry(...size),m,parent);o.position.set(...at);return o;}
 private post(parent:THREE.Object3D,r:number,height:number,at:[number,number,number],m:THREE.Material){const o=this.mesh(new THREE.CylinderGeometry(r,r*1.08,height,12),m,parent);o.position.set(...at);return o;}
 private async texture(url:string,color=false){const t=await new THREE.TextureLoader().loadAsync(url);if(this.disposed){t.dispose();throw new Error('Scene closed');}t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.push(t);return t;}
 private plantMaterial(m:THREE.Material){if(!(m instanceof THREE.MeshStandardMaterial))return;
  m.side=THREE.DoubleSide;m.alphaTest=.35;m.transparent=false;m.roughness=.9;
  m.onBeforeCompile=shader=>{shader.uniforms.windTime=this.windUniform;shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float windAnchor=clamp(position.y,0.0,1.0);transformed.x+=sin(windTime*1.2+position.x*2.0+position.z*1.7)*windAnchor*0.035;`);};this.mats.add(m);
 }
 async load(){
  const gltf=new GLTFLoader();
  const [grass,grassNormal,stone,stoneNormal,bark,barkNormal,cedar,maple,rock,fern,grassModel,flower,traveler,fox]=await Promise.all([
   this.texture('/textures/terrain-grass.jpg',true),this.texture('/textures/terrain-grass-normal.jpg'),this.texture('/textures/stone-path.jpg',true),this.texture('/textures/stone-path-normal.jpg'),this.texture('/textures/sakura-bark.jpg',true),this.texture('/textures/sakura-bark-normal.jpg'),this.texture('/textures/cedar-photo.webp',true),this.texture('/textures/maple-canopy.webp',true),
   gltf.loadAsync('/models/nature/rock_09/rock_09.gltf'),gltf.loadAsync('/models/nature/fern_02/fern_02.gltf'),gltf.loadAsync('/models/nature/grass_medium_02/grass_medium_02.gltf'),gltf.loadAsync('/models/nature/flower_gazania/flower_gazania.gltf'),gltf.loadAsync('/models/traveler-motion.glb'),gltf.loadAsync('/models/fox.glb')
  ]);
  if(this.disposed){this.disposeAsset([rock,fern,grassModel,flower,traveler,fox]);return;}
  for(const t of [grass,grassNormal,stone,stoneNormal,bark,barkNormal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(12,8);}
  this.materials={grass:this.material({map:grass,normalMap:grassNormal,normalScale:new THREE.Vector2(.55,.55),roughness:.95,color:this.theme.ground}),stone:this.material({map:stone,normalMap:stoneNormal,roughness:.91,color:0xb4b3a1}),wood:this.material({map:bark,normalMap:barkNormal,roughness:.92,color:0x887562}),red:this.material({map:bark,roughness:.78,color:0x964739}),bronze:this.material({color:0x817456,metalness:.72,roughness:.52}),roof:this.material({map:stone,normalMap:stoneNormal,roughness:.85,color:0x585d5b}),paper:this.material({color:0xe4d3ae,roughness:1,emissive:0xf4b75d,emissiveIntensity:this.theme.dusk?.18:.03}),gold:this.material({color:0xffdc88,emissive:0xffb957,emissiveIntensity:1.5,roughness:.25,metalness:.3}),blue:this.material({color:0xb3ddf2,emissive:0x6ebbe3,emissiveIntensity:1.2,roughness:.25,metalness:.25})};
  this.buildGround();this.buildLandscape(cedar,maple,rock,fern,grassModel,flower);this.buildVillage();this.buildTrialRings();this.buildWeather();
  this.actors=[this.makeActor(traveler,0),this.makeActor(traveler,1)];this.resident=this.makeActor(traveler,2);this.resident.root.position.set(this.residentPoint.x/S,groundHeight(this.realm,this.residentPoint.x/S,this.residentPoint.y/S),this.residentPoint.y/S);
  const foxRoot=clone(fox.scene) as THREE.Group,foxBounds=new THREE.Box3().setFromObject(foxRoot),foxScale=.6/(foxBounds.max.y-foxBounds.min.y);foxRoot.scale.setScalar(foxScale);foxRoot.position.y=-foxBounds.min.y*foxScale;
  const root=new THREE.Group();root.add(foxRoot);foxRoot.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(root);const mixer=new THREE.AnimationMixer(foxRoot);this.fox={root,mixer,walk:mixer.clipAction(fox.animations.find(c=>c.name==='Walk')!).play(),idle:mixer.clipAction(fox.animations.find(c=>c.name==='Survey')!).play()};
  // Warm shaders while the loading screen is visible. Loading the sky later
  // would recompile every physical material in the middle of a walk.
  await new HDRLoader().loadAsync(`/environment/${this.theme.dusk?'qwantani_dusk_1_puresky':'qwantani_moon_noon_puresky'}.hdr`).then(t=>{if(this.disposed){t.dispose();return;}t.mapping=THREE.EquirectangularReflectionMapping;this.sky=t;this.scene.environment=t;this.scene.environmentIntensity=.38;this.scene.background=t;this.scene.backgroundBlurriness=.18;this.scene.backgroundIntensity=this.theme.dusk?.55:.8;}).catch(()=>{});
  if(!this.disposed){this.camera.position.set(WIDTH/S/2,7,HEIGHT/S/2+8);this.camera.lookAt(WIDTH/S/2,1,HEIGHT/S/2);await this.renderer.compileAsync(this.scene,this.camera);}
 }
 private buildTrialRings(){
  trialsFor(this.realm).forEach((t,i)=>{if(!['guardian','tide','balance'].includes(t.kind))return;const radius=(t.kind==='guardian'?180:115)/S,g=new THREE.RingGeometry(radius-.045,radius,80),p=g.getAttribute('position');
   for(let n=0;n<p.count;n++){const x=p.getX(n)+t.x/S,z=p.getY(n)+t.y/S;p.setXYZ(n,x,groundHeight(this.realm,x,z)+.025,z);}g.computeVertexNormals();
   const m=new THREE.MeshBasicMaterial({color:t.kind==='guardian'?0xb594ef:0x81cadb,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});this.mats.add(m);const ring=this.mesh(g,m);ring.castShadow=false;this.trialRings.set(i,ring);
  });
 }
 private buildWeather(){
  if(![4,5,8,9].includes(this.realm))return;const random=seeded(this.realm+81),rain=[4,5].includes(this.realm),positions:number[]=[];
  for(let n=0;n<140;n++){const x=random()*WIDTH/S,y=random()*8,z=random()*HEIGHT/S;this.weatherHomes.push(x,y,z);positions.push(x,y,z);if(rain)positions.push(x-.04,y+.35,z);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.geos.add(g);
  const m=rain?new THREE.LineBasicMaterial({color:0xc0d3dc,transparent:true,opacity:.3,depthWrite:false}):new THREE.PointsMaterial({color:0xe6f1f5,size:.045,transparent:true,opacity:.7,depthWrite:false});this.mats.add(m);this.weather=rain?new THREE.LineSegments(g,m):new THREE.Points(g,m);this.scene.add(this.weather);
 }
 resolveMotion(p:Point,previous:Point,targets:Target[]){
  const obstacles=targets.filter(t=>t.type==='page'||t.type==='quest'||t.type==='interact'&&!['embers','rescue','escort'].includes(trialsFor(this.realm)[t.crossing!].kind)).map(t=>({...t,r:28}));obstacles.push({x:820,y:560,r:40} as typeof obstacles[number]);
  for(const o of obstacles){const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<o.r){let dx=previous.x-o.x,dy=previous.y-o.y,length=Math.hypot(dx,dy);if(length<1){dx=1;dy=0;length=1;}p.x=o.x+dx/length*o.r;p.y=o.y+dy/length*o.r;}}
 }
 private disposeAsset(models:GLTF[]){for(const m of models)m.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();}});}
 private buildGround(){
  const g=makeGroundGeometry(this.realm);
  const m=this.materials.grass;m.onBeforeCompile=shader=>{shader.uniforms.trailMap={value:this.materials.stone.map};shader.vertexShader='attribute float trailWeight;varying float vTrail;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTrail=trailWeight;');shader.fragmentShader='uniform sampler2D trailMap;varying float vTrail;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec4 pathColor=texture2D(trailMap,vMapUv);diffuseColor.rgb=mix(diffuseColor.rgb,pathColor.rgb*vec3(0.81,0.79,0.73),vTrail);`);};
  this.ground=this.mesh(g,m);this.ground.castShadow=false;
  // Continue the land beyond the playable boundary so the follow camera never
  // looks over the edge of a floating rectangular map.
  const skirt=new THREE.PlaneGeometry(140,120,70,60);skirt.rotateX(-Math.PI/2);skirt.translate(WIDTH/S/2,0,HEIGHT/S/2);const vertices=skirt.getAttribute('position');
  for(let n=0;n<vertices.count;n++){const x=vertices.getX(n),z=vertices.getZ(n);vertices.setY(n,-.9+Math.sin(x*.19)*.14+Math.cos(z*.15)*.18);}skirt.setAttribute('trailWeight',new THREE.Float32BufferAttribute(new Float32Array(vertices.count),1));skirt.computeVertexNormals();const surroundings=this.mesh(skirt,m);surroundings.castShadow=false;
  if(this.theme.water){const waterMaterial=new THREE.MeshPhysicalMaterial({color:this.realm===13?0x316a77:0x688b92,roughness:.2,metalness:.35,transparent:true,opacity:.82,normalMap:this.materials.stone.normalMap,normalScale:new THREE.Vector2(.05,.05)});this.mats.add(waterMaterial);this.water=this.mesh(new THREE.PlaneGeometry(WIDTH/S,HEIGHT/S,1,1),waterMaterial);this.water.rotation.x=-Math.PI/2;this.water.position.set(WIDTH/S/2,-.32,HEIGHT/S/2);this.water.castShadow=false;}
 }
 private scatter(model:GLTF,points:{x:number;z:number;scale:number;angle:number}[],wind=false){
  model.scene.updateMatrixWorld(true);const parts:THREE.Mesh[]=[];model.scene.traverse(o=>{if(o instanceof THREE.Mesh)parts.push(o);});parts.forEach((o,partIndex)=>{const selected=points.filter((_,i)=>i%parts.length===partIndex);this.geos.add(o.geometry);const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();if(wind)this.plantMaterial(c);else this.mats.add(c);return c;});
   const inst=new THREE.InstancedMesh(o.geometry,Array.isArray(o.material)?materials:materials[0],selected.length);const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();for(let i=0;i<selected.length;i++){const p=selected[i];q.setFromAxisAngle(UP,p.angle);matrix.compose(new THREE.Vector3(p.x,groundHeight(this.realm,p.x,p.z),p.z),q,new THREE.Vector3(p.scale,p.scale,p.scale));matrix.multiply(o.matrixWorld);inst.setMatrixAt(i,matrix);}inst.castShadow=!wind;inst.receiveShadow=true;this.scene.add(inst);this.vegetation.push(inst);
  });
 }
 private buildLandscape(cedar:THREE.Texture,maple:THREE.Texture,rock:GLTF,fern:GLTF,grass:GLTF,flower:GLTF){
  const random=seeded(this.realm*913+48),rockPoints:Parameters<GroundedWorld['scatter']>[1]=[],fernPoints:typeof rockPoints=[],grassPoints:typeof rockPoints=[],flowerPoints:typeof rockPoints=[];
  for(let n=0;n<900;n++){const x=random()*WIDTH,z=random()*HEIGHT,q=projectPath(this.realm,{x,y:z}),d=Math.hypot(x-q.x,z-q.y),clear=walkable(this.realm,{x,y:z});
   if(d<65||groundHeight(this.realm,x/S,z/S)<0)continue;const point={x:x/S,z:z/S,angle:random()*Math.PI*2,scale:.6+random()*.6};
   if(n%13===0&&!clear){point.scale=15+random()*20;rockPoints.push(point);}else if(n%5===0){point.scale=.45+random()*.45;fernPoints.push(point);}else if(n%7===0&&![8,9,12,13].includes(this.realm)){point.scale=.3+random()*.45;flowerPoints.push(point);}else if(![8,9,12].includes(this.realm))grassPoints.push(point);
  }
  this.scatter(rock,rockPoints);this.scatter(fern,fernPoints,true);this.scatter(grass,grassPoints,true);this.scatter(flower,flowerPoints,true);
  const treeMaterial=new THREE.MeshStandardMaterial({map:cedar,alphaTest:.4,side:THREE.DoubleSide,roughness:.95,color:[8,9].includes(this.realm)?0xc1d1d0:0xc4d0b7});this.mats.add(treeMaterial);this.plantMaterial(treeMaterial);
  const leafMaterial=new THREE.MeshStandardMaterial({map:maple,alphaTest:.4,side:THREE.DoubleSide,roughness:.95,color:this.realm===11?0x9ba76d:0xc69b65});this.mats.add(leafMaterial);this.plantMaterial(leafMaterial);
  const treeGeo=new THREE.PlaneGeometry(1,1,4,8);treeGeo.translate(0,.5,0);this.geos.add(treeGeo);
  for(let n=0;n<65;n++){const x=random()*WIDTH,z=random()*HEIGHT;if(walkable(this.realm,{x,y:z})||groundHeight(this.realm,x/S,z/S)<0)continue;const root=new THREE.Group();root.position.set(x/S,groundHeight(this.realm,x/S,z/S),z/S);root.rotation.y=random()*Math.PI;this.scene.add(root);
   if(this.theme.trees==='bamboo'){for(let k=0;k<4;k++){const tall=4+random()*3,stem=this.post(root,.05,tall,[(k-1.5)*.32,tall/2,random()*.5],this.materials.wood);stem.material=this.material({color:0x68885a,roughness:.85});for(let joint=.5;joint<tall;joint+=.45){const ring=this.mesh(new THREE.TorusGeometry(.058,.009,4,8),this.materials.wood,root);ring.rotation.x=Math.PI/2;ring.position.set((k-1.5)*.32,joint,stem.position.z);}for(let k=0;k<3;k++){const leaf=this.mesh(treeGeo,leafMaterial,root);leaf.scale.set(1.2,1,1);leaf.position.set(Math.sin(k*2)*.6,tall-1+k*.35,Math.cos(k*2)*.5);leaf.rotation.y=k*2;}}
   }else if(this.theme.trees==='maple'){const height=4+random()*2;this.post(root,.15,height*.65,[0,height*.325,0],this.materials.wood);for(let k=0;k<7;k++){const leaf=this.mesh(treeGeo,leafMaterial,root);leaf.scale.set(2.1,1.6,1);leaf.position.set(Math.sin(k*2.4)*1.1,height-2.3+(k%3)*.45,Math.cos(k*2.4)*1.1);leaf.rotation.y=k*2.4;}for(let k=0;k<4;k++){const branch=this.post(root,.06,1.6,[Math.sin(k*1.8)*.45,height*.55,Math.cos(k*1.8)*.45],this.materials.wood);branch.rotation.z=.5;branch.rotation.y=k*1.8;}
   }else if(this.theme.trees!=='rock'){const height=5+random()*4;this.post(root,.15,height*.45,[0,height*.225,0],this.materials.wood);for(let k=0;k<3;k++){const leaf=this.mesh(treeGeo,treeMaterial,root);leaf.scale.set(height*.65,height,1);leaf.rotation.y=k*Math.PI/3;leaf.castShadow=k===0;}}
  }
  if(this.theme.trees==='rock')for(let n=0;n<18;n++){const angle=n/18*Math.PI*2,x=WIDTH/S/2+Math.cos(angle)*WIDTH/S*.45,z=HEIGHT/S/2+Math.sin(angle)*HEIGHT/S*.46;rockPoints.push({x,z,angle,scale:100+random()*100});}if(this.theme.trees==='rock')this.scatter(rock,rockPoints.slice(-18));
  // Distant ridges are real geometry and are hidden naturally by atmospheric fog.
  for(let n=0;n<12;n++){const angle=n/12*Math.PI*2;const ridge=this.mesh(new THREE.SphereGeometry(8,18,12),this.material({map:this.materials.grass.map,roughness:1,color:0x556b61}));ridge.position.set(WIDTH/S/2+Math.sin(angle)*52,0,HEIGHT/S/2+Math.cos(angle)*46);ridge.scale.set(1.3,1.7+random(),1);}
 }
 private lantern(parent:THREE.Object3D,color:'gold'|'blue'='gold'){
  const m=this.materials,body=this.mesh(new THREE.CylinderGeometry(.15,.15,.38,12,1,true),color==='gold'?m.paper:m.blue,parent);body.position.y=.37;
  for(const y of [.17,.56]){const cap=this.mesh(new THREE.CylinderGeometry(.18,.18,.045,12),m.wood,parent);cap.position.y=y;}
  for(let n=0;n<6;n++){const angle=n*Math.PI/3;this.post(parent,.012,.4,[Math.sin(angle)*.15,.37,Math.cos(angle)*.15],m.wood);}
  const handle=this.mesh(new THREE.TorusGeometry(.085,.008,6,16,Math.PI),m.bronze,parent);handle.position.y=.63;
 }
 private torii(parent:THREE.Object3D,width=2.8){
  const m=this.materials;for(const side of [-1,1]){const post=this.post(parent,.12,2.8,[side*width*.38,1.4,0],m.red);post.rotation.z=-side*.025;this.post(parent,.17,.18,[side*width*.38,.09,0],m.stone);}
  this.box(parent,[width+.5,.18,.27],[0,2.86,0],m.wood);this.box(parent,[width+.2,.14,.22],[0,2.7,0],m.red);this.box(parent,[width,.14,.2],[0,2.24,0],m.red);this.box(parent,[.21,.52,.12],[0,2.47,.04],m.red);
 }
 private house(x:number,z:number,rotation=0){
  const m=this.materials,root=new THREE.Group();root.position.set(x,groundHeight(this.realm,x,z),z);root.rotation.y=rotation;this.scene.add(root);
  this.box(root,[4,.3,3.4],[0,.15,0],m.stone);this.box(root,[3.8,2.1,3],[0,1.35,0],m.paper);
  for(const side of [-1,1])for(const back of [-1,1])this.post(root,.09,2.5,[side*1.85,1.55,back*1.48],m.wood);
  for(let i=0;i<9;i++)this.box(root,[.055,2.1,.065],[-1.75+i*.44,1.35,1.525],m.wood);
  for(let i=0;i<5;i++)this.box(root,[3.8,.045,.07],[0,.45+i*.46,1.535],m.wood);
  this.box(root,[1.3,.18,1.1],[0,.34,1.98],m.wood);this.box(root,[.75,1.6,.09],[0,1.12,1.59],m.wood);
  for(const side of [-1,1]){const roof=this.box(root,[4.9,.13,2.25],[0,2.9,side*.94],m.roof);roof.rotation.x=side*.43;for(let n=0;n<22;n++){const tile=this.post(root,.033,2.25,[-2.34+n*.225,2.97,side*.94],m.roof);tile.rotation.x=Math.PI/2+side*.43;}this.box(root,[5.1,.16,.16],[0,3.39,0],m.roof);}
  const lamp=new THREE.Group();lamp.position.set(1.4,1.8,1.9);root.add(lamp);this.lantern(lamp);if(this.theme.dusk){const light=new THREE.PointLight(0xffc488,2,5);light.position.set(x+1,root.position.y+2,z+2);this.scene.add(light);this.lamps.push(light);}
 }
 private buildVillage(){
  if([0,4,5,14,15].includes(this.realm)){const sites=[[390,260],[1350,275],[1350,930],[350,930]];for(let i=0;i<sites.length;i++){const [x,z]=sites[i];if(!walkable(this.realm,{x,y:z}))this.house(x/S,z/S,i%2?-.12:.15);}}
  for(const path of pathsFor(this.realm))for(let n=0;n<path.length;n++){const p=path[n],q={x:p.x+125,y:p.y};if(q.x>WIDTH-50)continue;const root=new THREE.Group();root.position.set(q.x/S,groundHeight(this.realm,q.x/S,q.y/S),q.y/S);this.scene.add(root);this.post(root,.045,1.75,[0,.875,0],this.materials.wood);this.box(root,[.42,.055,.055],[.17,1.72,0],this.materials.wood);const lamp=new THREE.Group();lamp.position.set(.29,1.03,0);root.add(lamp);this.lantern(lamp);}
  const center=new THREE.Group();center.position.set(900/S,groundHeight(this.realm,900/S,600/S),600/S);this.scene.add(center);
  const hearth=this.mesh(new THREE.CylinderGeometry(.65,.72,.22,12),this.materials.stone,center);hearth.position.set(-2,.11,-1);for(let n=0;n<6;n++){const log=this.post(center,.07,.75,[-2,.26,-1],this.materials.wood);log.rotation.z=Math.PI/2;log.rotation.y=n*Math.PI/3;}
 }
 private makeActor(gltf:GLTF,side:number){const actor=buildTraveler(gltf,side);this.scene.add(actor.root);actor.model.traverse(o=>{if(o instanceof THREE.Mesh){this.geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])this.mats.add(m);}});const root=actor.root;
  if(side<2){const lantern=new THREE.Group();lantern.position.set(.38,.56,.08);root.add(lantern);lantern.scale.setScalar(.62);this.lantern(lantern,side?'blue':'gold');const light=new THREE.PointLight(side?0x9cdaed:0xffce85,1.2,3);light.position.set(.25,.85,.15);root.add(light);}
return actor;}
 private object(t:Target):Decoration{
  const root=new THREE.Group(),m=this.materials,kind=t.type==='interact'?trialsFor(this.realm)[t.crossing!].kind:t.type;
  if(kind==='travel'){this.torii(root,2.25);this.box(root,[.75,.35,.1],[0,1.9,.08],m.wood);}
  else if(kind==='page'){this.box(root,[.7,.12,.48],[0,.06,0],m.stone);this.box(root,[.58,.34,.4],[0,.32,0],m.wood);this.box(root,[.62,.1,.44],[0,.54,0],m.wood);for(const x of [-.2,.2])this.box(root,[.025,.43,.45],[x,.35,0],m.bronze);this.box(root,[.06,.07,.02],[0,.44,.24],m.bronze);}
  else if(kind==='shard'||kind==='embers'||kind==='rescue'){const orb=this.mesh(new THREE.OctahedronGeometry(kind==='shard'?.12:.18,1),t.id.includes('-wish')&&this.seat===1?m.blue:m.gold,root);orb.position.y=.6;}
  else if(kind==='bells'){for(const side of [-1,1])this.post(root,.07,1.6,[side*.35,.8,0],m.wood);this.box(root,[1,.07,.09],[0,1.62,0],m.wood);const points=[new THREE.Vector2(0,.05),new THREE.Vector2(.19,.06),new THREE.Vector2(.17,.17),new THREE.Vector2(.13,.39),new THREE.Vector2(.07,.43),new THREE.Vector2(0,.43)];const bell=this.mesh(new THREE.LatheGeometry(points,24),m.bronze,root);bell.position.y=.93;const rope=this.post(root,.013,.45,[0,1.5,0],m.wood);rope.position.y=1.4;}
  else if(kind==='escort'){const ring=this.mesh(new THREE.RingGeometry(.7,.73,32),m.blue,root);ring.rotation.x=-Math.PI/2;ring.position.y=.025;}
  else if(kind==='quest'){} // The resident is a rigged humanoid, not a billboard.
  else{this.post(root,.3,.13,[0,.065,0],m.stone);this.post(root,.18,.45,[0,.35,0],m.stone);this.box(root,[.56,.08,.56],[0,.64,0],m.stone);const lamp=new THREE.Group();lamp.position.y=.62;root.add(lamp);this.lantern(lamp,t.id.includes('seal')?'blue':this.seat?'blue':'gold');}
  root.position.set(t.x/S,groundHeight(this.realm,t.x/S,t.y/S),t.y/S);this.scene.add(root);return{root,type:kind,seed:this.decorations.size*.7};
 }
 resize(w:number,h:number){this.w=w;this.h=h;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 render(dt:number,time:number,self:Traveler,other:Traveler,room:CampaignRoom,targets:Target[],reducedMotion:boolean){
  if(this.disposed||this.actors.length!==2)return;this.lastTime=time;this.windUniform.value=reducedMotion?0:time;
  advanceTraveler(this.actors[this.seat],self,dt,true,this.realm);advanceTraveler(this.actors[1-this.seat],other,dt,false,this.realm);
  if(this.resident)advanceTraveler(this.resident,{...room.players[0],...this.residentPoint,facing:2,moving:false},dt,false,this.realm);
  const desired=new THREE.Vector3(self.x/S,groundHeight(this.realm,self.x/S,self.y/S)+6.2,self.y/S+8.3),look=new THREE.Vector3(self.x/S,groundHeight(this.realm,self.x/S,self.y/S)+.8,self.y/S-1.1);
  if(!this.initializedCamera){this.camera.position.copy(desired);this.initializedCamera=true;}else this.camera.position.lerp(desired,Math.min(1,dt*6));this.camera.lookAt(look);this.camera.updateMatrixWorld();
  const center=new THREE.Vector3(self.x/S,0,self.y/S);this.sun.position.copy(center).add(new THREE.Vector3(-12,23,8));this.sun.target.position.copy(center);
  const present=new Set<string>();for(const t of targets){present.add(t.id);let item=this.decorations.get(t.id);if(!item){item=this.object(t);this.decorations.set(t.id,item);}item.root.visible=true;item.root.position.set(t.x/S,groundHeight(this.realm,t.x/S,t.y/S),t.y/S);
   if(['shard','embers','rescue'].includes(item.type)){item.root.children[0].rotation.y=time*.65;item.root.children[0].position.y=.6+(reducedMotion?0:Math.sin(time*1.4+item.seed)*.04);}}
  room.trials.forEach((s,i)=>{if(!s.solved)return;const t=trialsFor(this.realm)[i],id=`restored-${i}`;present.add(id);let item=this.decorations.get(id);if(!item){item=this.object({...t,id,type:'restored',value:null});this.decorations.set(id,item);}item.root.visible=true;});
  for(const [id,item]of this.decorations)if(!present.has(id))item.root.visible=false;
  for(const [i,ring]of this.trialRings){const t=trialsFor(this.realm)[i],s=room.trials[i],m=ring.material as THREE.MeshBasicMaterial;ring.visible=!s.solved;const phase=Date.now()%5500;m.opacity=t.kind==='guardian'?(phase>3900||phase<800?.85:.16):.35;}
  if(this.weather&&!reducedMotion){const p=this.weather.geometry.getAttribute('position'),rain=[4,5].includes(this.realm);for(let n=0;n<this.weatherHomes.length/3;n++){const x=this.weatherHomes[n*3],y=(this.weatherHomes[n*3+1]-time*(rain?6:.35)%8+8)%8,z=this.weatherHomes[n*3+2];if(rain){p.setXYZ(n*2,x,y,z);p.setXYZ(n*2+1,x-.04,y+.35,z);}else p.setXYZ(n,x+Math.sin(time*.4+n)*.15,y,z);}p.needsUpdate=true;}
  if(this.fox){const escort=trialsFor(this.realm,room.difficulty).findIndex((t,i)=>t.kind==='escort'&&!room.trials[i]?.solved),trial=trialsFor(this.realm,room.difficulty)[escort],q=trial?escortPoint(trial,room.trials[escort].progress):pathsFor(this.realm)[0][2],x=q.x/S+(trial?0:Math.sin(time*.22)*.5),z=q.y/S+(trial?0:Math.cos(time*.22)*.4);this.fox.root.position.set(x,groundHeight(this.realm,x,z),z);this.fox.root.rotation.y=trial?Math.PI/2:time*.22;this.fox.walk.setEffectiveWeight(.55);this.fox.idle.setEffectiveWeight(.45);this.fox.mixer.update(dt*.7);}
  if(this.water&&!reducedMotion){this.water.position.y=-.32+Math.sin(time*.5)*.015;const m=this.water.material as THREE.MeshPhysicalMaterial;if(m.normalMap)m.normalMap.offset.set(time*.002,time*.001);}
  this.renderer.render(this.scene,this.camera);if(Math.floor(time)!==Math.floor(time-dt)){const a=this.actors[this.seat];this.renderer.domElement.dataset.contact=JSON.stringify({ground:a.root.position.y,base:a.visual.position.y,scale:a.visual.scale.y,feet:a.feet.map(f=>f.getWorldPosition(new THREE.Vector3()).y)});}
 }
 project(p:Point,height=.8){const v=new THREE.Vector3(p.x/S,groundHeight(this.realm,p.x/S,p.y/S)+height,p.y/S).project(this.camera);return{x:(v.x*.5+.5)*this.w,y:(-.5*v.y+.5)*this.h,visible:v.z<1&&v.z>-1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.1};}
 pick(clientX:number,clientY:number){const rect=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const hit=this.ground?this.ray.intersectObject(this.ground)[0]:undefined;return hit?{x:hit.point.x*S,y:hit.point.z*S}:null;}
 pickTarget(clientX:number,clientY:number,targets:Target[]){const rect=this.renderer.domElement.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  return targets.map(t=>{const p=this.project(t,t.type==='quest'?1:t.type==='travel'?1.5:t.type==='shard'?.6:.55);return{id:t.id,d:p.visible?Math.hypot(p.x-x,p.y-y):Infinity};}).filter(t=>t.d<30).sort((a,b)=>a.d-b.d)[0]?.id;
 }
 dispose(){
  this.disposed=true;for(const a of [...this.actors,...(this.resident?[this.resident]:[])]){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);}this.fox?.mixer.stopAllAction();
  this.scene.traverse(o=>{if(o instanceof THREE.Mesh){this.geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){this.mats.add(m);for(const t of Object.values(m))if(t instanceof THREE.Texture)this.textures.push(t);}}});
  for(const g of this.geos)g.dispose();for(const m of this.mats)m.dispose();for(const t of new Set(this.textures))t.dispose();this.sky?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
 }
}

export function buildTraveler(gltf:GLTF,side:number):Actor{
  gltf.scene.updateMatrixWorld(true);const model=clone(gltf.scene),root=new THREE.Group(),visual=new THREE.Group();root.add(visual);visual.add(model);
  const mixer=new THREE.AnimationMixer(model),clips=gltf.animations.map(c=>{const copy=c.clone();for(const track of copy.tracks){if(/Hips\.position$/.test(track.name)){// Retain vertical hip motion; locomotion controls horizontal translation.
   for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}}
  }return copy;}),actions=['idle','walk','run'].map(name=>mixer.clipAction(clips.find(c=>c.name.toLowerCase()===name)!));actions.forEach(a=>a.play());actions[0].setEffectiveWeight(1);actions[1].setEffectiveWeight(0);actions[2].setEffectiveWeight(0);mixer.update(.5);
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model,true),scale=(side===0?1.7:side===1?1.83:1.72)/(bounds.max.y-bounds.min.y);visual.scale.setScalar(scale);visual.position.set(-(bounds.max.x+bounds.min.x)*scale/2,-bounds.min.y*scale,-(bounds.max.z+bounds.min.z)*scale/2);
  model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m instanceof THREE.MeshStandardMaterial)m.color.set(side===0?0xd0c0a1:side===1?0xaec1ce:0xb8bfab);}}});
  root.updateMatrixWorld(true);const feet=['LeftFoot','RightFoot'].map(name=>{let bone:THREE.Object3D|undefined;model.traverse(o=>{if(o.name.endsWith(name))bone=o;});return bone!;}).filter(Boolean),clearance=feet.map(f=>f.getWorldPosition(new THREE.Vector3()).y);
  return{root,visual,model,mixer,actions,feet,clearance,base:visual.position.y,last:new THREE.Vector2(),angle:0,planted:[null,null]};
 }

export function advanceTraveler(actor:Actor,p:Traveler,dt:number,own:boolean,realm:number){
  const x=p.x/S,z=p.y/S,distance=actor.last.lengthSq()?actor.last.distanceTo(new THREE.Vector2(x,z)):0,speed=Math.min(5.5,distance/Math.max(dt,.001));
  let angle=actor.angle;if(distance>.0008)angle=Math.atan2(x-actor.last.x,z-actor.last.y);else if(own)angle=[Math.PI,Math.PI/2,0,-Math.PI/2][p.facing];
  actor.angle+=Math.atan2(Math.sin(angle-actor.angle),Math.cos(angle-actor.angle))*Math.min(1,dt*12);actor.root.rotation.y=actor.angle;
  actor.root.position.set(x,groundHeight(realm,x,z),z);const run=THREE.MathUtils.smoothstep(speed,2.6,4.1),move=speed>.08?1:0,weights=[1-move,move*(1-run),move*run];
  actor.actions.forEach((a,i)=>{a.setEffectiveWeight(THREE.MathUtils.damp(a.getEffectiveWeight(),weights[i],10,dt));a.setEffectiveTimeScale(i===0?1:i===1?Math.max(.25,speed/1.35):Math.max(.4,speed/3.5));});actor.mixer.update(dt);
  actor.visual.position.y=actor.base;actor.root.updateMatrixWorld(true);
  // Preserve motion-capture gait, correct only planted feet for the actual slope.
  const soles=actor.feet.map((f,i)=>f.getWorldPosition(new THREE.Vector3()).y-actor.clearance[i]);const low=Math.min(...soles);
  if(Number.isFinite(low))actor.visual.position.y+=THREE.MathUtils.clamp(actor.root.position.y-low,-.13,.16);
  actor.root.updateMatrixWorld(true);
  actor.feet.forEach((foot,i)=>{const point=foot.getWorldPosition(new THREE.Vector3()),floor=groundHeight(realm,point.x,point.z)+actor.clearance[i],stance=point.y-floor<.075;
   if(stance){if(!actor.planted[i]||actor.planted[i]!.distanceTo(point)>.5)actor.planted[i]=point.clone();const goal=actor.planted[i]!.clone();goal.y=groundHeight(realm,goal.x,goal.z)+actor.clearance[i];if(speed<.08)goal.copy(point).setY(Math.max(point.y,floor));legTo(foot,goal,new THREE.Vector3(Math.sin(actor.angle),.05,Math.cos(actor.angle)));}else{actor.planted[i]=null;if(point.y<floor)legTo(foot,point.clone().setY(floor),new THREE.Vector3(Math.sin(actor.angle),0,Math.cos(actor.angle)));}
  });actor.last.set(x,z);
 }
