import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {GameError} from './game';
import {readRoom,insertRoom,saveRoom} from './roomStore';
import {FLIGHT_REGIONS,MISSIONS,flightSpawn,terrainHeight,missionPoints,groundDistance,clamp,type TerrainData,type FlightRoom,type FlightDifficulty,type Aircraft} from './flight';
type State=Omit<FlightRoom,'seat'|'version'|'hint'>&{kind:'flight';tokens:[string,string|null];pulse:number};
const cache=new Map<number,Promise<TerrainData>>();
export function flightTerrain(region:number){let p=cache.get(region);if(!p){p=readFile(join(process.cwd(),'public','flight','terrain',`${FLIGHT_REGIONS[region].id}.json`),'utf8').then(s=>JSON.parse(s) as TerrainData);cache.set(region,p);}return p;}
function view(s:State,token:string,version:number,hint=''){const {tokens,pulse,kind,...rest}=s;const seat=tokens.indexOf(token);if(seat<0)throw new GameError('Join this flight to play.',403);return{...rest,seat,version,hint} as FlightRoom;}
async function read(code:string){const row=await readRoom(`flight:${code}`);if(!row)throw new GameError('Flight not found. Check the invitation code.',404);return row;}
export async function createFlight(name:string,difficulty:FlightDifficulty='explorer'){
 if(!['explorer','pilot','ace'].includes(difficulty))throw new GameError('Choose Explorer, Pilot or Ace.');
 const t=await flightTerrain(0),token=crypto.randomUUID(),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 for(let i=0;i<5;i++){const bytes=crypto.getRandomValues(new Uint8Array(6)),code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');const s:State={kind:'flight',code,names:[name,null],tokens:[token,null],status:'waiting',difficulty,mission:0,planes:[flightSpawn(0,t),flightSpawn(1,t)],steps:[0,0],progress:0,ready:[false,false],completed:[],crashes:[0,0],created:Date.now(),pulse:0};try{await insertRoom(`flight:${code}`,JSON.stringify(s),Date.now());return{token,room:view(s,token,0)};}catch(e){if(!String(e).includes('UNIQUE')&&!String(e).includes('duplicate'))throw e;}}
 throw new GameError('Cannot create a flight. Try again.',503);
}
export async function getFlight(code:string,token:string){const row=await read(code);return view(JSON.parse(row.state),token,row.version);}
export async function joinFlight(code:string,name:string){const row=await read(code),s=JSON.parse(row.state) as State;if(s.tokens[1])throw new GameError('This flight already has two pilots. Resume using the original browser.',409);const token=crypto.randomUUID();s.tokens[1]=token;s.names[1]=name;s.status='flying';s.planes[1]=flightSpawn(1,await flightTerrain(Math.floor(s.mission/2)));if(!await saveRoom(`flight:${code}`,JSON.stringify(s),row.version))throw new GameError('Another pilot joined first.',409);return{token,room:view(s,token,row.version+1)};}
export async function actFlight(code:string,token:string,input:{type:string;value?:unknown;mission?:number}):Promise<FlightRoom>{
 for(let attempt=0;attempt<8;attempt++){
  const row=await read(code),s=JSON.parse(row.state) as State,seat=s.tokens.indexOf(token);if(seat<0)throw new GameError('Join this flight to play.',403);
  if(input.mission!==undefined&&input.mission!==s.mission)return view(s,token,row.version);
  const now=Date.now(),region=Math.floor(Math.min(s.mission,11)/2),t=await flightTerrain(region),p=s.planes[seat],def=MISSIONS[s.mission];let hint='';
  if(input.type==='move'){
   const v=input.value as Aircraft;if(!v||!['x','y','z','yaw','pitch','roll','speed','throttle'].every(k=>Number.isFinite(v[k as keyof Aircraft])))throw new GameError('Invalid aircraft position.');
   const elapsed=clamp((now-p.seen)/1000,.05,2),max=elapsed*150+25,delta=Math.hypot(v.x-p.x,v.z-p.z),ratio=Math.min(1,max/Math.max(1,delta));
   const x=clamp(p.x+(v.x-p.x)*ratio,250,t.size-250),z=clamp(p.z+(v.z-p.z)*ratio,250,t.size-250),y=clamp(v.y,p.y-elapsed*75-25,p.y+elapsed*75+25);
   s.planes[seat]={...p,x,y:clamp(y,0,9000),z,yaw:v.yaw,pitch:clamp(v.pitch,-.6,.6),roll:clamp(v.roll,-1.1,1.1),speed:clamp(v.speed,0,125),throttle:clamp(v.throttle,0,1),flaps:clamp(Number(v.flaps)||0,0,1),vertical:clamp(Number(v.vertical)||0,-100,100),seen:now};
  }else if(input.type==='recover'){
   s.crashes[seat]++;s.planes[seat]=flightSpawn(seat,t,p.recovery+1);hint='Aircraft recovered. Shared mission progress is saved.';
  }else if(input.type==='continue'){
   if(s.status!=='briefing')throw new GameError('Finish this mission with your companion first.',409);s.ready[seat]=true;
   if(s.ready.every(Boolean)){const old=region;s.mission++;s.status=s.mission>=12?'won':'flying';s.steps=[0,0];s.progress=0;s.ready=[false,false];s.pulse=now;if(s.status!=='won'&&Math.floor(s.mission/2)!==old){const next=await flightTerrain(Math.floor(s.mission/2));s.planes=[flightSpawn(0,next,s.planes[0].recovery+1),flightSpawn(1,next,s.planes[1].recovery+1)];}}
  }else if(input.type==='check'||input.type==='interact'){
   if(s.status!=='flying')return view(s,token,row.version);
   const targets=missionPoints(s.mission,t),target=targets[Math.min(s.steps[seat],targets.length-1)],agl=p.y-terrainHeight(t,p.x,p.z),near=groundDistance(p,target),factor=s.difficulty==='explorer'?1.25:s.difficulty==='ace'?.8:1;
   if(def.kind==='route'){if(near<300*factor&&Math.abs(p.y-target.y)<180*factor&&s.steps[seat]<targets.length){s.steps[seat]++;hint=`${s.names[seat]} reached navigation gate ${s.steps[seat]}/3.`;}}
   else if(def.kind==='formation'){const other=s.planes[1-seat],separation=Math.hypot(p.x-other.x,p.y-other.y,p.z-other.z),steady=separation<300*factor&&Math.abs(p.y-other.y)<100*factor&&Math.abs(p.speed-other.speed)<12*factor&&near<1100&&groundDistance(other,target)<1100&&now-other.seen<2500&&agl>100;if(steady)s.progress+=Math.min(.65,Math.max(0,(now-s.pulse)/1000));s.pulse=now;if(s.progress>=(s.difficulty==='ace'?22:s.difficulty==='explorer'?10:15))s.steps=[1,1];}
   else if(def.kind==='landing'){if(near<180*factor&&agl>=1&&agl<12&&p.speed<43.7&&Math.abs(p.roll)<.22&&Math.abs(p.vertical)<5){s.steps[seat]=1;s.planes[seat].landed=true;hint='Safe landing confirmed.';}}
   else if(input.type==='interact'){const valid=near<(def.kind==='photo'?650:450)*factor&&agl>=(def.kind==='photo'?180:100)&&agl<=(def.kind==='photo'?900:500);if(!valid)throw new GameError('Get closer to the beacon and enter the marked altitude band.',409);s.steps[seat]=1;hint=def.kind==='photo'?'Survey photograph received.':'Supply parcel delivered.';}
   const required=def.kind==='route'?targets.length:1;if(s.steps.every(n=>n>=required)){s.status='briefing';if(!s.completed.includes(s.mission))s.completed.push(s.mission);hint='Mission complete. Both pilots confirm the next briefing.';}
  }else throw new GameError('Unknown flight action.');
  if(await saveRoom(`flight:${code}`,JSON.stringify(s),row.version))return view(s,token,row.version+1,hint);
 }
 throw new GameError('Flight connection is busy. Try again.',409);
}
