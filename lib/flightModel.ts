// Six-degree-of-freedom rigid-body flight model on a spherical Earth.
// Aerodynamic forces and moments come from stability derivatives (lib/aircraft.ts), engines are propeller
// (power-limited) or turbofan (spool lag, density and Mach lapse), the atmosphere is ISA adjusted to the
// live weather, and the gear is a constrained ground-contact model with steering, brakes and rotation.
import {spec,aircraftMass,type AircraftSpec} from './aircraft';
import {atmosphere,windAt,type Weather} from './weather';
import {geoMove} from './geo';
const G=9.80665,clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export type Laws={th?:number;ph?:number;gn?:number;ge?:number;gd?:number;gp?:number};
export type Touchdown={fpm:number;g:number;bank:number;pitch:number;crab:number;speed:number;centerline:number|null;fromThreshold:number|null;rating:string;time:number};
export type FlightEnv={ground:number;runway:{airport:{elevation:number};runway:{lat:number;lon:number;heading:number;length:number;width:number}}|null;weather?:Weather|null;water?:boolean;offset?:{along:number;cross:number}|null};
export type Targets={pitch?:number;bank?:number;elev?:number;ail?:number;rud?:number};
export type FlightInput={pitch:number;roll:number;rudder:number;throttle:number;brake:boolean|number;flaps:number;trim:number;stability:boolean;gear:boolean;engine:boolean;spoilers?:number;reverse?:boolean;parking?:boolean;autobrake?:number;autoRudder?:boolean;unlimitedFuel?:boolean;targets?:Targets|null};
export type FlightState={lat:number;lon:number;alt:number;heading:number;pitch:number;roll:number;speed:number;throttle:number;flaps:number;vertical:number;ground:boolean;engine:boolean;gear:boolean;fuel:number;phase:string;seen:number;recovery:number;distance:number;airborne:boolean;
 aircraft?:string;p?:number;q?:number;r?:number;vn?:number;ve?:number;vd?:number;n1?:number;gearPos?:number;spoilers?:number;ias?:number;aoa?:number;beta?:number;nz?:number;mach?:number;ff?:number;gs?:number;track?:number;crashed?:string;law?:Laws;stall?:boolean;brakes?:number;reverse?:boolean;tailStrike?:boolean};
export type StepEvent={liftoff?:boolean;touchdown?:Touchdown;crash?:string};
let random=Math.random;
/** Replace the turbulence random source (tests use a seeded generator for repeatable weather). */
export function setTurbulenceRandom(fn:()=>number){random=fn;}
function gauss(){let u=0,v=0;while(!u)u=random();while(!v)v=random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
export function stallAlpha(a:AircraftSpec,flaps=0,spoilers=0){return(a.clmax+a.clmaxFlap*flaps-a.clSpoiler*spoilers*.6-(a.cl0+a.clFlap*flaps-a.clSpoiler*spoilers))/a.cla;}
export function contactHeight(a:AircraftSpec,pitch:number,gearPos=1){const up=Math.max(0,pitch-a.staticPitch);return gearPos>.95?a.gearHeight*Math.cos(up)+a.mainArm*Math.sin(up):a.gearHeight*.42;}
/** Lift coefficient with flaps, spoilers and a post-stall break. */
function lift(a:AircraftSpec,alpha:number,flaps:number,spoilers:number){const as=stallAlpha(a,flaps,spoilers),base=a.cl0+a.clFlap*flaps-a.clSpoiler*spoilers,max=a.clmax+a.clmaxFlap*flaps-a.clSpoiler*spoilers*.6,neg=-stallAlpha(a)*.8;
 if(alpha>as)return Math.max(max*(1-2.4*(alpha-as)),Math.sin(2*alpha)*.95);if(alpha<neg)return Math.min((a.cl0+a.cla*neg)*(1-2.4*(neg-alpha)),Math.sin(2*alpha)*.95);return Math.min(max,base+a.cla*alpha);}
/** Engine spool and thrust. Returns thrust (N, body x) and fuel flow (kg/s). */
function engine(a:AircraftSpec,s:FlightState,i:FlightInput,dt:number,V:number,mach:number,sigma:number){
 const wantsRun=i.engine&&s.fuel>0;let n1=s.n1??0;const thr=clamp(i.throttle,0,1);
 if(wantsRun){if(n1<a.idle*.97)n1+=dt*(a.engine==='jet'?.012:.16);else{const target=a.idle+(1-a.idle)*thr;n1+=(target-n1)*Math.min(1,dt*(a.engine==='jet'?.32+1.3*Math.max(0,n1-a.idle):3.2));}}
 else n1=Math.max(0,n1-dt*(a.engine==='jet'?.035:.45));
 s.n1=n1;const running=wantsRun&&n1>=a.idle*.95,frac=n1<a.idle?.04*n1/a.idle:.04+.96*(a.engine==='jet'?Math.pow((n1-a.idle)/(1-a.idle),1.6):(n1-a.idle)/(1-a.idle));
 if(!running)return{T:a.engine==='piston'&&n1<.05?-.5*1.225*sigma*V*V*.12*a.engines:0,ff:0,running};
 if(a.engine==='piston'){const alt=Math.max(0,1.132*sigma-.132),P=a.power*a.engines*frac*alt,Ts=a.staticThrust*a.engines*frac*Math.sqrt(sigma),Vx=a.propEff*P/Math.max(1,Ts),T=P>0?a.propEff*P/Math.sqrt(V*V+Vx*Vx):0;return{T,ff:a.fuelFlow*a.engines*(.08+.92*frac)*Math.max(.3,alt),running};}
 let T=a.thrust*a.engines*frac*Math.pow(sigma,.85)*(1-.55*mach+.25*mach*mach);const ff=a.engines*(.015+T/a.engines*1e-5*(1+.55*mach));if(i.reverse&&s.ground)T=-.45*T;return{T,ff,running};}
export function stepFlight(s:FlightState,dtTotal:number,i:FlightInput,env:FlightEnv):StepEvent{
 const ev:StepEvent={};if(s.crashed){s.speed=0;s.engine=false;s.vn=s.ve=s.vd=0;s.p=s.q=s.r=0;return ev;}
 const a=spec(s.aircraft);let remaining=clamp(dtTotal,0,.1);
 while(remaining>1e-6){const dt=Math.min(1/120,remaining);remaining-=dt;sub(s,a,dt,i,env,ev);if(s.crashed)break;}
 return ev;}
function sub(s:FlightState,a:AircraftSpec,dt:number,i:FlightInput,env:FlightEnv,ev:StepEvent){
 const rad=Math.PI/180;s.law??={};s.p??=0;s.q??=0;s.r??=0;s.gearPos??=s.gear?1:0;s.spoilers??=0;
 if(s.vn===undefined||s.ve===undefined||s.vd===undefined){const h=s.speed*Math.cos(s.pitch);s.vn=h*Math.cos(s.heading*rad);s.ve=h*Math.sin(s.heading*rad);s.vd=-(s.vertical||0);}
 const wx=env.weather??null,atm=atmosphere(s.alt,wx??undefined),w=windAt(wx,s.alt),floor=env.runway?env.runway.airport.elevation:env.ground,agl=s.alt-floor;
 // Turbulence: first-order filtered gusts, stronger near the ground and in convective weather.
 const L=s.law,turb=(wx?.turbulence??0)*(agl<500?1.6:1)*(s.ground?.3:1),sig=turb*2.4,tau=1.4;for(const k of ['gn','ge','gd'] as const)L[k]=(L[k]??0)+(-(L[k]??0)/tau*dt+(sig?sig*Math.sqrt(2*dt/tau)*gauss()*(k==='gd'?.7:1):0));L.gp=(L.gp??0)*(1-dt/.6)+(sig?sig*.012*Math.sqrt(dt)*gauss():0);
 // Systems: flaps, gear and spoilers move at realistic rates; gear cannot retract with weight on wheels.
 const flapTarget=clamp(i.flaps,0,1);s.flaps+=clamp(flapTarget-s.flaps,-dt*(a.engine==='jet'?.06:.18),dt*(a.engine==='jet'?.06:.18));
 const gearWanted=a.gearRetract?(s.ground?true:i.gear):true;s.gear=gearWanted;s.gearPos=clamp(s.gearPos+(gearWanted?1:-1)*dt/(a.engine==='jet'?9:6),0,1);
 const autoSpoiler=a.clSpoiler>0&&s.ground&&clamp(i.throttle,0,1)<.08&&(s.airborne||s.speed>36)&&s.speed>10;s.spoilers+=clamp((autoSpoiler?1:clamp(i.spoilers??0,0,1))-s.spoilers,-dt*1.5,dt*1.5);
 // Attitude rotation matrix (body → NED).
 const psi=s.heading*rad,th=s.pitch,ph=s.roll,cps=Math.cos(psi),sps=Math.sin(psi),cth=Math.cos(th),sth=Math.sin(th),cph=Math.cos(ph),sph=Math.sin(ph);
 const xb=[cth*cps,cth*sps,-sth],yb=[sph*sth*cps-cph*sps,sph*sth*sps+cph*cps,sph*cth],zb=[cph*sth*cps+sph*sps,cph*sth*sps-sph*cps,cph*cth];
 const air=[s.vn-(w.n+(L.gn??0)),s.ve-(w.e+(L.ge??0)),s.vd-(L.gd??0)],dot=(u:number[],v:number[])=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
 const u=dot(air,xb),v=dot(air,yb),wv=dot(air,zb),V=Math.sqrt(u*u+v*v+wv*wv),Vs=Math.max(V,6),alpha=Math.atan2(wv,Math.max(.1,Math.abs(u)))*(V<1?0:1),beta=V>1?Math.asin(clamp(v/V,-1,1)):0,qbar=.5*atm.rho*V*V,mach=V/atm.a;
 const mass=aircraftMass(a,s.fuel),{T,ff,running}=engine(a,s,i,dt,V,mach,atm.sigma);s.engine=running;
 const ctl=controlLaw(s,a,i,qbar,Vs,alpha,beta,dt),ph_=s.p*a.b/(2*Vs),qh=s.q*a.c/(2*Vs),rh=s.r*a.b/(2*Vs);
 // Aerodynamic coefficients.
 const AR=a.b*a.b/a.S,hw=Math.max(.3,agl-a.gearHeight+.6),ge=(16*hw/a.b)**2/(1+(16*hw/a.b)**2),as=stallAlpha(a,s.flaps,s.spoilers);
 let CL=lift(a,alpha,s.flaps,s.spoilers)+a.clq*qh;CL*=1+(1-ge)*.08;
 const stalled=alpha>as;s.stall=stalled&&!s.ground&&V>8;
 const CD=a.cd0+a.cdFlap*Math.pow(s.flaps,1.2)+a.cdGear*(a.gearRetract?s.gearPos:0)+a.cdSpoiler*s.spoilers+CL*CL/(Math.PI*a.e*AR)*ge+.5*beta*beta+(Math.abs(alpha)>as?1.25*(Math.sin(Math.abs(alpha))**2-Math.sin(as)**2):0)+(mach>a.mcrit?20*(mach-a.mcrit)**4:0);
 const CY=a.cyb*beta+a.cyRud*ctl.rud,drop=stalled?.05*clamp((alpha-as)/.08,0,1)*Math.sign(s.r+beta*.5||1):0;
 const Cl=a.clb*beta+a.clp*ph_+a.clr*rh+a.clAil*ctl.ail+drop+(L.gp??0),Cm=a.cm0+a.cma*alpha+a.cmq*qh+a.cmElev*ctl.elev+a.cmTrim*clamp(i.trim,-1,1)+a.cmFlap*s.flaps,Cn=a.cnb*beta+a.cnp*ph_+a.cnr*rh+a.cnRud*ctl.rud+a.cnAil*ctl.ail;
 const sa=Math.sin(alpha),ca=Math.cos(alpha),X=qbar*a.S*(CL*sa-CD*ca)+T,Y=qbar*a.S*CY,Z=qbar*a.S*(-CL*ca-CD*sa);
 let Lm=qbar*a.S*a.b*Cl,Mm=qbar*a.S*a.c*Cm,Nm=qbar*a.S*a.b*Cn-a.pFactor*Math.max(0,T);
 const F=[0,1,2].map(k=>xb[k]*X+yb[k]*Y+zb[k]*Z),acc=[F[0]/mass,F[1]/mass,F[2]/mass+G];
 s.nz=-Z/(mass*G);s.aoa=alpha;s.beta=beta;s.mach=mach;s.ias=V*Math.sqrt(atm.sigma);s.ff=ff*3600;s.reverse=!!i.reverse&&s.ground&&a.engine==='jet';
 if(!i.unlimitedFuel)s.fuel=clamp(s.fuel-ff*dt/a.fuelMax*100,0,100);
 const [Ixx,Iyy,Izz]=a.I,contact=contactHeight(a,s.pitch,s.gearPos);
 if(s.ground){
  // Wheels on the ground: vertical constraint, pitch about the main gear, nose-wheel steering, friction and brakes.
  const normal=Math.max(0,mass*acc[2]),fwdU=[cps,sps],latU=[-sps,cps];let fwd=s.vn*fwdU[0]+s.ve*fwdU[1],lat=s.vn*latU[0]+s.ve*latU[1];
  if(acc[2]<0&&V>10){s.ground=false;s.airborne=true;ev.liftoff=true;}
  else{
   let brake=typeof i.brake==='number'?clamp(i.brake,0,1):i.brake?1:0;if(i.parking)brake=1;
   if(!brake&&i.autobrake&&s.airborne&&i.throttle<.1&&fwd>3){const want=[0,1.8,3,5.5][i.autobrake]??0,decel=-(acc[0]*fwdU[0]+acc[1]*fwdU[1]);brake=clamp((want-decel)/(a.brakeMu*G),0,1);}
   s.brakes=brake;const roll=(a.engine==='jet'?.015:.025)+a.brakeMu*brake,along=acc[0]*fwdU[0]+acc[1]*fwdU[1],resist=roll*normal/mass;
   if(Math.abs(fwd)<.15&&Math.abs(along)<=resist)fwd=0;else fwd+=(along-Math.sign(fwd||along)*resist)*dt;
   lat+=(acc[0]*latU[0]+acc[1]*latU[1])*dt*.15;lat*=Math.max(0,1-dt*9);
   s.vn=fwd*fwdU[0]+lat*latU[0];s.ve=fwd*fwdU[1]+lat*latU[1];s.vd=0;
   const steer=clamp(ctl.rud+i.roll*.6,-1,1),maxSteer=(a.engine==='jet'?70:32)*rad*(1-clamp(Math.abs(fwd)/30,0,.85)),rTarget=fwd*Math.tan(steer*maxSteer)/a.wheelbase+a.cnb*beta*qbar*a.S*a.b/Izz*.08;s.r+=(rTarget-s.r)*Math.min(1,dt*5);
   const mGround=-normal*a.mainArm*Math.cos(s.pitch);let qd=(Mm+mGround)/Iyy;if(s.pitch<=a.staticPitch&&qd<0){qd=0;s.q=Math.max(0,s.q);}s.q+=qd*dt;s.q*=Math.max(0,1-dt*1.5);s.pitch=Math.max(a.staticPitch,s.pitch+s.q*dt);if(s.pitch<=a.staticPitch)s.q=Math.max(0,s.q);
   if(s.pitch>=a.tailStrike){s.pitch=a.tailStrike;s.q=Math.min(0,s.q);s.tailStrike=true;}
   s.p=0;s.roll*=Math.max(0,1-dt*6);s.alt=floor+contactHeight(a,s.pitch,s.gearPos);
   const hd=s.r*dt/rad;s.heading=((s.heading+hd)%360+360)%360;const rot=s.r*dt;const vn=s.vn*Math.cos(rot)-s.ve*Math.sin(rot),ve=s.vn*Math.sin(rot)+s.ve*Math.cos(rot);s.vn=vn;s.ve=ve;
  }
 }
 if(!s.ground){
  s.vn+=acc[0]*dt;s.ve+=acc[1]*dt;s.vd+=acc[2]*dt;
  const pd=(Lm-(Izz-Iyy)*s.q*s.r)/Ixx,qd=(Mm-(Ixx-Izz)*s.p*s.r)/Iyy,rd=(Nm-(Iyy-Ixx)*s.p*s.q)/Izz;s.p+=pd*dt;s.q+=qd*dt;s.r+=rd*dt;
  // Quaternion attitude integration (no gimbal lock), then back to heading/pitch/roll.
  const c1=Math.cos(ph/2),s1=Math.sin(ph/2),c2=Math.cos(th/2),s2=Math.sin(th/2),c3=Math.cos(psi/2),s3=Math.sin(psi/2);
  let qw=c1*c2*c3+s1*s2*s3,qx=s1*c2*c3-c1*s2*s3,qy=c1*s2*c3+s1*c2*s3,qz=c1*c2*s3-s1*s2*c3;const P=s.p,Q=s.q,Rr=s.r;
  const dw=-.5*(qx*P+qy*Q+qz*Rr),dx=.5*(qw*P+qy*Rr-qz*Q),dy=.5*(qw*Q+qz*P-qx*Rr),dz=.5*(qw*Rr+qx*Q-qy*P);qw+=dw*dt;qx+=dx*dt;qy+=dy*dt;qz+=dz*dt;const n=Math.hypot(qw,qx,qy,qz);qw/=n;qx/=n;qy/=n;qz/=n;
  s.roll=Math.atan2(2*(qw*qx+qy*qz),1-2*(qx*qx+qy*qy));s.pitch=Math.asin(clamp(2*(qw*qy-qz*qx),-1,1));s.heading=((Math.atan2(2*(qw*qz+qx*qy),1-2*(qy*qy+qz*qz))/rad)%360+360)%360;
 }
 // Move over the sphere; great-circle motion rotates the local north reference (meridian convergence).
 const gs=Math.hypot(s.vn,s.ve),track=(Math.atan2(s.ve,s.vn)/rad+360)%360,dist=gs*dt;
 if(dist>0){const before=s.lon,moved=geoMove(s.lat,s.lon,track,dist),dlon=((moved.lon-before+540)%360-180)*rad,conv=dlon*Math.sin(((s.lat+moved.lat)/2)*rad);s.lat=moved.lat;s.lon=moved.lon;s.heading=((s.heading+conv/rad)%360+360)%360;const vn=s.vn*Math.cos(conv)-s.ve*Math.sin(conv),ve=s.vn*Math.sin(conv)+s.ve*Math.cos(conv);s.vn=vn;s.ve=ve;s.distance+=dist;}
 if(!s.ground)s.alt-=s.vd*dt;
 s.speed=V;s.gs=gs;s.track=track;s.vertical=-s.vd;
 // Touchdown and terrain contact.
 if(!s.ground&&s.vd>0&&s.alt<=floor+contactHeight(a,s.pitch,s.gearPos)){const sink=s.vd,fpm=sink*196.85,bank=Math.abs(s.roll)/rad,crab=Math.abs(((s.heading-track+540)%360)-180),rw=env.runway,off=env.offset??null;
  const crash=(why:string)=>{s.crashed=why;s.phase=`CRASH · ${why}`;s.alt=floor+contact;s.ground=true;s.engine=false;s.n1=0;ev.crash=why;};
  if(s.gearPos<.95)crash('GEAR-UP LANDING');
  else if(!rw&&env.water)crash('DITCHED IN WATER');
  else if(bank>(a.engine==='jet'?11:16))crash(a.engine==='jet'?'WING / ENGINE STRIKE':'WINGTIP STRIKE');
  else if(sink>(a.engine==='jet'?4.6:5.2))crash('STRUCTURAL FAILURE · HARD IMPACT');
  else if(crab>25&&gs>20)crash('LANDING GEAR COLLAPSE · SIDE LOAD');
  else if(!rw&&(a.id!=='trainer'||gs>38||sink>2.6))crash('TERRAIN IMPACT · OFF RUNWAY');
  else{const g=1+sink*sink/(2*G*.32),rating=sink<1?'BUTTER':sink<1.8?'SMOOTH':sink<3?'FIRM':'HARD';ev.touchdown={fpm:Math.round(fpm),g:Math.round(g*100)/100,bank:Math.round(bank*10)/10,pitch:Math.round(s.pitch/rad*10)/10,crab:Math.round(crab*10)/10,speed:Math.round((s.ias??V)/.5144),centerline:off?Math.round(off.cross*10)/10:null,fromThreshold:off?Math.round(off.along):null,rating,time:Date.now()};
   s.ground=true;s.vd=0;s.alt=floor+contactHeight(a,s.pitch,1);s.roll*=.3;s.p=0;if(s.pitch<a.staticPitch)s.pitch=a.staticPitch;}}
 s.phase=s.crashed?`CRASH · ${s.crashed}`:s.ground?(!s.engine?((s.n1??0)>.02&&i.engine?'ENGINE START':s.airborne&&gs>1?'LANDED · ROLLOUT':'PARKED · ENGINES OFF'):s.airborne?(gs>16?'LANDED · ROLLOUT':'LANDED · TAXI'):gs<.5?'HOLDING · READY':gs<14?'TAXI':'TAKEOFF ROLL'):s.stall?'STALL':s.vertical>2.5?'CLIMB':s.vertical<-2.5?'DESCENT':'CRUISE';
}
/** Pilot / fly-by-wire / autopilot control law. Uses model inversion so assists behave consistently across aircraft. */
function controlLaw(s:FlightState,a:AircraftSpec,i:FlightInput,qbar:number,V:number,alpha:number,beta:number,dt:number){
 const rad=Math.PI/180,t=i.targets??{},L=s.law!,P=s.p??0,Q=s.q??0,Rr=s.r??0;let elev=clamp(i.pitch,-1,1),ail=clamp(i.roll,-1,1),rud=clamp(i.rudder,-1,1);
 const assisted=!s.ground&&(a.fbw||i.stability||t.pitch!==undefined||t.bank!==undefined)&&qbar>60;
 if(!assisted){L.th=s.pitch;L.ph=s.roll;}
 else{
  const as=stallAlpha(a,s.flaps,s.spoilers??0),maxBank=a.fbw?67*rad:60*rad;
  if(t.pitch!==undefined)L.th=t.pitch;else{L.th=(L.th??s.pitch)+clamp(i.pitch,-1,1)*(a.fbw?3.5:6)*rad*dt;if(Math.abs(i.pitch)>.05)L.th+=(s.pitch-L.th)*Math.min(1,dt*.6);}
  if(alpha>as-.035&&(L.th??0)>s.pitch-.02)L.th=s.pitch-(alpha-(as-.035))*2;
  L.th=clamp(L.th,-15*rad,(a.fbw?30:25)*rad);
  if(t.bank!==undefined)L.ph=t.bank;else if(a.fbw){L.ph=(L.ph??s.roll)+clamp(i.roll,-1,1)*15*rad*dt;if(Math.abs(i.roll)<.05&&Math.abs(L.ph)>33*rad)L.ph-=Math.sign(L.ph)*5*rad*dt;}else L.ph=clamp(i.roll,-1,1)*45*rad;
  L.ph=clamp(L.ph,-maxBank,maxBank);
  const S=a.S,turnQ=9.81*Math.sin(s.roll)*Math.tan(clamp(s.roll,-1.2,1.2))/V,qCmd=clamp((L.th-s.pitch)*(a.fbw?.9:1.3),-(a.fbw?5:10)*rad,(a.fbw?5:10)*rad)*Math.cos(s.roll)+turnQ,qdDes=(qCmd-Q)*(a.fbw?2.6:4.5);
  const pitchOther=a.cm0+a.cma*alpha+a.cmq*Q*a.c/(2*V)+a.cmTrim*clamp(i.trim,-1,1)+a.cmFlap*s.flaps;elev=clamp((qdDes*a.I[1]/(qbar*S*a.c)-pitchOther)/a.cmElev,-1,1);
  const pCmd=clamp((L.ph-s.roll)*(a.fbw?1.1:1.6),-(a.fbw?15:30)*rad,(a.fbw?15:30)*rad),pdDes=(pCmd-P)*(a.fbw?3.5:6),rollOther=a.clb*beta+a.clp*P*a.b/(2*V)+a.clr*Rr*a.b/(2*V);ail=clamp((pdDes*a.I[0]/(qbar*S*a.b)-rollOther)/a.clAil,-1,1);
 }
 if(t.elev!==undefined)elev=t.elev;if(t.ail!==undefined)ail=t.ail;
 if(!s.ground&&(i.autoRudder??true)&&qbar>60){const rCoord=9.81*Math.sin(s.roll)*Math.cos(s.pitch)/V,rdDes=(rCoord-Rr)*2.2+beta*V*.05,other=a.cnb*beta+a.cnp*P*a.b/(2*V)+a.cnr*Rr*a.b/(2*V)+a.cnAil*ail;rud=clamp(rud+(rdDes*a.I[2]/(qbar*a.S*a.b)-other)/a.cnRud,-1,1);}
 if(t.rud!==undefined)rud=clamp(rud+t.rud,-1,1);
 return{elev,ail,rud};}
