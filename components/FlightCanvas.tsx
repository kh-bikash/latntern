'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {buildFlightWorld,disposeWorld,placeAircraft} from './FlightWorld';
import {buildCockpit} from './FlightCockpit';
import {FlightAudio} from '@/lib/flightAudio';
import {FLIGHT_REGIONS,MISSIONS,clamp,flightSpawn,groundDistance,missionPoints,navigationInput,stepFlight,terrainHeight,type Aircraft,type TerrainData,type FlightRoom} from '@/lib/flight';
export type FlightTelemetry={plane:Aircraft;agl:number;distance:number;targetAltitude:number;terrain:TerrainData;fps:number};
export type ControlState={pitch:number;roll:number;throttle:number;brake:boolean;assist:boolean;camera:number};
type Props={room:FlightRoom|null;region:number;intro?:boolean;sound:boolean;paused:boolean;controls:ControlState;onMove:(p:Aircraft)=>void;onAction:()=>void;onCrash:()=>void;onTelemetry:(t:FlightTelemetry)=>void;onError:(s:string)=>void};
export default function FlightCanvas(props:Props){
 const host=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;const [loading,setLoading]=useState(true),[failed,setFailed]=useState(''),[flash,setFlash]=useState(false);
 useEffect(()=>{
  let dead=false,frame=0,renderer:THREE.WebGLRenderer|undefined,world:Awaited<ReturnType<typeof buildFlightWorld>>|undefined,audio:FlightAudio|undefined;
  const keys=new Set<string>();const keydown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.matches('input:not([type=checkbox]),select,textarea'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyF'&&!e.repeat)live.current.onAction();},keyup=(e:KeyboardEvent)=>keys.delete(e.code),clear=()=>{keys.clear();audio?.dispose();audio=undefined;},blur=()=>keys.clear();
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',clear);
  const observer=new ResizeObserver(()=>{if(renderer&&host.current){const {width,height}=host.current.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}}),camera=new THREE.PerspectiveCamera(52,1,.2,100000);if(host.current)observer.observe(host.current);
  async function init(){
   setLoading(true);setFailed('');try{
    const response=await fetch(`/flight/terrain/${FLIGHT_REGIONS[props.region].id}.json`);if(!response.ok)throw new Error('Terrain download failed. Reload to try again.');const t=await response.json() as TerrainData;const mount=host.current;if(dead||!mount)return;
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;mount.appendChild(renderer.domElement);const r=mount.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
    world=await buildFlightWorld(t,props.room?.mission??props.region*2);if(dead){disposeWorld(world.scene);return;}const cockpit=buildCockpit();camera.add(cockpit.group);world.scene.add(camera);cockpit.group.visible=false;setLoading(false);
    let plane={...(live.current.room?.planes[live.current.room.seat]??flightSpawn(0,t))},other={...flightSpawn(1,t)},recovery=plane.recovery,last=performance.now(),send=0,telemetry=0,lastMission=live.current.room?.mission??props.region*2,crashAt=0,throttle=plane.throttle,lastThrottle=props.controls.throttle,frames=0,fps=60,fpsTime=last,wasIntro=true,identity=live.current.room?`${live.current.room.code}:${live.current.room.seat}`:'';
    const centerX=(t.lon-t.west)/(t.east-t.west)*t.size,centerZ=(t.north-t.lat)/(t.north-t.south)*t.size,peak=terrainHeight(t,centerX,centerZ),cameraPosition=new THREE.Vector3(),parcels:{mesh:THREE.Mesh;vertical:number}[]=[];let lastStep=0,flashUntil=0;
    function render(now:number){
     if(dead||!world||!renderer)return;frame=requestAnimationFrame(render);const p=live.current,dt=Math.min(1,(now-last)/1000);last=now;frames++;if(now-fpsTime>1000){fps=frames*1000/(now-fpsTime);fpsTime=now;frames=0;}
     const room=p.room,mission=Math.min(11,room?.mission??props.region*2),points=missionPoints(mission,t),target=points[Math.min(room?.steps[room.seat]??0,points.length-1)],kind=MISSIONS[mission].kind;
     if(mission!==lastMission){world.setMission(mission);lastMission=mission;}
     const step=room?.steps[room.seat]??0;if(step>lastStep){audio?.cue();if(kind==='photo'){setFlash(true);flashUntil=now+250;}if(kind==='drop'){const parcel=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),new THREE.MeshStandardMaterial({color:'#efdbad',roughness:.7}));parcel.position.set(plane.x,plane.y-3,plane.z);world.scene.add(parcel);parcels.push({mesh:parcel,vertical:-4});}}lastStep=step;if(flashUntil&&now>flashUntil){setFlash(false);flashUntil=0;}
     for(let i=parcels.length-1;i>=0;i--){const q=parcels[i];q.vertical-=dt*9.8;q.mesh.position.y+=q.vertical*dt;q.mesh.rotation.x+=dt*.7;q.mesh.rotation.z+=dt*.4;if(q.mesh.position.y<=terrainHeight(t,q.mesh.position.x,q.mesh.position.z)){world.scene.remove(q.mesh);q.mesh.geometry.dispose();(q.mesh.material as THREE.Material).dispose();parcels.splice(i,1);}}
     if(room&&(room.planes[room.seat].recovery!==recovery||identity!==`${room.code}:${room.seat}`)){plane={...room.planes[room.seat]};recovery=plane.recovery;identity=`${room.code}:${room.seat}`;throttle=plane.throttle;cameraPosition.set(0,0,0);}
     cockpit.group.visible=!p.intro&&p.controls.camera===1;cockpit.group.scale.x=Math.min(1,camera.aspect/.9);const fov=p.controls.camera===1?68:52;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
     if(p.intro){
      const a=now*.000012;camera.position.set(centerX+Math.sin(a+.2)*4700,peak+1800,centerZ+Math.cos(a+.2)*4800);camera.lookAt(centerX,peak*.75,centerZ);world.local.plane.visible=false;world.remote.plane.visible=false;world.markers.visible=false;wasIntro=true;
     }else{
      if(wasIntro){cameraPosition.set(0,0,0);wasIntro=false;}world.local.plane.visible=true;world.markers.visible=true;
      if(room&&room.status!=='briefing'&&room.status!=='won'&&!p.paused&&!plane.landed){
       if(lastThrottle!==p.controls.throttle){throttle=p.controls.throttle;lastThrottle=p.controls.throttle;}throttle=clamp(throttle+(keys.has('KeyE')?dt*.2:0)-(keys.has('KeyQ')?dt*.2:0),0,1);
       let pitch=p.controls.pitch+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),roll=p.controls.roll+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),brake=p.controls.brake||keys.has('Space');
       if(p.controls.assist&&pitch===0&&roll===0){const input=navigationInput(plane,target,kind,t,now/1000);({pitch,roll,throttle,brake}=input);if(input.land){plane.landed=true;plane.speed=0;plane.vertical=0;plane.y=terrainHeight(t,plane.x,plane.z)+2.4;}}
       if(!plane.landed){let remaining=dt;while(remaining>0){const slice=Math.min(.05,remaining);stepFlight(plane,slice,{pitch,roll,throttle,brake},t,room.difficulty,now/1000-remaining);remaining-=slice;if(plane.y<=terrainHeight(t,plane.x,plane.z)+2.4)break;}}
       const floor=terrainHeight(t,plane.x,plane.z)+2.4,landingRadius=room.difficulty==='explorer'?225:room.difficulty==='ace'?144:180;if(plane.y<=floor){if(kind==='landing'&&groundDistance(plane,target)<landingRadius&&plane.speed<43.7&&Math.abs(plane.roll)<.22&&Math.abs(plane.vertical)<5){plane.y=floor;plane.speed=0;plane.vertical=0;plane.landed=true;}else if(now-crashAt>4000){crashAt=now;p.onCrash();if(room.code==='PRACTICE'){plane=flightSpawn(0,t,recovery+1);recovery++;}else plane.landed=true;}}
      }
      if(room&&(room.status==='waiting'||room.status==='flying')&&!p.paused&&now-send>450){p.onMove({...plane});send=now;}
      placeAircraft(world.local.plane,plane);world.local.prop.rotation.z+=dt*(30+plane.throttle*100);world.local.plane.visible=p.controls.camera!==1;
      if(room?.names[1]){const remote=room.planes[1-room.seat];for(const k of ['x','y','z','pitch','roll'] as const)other[k]+=(remote[k]-other[k])*Math.min(1,dt*5);other.yaw+=Math.atan2(Math.sin(remote.yaw-other.yaw),Math.cos(remote.yaw-other.yaw))*Math.min(1,dt*5);placeAircraft(world.remote.plane,other);world.remote.plane.visible=true;world.remote.prop.rotation.z+=dt*90;}else world.remote.plane.visible=false;
      const forward=new THREE.Vector3(Math.sin(plane.yaw),Math.sin(plane.pitch),-Math.cos(plane.yaw)),desired=new THREE.Vector3(plane.x,plane.y,plane.z);if(p.controls.camera===1){desired.addScaledVector(forward,-.3);desired.y+=2;}else if(p.controls.camera===2){desired.add(new THREE.Vector3(160,100,120));}else{desired.addScaledVector(forward,-85);desired.y+=28;}
      desired.y=Math.max(desired.y,terrainHeight(t,desired.x,desired.z)+15);if(cameraPosition.lengthSq()===0)cameraPosition.copy(desired);cameraPosition.lerp(desired,1-Math.exp(-dt*(p.controls.camera===1?15:4)));camera.position.copy(cameraPosition);camera.lookAt(new THREE.Vector3(plane.x,plane.y+(p.controls.camera===0?-12:3),plane.z).addScaledVector(forward,p.controls.camera===2?0:p.controls.camera===1?180:55));
      if(now-telemetry>180){const agl=plane.y-terrainHeight(t,plane.x,plane.z);p.onTelemetry({plane:{...plane},agl,distance:groundDistance(plane,target),targetAltitude:target.y,terrain:t,fps});if(cockpit.group.visible)cockpit.update(plane,agl);telemetry=now;}
     }
     if(p.sound&&!document.hidden&&!p.intro&&!p.paused){audio??=new FlightAudio();audio.update(plane.throttle,plane.speed);}else if(audio){audio.dispose();audio=undefined;}
     world.clouds.position.x=Math.sin(now*.00002)*220;world.markers.children.forEach((g,i)=>{g.visible=!room||i>=(room.steps[room.seat]??0)||kind!=='route';});renderer.render(world.scene,camera);
    }
    frame=requestAnimationFrame(render);
   }catch(e){if(!dead){const message=e instanceof Error?e.message:'WebGL could not start.';setFailed(message);setLoading(false);live.current.onError(message);}}
  }
  void init();return()=>{dead=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',clear);audio?.dispose();if(world)disposeWorld(world.scene);renderer?.dispose();renderer?.domElement.remove();};
 },[props.region]);
 return <div className="flight-canvas" ref={host} aria-label={`Interactive 3D flight over ${FLIGHT_REGIONS[props.region].name}`}>{flash&&<div className="survey-flash"/>}{loading&&<div className="flight-loading"><span className="load-ring"/><p>Preparing {FLIGHT_REGIONS[props.region].name}</p><small>Loading real elevation & aerial photography</small></div>}{failed&&<div className="flight-loading" role="alert"><h2>Your graphics engine could not start.</h2><p>{failed}</p><button onClick={()=>location.reload()}>Reload flight</button></div>}</div>;
}
