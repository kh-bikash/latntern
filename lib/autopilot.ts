// Autopilot / flight director, GPS flight plan, autothrottle and an optional AI copilot that flies a
// complete departure, cruise, ILS-style approach and autoland using the same autopilot a player can use.
import {spec,vSpeeds,aircraftMass,cruiseAltitudeFt,type AircraftSpec} from './aircraft';
import {geoDistance,geoBearing,geoMove,crossTrack,angleDiff} from './geo';
import {atmosphere,altimeter,type Weather} from './weather';
import {contactHeight,stallAlpha,type FlightInput,type FlightState} from './flightModel';
const rad=Math.PI/180,kt=.514444,ftm=.3048,clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export type Lateral='ROL'|'HDG'|'NAV'|'LOC'|'ROLLOUT'|'TO';
export type Vertical='PIT'|'VS'|'ALT'|'ALTS'|'FLC'|'GS'|'FLARE'|'TO';
export type Waypoint={id:string;lat:number;lon:number;alt?:number};
export type RunwayRef={ident:string;lat:number;lon:number;heading:number;elevation:number;length:number;airport:string};
export type FlightPlan={waypoints:Waypoint[];active:number;departure:RunwayRef;arrival:RunwayRef;cruiseFt:number};
export type Autopilot={master:boolean;fd:boolean;lat:Lateral;vert:Vertical;apr:boolean;hdg:number;alt:number;vs:number;spd:number;athr:boolean;athrMode:string;baro:number;std:boolean;
 i?:{g?:number;t?:number;bank?:number;thr?:number;ias?:number;acc?:number;locCap?:boolean;gsCap?:boolean;vsWas?:number};copilot:boolean;stage:string;message:string;flareFrom?:number;decided?:boolean};
export const newAutopilot=(hdg:number,alt:number,spd:number,baro=1013):Autopilot=>({master:false,fd:true,lat:'HDG',vert:'ALT',apr:false,hdg,alt,vs:0,spd,athr:false,athrMode:'',baro,std:false,i:{},copilot:false,stage:'',message:''});
export function buildPlan(dep:RunwayRef,arr:RunwayRef,a:AircraftSpec):FlightPlan{
 const dist=geoDistance(dep,arr),cruiseFt=cruiseAltitudeFt(a,dist/1000),jet=a.engine==='jet',ifNm=jet?16:9,fafNm=jet?5.5:4,ifAlt=arr.elevation+(jet?3500:2000)*ftm,fafAlt=arr.elevation+15+fafNm*1852*Math.tan(3*rad);
 const der=geoMove(dep.lat,dep.lon,dep.heading,dep.length),climb=geoMove(der.lat,der.lon,dep.heading,jet?6000:2500),ifx=geoMove(arr.lat,arr.lon,arr.heading+180,ifNm*1852),faf=geoMove(arr.lat,arr.lon,arr.heading+180,fafNm*1852);
 const waypoints:Waypoint[]=[{id:`RW${dep.ident}`,...der},{id:'DEPRT',...climb}];
 // Long legs follow the great circle through intermediate fixes, like a planned airway route.
 const leg=geoDistance(climb,ifx),n=Math.floor(leg/400000);for(let k=1;k<=n;k++){const p=geoMove(climb.lat,climb.lon,geoBearing(climb,ifx),leg*k/(n+1));waypoints.push({id:`WPT${k}`,...p});}
 waypoints.push({id:'IF',...ifx,alt:ifAlt},{id:'FAF',...faf,alt:fafAlt},{id:`RW${arr.ident}`,lat:arr.lat,lon:arr.lon,alt:arr.elevation+15});
 return{waypoints,active:1,departure:dep,arrival:arr,cruiseFt};}
export function planRemaining(s:{lat:number;lon:number},plan:FlightPlan){let d=0,prev={lat:s.lat,lon:s.lon};for(let k=plan.active;k<plan.waypoints.length;k++){d+=geoDistance(prev,plan.waypoints[k]);prev=plan.waypoints[k];}return d;}
export function indicatedAlt(s:FlightState,wx:Weather|null|undefined,ap:Pick<Autopilot,'baro'|'std'>){const p=atmosphere(s.alt,wx??undefined).p;return altimeter(p,ap.std?1013.25:ap.baro);}
export function glidePath(s:{lat:number;lon:number;alt:number},r:RunwayRef){const d=geoDistance(r,s),ang=(geoBearing(r,s)-r.heading)*rad,along=d*Math.cos(ang),cross=d*Math.sin(ang),pathAlt=r.elevation+15+Math.max(0,-along)*Math.tan(3*rad);return{along,cross,dev:s.alt-pathAlt,locDeg:Math.atan2(cross,Math.max(50,-along+300))/rad,gsDeg:Math.atan2(s.alt-r.elevation-15,Math.max(50,-along))/rad-3};}
export type ApOut={targets:{pitch?:number;bank?:number;rud?:number;elev?:number}|null;throttle?:number;flaps?:number;gear?:boolean;spoilers?:number;brake?:number;reverse?:boolean;autobrake?:number;disconnect?:string;callout?:string};
/** One autopilot / autothrottle / copilot update. Returns control overrides for the flight model. */
export function autopilot(s:FlightState,ap:Autopilot,plan:FlightPlan|null,input:FlightInput,wx:Weather|null|undefined,ground:number,dt:number):ApOut{
 const a=spec(s.aircraft),I=ap.i??={},mass=aircraftMass(a,s.fuel),v=vSpeeds(a,mass),ias=(s.ias??0)/kt,V=Math.max(20,s.speed),out:ApOut={targets:null},maxBank=a.maxBank*rad,alt=indicatedAlt(s,wx,ap)/ftm,jet=a.engine==='jet';
 if(ap.copilot)copilot(s,a,ap,plan,v,ias,alt,wx,out,ground);
 if(s.ground&&ap.lat!=='ROLLOUT'&&ap.lat!=='TO'){if(ap.master&&!ap.copilot){ap.master=false;out.disconnect='AP OFF · ON GROUND';}}
 if(s.stall&&ap.master){ap.master=false;ap.copilot=false;out.disconnect='AP OFF · STALL';}
 const gam=Math.asin(clamp(-(s.vd??0)/Math.max(1,Math.hypot(s.vn??0,s.ve??0,s.vd??0)),-1,1)),rwy=plan?.arrival;
 // Lateral modes.
 let bank=0;const trackTo=(trackDeg:number)=>clamp(angleDiff(trackDeg,s.track??s.heading)*(jet?1.6:1.9)*rad,-maxBank,maxBank);
 if(ap.lat==='HDG')bank=clamp(angleDiff(ap.hdg,s.heading)*(jet?1.5:1.8)*rad,-maxBank,maxBank);
 else if(ap.lat==='NAV'&&plan){const wp=plan.waypoints[plan.active],from=plan.active>0?plan.waypoints[plan.active-1]:{lat:s.lat,lon:s.lon},dist=geoDistance(s,wp),legCourse=geoBearing(from,wp),xte=crossTrack(s,from,wp),turn=V*V/(9.81*Math.tan(maxBank))*Math.tan(Math.abs(angleDiff(plan.waypoints[plan.active+1]?geoBearing(wp,plan.waypoints[plan.active+1]):legCourse,legCourse))*rad/2);
  const along=Math.cos(angleDiff(geoBearing(from,s),legCourse)*rad)*geoDistance(from,s),legLen=geoDistance(from,wp);
  if((dist<Math.max(400,turn)||along>legLen)&&plan.active<plan.waypoints.length-1)plan.active++;
  const approachLeg=['FAF',plan.waypoints[plan.waypoints.length-1].id].includes(wp.id),gain=approachLeg?70:28,cap=approachLeg?45:35;bank=trackTo(dist<3000&&!approachLeg?geoBearing(s,wp):legCourse+clamp(-xte/1852*gain,-cap,cap));ap.hdg=Math.round(s.heading);}
 else if(ap.lat==='LOC'&&rwy){const g=glidePath(s,rwy);bank=trackTo(rwy.heading+clamp(-g.cross*(g.along>-3000?.09:.05),-35,35))*(g.along>-600?.5:1);if(Math.abs(g.along)<200)bank=clamp(bank,-5*rad,5*rad);}
 else if(ap.lat==='ROLLOUT'&&rwy){const g=glidePath(s,rwy);out.targets={...out.targets,rud:clamp(angleDiff(rwy.heading+clamp(-g.cross*1.5,-12,12),s.heading)*.09,-1,1)};}
 else if(ap.lat==='ROL')bank=Math.abs(s.roll)<6*rad?0:s.roll;
 if(ap.apr&&rwy&&!I.locCap&&!s.ground){const g=glidePath(s,rwy);if(Math.abs(g.locDeg)<2.4&&g.along<-500&&Math.abs(angleDiff(rwy.heading,s.heading))<100){I.locCap=true;ap.lat='LOC';out.callout='LOC';}}
 if(ap.apr&&rwy&&I.locCap&&!I.gsCap&&!s.ground){const g=glidePath(s,rwy);if(g.dev>-20&&g.dev<25&&g.along<-800&&Math.abs(g.cross)<300){I.gsCap=true;ap.vert='GS';out.callout='GLIDESLOPE';}}
 I.bank=(I.bank??s.roll)+clamp(bank-(I.bank??s.roll),-dt*6*rad,dt*6*rad);
 // Vertical modes: flight-path-angle loop over an attitude inner loop.
 let gTarget:number|undefined;const altErr=ap.alt-alt;
 if((ap.vert==='VS'||ap.vert==='FLC')&&Math.abs(altErr)<Math.max(80,Math.abs(ap.vert==='VS'?ap.vs:s.vertical*196.85)/5)){ap.vert='ALTS';out.callout='ALT CAPTURE';}
 if(ap.vert==='ALTS'&&Math.abs(altErr)<25)ap.vert='ALT';
 if(ap.vert==='ALT'||ap.vert==='ALTS'){const vs=clamp(Math.sign(altErr)*Math.max(Math.abs(altErr)>15?(ap.vert==='ALT'?60:180):0,Math.abs(altErr)*(ap.vert==='ALT'?3:5)),-Math.max(800,Math.abs(I.vsWas??0)),Math.max(800,Math.abs(I.vsWas??0)))/196.85;gTarget=Math.asin(clamp(vs/V,-.3,.3));}
 else if(ap.vert==='VS'){I.vsWas=ap.vs;gTarget=Math.asin(clamp(ap.vs/196.85/V,-.3,.3));}
 else if(ap.vert==='FLC'){const climbing=altErr>0;I.vsWas=s.vertical*196.85;gTarget=clamp(gam+(ias-ap.spd)*.0035,climbing?(s.alt-ground<300?.05:0):-.14,climbing?.24:0);}
 else if(ap.vert==='GS'&&rwy){const g=glidePath(s,rwy),vs=-Math.hypot(s.vn??0,s.ve??0)*Math.tan(3*rad)-clamp(g.dev,-60,60)*.12;gTarget=Math.asin(clamp(vs/V,-.25,.1));const h=s.alt-rwy.elevation-contactHeight(a,s.pitch,s.gearPos??1),flareAt=jet?12:6;if(h<flareAt&&ap.master){ap.vert='FLARE';ap.flareFrom=h;out.callout=jet?'FLARE':'';}}
 else if(ap.vert==='FLARE'&&rwy){const h=s.alt-rwy.elevation-contactHeight(a,s.pitch,s.gearPos??1),vs=-(clamp(h,0,20)*(jet?.2:.28)+(jet?1:.55));gTarget=Math.asin(clamp(vs/V,-.2,.05));if(s.ground){ap.vert='PIT';ap.lat='ROLLOUT';}}
 else if(ap.vert==='PIT')gTarget=undefined;
 const qbarE=.5*1.225*Math.max(30,s.ias??V)**2,clBase=a.cl0+a.clFlap*s.flaps-a.clSpoiler*(s.spoilers??0),clReq=mass*9.81*Math.cos(gam)/(qbarE*a.S*Math.max(.5,Math.cos(s.roll))),alphaReq=clamp((clReq-clBase)/a.cla,-.08,stallAlpha(a,s.flaps,s.spoilers??0)-.03),alphaNow=s.pitch-gam;
 let pitch:number|undefined;if(gTarget!==undefined){I.g=clamp((I.g??0)+(gTarget-gam)*dt*.3,-.05,.05);pitch=clamp(alphaReq+gTarget+I.g+(gTarget-gam)*.8,-12*rad,(jet?18:16)*rad);if(alphaNow>stallAlpha(a,s.flaps,s.spoilers??0)-.05)pitch=Math.min(pitch,s.pitch-.02);}else I.g=0;
 if(ap.vert==='PIT'&&s.ground&&ap.lat==='ROLLOUT')pitch=undefined;
 // Autothrottle.
 if(ap.athr&&!s.ground){let thr=I.thr??input.throttle;
  if(ap.vert==='FLC'){thr=altErr>0?(jet?.93:1):(jet?0:.25);ap.athrMode=altErr>0?'THR CLB':'THR IDLE';}
  else if(ap.vert==='FLARE'){const h=s.alt-(rwy?.elevation??ground)-contactHeight(a,s.pitch,s.gearPos??1);if(h<(jet?7:4)){thr=Math.max(0,thr-dt*.5);ap.athrMode='RETARD';if(!I.t){I.t=1;out.callout=jet?'RETARD':'';}}else ap.athrMode='SPEED';}
  else{const err=ap.spd-ias,acc=(ias-(I.ias??ias))/Math.max(dt,1e-3);I.acc=(I.acc??0)+(acc-(I.acc??0))*Math.min(1,dt*.7);thr=clamp(thr+(clamp(err,-15,15)*.016-I.acc*.08)*dt*(jet?1:1.6),0,jet?.95:1);ap.athrMode='SPEED';}
  I.thr=thr;out.throttle=thr;}
 else I.thr=input.throttle;I.ias=ias;
 if(s.ground&&ap.lat==='ROLLOUT'){out.throttle=0;out.autobrake=jet?2:0;out.brake=jet?undefined:(ias>15?.6:.4);out.reverse=jet&&ias>65;ap.athrMode='';out.spoilers=1;}
 if(ap.master)out.targets={...out.targets,bank:ap.lat==='ROLLOUT'?undefined:I.bank,pitch};
 else if(!ap.copilot)out.targets=null;
 return out;}
/** Optional AI copilot: runs the checklist-like flow of a real crew using the same autopilot modes. */
function copilot(s:FlightState,a:AircraftSpec,ap:Autopilot,plan:FlightPlan|null,v:ReturnType<typeof vSpeeds>,ias:number,alt:number,wx:Weather|null|undefined,out:ApOut,ground:number){
 if(!plan)return;const jet=a.engine==='jet',dep=plan.departure,arr=plan.arrival,agl=s.alt-Math.max(ground,s.ground?ground:0),flaps=a.flapDetents,remaining=planRemaining(s,plan),toIF=(()=>{let d=0,prev={lat:s.lat,lon:s.lon};const k=plan.waypoints.findIndex(w=>w.id==='IF');if(k<plan.active)return 0;for(let j=plan.active;j<=k;j++){d+=geoDistance(prev,plan.waypoints[j]);prev=plan.waypoints[j];}return d;})();
 const g=glidePath(s,arr),final=plan.waypoints.find(w=>w.id==='IF')!;
 // Take-off roll.
 if(s.ground&&!s.airborne){ap.stage='TAKEOFF';ap.lat='TO';ap.vert='TO';ap.master=true;out.flaps=flaps[a.toFlap]??0;out.gear=true;out.spoilers=0;const g0=glidePath(s,{...dep});
  out.throttle=1;out.brake=0;const steer=clamp(angleDiff(dep.heading+clamp(-g0.cross*2,-15,15),s.heading)*.12,-1,1);const rotate=ias>=v.vr;out.targets={rud:steer,elev:rotate?(s.pitch<(jet?12:9)*rad?(jet?.42:.45):0):(jet?0:-.05)};ap.message=rotate?'Rotate':ias>40?`${Math.round(ias)} kt`:'Take-off thrust set';return;}
 if(ap.stage==='TAKEOFF'||ap.stage==='INITIAL CLIMB'){ap.stage='INITIAL CLIMB';ap.lat='HDG';ap.hdg=dep.heading;ap.vert='FLC';ap.spd=jet?v.v2+15:a.vy;ap.alt=Math.max(ap.alt,plan.cruiseFt);ap.athr=jet;out.throttle=jet?undefined:1;if(s.vertical>1.5&&agl>12)out.gear=false;
  if(agl>(jet?300:150)){ap.stage='CLIMB';ap.lat='NAV';}return;}
 if(['CLIMB','CRUISE'].includes(ap.stage)){ap.lat='NAV';ap.athr=jet;out.gear=false;const climbSpd=jet?(alt<10000?250:Math.min(290,v.green+100)):a.climbIas;
  if(jet&&ias>v.green-5)out.flaps=0;else if(jet&&ias>(v.v2+25))out.flaps=flaps[Math.min(1,a.toFlap)];else if(!jet&&ias>a.vy-10)out.flaps=0;
  const descentDist=Math.max(0,(alt-(final.alt!/ftm))/(jet?300:450))*1852+(jet?18000:5000);
  if(toIF<descentDist&&remaining>0){ap.stage='DESCENT';}
  else{if(ap.stage==='CLIMB'&&Math.abs(plan.cruiseFt-alt)<150)ap.stage='CRUISE';ap.alt=plan.cruiseFt;if(ap.vert!=='ALT'&&ap.vert!=='ALTS')ap.vert='FLC';ap.spd=ap.stage==='CRUISE'?(jet?Math.min(290,a.cruiseIas):a.cruiseIas):climbSpd;if(!jet)out.throttle=ap.stage==='CRUISE'?.78:1;
   if(jet&&s.alt>8000)ap.spd=Math.min(ap.spd,Math.round(a.cruiseMach/Math.max(.3,s.mach??.7)*ias));}
  ap.message=ap.stage==='CRUISE'?'Cruise':'Climb';}
 if(ap.stage==='DESCENT'){ap.lat='NAV';ap.alt=Math.round(final.alt!/ftm/100)*100;ap.vert=ap.vert==='ALT'&&Math.abs(alt-ap.alt)<50?'ALT':'VS';if(ap.vert==='VS')ap.vs=-(jet?Math.min(2200,Math.max(900,(alt-ap.alt)/Math.max(1,toIF/1852)*(jet?.6:.5)*3)):600);ap.spd=jet?(alt>11000?280:250):a.cruiseIas-10;ap.athr=jet;if(!jet)out.throttle=.48;if(jet&&ias>ap.spd+12)out.spoilers=.5;else out.spoilers=0;
  if(toIF<(jet?26000:10000)||remaining<(jet?60000:28000)){ap.stage='APPROACH';ap.apr=true;}ap.message='Descent';}
 if(ap.stage==='APPROACH'){ap.apr=true;ap.athr=true;out.spoilers=0;if(!ap.i?.locCap)ap.lat='NAV';if(!ap.i?.gsCap){ap.alt=Math.round(final.alt!/ftm/100)*100;if(ap.vert!=='ALT'&&ap.vert!=='ALTS'&&Math.abs(alt-ap.alt)>200){ap.vert='VS';ap.vs=Math.sign(ap.alt-alt)*(jet?1000:500);}}
  const dist=planRemaining(s,plan);let cfg=1;if(dist<(jet?30000:15000))cfg=2;if(dist<(jet?20000:10000))cfg=3;if(dist<(jet?14000:7000)||ap.i?.gsCap)cfg=4;
  const idx=Math.min(flaps.length-1,jet?cfg:Math.max(0,Math.round(cfg*(flaps.length-1)/4)));out.flaps=flaps[idx];out.gear=cfg>=3;
  const target=cfg>=4?v.vapp:jet?[0,210,190,170,v.vapp][cfg]:[0,a.cruiseIas-15,a.vapp+20,a.vapp+10,a.vapp][cfg];ap.spd=Math.round(target);if(!jet)ap.athr=true;
  ap.message=ap.i?.gsCap?'Established · ILS':ap.i?.locCap?'Localizer captured':'Approach';if(ap.vert==='FLARE')ap.message='Flare';
  if(s.ground&&s.airborne){ap.stage='ROLLOUT';}
  else if(-g.along<(jet?1800:900)&&-g.along>-200&&(!ap.i?.gsCap||Math.abs(g.dev)>45||Math.abs(g.cross)>70)&&ap.vert!=='FLARE'){ap.stage='GO-AROUND';ap.apr=false;ap.i!.locCap=ap.i!.gsCap=false;out.callout='GO AROUND';}}
 if(ap.stage==='GO-AROUND'){ap.lat='HDG';ap.hdg=Math.round(arr.heading);ap.vert='FLC';ap.alt=Math.round(final.alt!/ftm/100)*100;ap.spd=jet?v.v2+20:a.vy;ap.athr=true;out.flaps=flaps[Math.min(flaps.length-1,jet?2:1)];if(s.vertical>1.5)out.gear=false;out.spoilers=0;ap.message='Go-around';
  if(s.alt-ground>(jet?380:250)){ap.stage='APPROACH';ap.lat='NAV';const k=plan.waypoints.findIndex(w=>w.id==='IF');plan.active=k;}}
 if(ap.stage==='ROLLOUT'){ap.lat='ROLLOUT';ap.vert='PIT';ap.message=ias>30?'Rollout':'Vacate runway';out.gear=true;if(ias<20){ap.copilot=false;ap.master=false;ap.stage='LANDED';out.reverse=false;out.throttle=0;out.brake=.5;}}
 void arr;void dep;void wx;}
export function apFromState(s:FlightState,wx:Weather|null|undefined):Autopilot{const ap=newAutopilot(Math.round(s.heading),0,Math.round((s.ias??0)/kt),Math.round(wx?.qnh??1013));ap.alt=Math.round(indicatedAlt(s,wx,ap)/ftm/100)*100;return ap;}
export function shortMode(ap:Autopilot){return{lat:ap.lat==='TO'?'TO':ap.lat,vert:ap.vert,arm:[ap.apr&&!ap.i?.locCap?'LOC':'',ap.apr&&!ap.i?.gsCap?'GS':''].filter(Boolean).join(' ')};}
