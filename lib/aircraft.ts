// Aircraft performance and aerodynamic data. Values follow published light-trainer, piston-twin and
// narrowbody-jet class data (POH figures, Roskam / JSBSim-style stability derivatives); they are
// approximations for a game, not certified data for any branded aircraft.
export type AircraftId='trainer'|'twin'|'jet';
export type AircraftSpec={
 id:AircraftId;name:string;kind:string;summary:string;engine:'piston'|'jet';engines:number;
 empty:number;payload:number;fuelMax:number;fuelStart:number;mtow:number;
 S:number;b:number;c:number;e:number;I:[number,number,number];
 cl0:number;cla:number;clmax:number;clFlap:number;clmaxFlap:number;clq:number;cd0:number;cdFlap:number;cdGear:number;cdSpoiler:number;clSpoiler:number;mcrit:number;
 cm0:number;cma:number;cmq:number;cmElev:number;cmTrim:number;cmFlap:number;
 cyb:number;cyRud:number;clb:number;clp:number;clr:number;clAil:number;cnb:number;cnp:number;cnr:number;cnRud:number;cnAil:number;
 power:number;staticThrust:number;propEff:number;thrust:number;idle:number;pFactor:number;fuelFlow:number;
 gearRetract:boolean;gearHeight:number;mainArm:number;wheelbase:number;staticPitch:number;tailStrike:number;brakeMu:number;
 flapDetents:number[];flapLabels:string[];flapSpeeds:number[];
 vne:number;mmo:number;vr:number;vy:number;vapp:number;climbIas:number;cruiseIas:number;cruiseMach:number;ceiling:number;cruiseMax:number;maxBank:number;
 fbw:boolean;autothrottle:boolean;fuelUnit:string;model:string;modelScale:number;modelLift:number;
};
const kt=.514444;
export const AIRCRAFT:Record<AircraftId,AircraftSpec>={
 trainer:{id:'trainer',name:'Kestrel T-180',kind:'Single-engine piston trainer',summary:'High-wing four-seat trainer. 180 hp, fixed gear, 122 kt cruise. Forgiving, slow and honest.',engine:'piston',engines:1,
  empty:767,payload:170,fuelMax:144,fuelStart:110,mtow:1157,S:16.2,b:11,c:1.49,e:.75,I:[1285,1825,2667],
  cl0:.25,cla:4.9,clmax:1.72,clFlap:.62,clmaxFlap:.6,clq:3.9,cd0:.031,cdFlap:.045,cdGear:0,cdSpoiler:0,clSpoiler:0,mcrit:.6,
  cm0:.04,cma:-.89,cmq:-12.4,cmElev:.48,cmTrim:.14,cmFlap:-.06,cyb:-.31,cyRud:.06,clb:-.089,clp:-.47,clr:.096,clAil:.065,cnb:.065,cnp:-.03,cnr:-.099,cnRud:.024,cnAil:-.008,
  power:134e3,staticThrust:2700,propEff:.8,thrust:0,idle:.22,pFactor:.22,fuelFlow:.0098,
  gearRetract:false,gearHeight:1.25,mainArm:.55,wheelbase:1.65,staticPitch:.01,tailStrike:.24,brakeMu:.45,
  flapDetents:[0,1/3,2/3,1],flapLabels:['UP','10°','20°','30°'],flapSpeeds:[163,110,85,85],
  vne:163,mmo:1,vr:55,vy:74,vapp:65,climbIas:76,cruiseIas:110,cruiseMach:0,ceiling:14000,cruiseMax:8500,maxBank:25,
  fbw:false,autothrottle:false,fuelUnit:'kg avgas',model:'trainer',modelScale:1,modelLift:0},
 twin:{id:'twin',name:'Cesium Air Twin',kind:'Twin-engine piston',summary:'Six-seat piston twin. 2 × 300 hp, retractable gear, 190 kt cruise at 8,000–12,000 ft.',engine:'piston',engines:2,
  empty:1580,payload:380,fuelMax:528,fuelStart:400,mtow:2495,S:18.5,b:11.5,c:1.65,e:.78,I:[4100,5600,9100],
  cl0:.22,cla:5.1,clmax:1.48,clFlap:.6,clmaxFlap:.62,clq:4.2,cd0:.026,cdFlap:.05,cdGear:.016,cdSpoiler:0,clSpoiler:0,mcrit:.62,
  cm0:.035,cma:-.95,cmq:-14,cmElev:.5,cmTrim:.15,cmFlap:-.07,cyb:-.38,cyRud:.065,clb:-.09,clp:-.48,clr:.1,clAil:.07,cnb:.075,cnp:-.03,cnr:-.11,cnRud:.028,cnAil:-.008,
  power:224e3,staticThrust:3900,propEff:.82,thrust:0,idle:.22,pFactor:0,fuelFlow:.0155,
  gearRetract:true,gearHeight:1.45,mainArm:.65,wheelbase:2.6,staticPitch:.0,tailStrike:.22,brakeMu:.45,
  flapDetents:[0,.5,1],flapLabels:['UP','APP','DN'],flapSpeeds:[223,152,122],
  vne:223,mmo:1,vr:85,vy:105,vapp:95,climbIas:120,cruiseIas:165,cruiseMach:0,ceiling:20000,cruiseMax:12000,maxBank:30,
  fbw:false,autothrottle:false,fuelUnit:'kg avgas',model:'twin',modelScale:1,modelLift:-.15},
 jet:{id:'jet',name:'Hinode NB-200',kind:'Narrowbody twin-jet airliner',summary:'150-seat fly-by-wire airliner. 2 × 120 kN turbofans, Mach 0.78 cruise at FL350, autothrottle and autoland.',engine:'jet',engines:2,
  empty:42600,payload:15000,fuelMax:19000,fuelStart:12500,mtow:78000,S:122.6,b:35.8,c:4.19,e:.8,I:[1.25e6,3.1e6,4.2e6],
  cl0:.2,cla:5.7,clmax:1.42,clFlap:.8,clmaxFlap:1.38,clq:5,cd0:.0215,cdFlap:.075,cdGear:.018,cdSpoiler:.07,clSpoiler:.45,mcrit:.74,
  cm0:.03,cma:-1.25,cmq:-35,cmElev:.85,cmTrim:.3,cmFlap:-.12,cyb:-.75,cyRud:.08,clb:-.13,clp:-.45,clr:.16,clAil:.075,cnb:.13,cnp:-.02,cnr:-.2,cnRud:.075,cnAil:-.004,
  power:0,staticThrust:0,propEff:0,thrust:120e3,idle:.21,pFactor:0,fuelFlow:0,
  gearRetract:true,gearHeight:2.9,mainArm:1.25,wheelbase:12.6,staticPitch:.005,tailStrike:.2,brakeMu:.5,
  flapDetents:[0,.2,.45,.7,1],flapLabels:['0','1','2','3','FULL'],flapSpeeds:[350,230,200,185,177],
  vne:350,mmo:.82,vr:0,vy:0,vapp:0,climbIas:250,cruiseIas:290,cruiseMach:.78,ceiling:39800,cruiseMax:37000,maxBank:30,
  fbw:true,autothrottle:true,fuelUnit:'kg Jet A-1',model:'jet',modelScale:1,modelLift:0},
};
export const AIRCRAFT_IDS=Object.keys(AIRCRAFT) as AircraftId[];
export function spec(id:unknown):AircraftSpec{return AIRCRAFT[(typeof id==='string'&&id in AIRCRAFT?id:'twin') as AircraftId];}
export function aircraftMass(a:AircraftSpec,fuelPercent:number){return a.empty+a.payload+a.fuelMax*Math.max(0,fuelPercent)/100;}
/** Equivalent (≈ indicated) stall speed in m/s for a given mass, flap setting and load factor. */
export function stallEas(a:AircraftSpec,mass:number,flaps:number,n=1){return Math.sqrt(2*mass*9.80665*Math.max(.2,n)/(1.225*a.S*(a.clmax+a.clmaxFlap*flaps)));}
/** Reference speeds (knots indicated). Jets compute speeds from weight, light aircraft use handbook speeds. */
export function vSpeeds(a:AircraftSpec,mass:number){const vs=(f:number)=>stallEas(a,mass,f)/kt,takeoffFlap=a.flapDetents[1]??0,landFlap=a.flapDetents[a.flapDetents.length-1];
 if(a.id==='jet'){const vr=Math.round(vs(takeoffFlap)*1.1),v2=Math.round(vs(takeoffFlap)*1.2);return{vs:Math.round(vs(0)),vs0:Math.round(vs(landFlap)),v1:vr-3,vr,v2,vref:Math.round(vs(landFlap)*1.23),vapp:Math.round(vs(landFlap)*1.23+5),vy:Math.round(Math.max(250,vs(0)*1.7)),green:Math.round(vs(0)*1.28)};}
 return{vs:Math.round(vs(0)),vs0:Math.round(vs(landFlap)),v1:a.vr,vr:a.vr,v2:a.vy,vref:Math.round(Math.max(a.vapp-5,vs(landFlap)*1.3)),vapp:a.vapp,vy:a.vy,green:a.vy};}
/** Maximum still-air range estimate in km with reserves, for flight planning warnings. */
export function rangeKm(a:AircraftSpec){return {trainer:1150,twin:1700,jet:5600}[a.id]*(a.fuelStart/a.fuelMax)/.76;}
export function cruiseAltitudeFt(a:AircraftSpec,distanceKm:number){const nm=distanceKm/1.852,raw=a.engine==='jet'?nm*130:nm*60,alt=Math.min(a.cruiseMax,Math.max(3000,raw));return a.engine==='jet'?Math.round(alt/1000)*1000:Math.round(alt/500)*500;}
