// Scene helpers for the globe: textured runways, airfield lighting and PAPI, weather (clouds, visibility,
// precipitation, lightning), aircraft lights and live traffic. All visuals are generated at runtime.
import type * as Cesium from 'cesium';
import {geoMove,geoDistance,geoBearing} from '@/lib/geo';
import {reciprocal,COVER_OKTAS,type Weather} from '@/lib/weather';
type C=typeof Cesium;
type Rwy={name:string;length:number;width:number;lat:number;lon:number;heading:number;endLat:number;endLon:number;estimated?:boolean;surface?:string};
const rnd=(seed:string)=>{let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296;};};
/** Paint a runway with ICAO markings: designators, threshold bars, touchdown zone, aiming point and centerline. */
export function runwayTexture(r:Rwy){const pxPerM=Math.min(1.25,4096/r.length),W=Math.max(48,Math.round(r.width*pxPerM*1.2)),H=Math.round(r.length*pxPerM),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d')!;const m=(v:number)=>v*pxPerM;
 const grass=!/ASP|CON|PEM|BIT|TAR|PAV|asph|conc/i.test(r.surface??'ASP');x.fillStyle=grass?'#6d7a4a':'#3b3e41';x.fillRect(0,0,W,H);const rand=rnd(r.name+r.length);for(let i=0;i<W*H/60;i++){const g=grass?90+rand()*50:48+rand()*28;x.fillStyle=grass?`rgb(${g*.8},${g},${g*.55})`:`rgb(${g},${g},${g+3})`;x.fillRect(rand()*W,rand()*H,1+rand()*2,1+rand()*3);}
 if(!grass){x.fillStyle='#2b2d30';for(let y=0;y<H;y+=m(3))x.fillRect(W/2-m(r.width*.2),y,m(r.width*.4),m(1.4)*rand());
  const pad=(W-m(r.width))/2,white='#e9ebe6';x.fillStyle=white;x.fillRect(pad,0,m(.9),H);x.fillRect(W-pad-m(.9),0,m(.9),H);
  const ends=[{y:H,ident:r.name.split('/')[0].padStart(2,'0'),dir:-1},{y:0,ident:reciprocal(r.name.split('/')[0]),dir:1}];
  for(const e of ends){const at=(d:number)=>e.y+e.dir*m(d),stripes=r.width>=60?16:r.width>=45?12:r.width>=30?8:4,sw=(m(r.width)-m(6))/(stripes*2);for(let i=0;i<stripes;i++){const sx=pad+m(3)+i*sw*2+(i>=stripes/2?sw:0)-(i>=stripes/2?sw:0);x.fillRect(sx+sw*.25,Math.min(at(6),at(36)),sw*1.4,m(30));}
   x.save();x.translate(W/2,at(54));if(e.dir<0)x.rotate(Math.PI);const num=e.ident.replace(/[LRC]$/,''),side=e.ident.slice(num.length);x.font=`bold ${m(18)}px Arial Narrow, Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(num,0,0);if(side)x.fillText(side,0,m(-22));x.restore();
   const block=(d:number,len:number,n:number)=>{for(const s of [-1,1])for(let k=0;k<n;k++)x.fillRect(W/2+s*(m(r.width*.16)+k*m(3))-(s<0?m(1.8):0),Math.min(at(d),at(d+len)),m(1.8),m(len));};
   if(r.length>1200){block(150,22,3);block(300,45,0);for(const s of [-1,1])x.fillRect(W/2+s*m(r.width*.17)-(s<0?m(r.width*.12):0),Math.min(at(300),at(345)),m(r.width*.12),m(45));block(450,22,2);block(600,22,2);block(750,22,1);block(900,22,1);}}
  x.fillStyle=white;for(let y=m(100);y<H-m(100);y+=m(50))x.fillRect(W/2-m(.45),y,m(.9),m(30));}
 return c;}
export type Airfield={id:string;elevation:number;runways:Rwy[]};
/** Runway surfaces, approach/edge lights and a functioning 4-box PAPI for the landing runway. */
export class AirfieldLayer{private entities:Cesium.Entity[]=[];private points:Cesium.PointPrimitiveCollection;private papi:{p:Cesium.PointPrimitive;angle:number;lat:number;lon:number;alt:number}[]=[];private als:{p:Cesium.PointPrimitive;seq:number}[]=[];drawn=new Set<string>();
 constructor(private C:C,private viewer:Cesium.Viewer){this.points=viewer.scene.primitives.add(new C.PointPrimitiveCollection());}
 add(a:Airfield,detail:boolean,landing?:string){if(this.drawn.has(a.id))return;this.drawn.add(a.id);const C=this.C,v=this.viewer,el=a.elevation;
  for(const r of a.runways.filter(r=>r.length>=150&&!/^H/i.test(r.name)).slice(0,detail?6:3)){const half=Math.max(12,r.width/2),A=geoMove(r.lat,r.lon,r.heading-90,half),B=geoMove(r.lat,r.lon,r.heading+90,half),Cc=geoMove(r.endLat,r.endLon,r.heading+90,half),D=geoMove(r.endLat,r.endLon,r.heading-90,half);
   const material=detail?new C.ImageMaterialProperty({image:runwayTexture(r) as unknown as string}):C.Color.fromCssColorString('#45494c');
   this.entities.push(v.entities.add({name:`${a.id} ${r.name}`,polygon:{hierarchy:C.Cartesian3.fromDegreesArray([A.lon,A.lat,B.lon,B.lat,Cc.lon,Cc.lat,D.lon,D.lat]),height:el+.25,material,stRotation:C.Math.toRadians(r.heading),outline:false}}));
   const lights=(lat:number,lon:number,color:Cesium.Color,size=4)=>this.points.add({position:C.Cartesian3.fromDegrees(lon,lat,el+.7),color,pixelSize:size,scaleByDistance:new C.NearFarScalar(150,1.7,9000,.45),translucencyByDistance:new C.NearFarScalar(20000,1,40000,0)});
   const white=C.Color.fromCssColorString('#fff6dc'),amber=C.Color.fromCssColorString('#ffc040'),green=C.Color.fromCssColorString('#3dff6e'),red=C.Color.fromCssColorString('#ff3030');
   for(let d=0;d<=r.length;d+=60)for(const s of [-1,1]){const p=geoMove(r.lat,r.lon,r.heading,d),e=geoMove(p.lat,p.lon,r.heading+s*90,half+2);lights(e.lat,e.lon,d>r.length-600||d<600?amber:white);}
   for(let k=-half;k<=half;k+=4){const t1=geoMove(r.lat,r.lon,r.heading+90,k),t2=geoMove(r.endLat,r.endLon,r.heading+90,k);lights(t1.lat,t1.lon,green,5);lights(t2.lat,t2.lon,red,5);}
   const base=r.name.split('/')[0].padStart(2,'0');for(const end of [{ident:base,lat:r.lat,lon:r.lon,hdg:r.heading},{ident:reciprocal(base),lat:r.endLat,lon:r.endLon,hdg:(r.heading+180)%360}]){if(!detail||(landing&&end.ident!==landing))continue;
    for(let d=30;d<=900;d+=30){const p=geoMove(end.lat,end.lon,end.hdg+180,d);for(const k of d===300?[-15,-10,-5,0,5,10,15]:[-1.5,0,1.5]){const q=geoMove(p.lat,p.lon,end.hdg+90,k);lights(q.lat,q.lon,white,4);}const q=geoMove(p.lat,p.lon,end.hdg,0);this.als.push({p:lights(q.lat,q.lon,white,7),seq:d});}
    for(let k=0;k<4;k++){const touch=geoMove(end.lat,end.lon,end.hdg,Math.min(330,r.length*.2)),q=geoMove(touch.lat,touch.lon,end.hdg-90,half+15+k*9);this.papi.push({p:lights(q.lat,q.lon,white,6),angle:[3.5,3.17,2.83,2.5][k],lat:q.lat,lon:q.lon,alt:el+1});}}}}
 update(viewer:{lat:number;lon:number;alt:number},night:boolean,lowVis:boolean,t:number){const on=night||lowVis;const n=this.points.length;for(let i=0;i<n;i++){const p=this.points.get(i);p.show=on;}
  for(const k of this.papi){const d=geoDistance(viewer,k),ang=Math.atan2(viewer.alt-k.alt,Math.max(1,d))*180/Math.PI;k.p.show=true;k.p.color=ang>k.angle?this.C.Color.fromCssColorString('#fff6dc'):this.C.Color.fromCssColorString('#ff2a2a');}
  const phase=(t*2)%1;for(const a of this.als){a.p.show=on;a.p.pixelSize=on&&Math.abs(phase-(1-a.seq/900))<.04?14:7;}}
 destroy(){for(const e of this.entities)this.viewer.entities.remove(e);if(!this.points.isDestroyed())this.viewer.scene.primitives.remove(this.points);}}
/** Cumulus fields generated from the reported cloud layers, recycled around the aircraft. */
export class CloudField{private col:Cesium.CloudCollection;private live=new Map<string,Cesium.CumulusCloud>();private last={lat:999,lon:999,key:''};
 constructor(private C:C,scene:Cesium.Scene){this.col=scene.primitives.add(new C.CloudCollection({noiseDetail:16,noiseOffset:C.Cartesian3.ZERO}));}
 update(lat:number,lon:number,wx:Weather|null,brightness:number){const key=JSON.stringify(wx?.clouds??[])+(wx?.precip??'');if(Math.abs(lat-this.last.lat)<.02&&Math.abs(lon-this.last.lon)<.02&&key===this.last.key){for(const c of this.live.values())c.brightness=brightness*(wx?.precip!=='none'?.7:1);return;}
  this.last={lat,lon,key};const C=this.C,cell=.035,want=new Set<string>(),radius=4;if(!wx){for(const c of this.live.values())this.col.remove(c);this.live.clear();return;}
  const i0=Math.round(lat/cell),j0=Math.round(lon/cell);
  wx.clouds.forEach((layer,li)=>{const okta=COVER_OKTAS[layer.cover],p=okta/8,per=layer.cover==='OVC'?3:layer.cover==='BKN'?2:1;for(let i=i0-radius;i<=i0+radius;i++)for(let j=j0-radius;j<=j0+radius;j++){if((i-i0)**2+(j-j0)**2>radius*radius)continue;for(let k=0;k<per;k++){const id=`${li}:${layer.base|0}:${layer.cover}:${i}:${j}:${k}`,r=rnd(id);if(r()>p*(layer.cb&&k===0?.5:1))continue;want.add(id);if(this.live.has(id))continue;
   const la=(i+r()-.5)*cell,lo=(j+r()-.5)*cell,cb=!!layer.cb&&r()<.25,w=cb?4200:layer.cover==='OVC'||layer.cover==='BKN'?2400+r()*1800:700+r()*1300,h=cb?7000:layer.cover==='OVC'?600+r()*300:350+r()*700,grey=wx.precip==='none'?1:.72;
   const cloud=this.col.add({position:C.Cartesian3.fromDegrees(lo,la,layer.base+h*.5),scale:new C.Cartesian2(w,h),maximumSize:new C.Cartesian3(50,cb?40:15+r()*15,cb?40:12+r()*10),slice:.3+r()*.4,brightness,color:new C.Color(grey,grey,grey*1.02,1)});this.live.set(id,cloud);}}});
  for(const [id,c] of this.live)if(!want.has(id)){this.col.remove(c);this.live.delete(id);}}
 /** 0..1 how deep the aircraft is inside a reported cloud layer (for instrument conditions). */
 static inside(wx:Weather|null,alt:number){if(!wx)return 0;let v=0;for(const l of wx.clouds){const top=l.base+(l.cb?7000:l.cover==='OVC'?650:l.cover==='BKN'?550:400),edge=Math.min(alt-l.base,top-alt);if(edge>0){const dense=COVER_OKTAS[l.cover]>=6?1:COVER_OKTAS[l.cover]>=4?.35:.12;v=Math.max(v,Math.min(1,edge/70)*dense);}}return v;}
 destroy(scene:Cesium.Scene){if(!this.col.isDestroyed())scene.primitives.remove(this.col);}}
const WEATHER_GLSL=`uniform sampler2D colorTexture;uniform sampler2D depthTexture;uniform float u_vis;uniform float u_cloud;uniform float u_rain;uniform float u_snow;uniform float u_flash;uniform float u_time;uniform float u_speed;uniform vec3 u_fog;in vec2 v_textureCoordinates;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec4 color=texture(colorTexture,v_textureCoordinates);float depth=czm_readDepth(depthTexture,v_textureCoordinates);float dist=1.0e7;
 if(depth<1.0){vec4 eye=czm_windowToEyeCoordinates(gl_FragCoord.xy,depth);dist=length(eye.xyz);}
 float f=depth<1.0?1.0-exp(-dist*3.0/max(40.0,u_vis)):clamp(1.0-u_vis/8000.0,0.0,1.0);f=max(f,u_cloud*0.985);color.rgb=mix(color.rgb,u_fog,clamp(f,0.0,1.0));
 if(u_rain>0.0){vec2 uv=v_textureCoordinates*vec2(90.0,5.0);uv.x+=uv.y*(0.15+u_speed*0.004);uv.y+=u_time*(5.0+u_speed*0.06);vec2 cell=floor(uv);float r=hash(cell);float y=fract(uv.y);float streak=step(1.0-0.12*u_rain,r)*smoothstep(0.0,0.15,y)*(1.0-smoothstep(0.25,0.6,y))*smoothstep(0.35,0.5,fract(uv.x))*(1.0-smoothstep(0.5,0.65,fract(uv.x)));color.rgb=mix(color.rgb,vec3(0.78,0.82,0.88),streak*0.45);}
 if(u_snow>0.0){for(int k=0;k<3;k++){float s=float(k)+1.0;vec2 uv=v_textureCoordinates*vec2(30.0*s,18.0*s);uv.y+=u_time*(0.6+u_speed*0.02)/s;uv.x+=sin(u_time*0.7+uv.y*0.5)*0.4;vec2 cell=floor(uv);vec2 fr=fract(uv)-0.5;float r=hash(cell+s);float d=length(fr+vec2(r-0.5,0.0)*0.6);color.rgb=mix(color.rgb,vec3(0.95),step(1.0-0.2*u_snow,r)*smoothstep(0.12/s,0.0,d)*0.8);}}
 color.rgb+=vec3(u_flash);out_FragColor=color;}`;
export function weatherStage(C:C,scene:Cesium.Scene){const u={u_vis:40000,u_cloud:0,u_rain:0,u_snow:0,u_flash:0,u_time:0,u_speed:0,u_fog:new C.Cartesian3(.75,.78,.82)};const stage=scene.postProcessStages.add(new C.PostProcessStage({fragmentShader:WEATHER_GLSL,uniforms:u}));return{u,stage};}
/** Navigation, beacon, strobe and landing lights attached to an aircraft model. */
export class AircraftLights{private col:Cesium.PointPrimitiveCollection;private p:Record<string,Cesium.PointPrimitive>={};
 constructor(private C:C,scene:Cesium.Scene,private span:number,private length:number){this.col=scene.primitives.add(new C.PointPrimitiveCollection());const add=(k:string,color:string,size:number)=>this.p[k]=this.col.add({color:C.Color.fromCssColorString(color),pixelSize:size,scaleByDistance:new C.NearFarScalar(50,1.6,15000,.6)});
  add('left','#ff2a2a',5);add('right','#2aff5a',5);add('tail','#ffffff',4);add('beacon','#ff2020',6);add('strobeL','#ffffff',8);add('strobeR','#ffffff',8);add('landing','#fffbe8',9);}
 update(frame:Cesium.Matrix4,t:number,s:{engine:boolean;ground:boolean;agl:number;night:boolean}){const C=this.C,at=(fwd:number,right:number,up:number)=>C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(fwd,-right,up),new C.Cartesian3());
  // Cesium model frame: x forward (after heading offset), y left, z up.
  this.p.left.position=at(-this.length*.05,-this.span/2,0);this.p.right.position=at(-this.length*.05,this.span/2,0);this.p.tail.position=at(-this.length*.5,0,.5);this.p.beacon.position=at(0,0,this.length*.06);this.p.strobeL.position=at(-this.length*.06,-this.span/2,0);this.p.strobeR.position=at(-this.length*.06,this.span/2,0);this.p.landing.position=at(this.length*.42,0,-.4);
  const nav=s.engine||s.night,strobe=!s.ground&&(t*1.2)%1<.06||(!s.ground&&(t*1.2)%1>.12&&(t*1.2)%1<.17);this.p.left.show=this.p.right.show=this.p.tail.show=nav;this.p.beacon.show=s.engine&&(t%1)<.12;this.p.strobeL.show=this.p.strobeR.show=strobe;this.p.landing.show=(s.agl<3000||s.ground)&&(s.engine)&&(s.night||!s.ground);}
 destroy(scene:Cesium.Scene){if(!this.col.isDestroyed())scene.primitives.remove(this.col);}}
export type LiveTraffic={hex:string;flight:string;reg:string;type:string;category:string;lat:number;lon:number;ground:boolean;alt:number|null;gs:number;track:number;rate:number;age:number;at:number};
/** Real-world ADS-B traffic rendered as aircraft models, extrapolated between position reports. */
export class TrafficLayer{private models=new Map<string,{m:Cesium.Model;e:Cesium.Entity;d:LiveTraffic;kind:string}>();private loading=new Set<string>();
 constructor(private C:C,private viewer:Cesium.Viewer,private urls:Record<string,string>,private scale:Record<string,number>,private lift:Record<string,number>){}
 kind(t:LiveTraffic){return/^A[345]/.test(t.category)||/^(A3|A2|B7|B3|A1|E1|E7|E9|CRJ|MD)/.test(t.type)&&!/^(A1$)/.test(t.category)?'jet':/^(B1|A1)/.test(t.category)||/^(C1|C2|PA|SR|DA|BE)/.test(t.type)?'trainer':'twin';}
 async sync(list:LiveTraffic[],ground:(lat:number,lon:number)=>number){const C=this.C,seen=new Set<string>();for(const t of list.slice(0,40)){seen.add(t.hex);const known=this.models.get(t.hex);if(known){known.d=t;continue;}if(this.loading.has(t.hex))continue;this.loading.add(t.hex);const kind=this.kind(t);
   try{const m=await C.Model.fromGltfAsync({url:this.urls[kind],scale:this.scale[kind],minimumPixelSize:24,maximumScale:60,color:C.Color.fromCssColorString(kind==='jet'?'#f4f6f8':'#e8e2d0'),colorBlendMode:C.ColorBlendMode.MIX,colorBlendAmount:.05});if(this.viewer.isDestroyed()){m.destroy();return;}this.viewer.scene.primitives.add(m);
    const e=this.viewer.entities.add({position:C.Cartesian3.fromDegrees(t.lon,t.lat,0),label:{text:'',font:'12px "Roboto Mono",monospace',fillColor:C.Color.fromCssColorString('#bff3ff'),outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-26),distanceDisplayCondition:new C.DistanceDisplayCondition(0,40000),scale:.85,showBackground:false}});
    this.models.set(t.hex,{m,e,d:t,kind});}catch{}finally{this.loading.delete(t.hex);}}
  for(const [k,v] of this.models)if(!seen.has(k)){this.viewer.scene.primitives.remove(v.m);this.viewer.entities.remove(v.e);this.models.delete(k);}void ground;}
 update(now:number,ground:(lat:number,lon:number)=>number){const C=this.C;for(const {m,e,d,kind} of this.models.values()){const dt=Math.min(60,(now-d.at)/1000+d.age),dist=d.gs*.5144*dt,p=geoMove(d.lat,d.lon,d.track,dist),alt=d.ground||d.alt===null?ground(p.lat,p.lon)+this.lift[kind]:d.alt*.3048+d.rate*.00508*dt;
  const pitch=d.ground?0:Math.atan2(d.rate*.00508,Math.max(30,d.gs*.5144));m.modelMatrix=C.Transforms.headingPitchRollToFixedFrame(C.Cartesian3.fromDegrees(p.lon,p.lat,alt),new C.HeadingPitchRoll(C.Math.toRadians(d.track-90),pitch,0));
  (e.position as unknown as Cesium.ConstantPositionProperty).setValue(C.Cartesian3.fromDegrees(p.lon,p.lat,alt));e.label!.text=new C.ConstantProperty(`${d.flight||d.reg||d.hex.toUpperCase()}\n${d.type||'—'} ${d.ground?'GND':d.alt!==null?`FL${String(Math.round(d.alt/100)).padStart(3,'0')}`:''}`);}}
 list(){return[...this.models.values()].map(v=>v.d);}
 destroy(){for(const v of this.models.values()){if(!v.m.isDestroyed())this.viewer.scene.primitives.remove(v.m);this.viewer.entities.remove(v.e);}this.models.clear();}}
/** Solar elevation (degrees) for day/night lighting decisions. */
export function sunElevation(date:Date,lat:number,lon:number){const d=(date.getTime()/864e5)+2440587.5-2451545,g=(357.529+.98560028*d)*Math.PI/180,q=280.459+.98564736*d,L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*Math.PI/180,e=(23.439-3.6e-7*d)*Math.PI/180,ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),gmst=(18.697374558+24.06570982441908*d)%24,lst=(gmst*15+lon)*Math.PI/180,ha=lst-ra,la=lat*Math.PI/180;return Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha))*180/Math.PI;}
export const bearingTo=geoBearing;
