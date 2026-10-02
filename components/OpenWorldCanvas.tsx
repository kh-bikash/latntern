"use client";
import {useEffect,useRef,useState} from 'react';
import {GroundedWorld} from './GroundedWorld';
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
  let world:GroundedWorld|undefined,ready=false,rendered=false,frameCount=0,fpsStart=performance.now();
  setLoading(true);setFailed(false);
  try{world=new GroundedWorld(holder,realm,room.seat);void world.load().then(()=>{if(!stopped){ready=true;world?.resize(w,h);setLoading(false);}}).catch(error=>{if(!stopped){console.error('Grounded world asset load failed',error);setFailed(true);setLoading(false);}});}catch(error){console.error('3D renderer unavailable',error);setFailed(true);setLoading(false);}
  const resize=()=>{w=holder.clientWidth;h=holder.clientHeight;const dpr=Math.min(2,devicePixelRatio||1);el.width=w*dpr;el.height=h*dpr;zoom=Math.max(.55,Math.min(1.15,h/740));world?.resize(w,h);};
  const observer=new ResizeObserver(resize);observer.observe(holder);resize();
  const position=():Traveler=>({x:self.x,y:self.y,facing:self.direction,moving:self.moving,grounded:self.dash===0,seen:Date.now(),realm});
  const emit=(t:Target)=>{if(acting||live.current.paused||distance(self,t)>130)return;acting=true;lastAction=clock;void live.current.onAction(t.type,t.type==='interact'?{crossing:t.crossing,payload:t.value}:t.value,position()).finally(()=>{acting=false;});};
  interact.current=()=>{if(nearest)emit(nearest);};
  reset.current=()=>{self.x=875+room.seat*65;self.y=600;self.vx=self.vy=0;path=[];selected=null;void live.current.onAction('checkpoint',null);};
  const clear=()=>{keys.clear();touch.current={left:false,right:false,up:false,down:false,run:false,hold:false,dodge:false};};
  const down=(e:KeyboardEvent)=>{if(live.current.paused||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown','shift',' ','e'].includes(k)){e.preventDefault();if(k===' '&&!e.repeat)touch.current.dodge=true;if(k==='e'&&!e.repeat)interact.current();if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown'].includes(k)){path=[];selected=null;}keys.add(k);}};
  const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
  const worldPointer=(e:PointerEvent)=>{return world?.pick(e.clientX,e.clientY);};
  const click=(e:PointerEvent)=>{if(live.current.paused||!ready)return;el.focus();const point=worldPointer(e);if(!point)return;const targetId=world?.pickTarget(e.clientX,e.clientY,targets);const t=targets.filter(t=>targetId?t.id===targetId:distance(t,point)<65).sort((a,b)=>distance(a,point)-distance(b,point))[0];selected=t?.id??null;path=walkPath(realm,self,t??point);if(t&&distance(self,t)<125){path=[];emit(t);if(!t.hold)selected=null;}};
  el.addEventListener('pointerdown',click);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  const text=(line:string,x:number,y:number,size=17,color='#f7eee0')=>{ctx.font=`500 ${size}px 'DM Sans',sans-serif`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(6,17,29,.9)';ctx.strokeText(line,x,y);ctx.fillStyle=color;ctx.fillText(line,x,y);};
  const tick=(now:number)=>{
   if(stopped)return;frame=requestAnimationFrame(tick);const dt=Math.min(.04,(now-previous)/1000);previous=now;clock+=dt;const state=live.current.room,active=!live.current.paused&&ready;
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
   if(!walkable(realm,{x:self.x,y:old.y})){self.x=old.x;self.vx=0;}if(!walkable(realm,{x:self.x,y:self.y})){self.y=old.y;self.vy=0;}world?.resolveMotion(self,old,targets);self.moving=distance(self,old)>.15;stride+=distance(self,old);
   if(dodging&&live.current.sound)playJump();
   const op=state.players[1-room.seat],beforeOther={x:other.x,y:other.y};other.x+=(op.x-other.x)*Math.min(1,dt*10);other.y+=(op.y-other.y)*Math.min(1,dt*10);other.facing=op.facing;other.grounded=op.grounded;other.moving=op.moving&&distance(other,beforeOther)>.1;otherStride+=distance(other,beforeOther);
   if(active&&(keys.has('e')||touch.current.hold)&&nearest&&clock-lastAction>(nearest.hold?.45:.6))emit(nearest);
   if(clock-lastSent>(self.moving?.26:1.8)){lastSent=clock;live.current.onMove(position());}
   const surface:Surface=[8,9].includes(realm)?'snow':[4,5,11,15].includes(realm)?'concrete':[0,2,3,10,14].includes(realm)?'grass':'wood';
   if(live.current.sound&&ready){if(stride-lastStep>27&&self.moving){lastStep=stride;playFootstep(surface,Math.hypot(self.vx,self.vy)/80,room.seat);}if(otherStride-lastOtherStep>27&&other.moving){lastOtherStep=otherStride;playFootstep(surface,1,1-room.seat,(other.x-self.x)/500,distance(self,other)/550);}if(Math.floor(clock*3)!==Math.floor((clock-dt)*3))updateAdventureSoundscape(place.ambient,self.x/WIDTH,clock,resident.x/WIDTH*4100,Math.max(...state.trials.map(t=>t.progress)));}
   if(ready&&(!live.current.paused||!rendered)){world?.render(active?dt:0,clock,position(),other,state,targets,live.current.reducedMotion);rendered=true;}frameCount++;if(now-fpsStart>1000){el.dataset.fps=String(Math.round(frameCount*1000/(now-fpsStart)));frameCount=0;fpsStart=now;}
   const dpr=el.width/w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   // HUD labels share the perspective camera; avatars and props are depth tested.
   for(const p of [{...position(),side:room.seat},{...other,side:1-room.seat}]){const screen=world?.project(p,2.05);if(screen?.visible)text(`${state.names[p.side]}${p.side===room.seat?' · you':''}`,screen.x,screen.y,12,colors[p.side]);}
   for(const t of targets){if(distance(self,t)>240&&t.id!==selected)continue;const screen=world?.project(t,t.type==='travel'?2.6:t.type==='quest'?2.1:1.5);if(screen?.visible){const label=t.id===nearest?.id?t.label:t.type==='travel'?t.label:t.type==='quest'?resident.name.split(',')[0]:t.type==='interact'&&['bells','runes'].includes(trials[t.crossing!].kind)?t.label:t.type==='interact'?trials[t.crossing!].title.split(' · ')[0]:t.type==='shard'?'✦':t.type==='page'?'Memory':'?';text(label,screen.x,screen.y,t.id===nearest?.id?13:11,t.id===nearest?.id?'#ffe1a1':'#dfe5df');}}
   if(selected){const t=targets.find(t=>t.id===selected);const screen=t?world?.project(t,.12):undefined;if(screen?.visible){ctx.strokeStyle='#fff4c8';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(screen.x,screen.y,12,5,0,0,Math.PI*2);ctx.stroke();}}
   const mw=w<700?110:150,mh=mw*HEIGHT/WIDTH,mx=w-mw-22,my=w<700?100:90;ctx.fillStyle='rgba(6,18,29,.8)';ctx.fillRect(mx-8,my-8,mw+16,mh+30);ctx.fillStyle='#32443e';ctx.fillRect(mx,my,mw,mh);
   ctx.strokeStyle='#b3ad96';ctx.lineWidth=5;ctx.lineCap='round';for(const path of pathsFor(realm)){ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(mx+p.x/WIDTH*mw,my+p.y/HEIGHT*mh):ctx.moveTo(mx+p.x/WIDTH*mw,my+p.y/HEIGHT*mh));ctx.stroke();}
   for(const p of [{...self,side:room.seat},{...other,side:1-room.seat}]){ctx.fillStyle=colors[p.side];ctx.beginPath();ctx.arc(mx+p.x/WIDTH*mw,my+p.y/HEIGHT*mh,3,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ece0ce';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('N ↑  ·  E →  ·  S ↓  ·  W ←',mx+mw/2,my+mh+18);
   if(clock-lastHUD>.2){lastHUD=clock;const i=trials.map((t,index)=>({d:distance(self,t),index})).sort((a,b)=>a.d-b.d)[0];if(i&&i.d<300&&i.index!==focused){focused=i.index;live.current.onFocusTrial?.(focused);}setCoords(`${Math.round(self.x)}, ${Math.round(self.y)}`);const star=state.upgrades.sight?shardPoints(realm).filter(p=>!state.shards.includes(p.id)).sort((a,b)=>distance(self,a)-distance(self,b))[0]:undefined;setSight(star?`Keeper’s lens · ${Math.abs(star.x-self.x)>Math.abs(star.y-self.y)?star.x>self.x?"East →":"West ←":star.y>self.y?"South ↓":"North ↑"} · ${Math.round(distance(self,star)/10)} steps to starlight`:state.upgrades.sight?"All regional starlight found":"");setPrompt(nearest?`${nearest.label}${nearest.hold?'':' · E'}`:'WASD / arrows to explore · click to walk · Space dodge');const t=focused>=0?trials[focused]:undefined,s=t?state.trials[focused]:undefined;setClue(t&&!s?.solved?(t.kind==='guardian'?`${Date.now()%5500<800?'DODGE NOW':Date.now()%5500>3900?'SHADOW APPROACHING':'Hold E together'} · leave the violet circle or dodge with Space`:t.kind==='tide'?`${Date.now()%9000<5200?'LOW TIDE · Hold E':'HIGH TIDE · Wait'} · ${t.hint}`:t.kind==='balance'?`${Date.now()%7000<4200?'CALM WIND · Hold E':'GUST · Stay still'} · ${t.hint}`:t.kind==='bells'?`${s?.notes[room.seat]??0}/${t.melodies[room.seat].length} notes · ${t.melodies[room.seat].map(n=>BELL_NAMES[n]).join(' → ')}`:t.kind==='runes'?`Tell your companion: ${SIGILS[t.targets[1-room.seat]]}. Ask them for your mark.`:t.kind==='mirrors'?`Your target: ${SIGILS[t.targets[room.seat]]}`:t.hint):'');}
  };
  frame=requestAnimationFrame(tick);
  return()=>{stopped=true;cancelAnimationFrame(frame);world?.dispose();observer.disconnect();el.removeEventListener('pointerdown',click);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
 },[room.code,room.realm,room.seat]);
 const hold=(key:'left'|'right'|'up'|'down'|'run'|'hold')=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.current[key]=true;if(key==='hold')interact.current();},onPointerUp:()=>{touch.current[key]=false;},onPointerCancel:()=>{touch.current[key]=false;},onLostPointerCapture:()=>{touch.current[key]=false;}});
 return <div ref={host} className="adventure-world open-world">
  <canvas ref={canvas} tabIndex={0} data-renderer="grounded-3d" data-region={room.realm} data-assets-loaded={!loading} aria-label={`${REALMS[room.realm].title}. Open world adventure. WASD or arrows walk in all directions. Shift runs. Space dodges. E interacts.`}/>
  <div className="world-location"><small>THE ATLAS IS OPEN · {(room.visited??[room.realm]).length}/16 REGIONS VISITED</small><h2>{REALMS[room.realm].title}</h2><p>Choose your own path. Return whenever you like.</p></div>
  <div className="world-companion"><i className={Date.now()-room.players[1-room.seat].seen<8000?'online':''}/>{room.names[1-room.seat]}{room.emotes[1-room.seat]&&<span>“{room.emotes[1-room.seat]}”</span>}</div>
  {sight&&<div className="world-sight">{sight}</div>}{clue&&<div className="world-clue">{clue}</div>}<div className="world-prompt" aria-live="polite">{prompt}</div>
  <div className="touch-move compass-controls"><button aria-label="Walk north" {...hold('up')}>↑</button><button aria-label="Walk west" {...hold('left')}>←</button><button aria-label="Walk south" {...hold('down')}>↓</button><button aria-label="Walk east" {...hold('right')}>→</button></div>
  <div className="touch-actions"><button aria-label="Run" {...hold('run')}>Run</button><button aria-label="Dodge" onPointerDown={()=>{touch.current.dodge=true;}}>Dodge</button><button aria-label="Interact" {...hold('hold')}>E · Interact</button></div>
  {room.travelTarget!=null&&<button className="travel-cancel" onClick={()=>void props.onAction('cancelTravel',null)}>Cancel travel request</button>}
  <button className="checkpoint-control" onClick={()=>reset.current()}>Return to camp</button><span className="sr-only" data-testid="traveler-position">{coords}</span>
  {loading&&<div className="world-loading">Loading terrain, plants and travelers…</div>}{failed&&<div className="world-asset-error">The 3D world could not load. Please use a browser with WebGL enabled. <button onClick={()=>location.reload()}>Reload</button></div>}
 </div>;
}
