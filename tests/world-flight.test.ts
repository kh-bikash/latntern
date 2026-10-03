import test from 'node:test';
import assert from 'node:assert/strict';
import {airportSearch,airports,createWorld,joinWorld,worldAction} from '../lib/worldFlightServer';
import {airportRunway,airportEnds,findEnd,geoDistance,geoMove,geoBearing,nearRunway,worldSpawn,stepWorld,type Airport,type WorldInput,type WorldPlane} from '../lib/worldFlight';
import {AIRCRAFT,spec,vSpeeds,aircraftMass,type AircraftId} from '../lib/aircraft';
import {autopilot,buildPlan,newAutopilot,type RunwayRef} from '../lib/autopilot';
import {setTurbulenceRandom} from '../lib/flightModel';
import {atmosphere,altimeter,windAt,presetWeather,activeRunway,reciprocal,buildWeather,atis,type Weather} from '../lib/weather';
const kt=.514444,input:WorldInput={pitch:0,roll:0,rudder:0,throttle:1,brake:false,flaps:0,trim:0,stability:false,gear:true,engine:true};
const get=async(id:string)=>(await airportSearch(id)).find(a=>a.id===id)!;
const ref=(a:Airport,e:ReturnType<typeof findEnd>):RunwayRef=>({ident:e.ident,lat:e.lat,lon:e.lon,heading:e.heading,elevation:a.elevation,length:e.length,airport:a.id});
const flat:Airport={id:'TEST',iata:'',name:'Test',type:'large_airport',country:'',city:'',lat:0,lon:0,elevation:0,runways:[{name:'09',length:4000,width:45,surface:'ASP',lat:0,lon:-.02,heading:90,endLat:0,endLon:.016}]};
/** Fly a complete copilot flight and return what happened. */
async function fly(id:AircraftId,from:Airport,to:Airport,wx:Weather|null=null,limit=3*3600){
 const de=activeRunway(airportEnds(from),wx),ae=activeRunway(airportEnds(to),wx),a=spec(id),p=worldSpawn(from,0,0,id,'runway',de.ident),plan=buildPlan(ref(from,de),ref(to,ae),a),ap=newAutopilot(de.heading,plan.cruiseFt,250,wx?.qnh??1013);ap.copilot=true;
 const inp:any={...input,throttle:0,flaps:p.flaps,autoRudder:true};let touchdown=null,crash=null,maxAlt=0,liftoff=false;
 for(let t=0;t<limit&&ap.stage!=='LANDED';t+=.05){const ground=geoDistance(p,from)<geoDistance(p,to)?from.elevation:to.elevation,o=autopilot(p,ap,plan,inp,wx,ground,.05);
  for(const k of ['throttle','flaps','gear','spoilers','brake','reverse','autobrake'] as const)if(o[k]!==undefined)inp[k]=o[k];inp.targets=o.targets;
  const e=stepWorld(p,.05,inp,ground,nearRunway(p,[from,to]),wx);if(e.liftoff)liftoff=true;if(e.touchdown)touchdown=e.touchdown;if(e.crash){crash=e.crash;break;}maxAlt=Math.max(maxAlt,p.alt);}
 return{p,ap,plan,touchdown,crash,maxAlt,liftoff,arrival:ae};}
test('the worldwide catalog includes major airports, both runway directions and great-circle geometry',async()=>{const list=await airports();assert(list.length>70000);for(const id of ['RJTT','KJFK','EGLL','LFPG','VABB','VEIM','YSSY']){const a=await get(id);assert(a);const r=airportRunway(a);assert(r.length>500);const ends=airportEnds(a);assert(ends.length>=2);assert(ends.some(e=>Math.abs(((e.heading-r.heading+540)%360)-180)>170));}
 assert.equal(reciprocal('16L'),'34R');assert.equal(reciprocal('04'),'22');assert.equal(reciprocal('36'),'18');const jfk=await get('KJFK'),lhr=await get('EGLL');assert(geoDistance(jfk,lhr)>5500000&&geoDistance(jfk,lhr)<5600000);const moved=geoMove(0,179.999,90,5000);assert(moved.lon<0);assert(Math.abs(geoBearing({lat:0,lon:179.999},moved)-90)<.01);});
test('the ISA atmosphere, altimeter and winds aloft follow standard values',()=>{const sl=atmosphere(0),fl350=atmosphere(10668),trop=atmosphere(11000);assert(Math.abs(sl.rho-1.225)<.002);assert(Math.abs(sl.a-340.3)<.5);assert(Math.abs(trop.T-216.65)<.1);assert(Math.abs(fl350.p-23842)<150);assert(Math.abs(altimeter(atmosphere(1500).p,1013.25)-1500)<1);
 const hot=presetWeather('clear',0);hot.temp=35;assert(atmosphere(1000,hot).rho<atmosphere(1000).rho,'hot day reduces density');const low={...presetWeather('clear',0),qnh:990};assert(altimeter(atmosphere(500,low).p,1013.25)>altimeter(atmosphere(500,low).p,990)+150,'wrong baro setting misreads altitude');
 const w=presetWeather('windy',0),sfc=windAt(w,5),aloft=windAt(w,3000);assert(aloft.speed>sfc.speed*1.5);assert(sfc.speed<w.winds[0].speed);const n=windAt({...w,winds:[{alt:10,dir:360,speed:10}]},10);assert(n.n<-9.9,'a north wind blows toward the south');});
test('real METAR decoding, active runway selection and ATIS',()=>{const metar={icaoId:'RJTT',wdir:340,wspd:18,wgst:28,temp:9,dewp:2,altim:1004,visib:'3',wxString:'-RA',clouds:[{cover:'BKN',base:1500},{cover:'OVC',base:3000}],rawOb:'METAR RJTT 030000Z 34018G28KT 5000 -RA BKN015 OVC030 09/02 Q1004'};const wx=buildWeather(metar,null,11);assert.equal(wx.qnh,1004);assert(Math.abs(wx.winds[0].speed-18*kt)<.01);assert.equal(wx.precip,'rain');assert.equal(wx.clouds.length,2);assert(Math.abs(wx.clouds[0].base-(11+1500*.3048))<.1);
 const ends=[{ident:'16L',lat:0,lon:0,heading:150,length:3360,width:60,endLat:0,endLon:0,surface:'ASP'},{ident:'34R',lat:0,lon:0,heading:330,length:3360,width:60,endLat:0,endLon:0,surface:'ASP'}];assert.equal(activeRunway(ends,wx).ident,'34R');assert.equal(activeRunway(ends,{...wx,winds:[{alt:10,dir:160,speed:9}]}).ident,'16L');
 const text=atis('Tokyo',wx,'34R','ILS');assert.match(text,/34R/);assert.match(text,/Q N H 1004/);assert.match(text,/gusting 28/);});
test('published-class performance: takeoff roll, climb, top speed and stall for each aircraft',()=>{
 const expected={trainer:{roll:[200,420],roc:[550,1100]},twin:{roll:[380,800],roc:[1000,2100]},jet:{roll:[1000,2100],roc:[2000,5000]}};
 for(const id of ['trainer','twin','jet'] as const){const a=spec(id),p=worldSpawn(flat,0,0,id,'runway','09'),v=vSpeeds(a,aircraftMass(a,p.fuel)),i:WorldInput={...input,flaps:a.flapDetents[1]??0};let liftoff=-1;
  for(let n=0;n<2400&&liftoff<0;n++){i.pitch=(p.ias??0)/kt>=v.vr?.35:0;const e=stepWorld(p,.05,i,0,nearRunway(p,[flat]));if(e.liftoff)liftoff=p.distance;}
  assert(liftoff>expected[id].roll[0]&&liftoff<expected[id].roll[1],`${id} takeoff roll ${liftoff}`);
  // Hold best-rate climb speed with an attitude target, flaps and gear up.
  i.flaps=0;i.gear=false;i.pitch=0;let th=.12;const climb=id==='jet'?250:a.vy,vs:number[]=[];for(let n=0;n<3600;n++){const ias=(p.ias??0)/kt;if(p.alt>150)th=Math.max(-.05,Math.min(.3,th+(ias-climb)*.00025));i.targets={pitch:th,bank:0};stepWorld(p,.05,i,0,null);if(n>2400)vs.push(p.vertical*196.85);}
  const roc=vs.reduce((x,y)=>x+y)/vs.length;assert(!p.crashed,`${id} ${p.crashed}`);assert(roc>expected[id].roc[0]&&roc<expected[id].roc[1],`${id} climb ${roc}`);assert(p.fuel<100);}
 // Without a fly-by-wire envelope, a sustained pull at idle stalls a light aircraft near its handbook speed.
 const s=worldSpawn(flat,0,0,'trainer');Object.assign(s,{ground:false,airborne:true,alt:1500,vn:0,ve:45,vd:0,speed:45,heading:90,flaps:0});let stallKt=0;for(let n=0;n<2400&&!stallKt;n++){stepWorld(s,.05,{...input,throttle:0,pitch:Math.min(1,n/1200)},0,null);if(s.stall)stallKt=(s.ias??0)/kt;}assert(stallKt>35&&stallKt<55,`trainer stall ${stallKt}`);
 // The airliner's fly-by-wire alpha protection prevents a stall with full back stick.
 const j=worldSpawn(flat,0,0,'jet');Object.assign(j,{ground:false,airborne:true,alt:3000,vn:0,ve:120,vd:0,speed:120,heading:90,flaps:0,gear:false,gearPos:0});let stalled=false;for(let n=0;n<1600;n++){stepWorld(j,.05,{...input,throttle:0,gear:false,pitch:1},0,null);stalled||=!!j.stall;}assert(!stalled,'alpha protection');});
test('crashes are detected: gear-up landing, hard impact and wingtip strike freeze the aircraft',()=>{
 const mk=(id:AircraftId,extra:Partial<WorldPlane>)=>{const p=worldSpawn(flat,0,0,id);Object.assign(p,{ground:false,airborne:true,alt:20,vn:0,ve:70,vd:1,speed:70,heading:90,pitch:.05,flaps:1},extra);return p;};
 const run=(p:WorldPlane,i:Partial<WorldInput>={})=>{for(let n=0;n<600&&!p.crashed&&!p.ground;n++)stepWorld(p,.05,{...input,throttle:0,flaps:1,...i},0,nearRunway(p,[flat]));return p;};
 assert.match(run(mk('twin',{gear:false,gearPos:0,lat:0,lon:-.01,vd:2.5,pitch:-.02}),{gear:false,pitch:-.25}).crashed??'',/GEAR-UP/);
 assert.match(run(mk('jet',{vd:9,lat:0,lon:-.01})).crashed??'',/HARD IMPACT/);
 assert.match(run(mk('twin',{roll:.5,vd:2,lat:0,lon:-.01,law:{ph:.5,th:.05}})).crashed??'',/WINGTIP/);
 const water=mk('trainer',{lat:1,lon:1,vd:2,pitch:-.05});for(let n=0;n<600&&!water.crashed;n++)stepWorld(water,.05,{...input,throttle:0,pitch:-.2},0,null,null,true);assert.match(water.crashed??'',/DITCHED/);
 const frozen={...water};stepWorld(water,.05,input,0,null);assert.equal(water.lat,frozen.lat);});
for(const id of Object.keys(AIRCRAFT) as AircraftId[])test(`the ${id} copilot flies Haneda to Narita: takeoff, climb, cruise, ILS approach and autoland`,async()=>{
 const r=await fly(id,await get('RJTT'),await get('RJAA'));assert.equal(r.crash,null,String(r.crash));assert(r.liftoff);assert(r.maxAlt*3.28084>2500);assert(r.touchdown,'must touch down');const td=r.touchdown!;
 assert(td.fpm<400,`sink ${td.fpm} fpm`);assert(Math.abs(td.centerline??99)<12,`centerline ${td.centerline}`);assert(td.fromThreshold!>100&&td.fromThreshold!<1200,`touchdown ${td.fromThreshold} m past threshold`);assert.equal(r.ap.stage,'LANDED');assert(nearRunway(r.p,[await get('RJAA')]));});
test('the airliner lands in gusty crosswind and turbulence using real-weather runway selection',async()=>{let seed=20261003;setTurbulenceRandom(()=>((seed=Math.imul(seed^seed>>>15,2246822507)+0x6d2b79f5|0)>>>0)/4294967296);const from=await get('KSFO'),to=await get('KOAK'),wx=presetWeather('windy',to.elevation);wx.winds[0]={alt:to.elevation+10,dir:300,speed:9};
 const r=await fly('jet',from,to,wx);assert.equal(r.crash,null,String(r.crash));assert(r.touchdown);assert(r.touchdown!.fpm<750,`sink ${r.touchdown!.fpm}`);assert(Math.abs(r.touchdown!.centerline??99)<15,`centerline ${r.touchdown!.centerline}`);setTurbulenceRandom(Math.random);});
test('two world pilots authenticate, fly different aircraft, share movement and recover independently',async()=>{const a=await createWorld('Aoi','RJTT','RJAA',{aircraft:'jet',start:'runway',runway:'34R'}),b=await joinWorld(a.room.code,'Ren','trainer');assert.deepEqual(b.room.names,['Aoi','Ren']);assert.equal(b.room.planes[0].aircraft,'jet');assert.equal(b.room.planes[1].aircraft,'trainer');assert(!JSON.stringify(b.room).includes(a.token));
 await assert.rejects(()=>worldAction(a.room.code,'bad','get'),/Join/);await assert.rejects(()=>joinWorld(a.room.code,'Third'),/occupied/);
 const p={...a.room.planes[0],...geoMove(a.room.planes[0].lat,a.room.planes[0].lon,30,15),engine:true,throttle:.8,speed:60};await worldAction(a.room.code,a.token,'move',p);const observed=await worldAction(a.room.code,b.token,'get');assert(geoDistance(observed.planes[0],p)<.001);assert.equal(observed.planes[0].engine,true);
 await assert.rejects(()=>worldAction(a.room.code,a.token,'move',{...p,lat:Infinity}),/Invalid/);const fast=await worldAction(a.room.code,a.token,'move',{...p,speed:230});assert(fast.planes[0].speed>200,'airliner cruise speeds are accepted');
 const recovered=await worldAction(a.room.code,a.token,'recover');assert.equal(recovered.planes[0].recovery,1);assert.equal(recovered.planes[1].recovery,0);assert.equal(recovered.planes[0].speed,0);assert.equal(recovered.planes[0].aircraft,'jet');});
