"use client";
import { useEffect,useRef,useState } from "react";
import { FLOOR,HEIGHT,WIDTH,REALMS, SIGILS,BELL_NAMES,trialsFor,platformsFor,shardPoints,pagePoints,spawn,type CampaignRoom,type Traveler,type Point,inspectPoints } from "@/lib/adventure";
import {residentFor} from '@/lib/quests';
import {routeFor} from '@/lib/routes';
import { stepBody,type Body } from "@/lib/adventurePhysics";
import { targetAt,targetKey,canReach,type WorldTarget } from "@/lib/adventureInteraction";
import { terrainFor,terrainPlatformVariant,type Crop } from "@/lib/terrain";
import { playFootstep,playJump,playLanding,playStoryCue,updateAdventureSoundscape } from "@/lib/audio";

type Props={room:CampaignRoom;sound:boolean;paused:boolean;reducedMotion:boolean;onAction:(type:string,value:unknown,position?:Traveler)=>Promise<void>;onMove:(position:Traveler)=>void};
type Target=WorldTarget;
const COLORS=["#ffd28e","#84deff"];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export default function AdventureCanvas({room,sound,paused,reducedMotion,onAction,onMove}:Props){
 const hostRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null);
 const current=useRef({room,sound,paused,reducedMotion,onAction,onMove});current.current={room,sound,paused,reducedMotion,onAction,onMove};
 const input=useRef({left:false,right:false,jump:false,hold:false,sprint:false});
 const interactRef=useRef(()=>{});const resetRef=useRef(()=>{});
 const [prompt,setPrompt]=useState("Follow the lantern-lit path east"),[loading,setLoading]=useState(true),[coordinates,setCoordinates]=useState("130, 730"),[targetLabel,setTargetLabel]=useState(""),[storyLine,setStoryLine]=useState(""),[assetError,setAssetError]=useState(false),[sight,setSight]=useState("");
 useEffect(()=>{
  const canvas=canvasRef.current,host=hostRef.current;if(!canvas||!host)return;const ctx=canvas.getContext("2d");if(!ctx)return;
  let stopped=false,frame=0,previous=performance.now(),clock=0,camera=0,screenW=1200,screenH=700,zoom=1,viewW=1200,destination:number|null=null;
  let lastSent=0,lastAction=0,lastHud=0,stride=0,otherStride=0,lastStep=0,otherLastStep=0,lastSound=0,shadowWarning=-1,shake=0,resetFlash=0,acting=false,currentTarget:Target|undefined;
  let visibleTargets:Target[]=[],selected:string|null=null,pointer:Point|null=null,wasPaused=false,storyUntil=0,lastDust=0,lastWraith=-5,lastMoveX=-100,lastMoveY=-100;
  let observed=current.current.room;
  const particles:{x:number;y:number;vx:number;vy:number;life:number;max:number;color:string}[]=[];
  const rings:{x:number;y:number;life:number;color:string}[]=[];
  const burst=(x:number,y:number,color:string,count=18)=>{for(let i=0;i<count&&particles.length<110;i++){const angle=Math.random()*Math.PI*2,speed=30+Math.random()*130,life=.5+Math.random()*.9;particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-35,life,max:life,color});}};
  const say=(line:string)=>{setStoryLine(line);storyUntil=clock+7;};
  const place=REALMS[room.realm],terrainStyle=terrainFor(room.realm),trials=trialsFor(room.realm,room.difficulty),platforms=platformsFor(room.realm),shards=shardPoints(room.realm),pages=pagePoints(room.realm),resident=residentFor(room.realm),landmarks=inspectPoints(room.realm);
  const own=room.players[room.seat];const self:Body={...own,vx:0,vy:0,coyote:.1,jumpBuffer:0};
  const other={...room.players[room.seat===0?1:0]},keys=new Set<string>();
  const images:Record<string,HTMLImageElement>={};
  const load=(name:string,path:string)=>new Promise<void>(resolve=>{const img=new Image();img.onload=()=>{images[name]=img;resolve();};img.onerror=()=>{if(!stopped)setAssetError(true);resolve();};img.src=path;});
  setLoading(true);setAssetError(false);setStoryLine("");
  void Promise.all([load("background",room.realm===0?"/adventure/valley.png":place.image),load("characters","/adventure/travelers.png"),load("residents","/adventure/residents.png"),load("props","/adventure/props.png"),load("stone","/textures/stone-path.jpg"),load("terrain",terrainStyle.atlas)]).then(()=>{if(!stopped)setLoading(false);});
  const resize=()=>{screenW=host.clientWidth;screenH=host.clientHeight;const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=screenW*dpr;canvas.height=screenH*dpr;zoom=screenH/HEIGHT;viewW=screenW/zoom;};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const bodyPosition=():Traveler=>({x:self.x,y:self.y,facing:self.facing,moving:self.moving,grounded:self.grounded,seen:Date.now()});
  const emit=(target:Target)=>{if(acting||current.current.paused||!canReach(self,target))return;acting=true;lastAction=clock;void current.current.onAction(target.type,target.type==="interact"?{crossing:current.current.room.trials.findIndex(t=>!t.solved),payload:target.value}:target.value,bodyPosition()).finally(()=>{acting=false;});};
  interactRef.current=()=>{if(currentTarget)emit(currentTarget);};
  resetRef.current=()=>{self.x=current.current.room.checkpoints[room.seat];self.y=FLOOR;self.vx=0;self.vy=0;self.grounded=true;shake=.3;resetFlash=1;void current.current.onAction("checkpoint",undefined);};
  const down=(event:KeyboardEvent)=>{if(current.current.paused)return;if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;const k=event.key.toLowerCase();if(k===" "&&event.target instanceof HTMLButtonElement)return;if(["a","d","w","arrowleft","arrowright","arrowup"," ","e","shift"].includes(k)){event.preventDefault();if(["a","d","arrowleft","arrowright"].includes(k)){destination=null;selected=null;}if((k===" "||k==="w"||k==="arrowup")&&!event.repeat)input.current.jump=true;if(k==="e"&&!event.repeat)interactRef.current();keys.add(k);}};
  const up=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase());
  const worldPointer=(event:MouseEvent):Point=>{const rect=canvas.getBoundingClientRect();return {x:camera+(event.clientX-rect.left)/zoom,y:(event.clientY-rect.top)/zoom};};
  const hover=(event:MouseEvent)=>{pointer=worldPointer(event);};
  const unhover=()=>{pointer=null;canvas.style.cursor="default";};
  const pointWalk=(event:MouseEvent)=>{if(current.current.paused)return;canvas.focus();const point=worldPointer(event),target=targetAt(visibleTargets,point);selected=target?targetKey(target):null;destination=Math.max(30,Math.min(WIDTH-40,target?.x??point.x));if(target&&canReach(self,target)){destination=null;if(!target.hold)selected=null;emit(target);}};
  const clear=()=>{keys.clear();input.current={left:false,right:false,jump:false,hold:false,sprint:false};};
  canvas.addEventListener("click",pointWalk);canvas.addEventListener("mousemove",hover);canvas.addEventListener("mouseleave",unhover);window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",clear);
  const glow=(x:number,y:number,r:number,color:string,alpha=.45)=>{const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color);gradient.addColorStop(1,"transparent");ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();};
  const text=(value:string,x:number,y:number,color="#e9e9db",size=18)=>{ctx.font=`500 ${size}px 'DM Sans',sans-serif`;ctx.textAlign="center";ctx.lineWidth=5;ctx.strokeStyle="rgba(5,16,30,.85)";ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);};
  const prop=(index:number,x:number,y:number,size:number,angle=0,alpha=1)=>{const image=images.props;if(!image)return;const sw=image.width/4,sh=image.height/3;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,(index%4)*sw,Math.floor(index/4)*sh,sw,sh,-size/2,-size,size,size);ctx.restore();};
  const art=(crop:Crop,x:number,y:number,w:number,h:number,flip=false)=>{if(!images.terrain)return;ctx.save();ctx.translate(x+(flip?w:0),y);if(flip)ctx.scale(-1,1);ctx.drawImage(images.terrain,...crop,0,0,w,h);ctx.restore();};
  const residentArt=(index:number,x:number,y:number,size:number,angle=0)=>{const image=images.residents;if(!image)return;const sw=image.width/4,sh=image.height/2;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,(index%4)*sw,Math.floor(index/4)*sh,sw,sh,-size/2,-size*1.32,size,size*1.34);ctx.restore();};
  const renderCharacter=(player:Traveler,seat:number,isSelf:boolean)=>{
   const x=player.x-camera,y=player.y,phase=isSelf?stride:otherStride,walk=player.moving?Math.floor(phase/24)%4:0;
   ctx.save();ctx.globalAlpha=isSelf?1:.93;ctx.fillStyle="rgba(0,0,0,.32)";ctx.beginPath();ctx.ellipse(x,y+5,35,8,0,0,Math.PI*2);ctx.fill();
   glow(x+(player.facing>0?28:-28),y-67,110,COLORS[seat],.23);
   const image=images.characters;if(image){const sw=image.width/4,sh=image.height/2;ctx.translate(x,y+(player.moving&&player.grounded?Math.sin(phase/96*Math.PI*2)*2.3:Math.sin(clock*2)*1.3));ctx.scale(player.facing||1,1);ctx.drawImage(image,walk*sw,seat*sh,sw,sh,-69,-136,138,138);}
   ctx.restore();text(`${current.current.room.names[seat]||"Companion"}${isSelf?" · you":""}`,x,y-154,COLORS[seat],17);
  };
  const tick=(now:number)=>{
   if(stopped)return;frame=requestAnimationFrame(tick);const dt=Math.min(.035,(now-previous)/1000);previous=now;clock+=dt;
   const state=current.current.room,activeIndex=state.trials.findIndex(t=>!t.solved),trial=trials[activeIndex],trialState=state.trials[activeIndex];
   const live=!current.current.paused&&state.status==="playing";
   if(current.current.paused&&!wasPaused){clear();destination=null;selected=null;}wasPaused=current.current.paused;
   if(state!==observed){
    for(const shard of shards)if(state.shards.includes(shard.id)&&!observed.shards.includes(shard.id))burst(shard.x,shard.y,"#b8eeff",28);
    for(const page of pages)if(state.pages.includes(page.id)&&!observed.pages.includes(page.id)){burst(page.x,page.y-45,"#f5d6a1");say("Ren · A memory left for strangers. She believed someone would come looking.");}
    state.trials.forEach((ts,i)=>{const old=observed.trials[i],t=trials[i];if(!old)return;
     if(ts.solved&&!old.solved){burst(t.x,FLOOR-160,place.accent,48);rings.push({x:t.x,y:FLOOR-70,life:1.6,color:place.accent});say(["Aoi · The path remembers us. Let's carry this light a little farther.","Ren · Two small lanterns, and the dark gives way. I think she knew.","Aoi · That wasn't a light we took. It was a light we made together.","Ren · Look—the eastern gate is waking. We're one step closer to home."][i]);}
     for(let side=0;side<2;side++){if(ts.notes[side]!==old.notes[side]){const note=t.melodies[side][Math.max(0,ts.notes[side]-1)]??0;rings.push({x:t.x+(note-1)*110,y:FLOOR-55,life:1,color:COLORS[side]});}for(const piece of ts.pieces[side])if(!old.pieces[side].includes(piece)){const p=t.embers[side][piece];if(p)burst(p.x,p.y,COLORS[side],24);}}
    });observed=state;
   }
   if(storyUntil&&clock>storyUntil){storyUntil=0;setStoryLine("");}
   const manual=live?((keys.has("d")||keys.has("arrowright")||input.current.right?1:0)-(keys.has("a")||keys.has("arrowleft")||input.current.left?1:0)):0;
   if(destination!==null&&Math.abs(destination-self.x)<12)destination=null;
   const direction=manual||(live&&destination!==null?Math.sign(destination-self.x):0);
   const jump=live&&input.current.jump;input.current.jump=false;
   const partnerState=state.players[room.seat===0?1:0];
   const otherBeforeX=other.x;
   other.x+=(partnerState.x-other.x)*Math.min(1,dt*10);other.y+=(partnerState.y-other.y)*Math.min(1,dt*12);other.moving=partnerState.moving;other.facing=partnerState.facing;other.grounded=partnerState.grounded;
   const blue=room.seat===1?self:other;
   const beforeX=self.x,wasGrounded=self.grounded,fallSpeed=self.vy;
   // Only nearby blue light reveals a solid spirit bridge for the warm traveler.
   const spiritNear=(p:{x:number;w:number})=>Math.abs(blue.x-p.x-p.w/2)<650;
   const route=routeFor(room.realm),gust=Math.sin(Date.now()/1250)*route.wind*(state.difficulty==='story'?.5:1);
   stepBody(self,platforms.filter(p=>!p.spirit||spiritNear(p)),dt,direction,jump,keys.has("shift")||input.current.sprint,trial?trial.x+265:WIDTH,true,state.upgrades.wind>0,{traction:route.traction,wind:gust});
   const surface=self.y===FLOOR?terrainStyle.surface:room.realm===1||room.realm===2||room.realm===4||room.realm===10||room.realm===14?"wood":terrainStyle.surface==="snow"?"snow":"concrete";
   stride+=Math.abs(self.x-beforeX);otherStride+=Math.abs(other.x-otherBeforeX);
   if(wasGrounded&&!self.grounded&&self.vy<0&&current.current.sound&&live)playJump();
   if(!wasGrounded&&self.grounded&&fallSpeed>140&&live){burst(self.x,self.y-4,place.accent,8);if(current.current.sound)playLanding(surface,fallSpeed);lastStep=stride;}
   if(live&&self.moving&&self.grounded&&clock-lastDust>.15){lastDust=clock;burst(self.x,self.y-2,place.ambient==="snow"?"#ecf6ff":"#a1b9ad",2);}

   const danger=place.index>=4&&trial&&trial.kind==="guardian";
   if(danger&&live&&Date.now()%5500>4800&&shadowWarning!==Math.floor(Date.now()/5500)&&Math.abs(self.x-trial.x)<700){shadowWarning=Math.floor(Date.now()/5500);if(current.current.sound)playStoryCue("shadow");}
   if(danger&&live&&Date.now()%5500<1050&&Math.abs(self.x-trial.x)<250&&self.y>FLOOR-50){resetRef.current();}
   if(state.status==="playing"&&now-lastSent>(Math.abs(self.x-lastMoveX)>3||Math.abs(self.y-lastMoveY)>3?260:1800)){lastSent=now;lastMoveX=self.x;lastMoveY=self.y;current.current.onMove(bodyPosition());}
   if(live&&self.moving&&self.grounded&&stride-lastStep>96&&current.current.sound){lastStep=stride;playFootstep(surface,Math.abs(self.vx)/100,Math.floor(stride/96)%2);}
   if(live&&other.moving&&other.grounded&&otherStride-otherLastStep>96&&current.current.sound){otherLastStep=otherStride;const gap=other.x-self.x;if(Math.abs(gap)<1000)playFootstep(surface,1,Math.floor(otherStride/96)%2,Math.max(-.8,Math.min(.8,gap/600)),Math.abs(gap));}
   if(current.current.sound&&clock-lastSound>.3){lastSound=clock;updateAdventureSoundscape(place.ambient,self.x/WIDTH,clock,trial?.sockets[0].x,trialState?.progress??0);}
   const targets:Target[]=[{...resident,type:'quest',value:null,label:'Speak with '+resident.name}];
   for(const landmark of landmarks)targets.push({...landmark,type:'inspect',value:landmark.id,label:'Investigate '+landmark.label});
   for(const shard of shards)if(!state.shards.includes(shard.id))targets.push({...shard,type:"shard",value:shard.id,label:"Collect a starlight shard"});
   for(const page of pages)if(!state.pages.includes(page.id))targets.push({...page,type:"page",value:page.id,label:"Read the keeper's journal"});
   if(trial){
    if(trial.kind==="bells")for(let i=0;i<3;i++)targets.push({type:"interact",value:i,x:trial.x+(i-1)*110,y:FLOOR,label:`Ring ${BELL_NAMES[i]} bell`});
    else if(trial.kind==='runes')for(let i=0;i<4;i++)targets.push({type:'interact',value:i,x:trial.x-165+i*110,y:FLOOR,label:'Choose the '+SIGILS[i]+' seal'});
    else if(trial.kind==="embers"||trial.kind==='rescue'){trial.embers[room.seat].forEach((p,i)=>{if(!trialState.pieces[room.seat].includes(i))targets.push({...p,type:"interact",value:i,label:trial.kind==='rescue'?'Rescue a crane spirit':"Gather your lantern's wish"});});if(trial.kind==='rescue'&&trialState.pieces[room.seat].length===2)targets.push({...trial.sockets[room.seat],type:'interact',value:null,label:'Release the flock together',hold:true});}
    else if(trial.kind==="escort")targets.push({type:"interact",value:null,x:trial.x-170+trialState.progress*340,y:FLOOR,label:"Guide the spirit fox together",hold:true});
    else targets.push({...trial.sockets[room.seat],type:"interact",value:null,label:trial.kind==="mirrors"?"Turn your light compass":"Join your lanterns together",hold:trial.kind!=="mirrors"});
   }else targets.push({x:WIDTH-210,y:FLOOR,type:"advance",value:null,label:"Travel onward together"});
   visibleTargets=targets;
   const chosen=targets.find(t=>targetKey(t)===selected),hovered=pointer?targetAt(targets,pointer):undefined;
   canvas.style.cursor=hovered?"pointer":"crosshair";
   if(selected&&!chosen)selected=null;
   if(live&&chosen&&canReach(self,chosen)){destination=null;if(!chosen.hold){selected=null;emit(chosen);}else if(clock-lastAction>.52)emit(chosen);}
   currentTarget=targets.filter(target=>distance(self,target)<(target.hold?130:112)).sort((a,b)=>distance(self,a)-distance(self,b))[0];
   if(live&&currentTarget?.hold&&(keys.has("e")||input.current.hold)&&clock-lastAction>.52)emit(currentTarget);
   const desired=Math.max(0,Math.min(WIDTH-viewW,self.x-viewW*.36));camera+=(desired-camera)*Math.min(1,dt*5);shake=Math.max(0,shake-dt);resetFlash=Math.max(0,resetFlash-dt);
   const dpr=canvas.width/screenW;ctx.setTransform(dpr*zoom,0,0,dpr*zoom,0,0);ctx.clearRect(0,0,viewW,HEIGHT);
   ctx.fillStyle=terrainStyle.shadow;ctx.fillRect(0,0,viewW,HEIGHT);
   const background=images.background;if(background){const bw=WIDTH*.28+viewW,bh=Math.max(HEIGHT,bw*background.height/background.width);ctx.drawImage(background,-camera*.28,-Math.max(0,bh-HEIGHT)*.42,bw,bh);}
   const atmosphere=ctx.createLinearGradient(0,0,0,HEIGHT);atmosphere.addColorStop(0,"rgba(6,15,31,.12)");atmosphere.addColorStop(.6,"rgba(6,15,31,.1)");atmosphere.addColorStop(1,"rgba(5,14,28,.84)");ctx.fillStyle=atmosphere;ctx.fillRect(0,0,viewW,HEIGHT);
   if(shake)ctx.translate(Math.sin(clock*70)*shake*12,0);
   // The top of each painted ledge follows the actual collision surface.
   for(const platform of platforms){const x=platform.x-camera;if(x+platform.w<0||x>viewW)continue;const lit=!platform.spirit||spiritNear(platform);
    ctx.save();ctx.globalAlpha=lit?1:.38;
    const ground=platform.y===FLOOR,terrain=images.terrain;
    if(ground){const pg=ctx.createLinearGradient(0,FLOOR,0,HEIGHT);pg.addColorStop(0,terrainStyle.soil);pg.addColorStop(1,terrainStyle.shadow);ctx.fillStyle=pg;ctx.fillRect(x,FLOOR,platform.w,HEIGHT-FLOOR);}
    if(terrain){const crop=ground?terrainStyle.ground:terrainStyle.ledge,h=ground?168:Math.min(86,platform.w*.43);art(crop,x-3,platform.y-8,platform.w+6,h,terrainPlatformVariant(platform,room.realm)%2===1);}
    else{ctx.fillStyle="#405148";ctx.fillRect(x,platform.y,platform.w,ground?HEIGHT-FLOOR:31);if(images.stone)ctx.drawImage(images.stone,x,platform.y,platform.w,34);}
    if(platform.spirit){ctx.strokeStyle="#99deef";ctx.lineWidth=2;ctx.shadowColor="#81d7ef";ctx.shadowBlur=lit?12:0;ctx.beginPath();ctx.moveTo(x+6,platform.y);ctx.lineTo(x+platform.w-6,platform.y);ctx.stroke();}
    ctx.restore();
   }
   for(let i=0;i<Math.ceil(WIDTH/terrainStyle.detailSpacing);i++){const wx=70+i*terrainStyle.detailSpacing+(i%3)*31,x=wx-camera;if(x<-230||x>viewW+230)continue;const w=terrainStyle.detailSize,h=w*terrainStyle.detail[3]/terrainStyle.detail[2];ctx.save();ctx.globalAlpha=.83;ctx.translate(x,FLOOR+10);ctx.rotate(Math.sin(clock*.7+i)*terrainStyle.sway+(Math.abs(self.x-wx)<85?self.vx*terrainStyle.sway*.002:0));art(terrainStyle.detail,-w/2,-h,w,h,i%2===1);ctx.restore();}
   if(terrainStyle.water){ctx.save();ctx.globalAlpha=.17;ctx.strokeStyle=terrainStyle.water;ctx.lineWidth=2;for(let i=0;i<18;i++){const wx=i*240-camera,yy=FLOOR+155+Math.sin(clock*1.7+i)*8;ctx.beginPath();ctx.ellipse(wx,yy,42+Math.sin(clock+i)*12,5,0,0,Math.PI*2);ctx.stroke();}ctx.restore();}
   const weather=terrainStyle.weather,rain=weather==="rain"||weather==="drizzle",floating=["stars","fireflies","dust","lights","pollen","gold"].includes(weather);
   for(let i=0;i<(current.current.reducedMotion?0:rain?65:34);i++){const speed=rain?200:floating?2:weather==="sparks"?-27:18,px=((i*143.7+clock*(floating?3:14+i%4))%(viewW+160))-80,py=(i*91.3+clock*speed+HEIGHT*8)%HEIGHT;ctx.save();ctx.globalAlpha=(floating?.3:.22)+Math.sin(clock*(floating?1.5:1)+i)*.12;ctx.translate(px+(floating?Math.sin(clock+i)*12:0),py);ctx.fillStyle=terrainStyle.particle;ctx.beginPath();if(weather==="mist"||weather==="spray"){ctx.ellipse(0,0,weather==="mist"?65:20,weather==="mist"?8:2,0,0,Math.PI*2);ctx.globalAlpha=.04;}else if(rain){ctx.rotate(-.18);ctx.ellipse(0,0,1,weather==="rain"?14:7,0,0,Math.PI*2);}else if(weather==="frost"){ctx.moveTo(0,-4);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();}else{ctx.rotate(clock*.35+i);ctx.ellipse(0,0,floating?2:3,weather==="snow"?3:floating?2:6,0,0,Math.PI*2);}ctx.fill();ctx.restore();}
   for(const shard of shards)if(!state.shards.includes(shard.id)){const x=shard.x-camera,y=shard.y+Math.sin(clock*2+shard.x)*6;glow(x,y,65,"#a9ecff",.3);prop(7,x,y+25,51,Math.sin(clock)*.04);}
   for(const page of pages){prop(state.pages.includes(page.id)?5:4,page.x-camera,FLOOR,83);if(!state.pages.includes(page.id)){prop(8,page.x-camera,FLOOR-66+Math.sin(clock*2)*3,45);text("A keeper's memory",page.x-camera,FLOOR-123,place.accent,15);}}
   trials.forEach((t,i)=>{
    if(t.x-camera<-420||t.x-camera>viewW+420)return;const solved=state.trials[i].solved,enabled=i===activeIndex||solved;const ts=state.trials[i];
    if(t.kind==="bells")for(let b=0;b<3;b++){prop(2,t.x+(b-1)*110-camera,FLOOR,88,enabled?Math.sin(clock*1.3+b)*.025:0,enabled?1:.55);text(BELL_NAMES[b],t.x+(b-1)*110-camera,FLOOR-98,place.accent,16);}
    else if(t.kind==="embers"||t.kind==="rescue")for(let side=0;side<2;side++)t.embers[side].forEach((p,j)=>{if(ts.pieces[side].includes(j))return;glow(p.x-camera,p.y,65,COLORS[side],.25);if(t.kind==="rescue")residentArt(5,p.x-camera,p.y+22+Math.sin(clock*2+j)*6,70,Math.sin(clock*1.8+j)*.03);else prop(side===0?9:7,p.x-camera,p.y+22+Math.sin(clock*2+j)*6,55);});
    else if(t.kind==="runes"){for(let mark=0;mark<4;mark++){const x=t.x-165+mark*110-camera;residentArt(7,x,FLOOR,90);text(SIGILS[mark],x,FLOOR-135,place.accent,16);if(ts.notes[room.seat]&&mark===t.targets[room.seat])glow(x,FLOOR-60,80,COLORS[room.seat],.4);}}
    else if(t.kind==="escort"){const x=t.x-170+ts.progress*340;glow(x-camera,FLOOR-50,90,"#92dfff",.22);residentArt(4,x-camera,FLOOR-8+Math.sin(clock*2)*4,100,Math.sin(clock*3)*.02);}
    else{
     t.sockets.forEach((p,side)=>{prop(t.kind==="mirrors"?3:side,p.x-camera,p.y,109,t.kind==="mirrors"?ts.turns[side]*Math.PI/2:0,enabled?1:.48);glow(p.x-camera,p.y-62,95,COLORS[side],solved?.35:.14);text(t.kind==="mirrors"?SIGILS[ts.turns[side]]:side===0?"Warm lantern":"Spirit lantern",p.x-camera,p.y-128,COLORS[side],16);});
     if(enabled&&!solved&&ts.progress>0){const a=t.sockets[0],b=t.sockets[1];ctx.save();ctx.globalAlpha=.35+ts.progress*.45;ctx.strokeStyle=place.accent;ctx.lineWidth=3;ctx.shadowColor=place.accent;ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(a.x-camera,a.y-67);ctx.quadraticCurveTo(t.x-camera,FLOOR-180-Math.sin(clock*3)*12,b.x-camera,b.y-67);ctx.stroke();ctx.restore();}
     if(t.kind==="guardian"){prop(11,t.x-camera,FLOOR-160,170);if(Date.now()%5500<1050){glow(t.x-camera,FLOOR-20,285,"#9063c7",.4);ctx.strokeStyle="#bc8edf";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(t.x-250-camera,FLOOR-20);ctx.lineTo(t.x+250-camera,FLOOR-20);ctx.stroke();}}
    }
    if(t.kind==='rescue'){t.sockets.forEach((p,side)=>{prop(side,p.x-camera,p.y,100,0,enabled?1:.5);});if(enabled&&ts.pieces[0].length===2&&ts.pieces[1].length===2)text('The flock is ready · hold E together',t.x-camera,FLOOR-300,place.accent,18);}
    if(t.kind==='tide'&&enabled&&!solved){const low=Date.now()%9000<5200;text(low?'LOW TIDE · join your lights':'HIGH TIDE · hold your place',t.x-camera,FLOOR-300,low?'#a3dedb':'#dfa66c',17);}
    if(t.kind==='balance'&&enabled&&!solved)text(Date.now()%7000<4200?'CALM WIND · hold E':'GUSTS · wait for calm',t.x-camera,FLOOR-280,place.accent,17);
    if(t.kind==='guardian'&&enabled&&!solved)text('GUARDIAN · phase '+(1+Math.min(2,Math.floor(ts.progress*3)))+' / 3',t.x-camera,FLOOR-450,'#e5beee',19);
    if(!solved){const gx=t.x+265-camera;ctx.save();ctx.globalAlpha=enabled?.6:.25;glow(gx,FLOOR-110,95,"#b0c3ff",.22);const g=ctx.createLinearGradient(gx,0,gx+18,0);g.addColorStop(0,"transparent");g.addColorStop(.5,"#acc8f9");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(gx-8,FLOOR-355,16,355);ctx.restore();}
    if(enabled){text(solved?"Crossing restored":t.title,t.x-camera,FLOOR-395,solved?"#c4e2c0":place.accent,20);if(!solved&&["bond","tide","escort","guardian","balance","rescue"].includes(t.kind)){ctx.fillStyle="rgba(8,19,32,.8)";ctx.fillRect(t.x-camera-85,FLOOR-374,170,7);ctx.fillStyle=place.accent;ctx.fillRect(t.x-camera-85,FLOOR-374,170*ts.progress,7);}}
   });
   residentArt(resident.sprite,resident.x-camera,FLOOR,115,Math.sin(clock*.75)*.008);residentArt(6,resident.x-90-camera,FLOOR,64);text(resident.name,resident.x-camera,FLOOR-180,place.accent,17);text(state.quests.includes(resident.id)?'Promise fulfilled':'E · a village promise',resident.x-camera,FLOOR-155,'#d6dbc5',13);
   for(const landmark of landmarks){const x=landmark.x-camera;if(x<-150||x>viewW+150)continue;const done=state.discoveries.includes(landmark.id);prop(landmark.sound==='bell'?2:landmark.sound==='water'?3:landmark.sound==='wood'?4:5,x,FLOOR,78,Math.sin(clock*.8)*.01,done?.6:1);if(!done)glow(x,FLOOR-40,62,place.accent,.16);text(landmark.label,x,FLOOR-112,done?'#a8b4ac':place.accent,13);}
   // Patrol spirits can be avoided by jumping. Story mode keeps exploration gentle.
   if(room.realm>=2&&state.difficulty!=='story'&&trial&&trial.kind!=='guardian'){const wx=trial.x-380+Math.sin(clock*(state.difficulty==='expert'?.95:.65)+room.realm)*155,wy=FLOOR-24;glow(wx-camera,wy,47,'#af8bf3',.25);ctx.save();ctx.fillStyle='#c7b1e0';ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(wx-camera,wy,16,21+Math.sin(clock*3)*4,0,0,Math.PI*2);ctx.fill();ctx.restore();text('Wandering shadow',wx-camera,wy-42,'#bfa7d6',11);if(live&&clock-lastWraith>3&&Math.hypot(self.x-wx,self.y-wy)<35){lastWraith=clock;resetRef.current();say('Ren · Jump over the wandering shadow. Your lantern remembers the way back.');}}
   prop(6,WIDTH-210-camera,FLOOR,210);if(activeIndex<0)glow(WIDTH-210-camera,FLOOR-100,145,place.accent,.26);
   renderCharacter(other,room.seat===0?1:0,false);renderCharacter(self,room.seat,true);
   for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=55*dt;ctx.save();ctx.globalAlpha=p.life/p.max*.8;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-camera,p.y,2+p.life*2,0,Math.PI*2);ctx.fill();ctx.restore();}
   for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;if(r.life<=0){rings.splice(i,1);continue;}ctx.save();ctx.globalAlpha=Math.min(.8,r.life*.65);ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x-camera,r.y,25+(1.6-r.life)*100,18+(1.6-r.life)*50,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
   const focus=chosen??hovered??currentTarget;if(focus){const x=focus.x-camera,y=focus.y-42;glow(x,y,75,place.accent,.17);ctx.strokeStyle=place.accent;ctx.lineWidth=2;ctx.setLineDash([7,8]);ctx.beginPath();ctx.ellipse(x,y,51,54,Math.sin(clock)*.08,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);if(chosen&&!canReach(self,chosen))text(Math.abs(self.y-chosen.y)>112&&Math.abs(self.x-chosen.x)<112?"Jump to reach this light":"Following this light…",x,y-76,place.accent,17);}
   if(destination!==null&&!chosen){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle=place.accent;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(destination-camera,FLOOR-2,16,5,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
   for(let i=0;i<4;i++){const x=i*(1150+room.realm*11)-camera*1.1;if(x<-350||x>viewW+350)continue;const w=terrainStyle.detailSize*1.55,h=w*terrainStyle.detail[3]/terrainStyle.detail[2];ctx.save();ctx.globalAlpha=.72;ctx.translate(x,HEIGHT+45);ctx.rotate(Math.sin(clock*.6+i)*terrainStyle.sway);art(terrainStyle.detail,-w/2,-h,w,h,i%2===1);ctx.restore();}
   if(resetFlash){ctx.fillStyle=`rgba(6,14,31,${resetFlash*.5})`;ctx.fillRect(0,0,viewW,HEIGHT);text("Your lantern brings you back to the last checkpoint",viewW/2,HEIGHT/2,"#e9cc9c",22);}
   if(clock-lastHud>.18){lastHud=clock;setCoordinates(Math.round(self.x)+', '+Math.round(self.y));if(state.upgrades.sight){const star=shards.filter(s=>!state.shards.includes(s.id)).sort((a,b)=>distance(self,a)-distance(self,b))[0];setSight(star?'Keeper’s lens · '+(star.x>self.x?'east →':'← west')+' · '+Math.round(distance(self,star)/10)+' steps':'Every star in this place is found.');}setTargetLabel(currentTarget?.label??"");setPrompt(currentTarget?`${currentTarget.hold?"Hold":"Press"} E · ${currentTarget.label}`:trial?`${trial.title} · ${Math.max(0,Math.round((trial.x-self.x)/10))} steps east`:"Meet at the eastern gate to travel onward");}
  };
  frame=requestAnimationFrame(tick);
  return()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener("click",pointWalk);canvas.removeEventListener("mousemove",hover);canvas.removeEventListener("mouseleave",unhover);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",clear);clear();};
 },[room.realm,room.seat]);
 const hold=(key:"left"|"right"|"hold")=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);input.current[key]=true;if(key==="hold")interactRef.current();},onPointerUp:()=>{input.current[key]=false;},onPointerCancel:()=>{input.current[key]=false;},onClick:(e:React.MouseEvent)=>{if(e.detail===0&&key==="hold")interactRef.current();}});
 return <div className="adventure-world" ref={hostRef}>
  <canvas ref={canvasRef} data-region={room.realm} data-assets-loaded={loading?'false':'true'} aria-label={`${REALMS[room.realm].title}. Play with arrow keys or A and D, Space to jump, E to interact.`} tabIndex={0}/>
  {sight&&<div className="world-sight">{sight}</div>}
  {loading&&<div className="world-loading"><span className="loading-light"/>Painting the path ahead…</div>}
  {assetError&&<div className="world-asset-error" role="alert">Some scenery could not load. <button onClick={()=>window.location.reload()}>Reload your saved journey</button></div>}
  <div className="world-location"><small>CHAPTER {Math.floor(room.realm/2)+1} · {room.realm%2===0?"FIRST PATH":"SECOND PATH"}</small><h2>{REALMS[room.realm].title}</h2><p>{REALMS[room.realm].chapter} · {terrainFor(room.realm).name}</p><p className="route-tip">{routeFor(room.realm).tip}</p></div>
  <div className="world-prompt" aria-live="polite">{prompt}</div>
  {storyLine&&<div className="world-story-line" role="status">{storyLine}</div>}
  <div className="world-companion"><i className={Date.now()-room.players[room.seat===0?1:0].seen<8000?"online":""}/>{room.names[room.seat===0?1:0]}{room.emotes[room.seat===0?1:0]&&<span>“{room.emotes[room.seat===0?1:0]}”</span>}</div>
  <div className="touch-move"><button aria-label="Walk left" {...hold("left")}>◀</button><button aria-label="Walk right" {...hold("right")}>▶</button></div>
  <div className="touch-actions"><button className="sprint" aria-label="Run" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);input.current.sprint=true;}} onPointerUp={()=>{input.current.sprint=false;}} onPointerCancel={()=>{input.current.sprint=false;}}>Run</button><button aria-label="Jump" onPointerDown={()=>{input.current.jump=true;}} onClick={e=>{if(e.detail===0)input.current.jump=true;}}>Jump</button><button aria-label={targetLabel||"Interact with the world"} {...hold("hold")}>E · Interact</button></div>
  <span className="sr-only" data-testid="traveler-position">{coordinates}</span>
  <button className="checkpoint-control" onClick={()=>resetRef.current()}>Return to checkpoint</button>
 </div>;
}



