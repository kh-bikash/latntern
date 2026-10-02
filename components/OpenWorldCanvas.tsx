"use client";
import {useEffect,useRef,useState} from 'react';
import {WIDTH,HEIGHT,REALMS,trialsFor,shardPoints,pagePoints,inspectPoints,escortPoint,SIGILS,BELL_NAMES,type CampaignRoom,type Traveler,type Point} from '@/lib/adventure';
import {exitsFor,stepWorld,type WorldBody} from '@/lib/openWorld';
import {walkable,walkPath,pathsFor} from '@/lib/worldLayout';
import {residentFor} from '@/lib/quests';
import {playFootstep,playJump,playStoryCue,updateAdventureSoundscape,type Surface} from '@/lib/audio';
type Props={room:CampaignRoom;sound:boolean;paused:boolean;reducedMotion:boolean;onMove:(p:Traveler)=>void;onAction:(type:string,value:unknown,p?:Traveler)=>Promise<void>;onFocusTrial?:(i:number)=>void};
type Target=Point&{id:string;type:string;value:unknown;label:string;hold?:boolean;crossing?:number};
const colors=['#ffd78c','#81ddff'];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export default function OpenWorldCanvas(props:Props){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),live=useRef(props);live.current=props;
 const touch=useRef({left:false,right:false,up:false,down:false,run:false,hold:false,dodge:false}),interact=useRef(()=>{}),reset=useRef(()=>{});
 const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[prompt,setPrompt]=useState('Choose a trail. The whole world is open.'),[clue,setClue]=useState(''),[coords,setCoords]=useState(''),[sight,setSight]=useState('');
 const {room}=props;
 useEffect(()=>{
  const el=canvas.current,holder=host.current;if(!el||!holder)return;const ctx=el.getContext('2d');if(!ctx)return;
  const realm=room.realm,place=REALMS[realm],trials=trialsFor(realm,room.difficulty),resident=residentFor(realm),exits=exitsFor(realm),keys=new Set<string>();
  const self:WorldBody={...room.players[room.seat],vx:0,vy:0,direction:room.players[room.seat].facing,dash:0,cooldown:0},other={...room.players[1-room.seat]};
  let stopped=false,frame=0,previous=performance.now(),clock=0,w=1200,h=700,zoom=1,cx=0,cy=0,stride=0,otherStride=0,lastSent=0,lastStep=0,lastOtherStep=0,lastHUD=0,lastAction=0,acting=false,focused=-1,selected:string|null=null,path:Point[]=[],nearest:Target|undefined,targets:Target[]=[],wasPaused=false,observed=room;
  const images:Record<string,HTMLImageElement>={},particles:{x:number;y:number;age:number;color:string}[]=[];
  const load=(key:string,url:string)=>new Promise<void>(resolve=>{const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>{if(!stopped)setFailed(true);resolve();};im.src=url;});
  setLoading(true);setFailed(false);
  void Promise.all([load('map',`/world/maps-${Math.floor(realm/4)}.webp`),load('walkers','/world/walkers.webp'),load('props','/adventure/props.png'),load('residents','/adventure/residents.png')]).then(()=>{if(!stopped)setLoading(false);});
  const resize=()=>{w=holder.clientWidth;h=holder.clientHeight;const dpr=Math.min(2,devicePixelRatio||1);el.width=w*dpr;el.height=h*dpr;zoom=Math.max(.55,Math.min(1.15,h/740));};
  const observer=new ResizeObserver(resize);observer.observe(holder);resize();
  const position=():Traveler=>({x:self.x,y:self.y,facing:self.direction,moving:self.moving,grounded:self.dash===0,seen:Date.now(),realm});
  const emit=(t:Target)=>{if(acting||live.current.paused||distance(self,t)>130)return;acting=true;lastAction=clock;void live.current.onAction(t.type,t.type==='interact'?{crossing:t.crossing,payload:t.value}:t.value,position()).finally(()=>{acting=false;});};
  interact.current=()=>{if(nearest)emit(nearest);};
  reset.current=()=>{self.x=875+room.seat*65;self.y=600;self.vx=self.vy=0;path=[];selected=null;void live.current.onAction('checkpoint',null);};
  const clear=()=>{keys.clear();touch.current={left:false,right:false,up:false,down:false,run:false,hold:false,dodge:false};};
  const down=(e:KeyboardEvent)=>{if(live.current.paused||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown','shift',' ','e'].includes(k)){e.preventDefault();if(k===' '&&!e.repeat)touch.current.dodge=true;if(k==='e'&&!e.repeat)interact.current();if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown'].includes(k)){path=[];selected=null;}keys.add(k);}};
  const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
  const worldPointer=(e:PointerEvent)=>{const rect=el.getBoundingClientRect();return {x:cx+(e.clientX-rect.left)/zoom,y:cy+(e.clientY-rect.top)/zoom};};
  const click=(e:PointerEvent)=>{if(live.current.paused)return;el.focus();const point=worldPointer(e);const t=targets.filter(t=>distance(t,point)<65).sort((a,b)=>distance(a,point)-distance(b,point))[0];selected=t?.id??null;path=walkPath(realm,self,t??point);if(t&&distance(self,t)<125){path=[];emit(t);if(!t.hold)selected=null;}};
  el.addEventListener('pointerdown',click);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  const text=(line:string,x:number,y:number,size=17,color='#f7eee0')=>{ctx.font=`500 ${size}px 'DM Sans',sans-serif`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(6,17,29,.9)';ctx.strokeText(line,x,y);ctx.fillStyle=color;ctx.fillText(line,x,y);};
  const glow=(p:Point,r:number,color:string,alpha=.35)=>{ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.restore();};
  const sprite=(sheet:string,index:number,columns:number,rows:number,p:Point,size:number)=>{const im=images[sheet];if(!im)return;const sw=im.width/columns,sh=im.height/rows;ctx.drawImage(im,index%columns*sw,Math.floor(index/columns)*sh,sw,sh,p.x-size/2,p.y-size,size,size);};
  const ring=(p:Point,color:string,r=35)=>{ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.55,0,0,Math.PI*2);ctx.stroke();glow(p,65,color,.28);};
  const hero=(p:Traveler,side:number,own:boolean)=>{ctx.save();ctx.fillStyle='rgba(3,9,16,.37)';ctx.beginPath();ctx.ellipse(p.x,p.y+2,23,8,0,0,Math.PI*2);ctx.fill();if(own&&self.dash>0)glow(p,80,colors[side],.7);const direction=Math.max(0,Math.min(3,p.facing)),phase=own?stride:otherStride,cell=direction*8+side*4+(p.moving?Math.floor(phase/25)%4:0);sprite('walkers',cell,8,4,{x:p.x,y:p.y+(p.moving?Math.sin(phase/16)*1.5:Math.sin(clock*2)*.8)},108);glow({x:p.x+15,y:p.y-35},50,colors[side],.14);text(`${live.current.room.names[side]}${own?' · you':''}`,p.x,p.y-120,16,colors[side]);ctx.restore();};
  const tick=(now:number)=>{
   if(stopped)return;frame=requestAnimationFrame(tick);const dt=Math.min(.04,(now-previous)/1000);previous=now;clock+=dt;const state=live.current.room,active=!live.current.paused;
   if(!active&&!wasPaused){clear();path=[];selected=null;}wasPaused=!active;
   targets=[];const add=(type:string,value:unknown,p:Point,label:string,id:string,hold=false,crossing?:number)=>targets.push({...p,type,value,label,id,hold,crossing});
   for(const p of shardPoints(realm))if(!state.shards.includes(p.id))add('shard',p.id,p,'Gather starlight',p.id);
   for(const p of pagePoints(realm))if(!state.pages.includes(p.id))add('page',p.id,p,'Read a keeper’s memory',p.id);
   for(const p of inspectPoints(realm))if(!state.discoveries.includes(p.id))add('inspect',p.id,p,p.label,p.id);
   add('quest',null,resident,`Speak to ${resident.name}`,'resident');
   for(const exit of exits)add('travel',exit.realm,exit,`${exit.direction} → ${REALMS[exit.realm].title}`,`exit-${exit.realm}`);
   if(realm===15&&state.completed.length===16)add('advance',null,{x:1600,y:600},'Bring the dawn home together','ending');
   trials.forEach((t,i)=>{const s=state.trials[i];if(s.solved)return;const prefix=`trial-${i}`,seat=room.seat;
    if(t.kind==='bells')for(let note=0;note<3;note++)add('interact',note,{x:t.x+(note-1)*110,y:t.y},`Ring ${BELL_NAMES[note]}`,`${prefix}-bell-${note}`,false,i);
    else if(t.kind==='runes')for(let mark=0;mark<4;mark++)add('interact',mark,{x:t.x-165+mark*110,y:t.y},`Choose ${SIGILS[mark]}`,`${prefix}-seal-${mark}`,false,i);
    else if(t.kind==='embers'||(t.kind==='rescue'&&s.pieces[seat].length<2))t.embers[seat].forEach((p,j)=>{if(!s.pieces[seat].includes(j))add('interact',j,p,t.kind==='rescue'?'Rescue a crane spirit':'Recover your wish',`${prefix}-wish-${j}`,false,i);});
    else add('interact',null,t.kind==='escort'?escortPoint(t,s.progress):t.sockets[seat],t.kind==='mirrors'?`Turn compass · ${SIGILS[s.turns[seat]]}`:t.kind==='escort'?'Hold E · guide the silver fox':'Hold E · join your lantern',`${prefix}-shrine`,t.kind!=='mirrors',i);
   });
   nearest=targets.filter(t=>distance(self,t)<130).sort((a,b)=>(a.id===selected?-1000:distance(self,a))-(b.id===selected?-1000:distance(self,b)))[0];
   if(selected){const chosen=targets.find(t=>t.id===selected);if(!chosen){selected=null;path=[];}else if(distance(self,chosen)<100){path=[];if(clock-lastAction>.46){emit(chosen);if(!chosen.hold)selected=null;}}else if(chosen.type==='interact'&&trials[chosen.crossing!]?.kind==='escort'&&path.length===0)path=walkPath(realm,self,chosen);}
   let dx=active?Number(keys.has('d')||keys.has('arrowright')||touch.current.right)-Number(keys.has('a')||keys.has('arrowleft')||touch.current.left):0,dy=active?Number(keys.has('s')||keys.has('arrowdown')||touch.current.down)-Number(keys.has('w')||keys.has('arrowup')||touch.current.up):0;
   if(active&&!dx&&!dy&&path.length){while(path.length&&distance(self,path[0])<18)path.shift();if(path.length){dx=path[0].x-self.x;dy=path[0].y-self.y;}}
   const old={x:self.x,y:self.y},dodging=touch.current.dodge;stepWorld(self,dt,dx,dy,active&&(keys.has('shift')||touch.current.run),active&&dodging,state.upgrades.wind>0,[8,9].includes(realm)?.72:1);touch.current.dodge=false;
   if(!walkable(realm,{x:self.x,y:old.y})){self.x=old.x;self.vx=0;}if(!walkable(realm,{x:self.x,y:self.y})){self.y=old.y;self.vy=0;}self.moving=distance(self,old)>.15;stride+=distance(self,old);
   if(dodging&&live.current.sound)playJump();
   const op=state.players[1-room.seat],beforeOther={x:other.x,y:other.y};other.x+=(op.x-other.x)*Math.min(1,dt*10);other.y+=(op.y-other.y)*Math.min(1,dt*10);other.facing=op.facing;other.grounded=op.grounded;other.moving=op.moving&&distance(other,beforeOther)>.1;otherStride+=distance(other,beforeOther);
   if(active&&(keys.has('e')||touch.current.hold)&&nearest&&clock-lastAction>(nearest.hold?.45:.6))emit(nearest);
   if(clock-lastSent>(self.moving?.26:1.8)){lastSent=clock;live.current.onMove(position());}
   const surface:Surface=[8,9].includes(realm)?'snow':[4,5,11,15].includes(realm)?'concrete':[0,2,3,10,14].includes(realm)?'grass':'wood';
   if(live.current.sound){if(stride-lastStep>70&&self.moving){lastStep=stride;playFootstep(surface,Math.hypot(self.vx,self.vy)/205,room.seat);}if(otherStride-lastOtherStep>70&&other.moving){lastOtherStep=otherStride;playFootstep(surface,1,1-room.seat,(other.x-self.x)/500,distance(self,other)/550);}if(Math.floor(clock*3)!==Math.floor((clock-dt)*3))updateAdventureSoundscape(place.ambient,self.x/WIDTH,clock,resident.x/WIDTH*4100,Math.max(...state.trials.map(t=>t.progress)));}
   if(state!==observed){state.trials.forEach((t,i)=>{if(t.solved&&!observed.trials[i]?.solved)for(let n=0;n<28;n++)particles.push({x:trials[i].x+(Math.random()-.5)*140,y:trials[i].y+(Math.random()-.5)*100,age:0,color:place.accent});});observed=state;}
   cx+= (Math.max(0,Math.min(WIDTH-w/zoom,self.x-w/zoom/2))-cx)*Math.min(1,dt*7);cy+=(Math.max(0,Math.min(HEIGHT-h/zoom,self.y-h/zoom/2))-cy)*Math.min(1,dt*7);
   const dpr=el.width/w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#13242c';ctx.fillRect(0,0,w,h);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);
   const im=images.map;if(im){const sw=im.width/2,sh=im.height/2,tile=realm%4;ctx.drawImage(im,tile%2*sw,Math.floor(tile/2)*sh,sw,sh,0,0,WIDTH,HEIGHT);}
   // Shallow animated reflections and drifting weather sit in the painted world.
   if(!live.current.reducedMotion){for(let n=0;n<45;n++){const x=(n*173.6+clock*(place.ambient==='rain'?25:8))%WIDTH,y=(n*87.9+clock*(place.ambient==='rain'?240:12))%HEIGHT;ctx.globalAlpha=.2+.15*Math.sin(clock+n);ctx.fillStyle=[8,9].includes(realm)?'#f5ffff':place.ambient==='rain'?'#adcee8':'#ffe6c8';if(place.ambient==='rain'){ctx.fillRect(x,y,1,14);}else{ctx.beginPath();ctx.ellipse(x,y,2.5,1.5,clock+n,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;}
   // Residents and wildlife add movement independent of the two travelers.
   sprite('residents',resident.sprite,4,2,resident,98);text(state.quests.includes(resident.id)?'Promise fulfilled':resident.name.split(',')[0],resident.x,resident.y-104,16,'#ffe2aa');
   const wander=pathsFor(realm)[0][2],fox={x:wander.x+Math.cos(clock*.3)*38,y:wander.y+Math.sin(clock*.3)*22};sprite('residents',4,4,2,fox,68);
   for(const p of shardPoints(realm))if(!state.shards.includes(p.id)){const float={x:p.x,y:p.y-20+Math.sin(clock*2+p.x)*5};glow(float,55,'#b8efff');sprite('props',10,4,3,float,46);text('✦',p.x,p.y+15,19,'#c7f5ff');}
   for(const p of pagePoints(realm)){sprite('props',1,4,3,p,70);if(!state.pages.includes(p.id)){glow(p,75,'#ffd392',.2);text('Memory',p.x,p.y+18,15,'#ffe1ab');}}
   for(const p of inspectPoints(realm)){sprite('props',realm%3===0?5:7,4,3,p,60);text(state.discoveries.includes(p.id)?'✓':'?',p.x,p.y-67,19,place.accent);}
   trials.forEach((t,i)=>{const s=state.trials[i];if(s.solved){glow(t,120,place.accent,.23);text('✦ RESTORED',t.x,t.y-105,15,place.accent);return;}
    text(`${i+1} · ${t.title.split(' · ')[0]}`,t.x,t.y-115,18);
    if(t.kind==='bells')for(let n=0;n<3;n++){const p={x:t.x+(n-1)*110,y:t.y};sprite('props',0,4,3,p,62);text(BELL_NAMES[n],p.x,p.y+23,15,'#ffdf9c');}
    else if(t.kind==='runes')for(let n=0;n<4;n++){const p={x:t.x-165+n*110,y:t.y};ring(p,place.accent,30);text(SIGILS[n],p.x,p.y+8,15);}
    else if(t.kind==='escort'){const fox=escortPoint(t,s.progress);sprite('residents',4,4,2,fox,85);ring(fox,place.accent,55);}
    else{for(let side=0;side<2;side++){const p=t.sockets[side];ring(p,colors[side],42);sprite('props',side?11:6,4,3,p,64);if(t.kind==='mirrors')text(SIGILS[s.turns[side]],p.x,p.y+28,16,colors[side]);}
     if(t.kind==='embers'||t.kind==='rescue')for(let side=0;side<2;side++)t.embers[side].forEach((p,n)=>{if(s.pieces[side].includes(n))return;glow(p,60,colors[side]);sprite(t.kind==='rescue'?'residents':'props',t.kind==='rescue'?5:10,4,t.kind==='rescue'?2:3,{x:p.x,y:p.y-8+Math.sin(clock*2+n)*3},t.kind==='rescue'?66:42);});
    }
    if(s.progress>0){ctx.fillStyle='rgba(4,16,28,.85)';ctx.fillRect(t.x-80,t.y+75,160,8);ctx.fillStyle=place.accent;ctx.fillRect(t.x-80,t.y+75,160*s.progress,8);}
    if(t.kind==='guardian'){const time=Date.now()%5500,warning=time>3900||time<800;ctx.save();ctx.globalAlpha=warning?.26:.08;ctx.fillStyle='#b597ff';ctx.beginPath();ctx.ellipse(t.x,t.y,180,180,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.8;ctx.strokeStyle='#ccafff';ctx.lineWidth=warning?4:1;ctx.stroke();ctx.restore();sprite('props',9,4,3,{x:t.x,y:t.y-25+Math.sin(clock)*8},90);text(time<800?'DODGE!':time>3900?'SHADOW APPROACHING':'Join your light',t.x,t.y+205,16,'#ddc5ff');if(time>3900&&Math.floor(clock)!==Math.floor(clock-dt)&&live.current.sound&&distance(self,t)<350)playStoryCue('shadow');}
    if(t.kind==='tide')text(Date.now()%9000<5200?'LOW TIDE · HOLD E':'HIGH TIDE · WAIT',t.x,t.y+115,15,'#9adef2');
    if(t.kind==='balance')text(Date.now()%7000<4200?'CALM WIND · HOLD E':'GUST · STAY STILL',t.x,t.y+115,15,'#cfe6ec');
   });
   for(const e of exits){ring(e,place.accent,55);sprite('props',7,4,3,e,95);text(`${e.direction} →`,e.x,e.y-110,19,place.accent);text(REALMS[e.realm].title,e.x,e.y+27,16);if(state.travelTarget===e.realm)text('Your companion is waiting',e.x,e.y+50,15,'#ffd9aa');}
   if(realm===15){sprite('props',8,4,3,{x:1600,y:600},105);text(`${state.completed.length}/16 regions restored`,1600,625,16,place.accent);}
   const people:[Traveler,number,boolean][]=[[{...position()},room.seat,true],[other,1-room.seat,false]];people.sort((a,b)=>a[0].y-b[0].y).forEach(p=>hero(...p));
   if(selected){const t=targets.find(t=>t.id===selected);if(t)ring(t,'#ffffff',50);}if(path.length){const p=path[path.length-1];ctx.strokeStyle='rgba(255,243,211,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,12,6,0,0,Math.PI*2);ctx.stroke();}
   for(let n=particles.length-1;n>=0;n--){const p=particles[n];p.age+=dt;p.y-=dt*40;if(p.age>1.5){particles.splice(n,1);continue;}glow(p,12,p.color,(1-p.age/1.5)*.7);}ctx.restore();
   // The map remains available during exploration, including remote player position.
   const mw=150,mh=100,mx=w-mw-22,my=90;ctx.fillStyle='rgba(6,18,29,.77)';ctx.fillRect(mx-8,my-8,mw+16,mh+40);if(im){const tile=realm%4;ctx.globalAlpha=.7;ctx.drawImage(im,tile%2*im.width/2,Math.floor(tile/2)*im.height/2,im.width/2,im.height/2,mx,my,mw,mh);ctx.globalAlpha=1;}for(const p of [{...self,side:room.seat},{...other,side:1-room.seat}]){ctx.fillStyle=colors[p.side];ctx.beginPath();ctx.arc(mx+p.x/WIDTH*mw,my+p.y/HEIGHT*mh,4,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ece0ce';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('N ↑  ·  E →  ·  S ↓  ·  W ←',mx+mw/2,my+mh+21);
   if(clock-lastHUD>.2){lastHUD=clock;const i=trials.map((t,index)=>({d:distance(self,t),index})).sort((a,b)=>a.d-b.d)[0];if(i&&i.d<300&&i.index!==focused){focused=i.index;live.current.onFocusTrial?.(focused);}setCoords(`${Math.round(self.x)}, ${Math.round(self.y)}`);const star=state.upgrades.sight?shardPoints(realm).filter(p=>!state.shards.includes(p.id)).sort((a,b)=>distance(self,a)-distance(self,b))[0]:undefined;setSight(star?`Keeper’s lens · ${Math.abs(star.x-self.x)>Math.abs(star.y-self.y)?star.x>self.x?"East →":"West ←":star.y>self.y?"South ↓":"North ↑"} · ${Math.round(distance(self,star)/10)} steps to starlight`:state.upgrades.sight?"All regional starlight found":"");setPrompt(nearest?`${nearest.label}${nearest.hold?'':' · E'}`:'WASD / arrows to explore · click to walk · Space dodge');const t=focused>=0?trials[focused]:undefined,s=t?state.trials[focused]:undefined;setClue(t&&!s?.solved?(t.kind==='bells'?`${s?.notes[room.seat]??0}/${t.melodies[room.seat].length} notes · ${t.melodies[room.seat].map(n=>BELL_NAMES[n]).join(' → ')}`:t.kind==='runes'?`Tell your companion: ${SIGILS[t.targets[1-room.seat]]}. Ask them for your mark.`:t.kind==='mirrors'?`Your target: ${SIGILS[t.targets[room.seat]]}`:t.hint):'');}
  };
  frame=requestAnimationFrame(tick);
  return()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointerdown',click);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
 },[room.code,room.realm,room.seat]);
 const hold=(key:'left'|'right'|'up'|'down'|'run'|'hold')=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.current[key]=true;if(key==='hold')interact.current();},onPointerUp:()=>{touch.current[key]=false;},onPointerCancel:()=>{touch.current[key]=false;},onLostPointerCapture:()=>{touch.current[key]=false;}});
 return <div ref={host} className="adventure-world open-world">
  <canvas ref={canvas} tabIndex={0} data-region={room.realm} data-assets-loaded={!loading} aria-label={`${REALMS[room.realm].title}. Open world adventure. WASD or arrows walk in all directions. Shift runs. Space dodges. E interacts.`}/>
  <div className="world-location"><small>THE ATLAS IS OPEN · {(room.visited??[room.realm]).length}/16 REGIONS VISITED</small><h2>{REALMS[room.realm].title}</h2><p>Choose your own path. Return whenever you like.</p></div>
  <div className="world-companion"><i className={Date.now()-room.players[1-room.seat].seen<8000?'online':''}/>{room.names[1-room.seat]}{room.emotes[1-room.seat]&&<span>“{room.emotes[1-room.seat]}”</span>}</div>
  {sight&&<div className="world-sight">{sight}</div>}{clue&&<div className="world-clue">{clue}</div>}<div className="world-prompt" aria-live="polite">{prompt}</div>
  <div className="touch-move compass-controls"><button aria-label="Walk north" {...hold('up')}>↑</button><button aria-label="Walk west" {...hold('left')}>←</button><button aria-label="Walk south" {...hold('down')}>↓</button><button aria-label="Walk east" {...hold('right')}>→</button></div>
  <div className="touch-actions"><button aria-label="Run" {...hold('run')}>Run</button><button aria-label="Dodge" onPointerDown={()=>{touch.current.dodge=true;}}>Dodge</button><button aria-label="Interact" {...hold('hold')}>E · Interact</button></div>
  {room.travelTarget!=null&&<button className="travel-cancel" onClick={()=>void props.onAction('cancelTravel',null)}>Cancel travel request</button>}
  <button className="checkpoint-control" onClick={()=>reset.current()}>Return to camp</button><span className="sr-only" data-testid="traveler-position">{coords}</span>
  {loading&&<div className="world-loading">Opening the painted world…</div>}{failed&&<div className="world-asset-error">Artwork could not load. <button onClick={()=>location.reload()}>Reload</button></div>}
 </div>;
}
