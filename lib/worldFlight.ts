import {clamp} from './flight';
import {geoMove,geoDistance,geoBearing} from './geo';
import {spec,stallEas,aircraftMass,vSpeeds,type AircraftId} from './aircraft';
import {runwayEnds,type RunwayEnd,type Weather} from './weather';
import {stepFlight,contactHeight,type FlightInput,type FlightState,type StepEvent} from './flightModel';
export {geoMove,geoDistance,geoBearing} from './geo';
export type Runway={name:string;length:number;width:number;surface:string;lat:number;lon:number;heading:number;endLat:number;endLon:number;estimated?:boolean};
export type Airport={id:string;iata:string;name:string;type:string;country:string;city:string;lat:number;lon:number;elevation:number;runways:Runway[]};
export type WorldPlane=FlightState;
export type StartMode='runway'|'cold'|'final'|'cruise';
export type WorldRoom={code:string;seat:0|1;names:[string,string|null];departure:Airport;arrival:Airport;planes:[WorldPlane,WorldPlane];version:number;created:number;start?:StartMode;runway?:string;arrivalRunway?:string};
export type WorldInput=FlightInput;
export const START_MODES:{id:StartMode;label:string;detail:string}[]=[{id:'runway',label:'Runway',detail:'Lined up, engines running'},{id:'cold',label:'Cold & dark',detail:'Lined up, start engines yourself'},{id:'final',label:'Final approach',detail:'10 nm final, configured to land at arrival'},{id:'cruise',label:'Cruise',detail:'En route at cruise altitude'}];
export function airportRunway(a:Airport):Runway{if(a.runways.length)return [...a.runways].sort((x,y)=>y.length-x.length)[0];const start=geoMove(a.lat,a.lon,180,500),end=geoMove(a.lat,a.lon,0,500);return{name:'36',length:1000,width:30,surface:'practice',...start,heading:0,endLat:end.lat,endLon:end.lon,estimated:true};}
export function airportEnds(a:Airport):RunwayEnd[]{const list=a.runways.filter(r=>r.length>=150&&!/^H/i.test(r.name));return runwayEnds(list.length?list:[airportRunway(a)]);}
export function findEnd(a:Airport,ident?:string){const ends=airportEnds(a);return ends.find(e=>e.ident===ident)??ends.sort((x,y)=>y.length-x.length)[0];}
export function runwayOffset(p:{lat:number;lon:number},r:{lat:number;lon:number;heading:number}){const d=geoDistance(r,p),angle=(geoBearing(r,p)-r.heading)*Math.PI/180;return{along:d*Math.cos(angle),cross:d*Math.sin(angle)};}
export function nearRunway(p:{lat:number;lon:number},airports:Airport[]){for(const airport of airports){if(Math.abs(airport.lat-p.lat)>.08||geoDistance(airport,p)>8000)continue;for(const runway of airport.runways.length?airport.runways:[airportRunway(airport)]){const q=runwayOffset(p,runway);if(q.along>-60&&q.along<runway.length+60&&Math.abs(q.cross)<Math.max(14,runway.width/2+6))return{airport,runway};}}return null;}
export function worldSpawn(a:Airport,seat=0,recovery=0,aircraft:AircraftId='twin',start:StartMode='runway',runway?:string,arrival?:Airport,arrivalRunway?:string):WorldPlane{
 const s=spec(aircraft),fuel=s.fuelStart/s.fuelMax*100,base={pitch:s.staticPitch,roll:0,flaps:s.flapDetents[1]??0,ground:true,engine:start!=='cold',gear:true,fuel,seen:Date.now(),recovery,distance:0,airborne:false,aircraft,p:0,q:0,r:0,n1:start==='cold'?0:s.idle,gearPos:1,spoilers:0,law:{}};
 if((start==='final'||start==='cruise')&&arrival){const mass=aircraftMass(s,fuel),v=vSpeeds(s,mass);
  if(start==='final'){const e=findEnd(arrival,arrivalRunway),dist=18520,fix=geoMove(e.lat,e.lon,e.heading+180,dist),alt=arrival.elevation+15+dist*Math.tan(3*Math.PI/180),tas=v.vapp*.5144,heading=e.heading,gamma=-3*Math.PI/180;
   return{...base,...fix,alt,heading,pitch:.02,speed:tas,throttle:s.engine==='jet'?.42:.5,flaps:s.flapDetents[s.flapDetents.length-1],vertical:tas*Math.sin(gamma),ground:false,airborne:true,gear:true,phase:'DESCENT',vn:tas*Math.cos(heading*Math.PI/180),ve:tas*Math.sin(heading*Math.PI/180),vd:-tas*Math.sin(gamma),law:{th:.02,ph:0},n1:s.idle+.4*(1-s.idle)};}
  const brg=geoBearing(a,arrival),d=Math.min(geoDistance(a,arrival)*.25,s.engine==='jet'?60000:25000),pos=geoMove(a.lat,a.lon,brg,d),alt=Math.max(a.elevation,arrival.elevation)+(s.engine==='jet'?7300:1800),tas=(s.engine==='jet'?280:s.cruiseIas*1.08)*.5144;
  return{...base,...pos,alt,heading:brg,pitch:.035,speed:tas,throttle:s.engine==='jet'?.82:.75,flaps:0,vertical:0,ground:false,airborne:true,gear:!s.gearRetract,gearPos:s.gearRetract?0:1,phase:'CRUISE',vn:tas*Math.cos(brg*Math.PI/180),ve:tas*Math.sin(brg*Math.PI/180),vd:0,law:{th:.035,ph:0},n1:s.idle+.8*(1-s.idle)};}
 const e=findEnd(a,runway),p=geoMove(e.lat,e.lon,e.heading,Math.min(e.length*.25,60+seat*(s.engine==='jet'?90:45)));
 return{...base,...p,alt:a.elevation+contactHeight(s,s.staticPitch),heading:e.heading,speed:0,throttle:0,vertical:0,phase:start==='cold'?'PARKED · ENGINES OFF':'HOLDING · READY',vn:0,ve:0,vd:0};}
export function worldStallSpeed(p:WorldPlane){const s=spec(p.aircraft);return stallEas(s,aircraftMass(s,p.fuel),p.flaps,1/Math.max(.35,Math.cos(p.roll)));}
/** Advance the aircraft with the full flight model. The Earth surface under the aircraft is `terrain` metres. */
export function stepWorld(p:WorldPlane,dt:number,i:WorldInput,terrain:number,runway:ReturnType<typeof nearRunway>,weather?:Weather|null,water=false):StepEvent{
 const r=runway?.runway,reverse=r&&Math.abs(((p.heading-r.heading+540)%360)-180)>90,offset=r?runwayOffset(p,reverse?{lat:r.endLat,lon:r.endLon,heading:(r.heading+180)%360}:r):null;return stepFlight(p,dt,i,{ground:terrain,runway,weather,water,offset});}
export {clamp};
