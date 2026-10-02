import {clamp} from './flight';
export type Runway={name:string;length:number;width:number;surface:string;lat:number;lon:number;heading:number;endLat:number;endLon:number;estimated?:boolean};
export type Airport={id:string;iata:string;name:string;type:string;country:string;city:string;lat:number;lon:number;elevation:number;runways:Runway[]};
export type WorldPlane={lat:number;lon:number;alt:number;heading:number;pitch:number;roll:number;speed:number;throttle:number;flaps:number;vertical:number;ground:boolean;engine:boolean;gear:boolean;fuel:number;phase:string;seen:number;recovery:number;distance:number;airborne:boolean};
export type WorldRoom={code:string;seat:0|1;names:[string,string|null];departure:Airport;arrival:Airport;planes:[WorldPlane,WorldPlane];version:number;created:number};
export type WorldInput={pitch:number;roll:number;rudder:number;throttle:number;brake:boolean;flaps:number;trim:number;stability:boolean;gear:boolean;engine:boolean};
const R=6371008.8,rad=Math.PI/180;
export function geoMove(lat:number,lon:number,heading:number,distance:number){const a=lat*rad,b=lon*rad,h=heading*rad,d=distance/R,latitude=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(h)),longitude=b+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(latitude));return{lat:latitude/rad,lon:((longitude/rad+540)%360)-180};}
export function geoDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}){const x=(b.lat-a.lat)*rad,y=(b.lon-a.lon)*rad,q=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));}
export function geoBearing(a:{lat:number;lon:number},b:{lat:number;lon:number}){const y=Math.sin((b.lon-a.lon)*rad)*Math.cos(b.lat*rad),x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lon-a.lon)*rad);return(Math.atan2(y,x)/rad+360)%360;}
export function airportRunway(a:Airport):Runway{if(a.runways.length)return [...a.runways].sort((x,y)=>y.length-x.length)[0];const start=geoMove(a.lat,a.lon,180,500),end=geoMove(a.lat,a.lon,0,500);return{name:'36',length:1000,width:30,surface:'practice',...start,heading:0,endLat:end.lat,endLon:end.lon,estimated:true};}
export function runwayOffset(p:{lat:number;lon:number},r:Runway){const d=geoDistance(r,p),angle=(geoBearing(r,p)-r.heading)*rad;return{along:d*Math.cos(angle),cross:d*Math.sin(angle)};}
export function nearRunway(p:{lat:number;lon:number},airports:Airport[]){for(const airport of airports)for(const runway of airport.runways.length?airport.runways:[airportRunway(airport)]){const q=runwayOffset(p,runway);if(q.along>-80&&q.along<runway.length+80&&Math.abs(q.cross)<Math.max(14,runway.width/2+5))return{airport,runway};}return null;}
export function worldSpawn(a:Airport,seat=0,recovery=0):WorldPlane{const r=airportRunway(a),p=geoMove(r.lat,r.lon,r.heading,100+seat*60);return{...p,alt:a.elevation+2,heading:r.heading,pitch:0,roll:0,speed:0,throttle:0,flaps:.5,vertical:0,ground:true,engine:false,gear:true,fuel:100,phase:'PARKED · START ENGINE',seen:Date.now(),recovery,distance:0,airborne:false};}
export function worldStallSpeed(p:WorldPlane){return 31*(1-.20*p.flaps)*Math.sqrt(1/Math.max(.35,Math.cos(p.roll)));}
// Fixed-time integration on the Earth. No teleportation or simulation time warp.
export function stepWorld(p:WorldPlane,dt:number,i:WorldInput,terrain:number,runway:ReturnType<typeof nearRunway>){
 if(p.phase==='HARD CONTACT · RECOVER'){p.engine=false;p.speed=0;return;}
 dt=clamp(dt,0,.05);p.engine=i.engine&&p.fuel>0;p.throttle=clamp(i.throttle,0,1);p.flaps+= (clamp(i.flaps,0,1)-p.flaps)*Math.min(1,dt*1.5);p.gear=i.gear;
 const floor=(runway?runway.airport.elevation:terrain)+2,density=Math.exp(-p.alt/10000),power=p.engine?p.throttle*17*Math.pow(density,.25):0;
 if(p.ground){p.alt=floor;p.roll=0;p.vertical=0;p.speed=Math.max(0,p.speed+(power*.28-1.0-.0009*p.speed*p.speed-(i.brake?12:0))*dt);p.heading+=clamp(i.rudder+i.roll*.55,-1,1)*(p.speed>0?12/Math.max(1,p.speed/4):0)*dt;p.pitch+=(i.pitch*.12-p.pitch)*Math.min(1,dt*3);if(p.speed>31&&p.pitch>.055&&p.engine){p.ground=false;p.airborne=true;p.alt+=.4;p.phase='CLIMB';}else p.phase=p.airborne?'LANDED · TAXI / BRAKES':!p.engine?'PARKED · START ENGINE':p.speed<2?'READY · RELEASE BRAKES':p.speed<12?'TAXI':'TAKEOFF ROLL';}
 else{
  if(i.stability){p.pitch+=(clamp(i.pitch,-1,1)*.30+i.trim*.09-p.pitch)*dt*2.2;p.roll+=(clamp(i.roll,-1,1)*.85-p.roll)*dt*2.6;}else{p.pitch=clamp(p.pitch+(i.pitch*.23+i.trim*.025-p.pitch*.02)*dt,-.5,.5);p.roll=clamp(p.roll+(i.roll*.5-p.roll*.025)*dt,-1.05,1.05);}
  p.speed=clamp(p.speed+(power-(3.3+.00165*p.speed*p.speed*density+p.flaps*3+(p.gear?1.2:0))-Math.sin(p.pitch)*9.81-(i.brake?10:0))*dt,8,110);p.heading+=(9.81*Math.tan(p.roll)/Math.max(18,p.speed)+i.rudder*.035)*dt/rad;
  const stall=Math.max(0,worldStallSpeed(p)-p.speed)*1.5;p.vertical=p.speed*Math.sin(p.pitch)-stall;p.alt+=p.vertical*dt;p.phase=p.speed<worldStallSpeed(p)?'STALL':p.vertical>2?'CLIMB':p.vertical<-2?'DESCENT':'CRUISE';
  if(p.alt<=floor){if(runway&&p.gear&&p.speed<46&&Math.abs(p.roll)<.18&&Math.abs(p.vertical)<4&&Math.abs(((p.heading-runway.runway.heading+540)%360)-180)<18){p.alt=floor;p.ground=true;p.pitch=0;p.roll=0;p.vertical=0;p.phase=p.airborne?'LANDED · APPLY BRAKES':'ON RUNWAY';}else{p.alt=floor;p.speed=0;p.phase='HARD CONTACT · RECOVER';p.ground=true;p.engine=false;}}
 }
 const travelled=p.speed*Math.cos(p.pitch)*dt;Object.assign(p,geoMove(p.lat,p.lon,p.heading,travelled));p.heading=(p.heading%360+360)%360;p.distance+=travelled;p.fuel=clamp(p.fuel-(p.engine?.002+.005*p.throttle:0)*dt,0,100);p.alt=clamp(p.alt,-500,15000);
}
export function worldGuidance(p:WorldPlane,departure:Airport,arrival:Airport,mode:'departure'|'approach',terrain:number,final=false){
 const rw=airportRunway(mode==='departure'?departure:arrival),q=runwayOffset(p,rw),headingError=(target:number)=>((target-p.heading+540)%360)-180;
 let goal=arrival,altitude=Math.max(1500,terrain+600),throttle=.82,pitch=0,roll=0,rudder=0,flaps=0,gear=false,brake=false;
 if(mode==='departure'&&p.ground&&!p.airborne){return{pitch:p.speed>30?.65:0,roll:0,rudder:clamp(headingError(rw.heading)*.15,-1,1),throttle:1,flaps:.5,gear:true,engine:true,stability:true,trim:0,brake:false,final:false};}
 if(mode==='departure'&&p.alt<departure.elevation+250){pitch=.55;roll=clamp(headingError(rw.heading)*.025,-.4,.4);throttle=1;gear=true;flaps=.5;}
 else if(mode==='approach'){
  const staging=geoMove(rw.lat,rw.lon,rw.heading+180,5000);if(!final&&geoDistance(p,staging)<650&&q.along<-1000&&Math.abs(q.cross)<600)final=true;
  if(final){goal={...arrival,...geoMove(rw.lat,rw.lon,rw.heading,500)};altitude=arrival.elevation+Math.max(.8,-q.along*.045);flaps=1;gear=true;throttle=clamp(.65+(38-p.speed)*.025,.15,.95);pitch=clamp(Math.atan2(arrival.elevation+Math.max(.8,-(q.along+500)*.045)-p.alt,500)/.30,-.30,.35);roll=clamp(headingError(rw.heading+clamp(-q.cross*.018,-12,12))*.025,-.55,.55);if(q.along>-300)roll=clamp(roll,-.12,.12);if(p.ground){pitch=0;throttle=0;brake=true;}}
  else{goal={...arrival,...staging};altitude=Math.max(arrival.elevation+260,terrain+160);throttle=.65;flaps=.5;gear=true;roll=clamp(headingError(geoBearing(p,goal))*.028,-1,1);pitch=clamp((altitude-p.alt)/700,-.6,.7);}
 }else{roll=clamp(headingError(geoBearing(p,goal))*.028,-1,1);pitch=clamp((altitude-p.alt)/1000,-.7,.8);}
 return{pitch,roll,rudder,throttle,flaps,gear,engine:true,stability:true,trim:0,brake,final};
}
