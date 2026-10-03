// Original procedural flight decks rendered over the globe. The camera sits at the pilot's eye looking
// down -Z; glass screens are canvas textures painted with the shared avionics renderer.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
export type DeckKind='airliner'|'ga'|'glider';
export type Screen={ctx:CanvasRenderingContext2D;tex:THREE.CanvasTexture;w:number;h:number};
export type Deck={group:THREE.Group;screens:Record<string,Screen>;fcu?:Screen;update:(s:{roll:number;pitch:number;throttle:number;flaps:number;spoilers:number;light:number})=>void};
function screen(w:number,h:number,pxW=512,pxH=Math.round(pxW*h/w)){const c=document.createElement('canvas');c.width=pxW;c.height=pxH;const ctx=c.getContext('2d')!;const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));return{mesh,s:{ctx,tex,w:pxW,h:pxH} as Screen};}
function panelTexture(base:string,seed:number,kind:'switches'|'plain'){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!;x.fillStyle=base;x.fillRect(0,0,512,512);let s=seed;const r=()=>(s=Math.imul(s^s>>>15,2246822507)+0x6d2b79f5|0,(s>>>0)/4294967296);
 for(let i=0;i<4000;i++){const g=r()*14-7;x.fillStyle=`rgba(${g>0?255:0},${g>0?255:0},${g>0?255:0},${Math.abs(g)/250})`;x.fillRect(r()*512,r()*512,2,2);}
 if(kind==='switches'){for(let row=0;row<7;row++)for(let col=0;col<8;col++){if(r()<.25)continue;const px=24+col*61,py=26+row*70;x.strokeStyle='#ffffff30';x.strokeRect(px-4,py-4,52,58);x.fillStyle='#d9dcd6';x.font='9px Arial';x.fillText(['FUEL','HYD','ELEC','BLEED','PACK','APU','ENG','ANTI ICE','LIGHTS','WIPER','PROBE','CAB'][Math.floor(r()*12)],px,py+6);
  const t=r();if(t<.5){x.fillStyle='#1b1f22';x.fillRect(px+6,py+14,30,24);x.fillStyle=r()<.3?'#4ef07a':'#ffffffcc';x.fillRect(px+10,py+18,22,6);x.fillStyle='#ffb02e88';x.fillRect(px+10,py+28,22,6);}else{x.fillStyle='#c8ccd0';x.beginPath();x.arc(px+21,py+28,9,0,7);x.fill();x.fillStyle='#2a2e32';x.fillRect(px+19,py+16,4,14);}}
  x.strokeStyle='#ffffff22';x.lineWidth=2;for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*128,0);x.lineTo(i*128,512);x.stroke();}}
 for(let i=0;i<40;i++){x.fillStyle='#9a9fa4';const px=r()*512,py=r()*512;x.beginPath();x.arc(px,py,2.2,0,7);x.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
export function buildDeck(kind:DeckKind,renderer:THREE.WebGLRenderer,opts:{sidestick:boolean;engines:number;airbus:boolean}):{scene:THREE.Scene;deck:Deck}{
 const scene=new THREE.Scene(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
 const hemi=new THREE.HemisphereLight('#dfe8f0','#3a3f44',1.1),sun=new THREE.DirectionalLight('#fff1dc',1.6);sun.position.set(-1,3,-2);scene.add(hemi,sun);
 const group=new THREE.Group();scene.add(group);const screens:Record<string,Screen>={};let fcu:Screen|undefined;
 const tone=opts.airbus?'#56616c':'#5b5d5f',mat=(color:string,rough=.75,metal=.15,map?:THREE.Texture)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,map}),panel=mat(tone,.8,.1,panelTexture(tone,7,'plain')),dark=mat('#23272b',.6,.2),black=mat('#0d0f11',.4,.3),trim=mat('#8b9196',.45,.6),seatMat=mat('#2f3a46',.9,0);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=panel,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);group.add(o);return o;};
 const glass=(name:string,w:number,h:number,x:number,y:number,z:number,tilt:number,px=512)=>{const {mesh,s}=screen(w,h,px);mesh.position.set(x,y,z);mesh.rotation.x=-tilt;group.add(mesh);const bezel=box(w+.03,h+.03,.02,x,y,z-.012,black,-tilt);void bezel;screens[name]=s;};
 const levers:THREE.Object3D[]=[];let yoke:THREE.Object3D|undefined,stick:THREE.Object3D|undefined,flapLever:THREE.Object3D|undefined,spoilerLever:THREE.Object3D|undefined;
 if(kind==='airliner'){
  // Windshield structure: centre post, side posts, header and sill.
  for(const s of [-1,1]){box(.06,.7,.06,s*.82,.32,-1.18,dark,.38,0,s*-.1);box(.055,.7,.055,s*1.22,.28,-.7,dark,.22,s*.5,s*-.2);box(.05,.6,.9,s*1.35,.2,.05,dark);}
  box(.05,.62,.05,0,.36,-1.24,dark,.4);box(2.7,.08,.25,0,.72,-.98,dark,.4);box(2.9,.06,.6,0,.92,-.35,panel,.25);
  // Glareshield with the flight control unit, then the main instrument panel.
  box(2.4,.05,.36,0,-.2,-1.12,dark);box(2.4,.09,.03,0,-.245,-.94,dark);
  {const {mesh,s}=screen(.78,.06,1024);mesh.position.set(0,-.24,-.923);group.add(mesh);fcu=s;}
  box(2.4,.56,.05,0,-.56,-1.13,panel,-.1);
  const sy=-.46,sz=-1.1,t=.1,sw=.22;glass('pfd',sw,sw,-.72,sy,sz,t);glass('nd',sw,sw,-.47,sy,sz,t);glass('ecam',sw,sw*.95,0,sy,sz+.005,t);glass('nd2',sw,sw,.47,sy,sz,t);glass('pfd2',sw,sw,.72,sy,sz,t);
  glass('ecam2',.2,.18,0,-.74,-.86,.75);
  // Pedestal with thrust levers, flap and speedbrake handles.
  box(.52,.32,1.0,0,-.92,-.42,panel);box(.5,.02,.95,0,-.755,-.42,dark);
  for(let e=0;e<opts.engines;e++){const g=new THREE.Group();g.position.set((e-(opts.engines-1)/2)*.075,-.75,-.62);const arm=new THREE.Mesh(new THREE.BoxGeometry(.025,.16,.02),trim);arm.position.y=.08;g.add(arm);const knob=new THREE.Mesh(new THREE.BoxGeometry(.06,.035,.035),black);knob.position.y=.165;g.add(knob);group.add(g);levers.push(g);}
  flapLever=new THREE.Group();flapLever.position.set(.18,-.75,-.4);{const a=new THREE.Mesh(new THREE.BoxGeometry(.015,.1,.015),trim);a.position.y=.05;flapLever.add(a);const k=new THREE.Mesh(new THREE.BoxGeometry(.05,.025,.04),mat('#c9ccc8'));k.position.y=.1;flapLever.add(k);}group.add(flapLever);
  spoilerLever=new THREE.Group();spoilerLever.position.set(-.18,-.75,-.55);{const a=new THREE.Mesh(new THREE.BoxGeometry(.015,.09,.015),trim);a.position.y=.045;spoilerLever.add(a);const k=new THREE.Mesh(new THREE.BoxGeometry(.03,.02,.06),black);k.position.y=.09;spoilerLever.add(k);}group.add(spoilerLever);
  // Side consoles, sidestick or yoke, seats and the overhead panel.
  for(const s of [-1,1]){box(.4,.25,1.0,s*1.0,-.88,-.25,panel);box(.6,.9,.08,s*.55,-.95,.45,seatMat);box(.05,1.0,1.9,s*1.4,-.55,-.3,panel);box(.08,.05,1.6,s*1.33,-.06,-.3,dark);}
  box(3,.04,2.8,0,-1.08,-.2,dark);box(3,2.2,.05,0,0,.9,dark);
  if(opts.sidestick){stick=new THREE.Group();stick.position.set(-1.0,-.74,-.28);const st=new THREE.Mesh(new THREE.CylinderGeometry(.018,.026,.18,12),black);st.position.y=.09;stick.add(st);const grip=new THREE.Mesh(new THREE.SphereGeometry(.035,14,10),black);grip.scale.set(1,1.4,1);grip.position.y=.2;stick.add(grip);group.add(stick);}
  else{yoke=new THREE.Group();yoke.position.set(-.55,-.68,-.62);const col=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5,12),dark);col.rotation.x=.3;col.position.set(0,-.2,.06);yoke.add(col);const wheel=new THREE.Mesh(new THREE.TorusGeometry(.13,.018,10,28,Math.PI*1.25),black);wheel.rotation.z=Math.PI*1.125;yoke.add(wheel);group.add(yoke);}
  const over=new THREE.Mesh(new THREE.BoxGeometry(1.0,.05,.9),mat(tone,.8,.1,panelTexture(tone,11,'switches')));over.position.set(0,.98,-.1);over.rotation.x=.42;group.add(over);
 }else if(kind==='ga'){
  for(const s of [-1,1]){box(.05,.7,.05,s*.62,.2,-.85,dark,.45,0,s*-.15);box(.05,.5,1.1,s*.78,.05,-.2,dark);}
  box(1.6,.06,.5,0,.62,-.45,mat('#d9d5cc',.9));box(1.36,.035,.24,0,-.2,-.9,black);box(1.36,.05,.02,0,-.225,-.78,black);
  box(1.36,.4,.06,0,-.43,-.92,mat('#3a3d40',.75,.15,panelTexture('#3a3d40',5,'plain')),-.06);glass('pfd',.3,.225,-.24,-.39,-.885,.06);glass('mfd',.3,.225,.2,-.39,-.885,.06);
  for(const s of [-1,1])box(.04,.6,1.4,s*.74,-.72,-.3,panel);box(1.5,.04,1.6,0,-1.05,-.3,dark);
  box(.6,.2,.6,0,-.78,-.35,panel);
  yoke=new THREE.Group();yoke.position.set(-.24,-.6,-.7);{const col=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.2,10),dark);col.rotation.x=Math.PI/2;col.position.z=-.1;yoke.add(col);const bar=new THREE.Mesh(new THREE.BoxGeometry(.22,.035,.03),black);yoke.add(bar);for(const s of [-1,1]){const h=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.1,10),black);h.position.set(s*.11,.035,0);yoke.add(h);}}group.add(yoke);
  for(let e=0;e<Math.max(1,opts.engines);e++){const g=new THREE.Group();g.position.set(.02+e*.05,-.66,-.7);const a=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.12,8),trim);a.rotation.x=Math.PI/2;a.position.z=.06;g.add(a);const k=new THREE.Mesh(new THREE.SphereGeometry(.022,12,8),black);k.position.z=.12;g.add(k);group.add(g);levers.push(g);}
  for(const s of [-1,1])box(.5,.8,.08,s*.36,-.95,.4,seatMat);
 }else{
  box(.7,.26,.08,0,-.42,-.66,panel,-.2);glass('gauges',.6,.2,0,-.41,-.615,.2,768);
  stick=new THREE.Group();stick.position.set(0,-.78,-.32);{const st=new THREE.Mesh(new THREE.CylinderGeometry(.012,.015,.4,10),black);st.position.y=.2;stick.add(st);}group.add(stick);
  const frame=new THREE.Mesh(new THREE.TorusGeometry(.75,.02,8,40,Math.PI),dark);frame.position.set(0,-.3,.25);frame.rotation.y=Math.PI/2;group.add(frame);for(const s of [-1,1])box(.06,.12,1.6,s*.42,-.62,-.2,mat('#e9ecee',.5));
 }
 const update:Deck['update']=s=>{for(const l of levers)l.rotation.x=kind==='ga'?0:-.35+s.throttle*.75;if(kind==='ga')for(const l of levers)l.position.z=-.7-s.throttle*.06;
  if(yoke){yoke.rotation.z=-s.roll*.6;yoke.position.z=(kind==='ga'?-.7:-.62)+s.pitch*-.05;}if(stick){stick.rotation.z=-s.roll*.25;stick.rotation.x=s.pitch*.25;}
  if(flapLever)flapLever.rotation.x=-.6*s.flaps+.3;if(spoilerLever)spoilerLever.rotation.x=-.6*s.spoilers+.25;hemi.intensity=.25+.9*s.light;sun.intensity=.2+1.5*s.light;scene.environmentIntensity=.25+.75*s.light;};
 return{scene,deck:{group,screens,fcu,update}};}
/** Painted autopilot panel strip (speed, heading, altitude, vertical speed windows and mode lights). */
export function drawFcu(s:Screen,ap:{spd:number;hdg:number;alt:number;vs:number;master:boolean;athr:boolean;lat:string;vert:string;apr:boolean}){const c=s.ctx,W=s.w,H=s.h;c.fillStyle='#3d464f';c.fillRect(0,0,W,H);
 const win=(x:number,label:string,val:string,on:boolean)=>{c.fillStyle='#e6e8e4';c.font='bold 13px Arial';c.textAlign='center';c.fillText(label,x,16);c.fillStyle='#0a0c0d';c.fillRect(x-62,22,124,40);c.fillStyle='#ff9b2e';c.font='bold 30px "Roboto Mono",monospace';c.fillText(val,x,54);if(on){c.fillStyle='#4ef07a';c.beginPath();c.arc(x+74,42,5,0,7);c.fill();}};
 win(110,'SPD',String(Math.round(ap.spd)),ap.athr);win(300,'HDG',String(Math.round(ap.hdg)).padStart(3,'0'),ap.lat==='HDG');win(560,'ALT',String(Math.round(ap.alt)).padStart(5,'0'),ap.vert==='ALT'||ap.vert==='ALTS');win(800,'V/S',`${ap.vs>0?'+':''}${Math.round(ap.vs)}`,ap.vert==='VS');
 const btn=(x:number,t:string,on:boolean)=>{c.fillStyle='#1f2428';c.fillRect(x-30,66,60,14);c.fillStyle=on?'#4ef07a':'#69737b';c.fillRect(x-14,68,28,4);c.fillStyle='#d9dcd6';c.font='bold 10px Arial';c.fillText(t,x,80);};
 btn(930,'AP',ap.master);btn(990,'A/THR',ap.athr);btn(400,'LOC',ap.lat==='LOC');btn(460,'APPR',ap.apr);btn(680,'NAV',ap.lat==='NAV');s.tex.needsUpdate=true;}
/** Glider instruments: airspeed, altimeter and variometer. */
export function drawGliderGauges(s:Screen,d:{ias:number;alt:number;vs:number}){const c=s.ctx,W=s.w,H=s.h;c.fillStyle='#1a1d20';c.fillRect(0,0,W,H);const g=(i:number,label:string,v:number,max:number,text:string,center=false)=>{const x=W*(i+.5)/3,y=H/2,r=H*.42;c.fillStyle='#08090a';c.beginPath();c.arc(x,y,r,0,7);c.fill();c.strokeStyle='#ddd';c.lineWidth=2;for(let k=0;k<=10;k++){const a=(center?-Math.PI:-Math.PI*.75)+k/10*(center?Math.PI*2:Math.PI*1.5);c.beginPath();c.moveTo(x+Math.cos(a-Math.PI/2)*r*.8,y+Math.sin(a-Math.PI/2)*r*.8);c.lineTo(x+Math.cos(a-Math.PI/2)*r*.92,y+Math.sin(a-Math.PI/2)*r*.92);c.stroke();}
  const f=center?Math.max(-1,Math.min(1,v/max)):Math.max(0,Math.min(1,v/max)),a=center?f*Math.PI*.9:-Math.PI*.75+f*Math.PI*1.5;c.strokeStyle='#fff';c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.sin(a)*r*.78,y-Math.cos(a)*r*.78);c.stroke();c.fillStyle='#ddd';c.font=`${Math.round(H*.09)}px Arial`;c.textAlign='center';c.fillText(label,x,y+r*.45);c.font=`bold ${Math.round(H*.11)}px "Roboto Mono",monospace`;c.fillText(text,x,y-r*.3);};
 g(0,'KT',d.ias,150,String(Math.round(d.ias)));g(1,'FT',d.alt%1000,1000,String(Math.round(d.alt)));g(2,'M/S',d.vs/196.85,5,(d.vs/196.85).toFixed(1),true);s.tex.needsUpdate=true;}
