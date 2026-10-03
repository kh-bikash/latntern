'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as MapLibreMap,StyleSpecification,GeoJSONSource} from 'maplibre-gl';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {buildDeck,drawFcu,drawGliderGauges,type Deck} from './Cockpits';
import {drawPanel,drawPFD,drawND,drawEICAS,type AvionicsData,type NavPoint} from './Avionics';
import {aircraftModelUrl} from './AircraftModels';
import {airfieldArt,papiLights,pointsGeoJSON,ThreeClouds,ThreeTraffic,WeatherOverlay,sunElevation,sunAzimuth,type LiveTraffic,type TrafficModel,type Airfield} from './worldScene';
import {ThreeLayer,wrapModel,type Placed} from './threeLayer';
import {OsmScenery} from './osmScenery';
import type {Sim,Telemetry,TimePreset} from './sim';
import {AircraftAudio,Speaker} from '@/lib/aircraftAudio';
import {demProtocol,groundInfo,flattenAirport} from '@/lib/worldTerrain';
import {geoDistance,geoBearing,geoMove,nearRunway,stepWorld,worldStallSpeed,type Airport,type WorldRoom,type WorldPlane} from '@/lib/worldFlight';
import {spec,vSpeeds,aircraftMass,AIRCRAFT,type ModelInfo,type AircraftId} from '@/lib/aircraft';
import {autopilot,indicatedAlt,glidePath,planRemaining,newAutopilot,shortMode} from '@/lib/autopilot';
import {atmosphere,windAt} from '@/lib/weather';
import {loadMetars,loadModel,weatherAt,type Metar} from '@/lib/weatherClient';
import {clamp} from '@/lib/flight';

export type View={camera:number;clean:boolean;panel:boolean};
export type CanvasEvent={type:'touchdown';data:import('@/lib/flightModel').Touchdown;atArrival:boolean}|{type:'crash';reason:string}|{type:'ap';text:string};
export type Preview={lat:number;lon:number;elevation:number;heading:number}|null;
type Quality='performance'|'balanced'|'high';
type Props={room:WorldRoom|null;sim:Sim|null;view:View;sound:boolean;paused:boolean;shared:boolean;preview?:Preview;quality?:Quality;googleKey?:string;onMove:(p:WorldPlane)=>void;onTelemetry:(t:Telemetry)=>void;onEvent:(e:CanvasEvent)=>void;onError:(s:string)=>void};
type Engine={map:MapLibreMap;layer:ThreeLayer;scenery:OsmScenery;setTime:(date:Date,lat:number,lon:number,vis:number)=>{sunEl:number;day:number}};
const kt=.514444,ft=.3048,rad=Math.PI/180,EMPTY={type:'FeatureCollection' as const,features:[]};
// glTF loading with meshopt geometry; each model file is parsed once and cloned per aircraft.
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);const modelCache=new Map<string,Promise<THREE.Object3D>>();
async function modelObject(m:ModelInfo){const url=m.url.startsWith('proc:')?await aircraftModelUrl(m.url.slice(5) as 'trainer'|'jet'):m.url;let p=modelCache.get(url);if(!p){p=loader.loadAsync(url).then(g=>{g.scene.traverse(o=>{const mesh=o as THREE.Mesh;const mats=mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];for(const mt of mats as THREE.MeshStandardMaterial[]){if('metalness' in mt){mt.metalness=Math.min(mt.metalness??0,.15);mt.roughness=Math.max(.35,Math.min(mt.roughness??.6,.7));}}});return g.scene;});modelCache.set(url,p);}return wrapModel((await p).clone(true),m.heading===180);}
const trafficModel=(id:string):TrafficModel=>{const m=AIRCRAFT[id as AircraftId]?.model??AIRCRAFT.jet.model;return{object:()=>modelObject(m),ground:m.ground,scale:m.scale};};
function timeFor(preset:TimePreset,lat:number,lon:number){const now=new Date();if(preset==='live')return now;const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));const solar=(h:number)=>new Date(day.getTime()+((h-lon/15+48)%24)*3600000);
 if(preset==='dawn'||preset==='sunset'){let best=solar(preset==='dawn'?6:18),score=1e9;for(let h=preset==='dawn'?3:14;h<(preset==='dawn'?11:22);h+=1/12){const d=solar(h),e=sunElevation(d,lat,lon),want=preset==='dawn'?3:2.5,s=Math.abs(e-want);if(s<score){score=s;best=d;}}return best;}
 return solar({morning:9,noon:12.5,afternoon:15.5,night:23}[preset] as number);}
const blend=(a:number[],b:number[],t:number)=>a.map((v,i)=>Math.round(v+(b[i]-v)*clamp(t,0,1))),css=(c:number[])=>`rgb(${c.join(',')})`;
/** MapLibre style: open satellite imagery, national orthophotos where available, open terrain and airfield layers. */
function buildStyle():StyleSpecification{const raster=(tiles:string,maxzoom:number,bounds?:[number,number,number,number],attribution?:string)=>({type:'raster' as const,tiles:[tiles],tileSize:256,maxzoom,bounds,attribution});
 return{version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources:{sat:raster('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false',19,undefined,'Imagery © Esri, Maxar, Earthstar Geographics'),
   ign:raster('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',18,[-5.2,41.3,9.6,51.1],'IGN-F'),
   swiss:raster('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',18,[5.9,45.8,10.5,47.85],'© swisstopo'),pdok:raster('https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',18,[3.3,50.7,7.3,53.6],'PDOK'),
   night:raster('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',8,undefined,'NASA VIIRS Black Marble'),
   dem:{type:'raster-dem',tiles:['flatdem://{z}/{x}/{y}'],tileSize:256,maxzoom:15,encoding:'terrarium',attribution:'Mapzen terrain (SRTM, GMTED, ETOPO1) · 3D buildings © OpenStreetMap contributors via OpenFreeMap'},
   lights:{type:'geojson',data:EMPTY},papi:{type:'geojson',data:EMPTY},labels:{type:'geojson',data:EMPTY}},
  layers:[{id:'bg',type:'background',paint:{'background-color':'#3d5a68'}},{id:'sat',type:'raster',source:'sat',paint:{'raster-contrast':.08,'raster-saturation':.1,'raster-fade-duration':120}},...['ign','swiss','pdok'].map(id=>({id,type:'raster' as const,source:id,paint:{'raster-fade-duration':120}})),
   {id:'night',type:'raster',source:'night',paint:{'raster-opacity':0}},
   {id:'lights',type:'circle',source:'lights',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],11,['*',['get','size'],.35],15,['get','size'],19,['*',['get','size'],2.4]],'circle-blur':.6,'circle-opacity':0,'circle-pitch-alignment':'viewport'}},
   {id:'papi',type:'circle',source:'papi',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],11,2,15,4,19,7],'circle-blur':.5,'circle-pitch-alignment':'viewport'}},
   {id:'labels',type:'symbol',source:'labels',layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,-2.2],'text-allow-overlap':true},paint:{'text-color':'#c9f2ff','text-halo-color':'#04121a','text-halo-width':1.4}}],
  terrain:{source:'dem',exaggeration:1},
  sky:{'sky-color':'#5b9be0','horizon-color':'#d6e6f2','fog-color':'#d8e4ec','sky-horizon-blend':.6,'horizon-fog-blend':.7,'fog-ground-blend':.75,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,8,1,11,0]}} as StyleSpecification;}
/** One map for the whole session: planner and flights reuse it, so tiles stay cached. */
async function createEngine(el:HTMLElement,q:Quality):Promise<Engine>{const maplibregl=await import('maplibre-gl');maplibregl.setWorkerUrl('/flight/maplibre/maplibre-gl-worker.mjs');
 try{maplibregl.addProtocol('flatdem',demProtocol() as never);}catch{}
 const map=new maplibregl.Map({container:el,style:buildStyle(),center:[139.6,35.3],zoom:8,pitch:60,bearing:20,maxPitch:120,maxZoom:23,interactive:false,attributionControl:{compact:true},fadeDuration:q==='performance'?0:150,maxTileCacheSize:q==='performance'?200:600,pixelRatio:q==='performance'?1:q==='high'?Math.min(2,devicePixelRatio):Math.min(1.5,devicePixelRatio),canvasContextAttributes:{antialias:q!=='performance',powerPreference:'high-performance'}});
 await new Promise<void>(res=>map.once('load',()=>res()));
 const layer=new ThreeLayer((lon,lat,alt)=>maplibregl.MercatorCoordinate.fromLngLat([lon,lat],alt));map.addLayer(layer);const scenery=new OsmScenery(layer,q);
 let lastKey='';const setTime=(date:Date,lat:number,lon:number,vis:number)=>{const el2=sunElevation(date,lat,lon),az=sunAzimuth(date,lat,lon),day=clamp((el2+4)/14,0,1),dusk=clamp(1-Math.abs(el2-2)/10,0,1),fog=clamp(1-vis/30000,0,1);
  layer.setSun(az,el2,day);scenery.setLight(az,el2,day);const key=`${day.toFixed(2)}|${dusk.toFixed(2)}|${fog.toFixed(2)}`;if(key!==lastKey){lastKey=key;
   const hz=blend(blend([18,24,40],[214,230,242],day),[246,170,110],dusk*.7);
   map.setSky({'sky-color':css(blend([6,10,22],[91,155,224],day)),'horizon-color':css(hz),'fog-color':css(blend([20,24,32],[214,224,232],day)),'sky-horizon-blend':.6,'horizon-fog-blend':.55+fog*.4,'fog-ground-blend':Math.max(.08,.75-fog*.7),'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,8,1,11,0]} as never);
   for(const id of ['sat','ign','swiss','pdok'])map.setPaintProperty(id,'raster-brightness-max',.12+.88*day);map.setPaintProperty('night','raster-opacity',(1-day)*.85);map.setPaintProperty('lights','circle-opacity',day<.55||vis<5000?1:0);}
  return{sunEl:el2,day};};
 return{map,layer,scenery,setTime};}
/** Camera placed at a position with heading, pitch (0 = level) and roll, in MapLibre's free-camera terms. */
function placeCamera(map:MapLibreMap,lat:number,lon:number,alt:number,heading:number,pitchDeg:number,roll:number){try{map.jumpTo(map.calculateCameraOptionsFromCameraLngLatAltRotation([lon,lat],alt,heading,clamp(90+pitchDeg,0,120),roll));}catch{}}
export default function WorldCanvas(props:Props){
 const mount=useRef<HTMLDivElement>(null),cockpitMount=useRef<HTMLDivElement>(null),panelRef=useRef<HTMLCanvasElement>(null),fxRef=useRef<HTMLCanvasElement>(null),live=useRef(props);live.current=props;const engineRef=useRef<Promise<Engine>|null>(null);
 const [loading,setLoading]=useState<string|null>('Loading the map…');const loadingRef=useRef(loading);loadingRef.current=loading;const setLoadingNull=()=>{loadingRef.current=null;setLoading(null);};
 // Map lifetime and planner preview: orbit the departure airport while the player plans, warming the tile cache.
 useEffect(()=>{if(!mount.current)return;const p=createEngine(mount.current,live.current.quality??'balanced');engineRef.current=p;let dead=false,frame=0,orbit=0,last=performance.now(),timeAt=0;
  void p.then(e=>{if(dead)return;setLoadingNull();const tick=(now:number)=>{if(dead)return;frame=requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;if(live.current.room)return;const pv=live.current.preview;
   if(now-timeAt>3000&&pv){timeAt=now;e.setTime(new Date(),pv.lat,pv.lon,40000);}
   if(pv){orbit+=dt*2.5;const h=pv.heading+150+orbit,c=geoMove(pv.lat,pv.lon,h+180,2400);e.layer.center={lon:pv.lon,lat:pv.lat};placeCamera(e.map,c.lat,c.lon,pv.elevation+700,h,-16,0);e.scenery.update(pv.lat,pv.lon,600,true);e.layer.repaint();}
   else e.map.setBearing(e.map.getBearing()+dt*1.5);};frame=requestAnimationFrame(tick);}).catch(err=>{setLoadingNull();live.current.onError(err instanceof Error?err.message:'The map could not start.');});
  return()=>{dead=true;cancelAnimationFrame(frame);void p.then(e=>{e.scenery.destroy();e.map.remove();}).catch(()=>{});};},[]);
 // One flight on the shared map: aircraft, airfields, scenery, cockpit, physics and systems.
 useEffect(()=>{const room=props.room,sim=props.sim;if(!room||!sim||!engineRef.current)return;
  let dead=false,frame=0,audio:AircraftAudio|undefined,renderer:THREE.WebGLRenderer|undefined,cockpitScene:THREE.Scene|undefined;const smooth={p:0,r:0,y:0,gp:0,gr:0},camSpring={h:NaN,p:0,range:30};const ramp=(v:number,target:number,dt:number)=>{if(target===0){const d=dt*4.5;return Math.abs(v)<=d?0:v-Math.sign(v)*d;}if(v!==0&&Math.sign(v)!==Math.sign(target))return v+Math.sign(target)*dt*8;const rate=Math.abs(v)<.4?2.2:1.1,next=v+Math.sign(target)*rate*dt;return Math.abs(next)>Math.abs(target)?target:next;};const keys=new Set<string>(),look={yaw:0,pitch:0,zoom:1,orbit:0};let drag=false,lastPointer=[0,0];const speaker=new Speaker();const cleanups:(()=>void)[]=[];
  const keydown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.matches('input[type=text],input[type=search],input[type=password],input:not([type]),textarea,select'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Slash','F2','Period','PageUp','PageDown'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Home')look.yaw=look.pitch=0;
   const sim=live.current.sim;if(!sim||e.repeat||live.current.paused)return;const a=spec(sim.aircraft),i=sim.input,ap=sim.ap,det=a.flapDetents;
   const nearest=det.reduce((b,v,k)=>Math.abs(v-i.flaps)<Math.abs(det[b]-i.flaps)?k:b,0);
   switch(e.code){case 'KeyI':i.engine=!i.engine;break;case 'KeyE':if(e.ctrlKey){e.preventDefault();i.engine=true;i.parking=false;}break;case 'KeyG':if(a.gearRetract)i.gear=!i.gear;break;case 'KeyV':i.flaps=det[clamp(nearest+(e.shiftKey?-1:1),0,det.length-1)];break;
    case 'Slash':i.spoilers=i.spoilers>.75?0:i.spoilers+.5;break;case 'KeyF':case 'F2':if(a.engine==='jet'||a.engine==='turboprop')i.reverse=!i.reverse;break;case 'Period':if(e.ctrlKey)i.parking=!i.parking;break;
    case 'KeyP':ap.master=!ap.master;ap.copilot=false;if(ap.master){if(ap.lat==='TO'||ap.lat==='ROLLOUT')ap.lat='HDG';if(ap.vert==='TO'||ap.vert==='PIT'||ap.vert==='FLARE')ap.vert='VS';}live.current.onEvent({type:'ap',text:ap.master?'AUTOPILOT ON':'AUTOPILOT OFF'});audio?.tone(ap.master?'click':'ap');break;
    case 'KeyT':ap.athr=!ap.athr;break;case 'KeyB':if(e.shiftKey)ap.std=!ap.std;else{ap.baro=Math.round(sim.wx?.qnh??1013);ap.std=false;}break;
    case 'BracketLeft':case 'Numpad1':i.trim=clamp(i.trim-.04,-1,1);break;case 'BracketRight':case 'Numpad7':i.trim=clamp(i.trim+.04,-1,1);break;}};
  const keyup=(e:KeyboardEvent)=>keys.delete(e.code),blur=()=>{keys.clear();drag=false;};window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  const el=mount.current;const pointerDown=(e:PointerEvent)=>{if(e.button!==0)return;drag=true;lastPointer=[e.clientX,e.clientY];el?.setPointerCapture(e.pointerId);},pointerMove=(e:PointerEvent)=>{if(!drag)return;const dx=e.clientX-lastPointer[0],dy=e.clientY-lastPointer[1];if(live.current.view.camera===1){look.yaw=clamp(look.yaw+dx*.16,-150,150);look.pitch=clamp(look.pitch-dy*.13,-40,50);}else{look.orbit+=dx*.3;look.pitch=clamp(look.pitch-dy*.15,-60,70);}lastPointer=[e.clientX,e.clientY];},pointerUp=()=>{drag=false;},wheel=(e:WheelEvent)=>{e.preventDefault();look.zoom=clamp(look.zoom*(e.deltaY>0?1.1:.9),.3,6);};
  el?.addEventListener('pointerdown',pointerDown);el?.addEventListener('pointermove',pointerMove);el?.addEventListener('pointerup',pointerUp);el?.addEventListener('pointercancel',pointerUp);el?.addEventListener('wheel',wheel,{passive:false});
  async function init(){try{
   setLoading('Loading aircraft…');const E=await engineRef.current!;if(dead)return;const {map,layer}=E;
   flattenAirport(room!.departure);flattenAirport(room!.arrival);
   const a=spec(sim!.aircraft),m=a.model,craftObj=await modelObject(m);if(dead)return;const craft=layer.add(craftObj,{scale:m.scale});cleanups.push(()=>layer.remove(craft,false));
   // Aircraft lights: nav (red/green/white), beacon, strobes and landing light as screen-sized points on the airframe.
   const pt=(x:number,y:number,z:number,c:string,size:number)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x,y,z],3));const p=new THREE.Points(g,new THREE.PointsMaterial({color:c,size,sizeAttenuation:false,transparent:true,depthWrite:false}));craftObj.add(p);return p;};
   const half=a.b/2/m.scale,len=m.length/m.scale,navL=pt(-half,-len*.05,0,'#ff2a2a',5),navR=pt(half,-len*.05,0,'#2aff5a',5),tail=pt(0,-len*.5,.5,'#ffffff',4),beacon=pt(0,0,len*.06,'#ff2020',6),strobes=[pt(-half,-len*.06,0,'#ffffff',8),pt(half,-len*.06,0,'#ffffff',8)],landing=pt(0,len*.42,-.4,'#fffbe8',9);
   const fields=new Set<string>();let lights:{lat:number;lon:number;color:string;size:number}[]=[],papi:{lat:number;lon:number;angle:number;alt:number}[]=[];const imageIds:string[]=[];
   const addField=(ap:Airfield,detail:boolean,landingRw?:string)=>{if(fields.has(ap.id))return;fields.add(ap.id);const f=airfieldArt(ap,detail,landingRw);lights=lights.concat(f.lights);papi=papi.concat(f.papi);
    for(const img of f.images){if(map.getSource(img.id))continue;map.addSource(img.id,{type:'image',url:img.url,coordinates:img.coordinates});map.addLayer({id:img.id,type:'raster',source:img.id,paint:{'raster-fade-duration':0}},'night');imageIds.push(img.id);}
    (map.getSource('lights') as GeoJSONSource).setData(pointsGeoJSON(lights));};
   addField(room!.departure,true,room!.runway);addField(room!.arrival,true,sim!.plan.arrival.ident);
   cleanups.push(()=>{for(const id of imageIds){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}for(const s of ['lights','papi','labels'])(map.getSource(s) as GeoJSONSource|undefined)?.setData(EMPTY);});
   const clouds=new ThreeClouds(layer),traffic=new ThreeTraffic(layer,trafficModel);let remote:Placed|undefined,remoteKind='';cleanups.push(()=>{clouds.destroy();traffic.destroy();if(remote)layer.remove(remote,false);});
   const overlay=fxRef.current?new WeatherOverlay(fxRef.current):null;cleanups.push(()=>{const c=fxRef.current;c?.getContext('2d')?.clearRect(0,0,c.width,c.height);});
   // Flight deck: a 3D cockpit for the aircraft class, drawn over the map from the pilot's eye.
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;cockpitMount.current?.appendChild(renderer.domElement);
   const built=buildDeck(m.cockpit,renderer,{sidestick:a.fbw&&/Airbus/.test(a.name),engines:a.engines,airbus:/Airbus/.test(a.name)}),deck:Deck=built.deck;cockpitScene=built.scene;const camera3=new THREE.PerspectiveCamera(70,1,.03,40);
   let plane:WorldPlane={...room!.planes[room!.seat]},recovery=plane.recovery,last=performance.now(),send=0,telemetryAt=0,elapsed=0,ground=room!.departure.elevation,water=false,groundReady=false,groundRequest=0,terrainNotice=false,lastTime='',panelAt=0,cloudAt=0,wxAt=0,wxPos={lat:999,lon:999},trafficAt=0,nearAt={lat:999,lon:999},flash=0,lastRadio=99999,callouts=new Set<string>(),gpwsAt=0,sceneryAt=0,papiAt=0,labelAt=0,simClock=Date.now(),sunInfo={sunEl:30,day:1};
   const airports:Airport[]=[room!.departure,room!.arrival];let metars:Metar[]=[],modelWx:any=null,nearby:Airport[]=[];
   const refreshWeather=async()=>{wxPos={lat:plane.lat,lon:plane.lon};const [mt,w]=await Promise.all([loadMetars([room!.departure.id,room!.arrival.id],plane),sim!.settings.weather==='live'?loadModel(plane.lat,plane.lon):Promise.resolve(null)]);if(dead)return;metars=mt;modelWx=w;if(sim!.settings.weather!=='live'||metars.length||modelWx)sim!.wx=weatherAt(sim!.settings.weather,plane,metars,modelWx,ground);};
   sim!.wx??=weatherAt(sim!.settings.weather,plane,[],null,room!.departure.elevation);void refreshWeather();
   const terrainAt=(lat:number,lon:number)=>map.queryTerrainElevation([lon,lat])??ground;
   const readyBy=performance.now()+4500;E.scenery.update(plane.lat,plane.lon,Math.max(0,plane.alt-ground));
   const render=(now:number)=>{if(dead||!renderer||!cockpitScene)return;frame=requestAnimationFrame(render);const P=live.current,r=P.room,S=P.sim;if(!r||!S)return;const realDt=Math.min(.25,(now-last)/1000);last=now;
    if(loadingRef.current&&(groundReady&&map.areTilesLoaded()||now>readyBy))setLoadingNull();
    const rate=P.shared?1:clamp(S.settings.simRate,1,16),dt=realDt*rate,i=S.input,ap=S.ap,wx=S.wx;
    if(r.planes[r.seat].recovery!==recovery){plane={...r.planes[r.seat]};recovery=plane.recovery;ground=r.departure.elevation;look.yaw=look.pitch=0;S.ap=newAutopilot(Math.round(plane.heading),S.plan.cruiseFt,ap.spd,ap.baro);S.plan.active=1;Object.assign(i,{throttle:0,flaps:plane.flaps,gear:true,engine:plane.engine,spoilers:0,reverse:false,parking:false});callouts.clear();}
    // Terrain below the aircraft: rendered map elevation first, sampled open terrain as fallback; airports flattened in both.
    const h=map.queryTerrainElevation([plane.lon,plane.lat]);if(h!==null&&h!==undefined){ground=h;groundReady=true;}
    if(now-groundRequest>1000){groundRequest=now;void groundInfo(plane.lat,plane.lon).then(gi=>{if(dead)return;water=gi.water;if(h===null||h===undefined){ground=gi.height;groundReady=true;}}).catch(()=>{if(!terrainNotice){P.onError('Some terrain tiles are unavailable. Scenery will retry; avoid low flight until terrain loads.');terrainNotice=true;}});}
    const pad=navigator.getGamepads?.().find(gp=>gp?.connected),axis=(k:number)=>pad&&Math.abs(pad.axes[k]??0)>.12?pad.axes[k]:0;
    const expo=(x:number)=>x*(.3+.7*x*x);smooth.p=ramp(smooth.p,clamp(((keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0))*(S.settings.invertPitch?-1:1)+S.touch.pitch,-1,1),realDt);smooth.r=ramp(smooth.r,clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+S.touch.roll,-1,1),realDt);smooth.y=ramp(smooth.y,clamp((keys.has('KeyX')?1:0)-(keys.has('KeyZ')?1:0)+(pad?.buttons[5]?.pressed?1:0)-(pad?.buttons[4]?.pressed?1:0),-1,1),realDt);
    smooth.gp+=(expo(axis(1))-smooth.gp)*Math.min(1,realDt*14);smooth.gr+=(expo(axis(0))-smooth.gr)*Math.min(1,realDt*14);const stickP=clamp(smooth.p+smooth.gp,-1,1),stickR=clamp(smooth.r+smooth.gr,-1,1);
    if(!P.paused&&!document.hidden){elapsed+=dt;simClock+=dt*1000;
     if(!ap.athr||!ap.master)i.throttle=clamp(i.throttle+realDt*((keys.has('KeyE')&&!keys.has('ControlLeft')||keys.has('PageUp')?.35:0)-(keys.has('KeyQ')||keys.has('PageDown')?.35:0)+(pad?.buttons[7]?.value??0)*.4-(pad?.buttons[6]?.value??0)*.4),0,1);
     if((ap.master||ap.copilot)&&(Math.abs(stickP)>.5||Math.abs(stickR)>.5)){ap.master=false;ap.copilot=false;audio?.tone('ap');P.onEvent({type:'ap',text:'AUTOPILOT DISCONNECTED'});}
     i.pitch=stickP;i.roll=stickR;i.rudder=smooth.y;i.brake=keys.has('Space')||keys.has('Period')&&!keys.has('ControlLeft')||!!pad?.buttons[1]?.pressed||S.touch.brake;i.stability=S.settings.stability;i.autoRudder=S.settings.autoRudder;i.unlimitedFuel=S.settings.unlimitedFuel;
     const list=[...airports,...nearby];let remaining=dt;while(remaining>1e-4){const chunk=Math.min(.05,remaining);remaining-=chunk;
      const out=autopilot(plane,S.ap,S.plan,i,wx,ground,chunk);if(out.throttle!==undefined)i.throttle=out.throttle;for(const k of ['flaps','gear','spoilers','reverse','autobrake'] as const)if(out[k]!==undefined)(i as any)[k]=out[k];
      if(out.callout&&S.settings.callouts)speaker.say(out.callout.toLowerCase(),'gpws');if(out.disconnect){audio?.tone('ap');P.onEvent({type:'ap',text:out.disconnect});}
      const ev=stepWorld(plane,chunk,{...i,brake:out.brake!==undefined?out.brake:i.brake,parking:i.parking,targets:out.targets},ground,nearRunway(plane,list),wx,water);
      if(ev.touchdown){const atArrival=geoDistance(plane,r.arrival)<6000;if(plane.airborne&&elapsed>20){S.touchdowns.push(ev.touchdown);P.onEvent({type:'touchdown',data:ev.touchdown,atArrival});}audio?.touchdown(ev.touchdown.fpm/196.85);}
      if(ev.crash){P.onEvent({type:'crash',reason:ev.crash});speaker.stop();break;}}
     look.yaw=clamp(look.yaw+axis(2)*realDt*60,-150,150);look.pitch=clamp(look.pitch-axis(3)*realDt*40,-40,50);}
    // Time of day (the sim clock follows the sim rate): sky, lighting and night layers.
    if(lastTime!==S.settings.time){lastTime=S.settings.time;simClock=timeFor(S.settings.time,r.departure.lat,r.departure.lon).getTime();cloudAt=0;}
    const date=new Date(simClock),camCockpit=P.view.camera===1;
    // Weather refresh, clouds and screen weather.
    if((now-wxAt>600000||geoDistance(plane,wxPos)>60000)&&now-wxAt>20000){wxAt=now;void refreshWeather();}
    if(now-cloudAt>800){cloudAt=now;sunInfo=E.setTime(date,plane.lat,plane.lon,wx?.visibility??40000);clouds.update(plane.lat,plane.lon,wx,.25+.75*clamp((sunInfo.sunEl+6)/12,0,1));}
    const nightTime=sunInfo.sunEl<-4,dusk=clamp((sunInfo.sunEl+6)/12,0,1);
    const inCloud=ThreeClouds.inside(wx,plane.alt),topCloud=Math.max(0,...(wx?.clouds.map(c=>c.base)??[0])),precip=wx&&plane.alt<topCloud+300?wx.intensity:0;
    if(wx?.precip==='thunder'&&Math.random()<realDt*.08)flash=.9;flash*=Math.exp(-realDt*7);const fogL=Math.round(20+200*dusk);
    overlay?.draw({rain:wx&&(wx.precip==='rain'||wx.precip==='thunder')?precip:0,snow:wx?.precip==='snow'?precip:0,cloud:inCloud,flash:flash*(nightTime?.5:.25),fog:`rgb(${fogL},${fogL+4},${fogL+10})`,speed:camCockpit?Math.min(120,plane.speed):20,dt:realDt});
    // Nearby airports, PAPI, OpenStreetMap scenery and live traffic.
    if(geoDistance(plane,nearAt)>20000){nearAt={lat:plane.lat,lon:plane.lon};void fetch(`/api/world?lat=${plane.lat.toFixed(2)}&lon=${plane.lon.toFixed(2)}&km=60`).then(x=>x.json()).then(d=>{if(dead)return;nearby=(d.airports??[]) as Airport[];nearby.forEach((ap2,k)=>{flattenAirport(ap2);addField(ap2,k<3);});}).catch(()=>{});}
    if(now-papiAt>300){papiAt=now;const near=papi.filter(k=>Math.abs(k.lat-plane.lat)<.3&&Math.abs(k.lon-plane.lon)<.3);(map.getSource('papi') as GeoJSONSource).setData(pointsGeoJSON(papiLights(near,plane)));}
    if(now-sceneryAt>1500){sceneryAt=now;E.scenery.update(plane.lat,plane.lon,Math.max(0,plane.alt-ground));}
    if(S.settings.traffic&&now-trafficAt>8000){trafficAt=now;void fetch(`/api/traffic?lat=${plane.lat.toFixed(3)}&lon=${plane.lon.toFixed(3)}`).then(x=>x.json()).then(d=>{if(dead)return;const at=Date.now();void traffic.sync(((d.aircraft??[]) as LiveTraffic[]).map(t=>({...t,at})));}).catch(()=>{});}
    if(!S.settings.traffic&&traffic.list().length)void traffic.sync([]);traffic.update(Date.now(),terrainAt);
    if(now-labelAt>500){labelAt=now;(map.getSource('labels') as GeoJSONSource).setData(pointsGeoJSON(traffic.positions().filter(t=>geoDistance(plane,t)<30000).map(t=>({lat:t.lat,lon:t.lon,label:`${t.flight||t.reg||t.hex.toUpperCase()}\n${t.type||'—'} ${t.ground?'GND':t.alt!==null?`FL${String(Math.round(t.alt/100)).padStart(3,'0')}`:''}`}))));}
    // Aircraft placement: wheels on the surface at the physics contact height.
    Object.assign(craft,{lat:plane.lat,lon:plane.lon,alt:plane.alt-a.gearHeight+m.ground,heading:plane.heading,pitch:plane.pitch,roll:plane.roll,visible:!camCockpit});layer.center={lon:plane.lon,lat:plane.lat};
    const blink=(now/1000*1.2)%1,nav=plane.engine||nightTime||sunInfo.sunEl<3;navL.visible=navR.visible=tail.visible=nav;beacon.visible=plane.engine&&(now/1000%1)<.12;for(const s of strobes)s.visible=!plane.ground&&(blink<.06||blink>.12&&blink<.17);
    const agl=plane.alt-(nearRunway(plane,[...airports,...nearby])?.airport.elevation??ground)-a.gearHeight;landing.visible=plane.engine&&(agl<3000||plane.ground)&&(nightTime||!plane.ground);
    if(m.url.startsWith('proc:')){const gearNode=craftObj.getObjectByName('gear'),prop=craftObj.getObjectByName('prop');if(gearNode)gearNode.visible=(plane.gearPos??1)>.5;if(prop)prop.rotation.z=(now/1000*(plane.n1??0)*260)%(Math.PI*2);}
    const other=r.planes[1-r.seat],om=spec(other.aircraft).model,showRemote=!!r.names[1]&&Date.now()-other.seen<6000;
    if(showRemote&&remoteKind!==om.url){remoteKind=om.url;void modelObject(om).then(o=>{if(dead)return;if(remote)layer.remove(remote,false);remote=layer.add(o,{scale:om.scale});});}
    if(remote){const oa=spec(other.aircraft);Object.assign(remote,{lat:other.lat,lon:other.lon,alt:other.alt-oa.gearHeight+om.ground,heading:other.heading,pitch:other.pitch,roll:other.roll,visible:showRemote});}
    // Cameras: chase, cockpit, orbit and tower.
    const cam=P.view.camera,chase=Math.max(18,m.length*1.9);
    if(cam===1){const [f,eh,side]=m.eye,up=eh-a.gearHeight,fwd=f*Math.cos(plane.pitch)-up*Math.sin(plane.pitch),eye=geoMove(plane.lat,plane.lon,plane.heading,fwd),eye2=geoMove(eye.lat,eye.lon,plane.heading-90,side*Math.cos(plane.roll));
     map.setVerticalFieldOfView(clamp(52/look.zoom,18,80));placeCamera(map,eye2.lat,eye2.lon,plane.alt+up*Math.cos(plane.pitch)+f*Math.sin(plane.pitch),plane.heading+look.yaw,plane.pitch/rad+look.pitch-3,-plane.roll/rad);}
    else if(cam===3){const twr=[...airports].sort((x,y)=>geoDistance(plane,x)-geoDistance(plane,y))[0],tp=geoMove(twr.lat,twr.lon,45,350),talt=twr.elevation+45,d=geoDistance(tp,plane),brg=geoBearing(tp,plane),pitch=Math.atan2(plane.alt-talt,Math.max(1,d))/rad;map.setVerticalFieldOfView(clamp(Math.atan2(m.length*2,d)*2/rad,2,45));placeCamera(map,tp.lat,tp.lon,talt,brg,pitch,0);}
    else{if(cam===2&&!drag)look.orbit+=realDt*6;const k=Math.min(1,realDt*2.2);if(Number.isNaN(camSpring.h))camSpring.h=plane.heading;camSpring.h+=(((plane.heading-camSpring.h+540)%360)-180)*k;camSpring.p+=(clamp(plane.pitch,-.35,.35)*.35-camSpring.p)*k;camSpring.range+=(chase*look.zoom*(cam===2?1.6:1)*(1+Math.min(.25,plane.speed/900))-camSpring.range)*Math.min(1,realDt*3);
     const hdg=camSpring.h+look.orbit+(cam===2?70:0),elev=(7+(cam===2?14:0)-look.pitch)*rad+camSpring.p,horiz=camSpring.range*Math.cos(elev),pos=geoMove(plane.lat,plane.lon,hdg+180,horiz);let calt=plane.alt+camSpring.range*Math.sin(elev);const tg=terrainAt(pos.lat,pos.lon);if(calt<tg+3)calt=tg+3;
     map.setVerticalFieldOfView(42);placeCamera(map,pos.lat,pos.lon,calt,hdg,-Math.atan2(calt-plane.alt,Math.max(1,horiz))/rad,0);}
    layer.repaint();
    // Cockpit overlay.
    const host=mount.current!,size=host.getBoundingClientRect();if(renderer.domElement.width!==Math.round(size.width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(size.height*renderer.getPixelRatio())){renderer.setSize(size.width,size.height);camera3.aspect=size.width/size.height;camera3.updateProjectionMatrix();}
    camera3.rotation.set((look.pitch-3)*rad,-look.yaw*rad,0,'YXZ');camera3.fov=clamp(52/look.zoom,18,80)*1.18;camera3.updateProjectionMatrix();cockpitMount.current!.style.display=camCockpit?'block':'none';
    // Avionics, warnings, callouts and telemetry.
    const mass=aircraftMass(a,plane.fuel),vs=vSpeeds(a,mass),alt=indicatedAlt(plane,wx,ap)/ft,radio=Math.max(0,agl/ft),ias=(plane.ias??0)/kt,wind=windAt(wx,plane.alt),atm=atmosphere(plane.alt,wx??undefined),vsFpm=plane.vertical*196.85,big=a.mtow>15000;
    const flapIdx=a.flapDetents.reduce((b,x,k)=>Math.abs(x-plane.flaps)<Math.abs(a.flapDetents[b]-plane.flaps)?k:b,0),vfe=a.flapSpeeds[flapIdx]??a.vne,vmax=Math.min(a.vne,a.mmo<1?a.mmo/Math.max(.1,plane.mach??.1)*ias:999);
    const warnings:string[]=[],cautions:string[]=[];if(plane.crashed)warnings.push('CRASH');if(plane.stall)warnings.push('STALL');if(!plane.ground&&radio<1200&&vsFpm<-1200&&radio/(-vsFpm/60)<14)warnings.push('PULL UP');if(ias>vmax+3)warnings.push('OVERSPEED');if(!plane.ground&&flapIdx>0&&ias>vfe+5)warnings.push('FLAP OVERSPEED');
    const gearWarn=a.gearRetract&&!plane.ground&&(plane.gearPos??1)<.95&&radio<800&&vsFpm<-300;if(gearWarn)cautions.push('GEAR NOT DOWN');if(!plane.ground&&radio<2000&&vsFpm<-2200)cautions.push('SINK RATE');if(Math.abs(plane.roll)>(a.fbw?45:50)*rad)cautions.push('BANK ANGLE');if(a.fuelMax&&plane.fuel<8)cautions.push('LOW FUEL');if(i.parking&&plane.ground)cautions.push('PARKING BRAKE');if(!plane.engine&&!plane.ground&&a.engine!=='none')cautions.push('ENGINE OUT');if(plane.tailStrike)cautions.push('TAIL STRIKE');
    if(S.settings.callouts&&!P.paused&&!plane.crashed){const say=(k:string,text:string,urgent=false)=>{if(!callouts.has(k)){callouts.add(k);speaker.say(text,'gpws',urgent);}};
     if(!plane.ground&&vsFpm<-200){for(const [hh,word] of [[2500,'twenty five hundred'],[1000,'one thousand'],[500,'five hundred'],[100,'one hundred'],[50,'fifty'],[40,'forty'],[30,'thirty'],[20,'twenty'],[10,'ten']] as [number,string][])if(lastRadio>hh&&radio<=hh&&(big||hh>=100))say(`ra${hh}`,word,hh<=50);if(lastRadio>200&&radio<=200&&ap.apr)say('mins','minimums');if(a.engine==='jet'&&radio<25&&i.throttle>.12&&lastRadio>=25)say('retard','retard',true);}
     if(radio>3000)['ra2500','ra1000','ra500','ra100','ra50','ra40','ra30','ra20','ra10','mins','retard'].forEach(k=>callouts.delete(k));
     if(plane.ground&&!plane.airborne&&big){if(ias>vs.v1)say('v1','vee one');if(ias>vs.vr)say('vr','rotate');}if(!plane.ground&&plane.vertical>2&&radio>30&&radio<400)say('posrate','positive rate');if(plane.ground&&ias<20){callouts.delete('v1');callouts.delete('vr');callouts.delete('posrate');}
     if(now-gpwsAt>2500){const gw=warnings.includes('PULL UP')?'pull up':cautions.includes('SINK RATE')?'sink rate':gearWarn&&radio<500?'too low gear':cautions.includes('BANK ANGLE')&&big?'bank angle':plane.stall&&big?'stall':'';if(gw){gpwsAt=now;speaker.say(gw,'gpws',true);}}}
    lastRadio=radio;
    const loc=geoDistance(plane,S.plan.arrival)<40000?glidePath(plane,S.plan.arrival):null,remainingDist=planRemaining(plane,S.plan),wp=S.plan.waypoints[S.plan.active];
    if(now-panelAt>(camCockpit?50:66)&&(P.view.panel&&!P.view.clean||camCockpit)){panelAt=now;const route:NavPoint[]=[...S.plan.waypoints.map(w=>({id:w.id,lat:w.lat,lon:w.lon,kind:'wpt' as const})),...nearby.slice(0,12).map(x=>({id:x.id,lat:x.lat,lon:x.lon,kind:'apt' as const}))];
     const data:AvionicsData={ias,tas:plane.speed/kt,gs:(plane.gs??0)/kt,mach:plane.mach??0,alt,baro:ap.baro,std:ap.std,vs:vsFpm,pitch:plane.pitch,roll:plane.roll,heading:plane.heading,track:plane.track??plane.heading,beta:plane.beta??0,aoa:(plane.aoa??0),altSel:ap.alt,hdgSel:ap.hdg,spdSel:ap.spd,vsSel:ap.vs,ap:{master:ap.master,athr:ap.athr,athrMode:ap.athr?ap.athrMode||'SPEED':'',lat:ap.master||ap.fd?shortMode(ap).lat:'',vert:ap.master||ap.fd?shortMode(ap).vert:'',arm:shortMode(ap).arm,fd:ap.fd},fdPitch:null,fdBank:null,
      v:{vs:vs.vs,vs0:vs.vs0,vr:plane.ground?vs.vr:0,v2:big&&radio<3000?vs.v2:0,vref:radio<4000&&!plane.ground?vs.vref:0,vfe,vmax,green:a.engine==='jet'?vs.green:0},radio,loc:loc&&loc.along<0?loc.locDeg:null,gsDev:loc&&loc.along<0&&loc.along>-30000?loc.gsDeg:null,lat:plane.lat,lon:plane.lon,route,activeId:wp?.id??'',distNext:wp?geoDistance(plane,wp)/1852:0,distDest:remainingDist/1852,dest:r.arrival.id,eteMin:remainingDist/Math.max(20,plane.gs??0)/60,
      traffic:traffic.list().map(t=>({id:t.hex,label:t.flight,lat:t.lat,lon:t.lon,alt:t.alt,rate:t.rate,ground:t.ground})),wind:{dir:wind.dir,speed:wind.speed/kt},oat:atm.T-273.15,engine:a.engine,engines:a.engines,n1:plane.n1??0,running:plane.engine,ff:plane.ff??0,fuelKg:plane.fuel/100*a.fuelMax,fuelMax:a.fuelMax,flaps:a.flapLabels[flapIdx],flapPos:plane.flaps,gearPos:plane.gearPos??1,gearDown:plane.gear,retract:a.gearRetract,spoilers:plane.spoilers??0,brakes:plane.brakes??0,parking:i.parking,trim:i.trim,reverse:!!plane.reverse,
      warnings,cautions,range:radio<2500||plane.ground?5:radio<10000?20:40,utc:date.toISOString().slice(11,16),power:plane.engine||(plane.n1??0)>.02||!plane.ground||a.engine==='none',airportRunways:[r.departure,r.arrival,...nearby.slice(0,6)].flatMap(x=>x.runways.slice(0,4).map(rw=>({a:{lat:rw.lat,lon:rw.lon},b:{lat:rw.endLat,lon:rw.endLon}})))};
     if(ap.fd&&!plane.ground){data.fdBank=ap.i?.bank??null;data.fdPitch=plane.law?.th??null;}
     const pc=panelRef.current;if(pc&&P.view.panel&&!P.view.clean&&!camCockpit){const w=pc.clientWidth,hh=pc.clientHeight,dpr=Math.min(2,devicePixelRatio);if(pc.width!==Math.round(w*dpr)){pc.width=Math.round(w*dpr);pc.height=Math.round(hh*dpr);}const c2=pc.getContext('2d')!;c2.setTransform(dpr,0,0,dpr,0,0);drawPanel(c2,w,hh,data);}
     if(camCockpit){const sc=deck.screens,paint=(k:string,fn:(c:CanvasRenderingContext2D,w:number,h:number)=>void)=>{const s=sc[k];if(s){fn(s.ctx,s.w,s.h);s.tex.needsUpdate=true;}};
      paint('pfd',(c,w,hh)=>drawPFD(c,0,0,w,hh,data));paint('pfd2',(c,w,hh)=>drawPFD(c,0,0,w,hh,data));paint('nd',(c,w,hh)=>drawND(c,0,0,w,hh,data));paint('nd2',(c,w,hh)=>drawND(c,0,0,w,hh,{...data,range:Math.min(160,data.range*2)}));paint('ecam',(c,w,hh)=>drawEICAS(c,0,0,w,hh,data));paint('ecam2',(c,w,hh)=>drawND(c,0,0,w,hh,{...data,range:Math.max(2.5,data.range/2)}));
      paint('mfd',(c,w,hh)=>{drawND(c,0,0,w*.68,hh,data);drawEICAS(c,w*.68,0,w*.32,hh,data);});if(sc.gauges)drawGliderGauges(sc.gauges,{ias,alt,vs:vsFpm});if(deck.fcu)drawFcu(deck.fcu,ap);
      deck.update({roll:i.roll,pitch:i.pitch,throttle:i.throttle,flaps:plane.flaps,spoilers:plane.spoilers??0,light:dusk});}}
    if(camCockpit)renderer.render(cockpitScene,camera3);
    // Sound.
    if(P.sound&&!P.paused&&!document.hidden){audio??=new AircraftAudio(a.engine==='piston'?'piston':'jet',a.engines);audio.update({n1:a.engine==='turboprop'?.35+(plane.n1??0)*.5:plane.n1??0,running:plane.engine,speed:plane.speed,ground:plane.ground,cockpit:camCockpit,stall:!!plane.stall||(!big&&!plane.ground&&ias<worldStallSpeed(plane)/kt+5&&ias>20),gearWarn,overspeed:warnings.includes('OVERSPEED'),reverse:!!plane.reverse,spoilers:plane.spoilers??0,rain:camCockpit&&(wx?.precip==='rain'||wx?.precip==='thunder')?precip:0});}else if(audio){audio.dispose();audio=undefined;}
    speaker.enabled=P.sound&&S.settings.voice;
    // ATC and telemetry.
    if(now-telemetryAt>200){const snap={lat:plane.lat,lon:plane.lon,alt,agl:radio,ias,vs:vsFpm,heading:plane.heading,ground:plane.ground,airborne:plane.airborne,engine:plane.engine,crashed:!!plane.crashed,distDest:geoDistance(plane,r.arrival),locCaptured:!!ap.i?.locCap,onRunway:!!nearRunway(plane,airports),traffic:traffic.list().map(t=>({id:t.hex,type:t.type,flight:t.flight,lat:t.lat,lon:t.lon,alt:t.alt,track:t.track,ground:t.ground})),now:Date.now()};S.snap=snap;
     if(!P.paused){const lines=S.atc.tick(snap);for(const ln of lines){S.atcLines.push(ln);if(S.atcLines.length>80)S.atcLines.shift();if(ln.who==='atc'||ln.who==='atis')audio?.tone('click');speaker.say(ln.speech,ln.who==='pilot'?'pilot':'atc');}}
     P.onTelemetry({plane:{...plane},agl:radio*ft,altInd:alt,remaining:geoDistance(plane,r.arrival),bearing:geoBearing(plane,r.arrival),elapsed,terrainReady:groundReady,wx,wind:{dir:wind.dir,speed:wind.speed/kt},oat:atm.T-273.15,nextWp:wp?.id??'',distNext:wp?geoDistance(plane,wp):0,warnings,cautions,traffic:traffic.list().length,input:{...i},ap:{...ap,i:{...ap.i}},rate,night:nightTime});telemetryAt=now;}
    if(now-send>500&&!P.paused){P.onMove({...plane,law:undefined});send=now;}
   };frame=requestAnimationFrame(render);
  }catch(e){if(!dead){setLoadingNull();live.current.onError(e instanceof Error?e.message:'Flight could not start.');}}}
  void init();return()=>{dead=true;cancelAnimationFrame(frame);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);el?.removeEventListener('pointerdown',pointerDown);el?.removeEventListener('pointermove',pointerMove);el?.removeEventListener('pointerup',pointerUp);el?.removeEventListener('pointercancel',pointerUp);el?.removeEventListener('wheel',wheel);speaker.stop();audio?.dispose();for(const c of cleanups){try{c();}catch{}}
   cockpitScene?.traverse(o=>{const mesh=o as THREE.Mesh;mesh.geometry?.dispose?.();const mats=mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];for(const mt of mats){(mt as THREE.MeshStandardMaterial).map?.dispose();mt.dispose();}});renderer?.dispose();renderer?.domElement.remove();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[props.room?.code,props.sim]);
 return <><div className="world-globe" ref={mount}/><canvas ref={fxRef} className="world-fx"/><div className="world-cockpit" ref={cockpitMount}/><canvas ref={panelRef} className={`glass-panel ${props.room&&props.view.panel&&!props.view.clean&&props.view.camera!==1?'':'hidden'}`}/>{loading&&<div className={`world-loading ${props.room?'':'soft'}`}><span className="load-ring"/><h2>{props.room?'Preparing your flight':'Loading the map'}</h2><p>{loading}</p></div>}</>;
}
