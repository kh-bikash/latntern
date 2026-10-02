export type FlightDifficulty='explorer'|'pilot'|'ace';
export type FlightPoint={x:number;y:number;z:number};
export type Aircraft=FlightPoint&{yaw:number;pitch:number;roll:number;speed:number;throttle:number;vertical:number;seen:number;recovery:number;landed:boolean;flaps?:number};
export type TerrainData={id:string;name:string;lat:number;lon:number;north:number;south:number;west:number;east:number;size:number;grid:number;heights:number[]};
export type FlightRoom={code:string;seat:0|1;names:[string,string|null];status:'waiting'|'flying'|'briefing'|'won';difficulty:FlightDifficulty;mission:number;planes:[Aircraft,Aircraft];steps:[number,number];progress:number;ready:[boolean,boolean];completed:number[];crashes:[number,number];version:number;hint:string;created:number};
export const FLIGHT_REGIONS=[
 {id:'fuji',name:'Mount Fuji',subtitle:'The mountain that meets the morning',story:'A storm has silenced the mountain relay. Fly the lantern route together, then photograph the crater to locate the lost dawn signal.',weather:'dawn',wind:2},
 {id:'hakone',name:'Hakone Lakes',subtitle:'Medicine across the mist',story:'The lakeside team needs two emergency parcels. Make your drops, then hold formation through the quiet mountain corridor.',weather:'mist',wind:5},
 {id:'miyajima',name:'Seto Inland Sea',subtitle:'A thousand islands, one way home',story:'Trace the sea channel and bring both aircraft down gently at the floating rescue base. Watch your airspeed on the final approach.',weather:'clear',wind:7},
 {id:'kyoto',name:'Kyoto Valley',subtitle:'The city beneath your wings',story:'Follow the valley together and survey the hillside relay. Its message reveals where the missing signal crossed the mountains.',weather:'sunset',wind:4},
 {id:'aso',name:'Aso Caldera',subtitle:'The earth remembers',story:'Navigate the immense caldera and deliver the final supplies to the survey team. Mountain air demands patient climbs and early turns.',weather:'clear',wind:9},
 {id:'daisetsu',name:'Daisetsuzan',subtitle:'Carry the dawn home',story:'Photograph the northern ridge, then fly the last formation together. Two lights become one signal, and the villages answer.',weather:'clear',wind:11},
] as const;
export const MISSIONS=[
 {kind:'route',name:'The lantern route',rule:'Both pilots fly through each of the three gold navigation gates in order.'},
 {kind:'photo',name:'The crater signal',rule:'Fly within 650 m of the survey beacon, 180–900 m above terrain, and press F to photograph it.'},
 {kind:'drop',name:'Lakeside lifeline',rule:'Fly within 450 m of the supply beacon, 100–500 m above terrain, and press F to drop a parcel. Both pilots must deliver.'},
 {kind:'formation',name:'Through the mist',rule:'Both pilots stay near the beacon, within 300 m of each other, with matched speed and altitude for 15 seconds.'},
 {kind:'route',name:'The island channel',rule:'Both pilots follow three navigation gates over the inland sea.'},
 {kind:'landing',name:'A safe harbor',rule:'Land at the marked rescue base: below 85 knots, wings level, descent under 5 m/s. Both aircraft must arrive safely.'},
 {kind:'formation',name:'The valley duet',rule:'Fly together near the beacon: separation under 300 m, altitude difference under 100 m, speed difference under 12 m/s for 15 seconds.'},
 {kind:'photo',name:'The hillside relay',rule:'Survey the beacon from 180–900 m above terrain and within 650 m horizontally. Both pilots press F.'},
 {kind:'route',name:'Caldera passage',rule:'Follow three gates through the volcanic landscape. Plan your altitude before each turn.'},
 {kind:'drop',name:'The last delivery',rule:'Each pilot drops a parcel within 450 m of the beacon at 100–500 m above terrain.'},
 {kind:'photo',name:'A light in the north',rule:'Photograph the northern survey beacon from 180–900 m above terrain. Both pilots press F.'},
 {kind:'formation',name:'The dawn wing',rule:'Finish together: hold formation near the final beacon for 15 seconds.'},
] as const;
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function terrainHeight(t:TerrainData,x:number,z:number){
 const n=t.grid-1,fx=clamp(x/t.size*n,0,n-.00001),fz=clamp(z/t.size*n,0,n-.00001),col=Math.floor(fx),row=Math.floor(fz),u=fx-col,v=fz-row,a=row*t.grid+col,h=t.heights;
 return u+v<=1?h[a]+(h[a+1]-h[a])*u+(h[a+t.grid]-h[a])*v:h[a+t.grid+1]+(h[a+t.grid]-h[a+t.grid+1])*(1-u)+(h[a+1]-h[a+t.grid+1])*(1-v);
}
const pointCache=new WeakMap<TerrainData,Map<number,FlightPoint[]>>();
export function missionPoints(mission:number,t:TerrainData){
 const known=pointCache.get(t)?.get(mission);if(known)return known;
 const u=(t.lon-t.west)/(t.east-t.west),v=(t.north-t.lat)/(t.north-t.south),kind=MISSIONS[Math.min(11,mission)].kind;
 let path=kind==='route'?[[u-.18,v+.2],[u-.1,v+.05],[u+.12,v-.08]]:kind==='formation'?[[u-.16,v+.16]]:[[u,v]];
 if(kind==='landing'){
  // A seaplane must land on actual sea, never on an arbitrary mountainside.
  const radius=Math.ceil(1000/t.size*(t.grid-1));let best=Infinity,spot=[u,v];for(let j=12;j<t.grid-12;j++)for(let i=12;i<t.grid-12;i++){const a=i/(t.grid-1),b=j/(t.grid-1),d=(a-u)**2+(b-v)**2;if(t.heights[j*t.grid+i]>=.5||d>=best)continue;let clear=true;for(let y=-radius;y<=radius&&clear;y++)for(let x=-radius;x<=radius;x++)if(x*x+y*y<=radius*radius&&t.heights[(j+y)*t.grid+i+x]>3){clear=false;break;}if(clear){best=d;spot=[a,b];}}
  path=[spot];
 }
 const routeAltitude=Math.max(...t.heights)+450;
 const points=path.map(([a,b])=>{const x=clamp(a,.12,.88)*t.size,z=clamp(b,.12,.88)*t.size;return{x,z,y:kind==='route'?routeAltitude:terrainHeight(t,x,z)+(kind==='landing'?2.4:350)};});let cache=pointCache.get(t);if(!cache){cache=new Map();pointCache.set(t,cache);}cache.set(mission,points);return points;
}
export function flightSpawn(seat:number,t:TerrainData,recovery=0):Aircraft{const x=t.size*.22+seat*90,z=t.size*.77,target=missionPoints(Math.max(0,FLIGHT_REGIONS.findIndex(r=>r.id===t.id))*2,t)[0];return{x,y:Math.max(terrainHeight(t,x,z)+650,Math.max(...t.heights)*.7+350),z,yaw:Math.atan2(target.x-x,z-target.z),pitch:0,roll:0,speed:65,throttle:.65,vertical:0,seen:Date.now(),recovery,landed:false};}
export type FlightInput={pitch:number;roll:number;throttle:number;brake:boolean;rudder?:number;trim?:number;flaps?:number;stability?:boolean};
export function stallSpeed(p:Aircraft){return 27*Math.sqrt(1/Math.max(.35,Math.cos(p.roll)))*(1-.18*(p.flaps??0));}
export function flightWind(t:TerrainData,difficulty:FlightDifficulty,time:number){const strength=(FLIGHT_REGIONS.find(r=>r.id===t.id)?.wind??2)*(difficulty==='explorer'?.2:difficulty==='ace'?1:.55),gust=difficulty==='ace'?1+.2*Math.sin(time*.8):1;return{x:strength*gust*.85,z:strength*gust*.35,speed:strength*gust};}
// An accessible flight model, with banked turns, momentum, drag and stall descent.
// This is a game model, not an engineering aircraft simulator.
export function stepFlight(p:Aircraft,dt:number,input:FlightInput,t:TerrainData,difficulty:FlightDifficulty,time:number){
 dt=Math.min(.05,Math.max(0,dt));p.throttle=clamp(input.throttle,0,1);
 const control=difficulty==='explorer'?1.15:1,gust=difficulty==='ace'?Math.sin(time*.8)*.008:0,trim=clamp(input.trim??0,-1,1)*.11;
 p.flaps=clamp((p.flaps??0)+(clamp(input.flaps??0,0,1)-(p.flaps??0))*dt*1.2,0,1);
 if(input.stability!==false){p.pitch+=(clamp(input.pitch,-1,1)*.38*control+trim+gust-p.pitch)*Math.min(1,dt*2.2);p.roll+=(clamp(input.roll,-1,1)*.8-p.roll)*Math.min(1,dt*2.8);}
 else{p.pitch=clamp(p.pitch+(clamp(input.pitch,-1,1)*.24+trim*.3+gust-p.pitch*.035)*dt,-.55,.55);p.roll=clamp(p.roll+(clamp(input.roll,-1,1)*.58-p.roll*.025)*dt,-1.05,1.05);}
 // Density-dependent power/drag, load-factor stall margin and a coordinated
 // turn rate g*tan(bank)/airspeed. Still a deliberately simplified game model.
 const density=Math.exp(-p.y/10000),drag=6.7+.0016*p.speed*p.speed*density+p.flaps*(1.8+.0015*p.speed*p.speed),power=p.throttle*23*Math.pow(density,.25);
 p.speed=clamp(p.speed+(power-drag-Math.sin(p.pitch)*9.81-(input.brake?18:0))*dt,12,120);
 p.yaw+=(9.81*Math.tan(p.roll)/Math.max(22,p.speed)+clamp(input.rudder??0,-1,1)*.045)*dt;
 const stall=Math.max(0,stallSpeed(p)-p.speed)*1.15;p.vertical=p.speed*Math.sin(p.pitch)-stall;
 const wind=flightWind(t,difficulty,time);
 p.x+=(Math.sin(p.yaw)*p.speed*Math.cos(p.pitch)+wind.x)*dt;p.z+=(-Math.cos(p.yaw)*p.speed*Math.cos(p.pitch)+wind.z)*dt;p.y=clamp(p.y+p.vertical*dt,0,9000);p.landed=false;
 if(p.x<250||p.x>t.size-250||p.z<250||p.z>t.size-250){p.x=clamp(p.x,250,t.size-250);p.z=clamp(p.z,250,t.size-250);p.yaw=Math.atan2(t.size/2-p.x,p.z-t.size/2);p.roll=0;}
}
export function headingDegrees(yaw:number){return (yaw*180/Math.PI%360+360)%360;}
export function groundDistance(a:FlightPoint,b:FlightPoint){return Math.hypot(a.x-b.x,a.z-b.z);}
export function gps(t:TerrainData,p:FlightPoint){return{lat:t.north+(t.south-t.north)*p.z/t.size,lon:t.west+(t.east-t.west)*p.x/t.size};}
export const formationSeconds=(difficulty:FlightDifficulty)=>difficulty==='ace'?22:difficulty==='explorer'?10:15;
export function missionRule(mission:number,difficulty:FlightDifficulty){const factor=difficulty==='explorer'?1.25:difficulty==='ace'?.8:1;return MISSIONS[Math.min(11,mission)].rule.replace('15 seconds',`${formationSeconds(difficulty)} seconds`).replace('650 m',`${Math.round(650*factor)} m`).replace('450 m',`${Math.round(450*factor)} m`).replace('300 m',`${Math.round(300*factor)} m`).replace('100 m, speed',`${Math.round(100*factor)} m, speed`).replace('12 m/s',`${(12*factor).toFixed(1)} m/s`);}
const landingApproaches=new WeakMap<Aircraft,boolean>();
export function navigationInput(p:Aircraft,target:FlightPoint,kind:string,t:TerrainData,time:number):FlightInput&{land:boolean}{
 let goal={...target};const dist=groundDistance(p,target);if(kind!=='route'&&kind!=='landing'&&dist<750){const a=time*.075;goal={x:target.x+Math.sin(a)*430,y:target.y,z:target.z+Math.cos(a)*430};}
 let landingHold=false;if(kind==='landing'&&dist<1100&&!landingApproaches.get(p)){if(p.y-target.y<40)landingApproaches.set(p,true);else{landingHold=true;const a=Math.atan2(p.x-target.x,p.z-target.z)+.65;goal={x:target.x+Math.sin(a)*650,y:target.y+30,z:target.z+Math.cos(a)*650};}}
 const yaw=Math.atan2(goal.x-p.x,p.z-goal.z),error=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));let roll=clamp(error*2.5,-1,1);
 const aheadX=clamp(p.x+Math.sin(p.yaw)*1100,0,t.size),aheadZ=clamp(p.z-Math.cos(p.yaw)*1100,0,t.size),safe=terrainHeight(t,aheadX,aheadZ)+350;
 const altitude=kind==='landing'?(landingHold?target.y+30:Math.max(terrainHeight(t,target.x,target.z)+Math.max(2.4,dist*(landingApproaches.get(p)?.035:.10)),dist>1100?safe:0)):Math.max(goal.y,safe);
 let pitch=clamp((altitude-p.y)/Math.max(600,dist)*2.7,-.85,1),throttle=.72,brake=false,land=false;
 if(kind==='landing'){const agl=p.y-terrainHeight(t,p.x,p.z);pitch=clamp((altitude-p.y)/100,-.3,dist>1500?1:.2);throttle=.55;brake=p.speed>37.5;if(dist<180&&agl<40)roll=0;land=dist<100&&agl<11&&Math.abs(p.roll)<.22&&Math.abs(p.vertical)<5;}
 return{pitch,roll,throttle,brake,land,flaps:kind==='landing'?.5:0,stability:true};
}

