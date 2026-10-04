// Shared mutable simulator state: written by the 60 Hz loop, read and commanded by the React UI.
import {spec,vSpeeds,aircraftMass,type AircraftId} from '@/lib/aircraft';
import {buildPlan,newAutopilot,indicatedAlt,type Autopilot,type FlightPlan,type RunwayRef} from '@/lib/autopilot';
import {AtcController,type AtcLine,type AtcSnap} from '@/lib/atc';
import {findEnd,type Airport,type WorldInput,type WorldPlane,type WorldRoom} from '@/lib/worldFlight';
import type {Touchdown} from '@/lib/flightModel';
import type {Weather,WeatherPreset} from '@/lib/weather';
export type TimePreset='live'|'dawn'|'morning'|'noon'|'afternoon'|'sunset'|'night';
export const TIME_PRESETS:{id:TimePreset;label:string}[]=[{id:'live',label:'Real time'},{id:'dawn',label:'Dawn'},{id:'morning',label:'Morning'},{id:'noon',label:'Midday'},{id:'afternoon',label:'Afternoon'},{id:'sunset',label:'Sunset'},{id:'night',label:'Night'}];
export type Settings={weather:WeatherPreset;time:TimePreset;traffic:boolean;simRate:number;unlimitedFuel:boolean;autoRudder:boolean;stability:boolean;quality:'performance'|'balanced'|'high';voice:boolean;callouts:boolean;invertPitch:boolean};
export const DEFAULT_SETTINGS:Settings={weather:'live',time:'afternoon',traffic:true,simRate:1,unlimitedFuel:false,autoRudder:true,stability:true,quality:'balanced',voice:true,callouts:true,invertPitch:false};
export type SimInput=WorldInput&{spoilers:number;reverse:boolean;parking:boolean;autobrake:number};
export type Telemetry={plane:WorldPlane;agl:number;altInd:number;remaining:number;bearing:number;elapsed:number;terrainReady:boolean;wx:Weather|null;wind:{dir:number;speed:number};oat:number;nextWp:string;distNext:number;warnings:string[];cautions:string[];traffic:number;input:SimInput;ap:Autopilot;rate:number;night:boolean};
export type Sim={input:SimInput;touch:{pitch:number;roll:number;brake:boolean};ap:Autopilot;plan:FlightPlan;atc:AtcController;wx:Weather|null;settings:Settings;snap:AtcSnap|null;touchdowns:Touchdown[];atcLines:AtcLine[];metarDep:string;metarArr:string;aircraft:AircraftId};
export const runwayRef=(a:Airport,ident?:string):RunwayRef=>{const e=findEnd(a,ident);return{ident:e.ident,lat:e.lat,lon:e.lon,heading:e.heading,elevation:a.elevation,length:e.length,airport:a.id};};
export function createSim(room:WorldRoom,callsign:string,settings:Settings,wxDep:Weather|null,wxArr:Weather|null):Sim{
 const plane=room.planes[room.seat],aircraft=(plane.aircraft??'twin') as AircraftId,a=spec(aircraft),dep=runwayRef(room.departure,room.runway),arr=runwayRef(room.arrival,room.arrivalRunway),plan=buildPlan(dep,arr,a),v=vSpeeds(a,aircraftMass(a,plane.fuel)),jet=a.engine==='jet';
 const ap=newAutopilot(Math.round(plane.heading),plan.cruiseFt,jet?v.v2+15:a.vy,Math.round(wxDep?.qnh??1013));ap.athr=false;
 const start=room.start??'runway';
 if(start==='cruise'){ap.master=true;ap.lat='NAV';ap.vert='ALT';ap.alt=Math.round(indicatedAlt(plane,wxDep,ap)/.3048/100)*100;ap.spd=Math.round((plane.speed/.5144)*.92);ap.athr=jet;ap.stage='CRUISE';plan.active=Math.max(1,plan.waypoints.findIndex(w=>w.id.startsWith('WPT')||w.id==='IF'));}
 if(start==='final'){ap.fd=true;ap.apr=true;ap.lat='HDG';ap.hdg=Math.round(plane.heading);ap.vert='ALT';ap.alt=Math.round(indicatedAlt(plane,wxArr,ap)/.3048/100)*100;ap.spd=v.vapp;ap.athr=jet;ap.baro=Math.round(wxArr?.qnh??1013);ap.stage='APPROACH';plan.active=plan.waypoints.length-1;}
 const atcAirport=(x:Airport,r:RunwayRef,wx:Weather|null)=>({id:x.id,name:x.name,city:x.city,country:x.country,lat:x.lat,lon:x.lon,elevation:x.elevation,runway:r.ident,runwayHeading:r.heading,wx});
 const atc=new AtcController(callsign||'Hinode 1',atcAirport(room.departure,dep,wxDep),atcAirport(room.arrival,arr,wxArr),plan.cruiseFt,jet);if(start==='cruise')atc.startAt('enroute');if(start==='final')atc.startAt('final');
 const input:SimInput={pitch:0,roll:0,rudder:0,throttle:plane.throttle,brake:false,flaps:plane.flaps,trim:0,stability:settings.stability,gear:plane.gear,engine:plane.engine,spoilers:0,reverse:false,parking:start==='cold',autobrake:jet?1:0,autoRudder:settings.autoRudder,unlimitedFuel:settings.unlimitedFuel};
 return{input,touch:{pitch:0,roll:0,brake:false},ap,plan,atc,wx:wxDep,settings,snap:null,touchdowns:[],atcLines:[],metarDep:wxDep?.metar??'',metarArr:wxArr?.metar??'',aircraft};}
