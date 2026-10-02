import {readRoom,insertRoom,saveRoom} from './roomStore';
import {GameError} from './game';
import {FLOOR,WIDTH,HEIGHT,escortPoint,spawn,trialsFor,trialInitial,shardPoints,pagePoints,inspectPoints,type CampaignRoom,type Traveler,type Difficulty,type Upgrade} from './adventure';
import {residentFor,questRequirement,RELICS,rewardBalance} from './quests';
import {exitsFor} from './openWorld';
import {walkable,safePoint} from './worldLayout';
type State=Omit<CampaignRoom,'seat'|'version'|'hint'> & {tokens:[string,string|null];entered:number;archive:Record<number,CampaignRoom["trials"]>;visited:number[];travelTarget:number|null};
function hydrate(s:State){s.archive??={};s.visited??=[s.realm];s.travelTarget??=null;if(s.worldVersion!==2){s.players=[spawn(0),spawn(1)];for(const r of s.completed)if(!s.archive[r])s.archive[r]=trialsFor(r,s.difficulty).map(()=>({...trialInitial(),solved:true}));s.worldVersion=2;}return s;}
const near=(p:Traveler,q:{x:number;y:number},r=110)=>Math.hypot(p.x-q.x,p.y-q.y)<r;
function seatOf(s:State,t:string):0|1{if(s.tokens[0]===t)return 0;if(s.tokens[1]===t)return 1;throw new GameError('Join this journey to play.',403);}
async function read(c:string){const r=await readRoom(c);if(!r)throw new GameError('Journey not found. Check the six-character code.',404);return r;}
function view(s:State,t:string,v:number,hint=''):CampaignRoom{hydrate(s);const {tokens,entered,...data}=s;return {...data,seat:seatOf(s,t),version:v,hint};}
export async function createAdventure(name:string,difficulty:Difficulty='adventure'){
 if(!['story','adventure','expert'].includes(difficulty))throw new GameError('Choose a journey difficulty.');
 const now=Date.now(),token=crypto.randomUUID();const s:State={code:'',names:[name,null],tokens:[token,null],status:'waiting',realm:0,unlocked:0,players:[spawn(0),spawn(1)],trials:trialsFor(0,difficulty).map(trialInitial),shards:[],pages:[],ready:[false,false],emotes:['',''],checkpoints:[130,195],created:now,entered:now,playtime:0,difficulty,quests:[],upgrades:{wind:0,sight:0,bond:0},spent:0,choices:[null,null],completed:[],discoveries:[],archive:{},visited:[0],travelTarget:null,worldVersion:2};
 for(let a=0;a<5;a++){s.code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');try{await insertRoom(s.code,JSON.stringify(s),now);return {token,room:view(s,token,0)};}catch(e){if(a===4){if(e instanceof GameError)throw e;throw new GameError('Could not create a journey. Try again.',503);}}}throw new GameError('Could not create a journey.',503);
}
export async function joinAdventure(code:string,name:string){const r=await read(code),s=JSON.parse(r.state) as State;if(s.tokens[1])throw new GameError('This journey already has two travelers. Use your saved session to return.',409);const token=crypto.randomUUID();s.names[1]=name;s.tokens[1]=token;s.status='playing';s.entered=Date.now();s.players=[spawn(0),spawn(1)];if(!await saveRoom(code,JSON.stringify(s),r.version))throw new GameError('Another traveler joined first.',409);return {token,room:view(s,token,r.version+1)};}
export async function getAdventure(c:string,t:string){const r=await read(c);return view(JSON.parse(r.state),t,r.version);}
export async function actAdventure(code:string,token:string,input:{type?:unknown;value?:unknown;realm?:unknown},retry=0):Promise<CampaignRoom>{
 if(!input||typeof input!=='object')throw new GameError('Invalid trail action.');
 const row=await read(code),s=hydrate(JSON.parse(row.state) as State),seat=seatOf(s,token),other=seat===0?1:0,now=Date.now();let hint='';
 if(s.status==='waiting')throw new GameError('Your companion must join first.',409);if(s.status==='won')return view(s,token,row.version,'The dawn is already home.');
 if(input.realm!==undefined&&input.realm!==s.realm)return view(s,token,row.version);
 if(input.type==='move'&&(input.value as {realm?:number}|null)?.realm!==undefined&&(input.value as {realm:number}).realm!==s.realm)return view(s,token,row.version);
 const trials=trialsFor(s.realm,s.difficulty),requested=(input.value as {crossing?:number}|null)?.crossing,current=input.type==='interact'&&Number.isInteger(requested)?Number(requested):s.trials.findIndex(t=>!t.solved),trial=trials[current],ts=s.trials[current];
 const elapsed=Math.max(0,Math.min(2,(now-s.entered)/1000));if(now-s.players[0].seen<5000&&now-s.players[1].seen<5000)s.playtime+=elapsed;s.entered=now;
 if(input.type==='move'){
  const v=input.value as Record<string,unknown>;if(!v||typeof v.x!=='number'||typeof v.y!=='number'||!Number.isFinite(v.x)||!Number.isFinite(v.y))throw new GameError('Invalid movement.');const p=s.players[seat],max=650*Math.min(3,Math.max(.26,(now-p.seen)/1000))+80,x=Math.max(p.x-max,Math.min(p.x+max,v.x));
  const point={x:Math.max(35,Math.min(WIDTH-35,x)),y:Math.max(35,Math.min(HEIGHT-35,Math.max(p.y-max,Math.min(p.y+max,v.y))))};const safe=walkable(s.realm,point)?point:safePoint(s.realm,point);s.players[seat]={...safe,facing:[0,1,2,3].includes(Number(v.facing))?Number(v.facing):2,moving:!!v.moving,grounded:!!v.grounded,seen:now};
 }else if(input.type==='travel'){
  const destination=Number(input.value),exit=exitsFor(s.realm).find(e=>e.realm===destination);
  if(!exit||!near(s.players[seat],exit,185))throw new GameError('Walk to the marked trail leading to that region.',409);
  if(s.travelTarget!==null&&s.travelTarget!==destination)throw new GameError('Your companion has chosen another trail. Meet them there.',409);
  s.travelTarget=destination;s.ready[seat]=true;hint='Waiting for your companion at this trail. Both press E to travel.';
  if(s.ready[0]&&s.ready[1]){
   if(!near(s.players[other],exit,185))throw new GameError('Both travelers must be at the same trail.',409);
   s.archive[s.realm]=s.trials;const previous=s.realm;s.realm=destination;s.trials=s.archive[destination]??trialsFor(destination,s.difficulty).map(trialInitial);
   const entry=exitsFor(destination).find(e=>e.realm===previous)!;s.players=[{...spawn(0),x:entry.x,y:entry.y},{...spawn(1),x:Math.min(WIDTH-35,entry.x+45),y:entry.y+35}];
   if(!s.visited.includes(destination))s.visited.push(destination);s.unlocked=Math.max(s.unlocked,destination);s.ready=[false,false];s.travelTarget=null;s.checkpoints=[130,195];hint='A new region opens. Explore any trail and choose the mysteries you want to solve.';
  }
 }else if(input.type==='cancelTravel'){s.ready=[false,false];s.travelTarget=null;hint='Travel plans cleared. Choose another path together.';
 }else if(input.type==='checkpoint'){s.players[seat]=spawn(seat);
 }else if(input.type==='emote'){const v=String(input.value);if(!['Follow me','Wait here','Ready!','Need help','Thank you!'].includes(v))throw new GameError('Choose a trail signal.');s.emotes[seat]=v;s.players[seat].seen=now;
 }else if(input.type==='shard'||input.type==='page'){const item=(input.type==='shard'?shardPoints(s.realm):pagePoints(s.realm)).find(p=>p.id===input.value);if(!item||!near(s.players[seat],item,115))throw new GameError('Walk closer to collect it.');const list=input.type==='shard'?s.shards:s.pages;if(!list.includes(item.id))list.push(item.id);
 }else if(input.type==='inspect'){
  const item=inspectPoints(s.realm).find(p=>p.id===input.value);if(!item||!near(s.players[seat],item,125))throw new GameError('Approach the landmark to investigate.',409);if(!s.discoveries.includes(item.id))s.discoveries.push(item.id);hint=item.discovery;
 }else if(input.type==='quest'){
  const resident=residentFor(s.realm);if(!near(s.players[seat],resident,140))throw new GameError('Speak to the resident beside the first camp.',409);const q=questRequirement(s.realm),prefix=`r${s.realm}-`,stars=s.shards.filter(id=>id.startsWith(prefix)).length,pages=s.pages.filter(id=>id.startsWith(prefix)).length,crossings=s.trials.filter(t=>t.solved).length,wishes=s.trials.reduce((n,t)=>n+t.pieces[0].length+t.pieces[1].length,0);
  if(stars<q.stars||pages<q.pages||crossings<q.crossings||wishes<q.wishes)hint=resident.request;else if(!s.quests.includes(resident.id)){s.quests.push(resident.id);hint=`${resident.name}: You kept your promise. Take two starlight tokens.`;}else hint='This village promise is already fulfilled.';
 }else if(input.type==='upgrade'){
  const key=String(input.value) as Upgrade,relic=RELICS[key];if(!relic)throw new GameError('Unknown relic.');if(!near(s.players[seat],residentFor(s.realm),160))throw new GameError('Visit the resident’s camp to craft a relic.',409);if(s.upgrades[key]>=relic.max)throw new GameError('This relic is already complete.',409);if(rewardBalance(s)<relic.cost)throw new GameError(`Find ${relic.cost} starlight tokens to craft this relic.`,409);s.spent+=relic.cost;s.upgrades[key]++;hint=`${relic.name} is ready for both travelers.`;
 }else if(input.type==='choice'){
  if(s.realm!==15||s.trials.some(t=>!t.solved)||s.players[seat].x<WIDTH-450)throw new GameError('Choose your village’s promise at the final gate.',409);if(!['share','guard'].includes(String(input.value)))throw new GameError('Choose a promise.');s.choices[seat]=String(input.value);hint='Your promise is saved. Meet your companion at the gate.';
 }else if(input.type==='advance'){
  if(s.trials.some(t=>!t.solved))throw new GameError('Restore all four crossings first.',409);if(s.realm===15&&s.completed.length<16)throw new GameError('Restore the light in all sixteen regions before bringing the dawn home.',409);if(s.players[seat].x<WIDTH-450)throw new GameError('Meet your companion at the eastern gate.',409);s.ready[seat]=true;
  if(s.ready[0]&&s.ready[1]){if(!s.completed.includes(s.realm))s.completed.push(s.realm);if(s.realm===15)s.status='won';else{s.archive[s.realm]=s.trials;s.realm++;if(!s.visited.includes(s.realm))s.visited.push(s.realm);s.unlocked=Math.max(s.unlocked,s.realm);s.trials=s.archive[s.realm]??trialsFor(s.realm,s.difficulty).map(trialInitial);s.players=[spawn(0),spawn(1)];s.checkpoints=[130,195];s.ready=[false,false];s.emotes=['',''];}}
 }else if(input.type==='interact'){
  const interaction=input.value as {crossing?:number;payload?:unknown}|null;let payload=input.value;if(interaction&&typeof interaction==='object'&&typeof interaction.crossing==='number'){if(s.trials[interaction.crossing]?.solved)return view(s,token,row.version,'The mystery is already restored.');payload=interaction.payload;}
  if(!trial||!ts)throw new GameError('The way is open. Meet at the eastern gate.',409);const player=s.players[seat];
  if(trial.kind==='mirrors'){if(!near(player,trial.sockets[seat],125))throw new GameError('Stand at your own mirror.',409);ts.turns[seat]=(ts.turns[seat]+1)%4;if(ts.turns[0]===trial.targets[0]&&ts.turns[1]===trial.targets[1])ts.solved=true;
  }else if(trial.kind==='bells'){
   const note=Number(payload);if(!Number.isInteger(note)||note<0||note>2)throw new GameError('Choose a bell.');if(!near(player,{x:trial.x+(note-1)*110,y:trial.y},125))throw new GameError('Walk closer to that bell.',409);const melody=trial.melodies[seat];if(ts.notes[seat]<melody.length){if(note===melody[ts.notes[seat]])ts.notes[seat]++;else{ts.notes[seat]=0;hint='The melody begins again. Read your lantern’s notes.';}}if(ts.notes[0]===trial.melodies[0].length&&ts.notes[1]===trial.melodies[1].length)ts.solved=true;
  }else if(trial.kind==='runes'){
   const mark=Number(payload);if(!Number.isInteger(mark)||mark<0||mark>3||!near(player,{x:trial.x-165+mark*110,y:trial.y},110))throw new GameError('Approach the seal you want to choose.',409);if(mark!==trial.targets[seat]){ts.notes=[0,0];hint='The seals went dark. Ask your companion which mark their lantern reveals.';}else ts.notes[seat]=1;if(ts.notes[0]===1&&ts.notes[1]===1)ts.solved=true;
  }else if(trial.kind==='embers'||(trial.kind==='rescue'&&payload!==null)){
   const piece=Number(payload);if(!Number.isInteger(piece)||piece<0||piece>1||!near(player,trial.embers[seat][piece],115))throw new GameError('Reach a wish matching your lantern.',409);if(!ts.pieces[seat].includes(piece))ts.pieces[seat].push(piece);if(trial.kind==='embers'&&ts.pieces[0].length===2&&ts.pieces[1].length===2)ts.solved=true;
  }else{
   if(trial.kind==='rescue'&&(ts.pieces[0].length<2||ts.pieces[1].length<2))throw new GameError('Rescue all four crane spirits before joining your lanterns.',409);
   const point=trial.kind==='escort'?escortPoint(trial,ts.progress):trial.sockets[seat],radius=trial.kind==='escort'?185:135;if(!near(player,point,radius))throw new GameError('Move closer to your lantern shrine.',409);
   ts.pulses[seat]=now;const companionPoint=trial.kind==='escort'?point:trial.sockets[other],linked=now-ts.pulses[other]<2500&&now-s.players[other].seen<5000&&near(s.players[other],companionPoint,radius);
   const wave=trial.kind==='guardian'&&now%5500<800,hit=wave&&[0,1].some(side=>s.players[side].grounded&&near(s.players[side],trial,180)),calm=trial.kind!=='balance'||(now%7000<4200&&player.grounded&&s.players[other].grounded),tide=trial.kind!=='tide'||now%9000<5200;
   if(hit){ts.progress=Math.max(0,ts.progress-.035);hint='The shadow struck your bond. Dodge or leave the circle when the guardian’s light turns violet.';}
   else if(linked&&tide&&calm){const amount=Math.max(0,Math.min(.8,(now-(ts.lastPulse||now-400))/1000)),seconds=trial.kind==='guardian'?18:trial.kind==='escort'?10:trial.kind==='balance'?7:trial.kind==='rescue'?6:4;ts.progress=Math.min(1,ts.progress+amount/seconds*(s.difficulty==='story'?1.35:s.difficulty==='expert'?.8:1)*(1+s.upgrades.bond*.2));}
   ts.lastPulse=now;if(ts.progress>=1)ts.solved=true;if(!hint)hint=!linked?'Your companion must hold E at their shrine too.':!tide?'High tide. Wait for the water to fall.':!calm?'Stay at your shrine and wait for calm wind.':'Your lights are joining.';
  }
  if(ts.solved)hint='Mystery restored. Choose another landmark or explore a neighboring region.';
 }else throw new GameError('Unknown trail action.');
 s.archive[s.realm]=s.trials;if(s.trials.every(t=>t.solved)&&!s.completed.includes(s.realm))s.completed.push(s.realm);
 if(!await saveRoom(code,JSON.stringify(s),row.version)){if(retry<6)return actAdventure(code,token,input,retry+1);throw new GameError('The journey is catching up. Try once more.',409);}return view(s,token,row.version+1,hint);
}
