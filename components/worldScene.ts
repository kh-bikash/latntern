// Scene helpers: runway artwork, airfield lighting and PAPI, clouds, precipitation overlay and live traffic.
// All visuals are generated at runtime from open data.
import * as THREE from 'three';
import {geoMove,geoDistance,geoBearing} from '@/lib/geo';
import {reciprocal,COVER_OKTAS,type Weather} from '@/lib/weather';
import type {ThreeLayer,Placed} from './threeLayer';
type Rwy={name:string;length:number;width:number;lat:number;lon:number;heading:number;endLat:number;endLon:number;estimated?:boolean;surface?:string};
const rnd=(seed:string)=>{let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296;};};
/** Paint a runway with ICAO markings: designators, threshold bars, touchdown zone, aiming point and centerline. */
export function runwayTexture(r:Rwy,px=Math.min(1.25,4096/r.length),seg?:[number,number]){const pxPerM=px,W=Math.max(48,Math.round(r.width*pxPerM*1.2)),H=Math.round(r.length*pxPerM),s0=seg?seg[0]:0,s1=seg?seg[1]:r.length,top=H-Math.round(s1*pxPerM),c=document.createElement('canvas');c.width=W;c.height=Math.max(8,Math.round((s1-s0)*pxPerM));const x=c.getContext('2d')!;x.translate(0,-top);const m=(v:number)=>v*pxPerM;
 const grass=!/ASP|CON|PEM|BIT|TAR|PAV|asph|conc/i.test(r.surface??'ASP');x.fillStyle=grass?'#6d7a4a':'#3b3e41';x.fillRect(0,0,W,H);const rand=rnd(r.name+r.length);for(let i=0;i<W*c.height/(seg?25:60);i++){const g=grass?90+rand()*50:48+rand()*28;x.fillStyle=grass?`rgb(${g*.8},${g},${g*.55})`:`rgb(${g},${g},${g+3})`;x.fillRect(rand()*W,top+rand()*c.height,1+rand()*2,1+rand()*3);}
 if(!grass){x.fillStyle='#2b2d30';for(let y=0;y<H;y+=m(3))x.fillRect(W/2-m(r.width*.2),y,m(r.width*.4),m(1.4)*rand());
  const pad=(W-m(r.width))/2,white='#e9ebe6';x.fillStyle=white;x.fillRect(pad,0,m(.9),H);x.fillRect(W-pad-m(.9),0,m(.9),H);
  const ends=[{y:H,ident:r.name.split('/')[0].padStart(2,'0'),dir:-1},{y:0,ident:reciprocal(r.name.split('/')[0]),dir:1}];
  for(const e of ends){const at=(d:number)=>e.y+e.dir*m(d),stripes=r.width>=60?16:r.width>=45?12:r.width>=30?8:4,sw=(m(r.width)-m(6))/(stripes*2);for(let i=0;i<stripes;i++){const sx=pad+m(3)+i*sw*2+(i>=stripes/2?sw:0)-(i>=stripes/2?sw:0);x.fillRect(sx+sw*.25,Math.min(at(6),at(36)),sw*1.4,m(30));}
   x.save();x.translate(W/2,at(54));if(e.dir>0)x.rotate(Math.PI);const num=e.ident.replace(/[LRC]$/,''),side=e.ident.slice(num.length);x.font=`bold ${m(18)}px Arial Narrow, Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(num,0,0);if(side)x.fillText(side,0,m(-22));x.restore();
   const block=(d:number,len:number,n:number)=>{for(const s of [-1,1])for(let k=0;k<n;k++)x.fillRect(W/2+s*(m(r.width*.16)+k*m(3))-(s<0?m(1.8):0),Math.min(at(d),at(d+len)),m(1.8),m(len));};
   if(r.length>1200){block(150,22,3);block(300,45,0);for(const s of [-1,1])x.fillRect(W/2+s*m(r.width*.17)-(s<0?m(r.width*.12):0),Math.min(at(300),at(345)),m(r.width*.12),m(45));block(450,22,2);block(600,22,2);block(750,22,1);block(900,22,1);}}
  x.fillStyle=white;for(let y=m(100);y<H-m(100);y+=m(50))x.fillRect(W/2-m(.45),y,m(.9),m(30));}
 return c;}
export type Airfield={id:string;elevation:number;runways:Rwy[]};
export type LightPoint={lat:number;lon:number;color:string;size:number;kind:'edge'|'threshold'|'als'|'papi'};
export type RunwayImage={id:string;url:string;coordinates:[[number,number],[number,number],[number,number],[number,number]]};
/** Runway artwork (draped image quads) and airfield lighting for one airport, as MapLibre-ready data. */
export function airfieldArt(a:Airfield,detail:boolean,landing?:string){const images:RunwayImage[]=[],lights:LightPoint[]=[],papi:{lat:number;lon:number;angle:number;alt:number}[]=[];
 for(const r of a.runways.filter(r=>r.length>=150&&!/^H/i.test(r.name)).slice(0,detail?6:3)){const half=Math.max(12,r.width/2),texHalf=Math.max(48,Math.round(r.width*(landing!==undefined?3:Math.min(1.25,4096/r.length))*1.2))/(landing!==undefined?3:Math.min(1.25,4096/r.length))/2;
  const quad=(from:number,to:number):RunwayImage['coordinates']=>{const p0=geoMove(r.lat,r.lon,r.heading,from),p1=geoMove(r.lat,r.lon,r.heading,to),c=(p:{lat:number;lon:number},side:number)=>{const q=geoMove(p.lat,p.lon,r.heading+side*90,texHalf);return[q.lon,q.lat] as [number,number];};return[c(p1,-1),c(p1,1),c(p0,1),c(p0,-1)];};
  if(landing!==undefined)for(let from=0;from<r.length;from+=900){const to=Math.min(r.length,from+900);images.push({id:`${a.id}-${r.name}-${from}`,url:runwayTexture(r,3,[from,to]).toDataURL('image/jpeg',.85),coordinates:quad(from,to)});}
  else images.push({id:`${a.id}-${r.name}`,url:runwayTexture(r).toDataURL('image/jpeg',.82),coordinates:quad(0,r.length)});
  for(let d=0;d<=r.length;d+=60)for(const s of [-1,1]){const p=geoMove(r.lat,r.lon,r.heading,d),e=geoMove(p.lat,p.lon,r.heading+s*90,half+2);lights.push({...e,color:d>r.length-600||d<600?'#ffc040':'#fff6dc',size:3,kind:'edge'});}
  for(let k=-half;k<=half;k+=4){const t1=geoMove(r.lat,r.lon,r.heading+90,k),t2=geoMove(r.endLat,r.endLon,r.heading+90,k);lights.push({...t1,color:'#3dff6e',size:4,kind:'threshold'},{...t2,color:'#ff3030',size:4,kind:'threshold'});}
  const base=r.name.split('/')[0].padStart(2,'0');for(const end of [{ident:base,lat:r.lat,lon:r.lon,hdg:r.heading},{ident:reciprocal(base),lat:r.endLat,lon:r.endLon,hdg:(r.heading+180)%360}]){if(!detail||(landing&&end.ident!==landing))continue;
   for(let d=30;d<=900;d+=30){const p=geoMove(end.lat,end.lon,end.hdg+180,d);for(const k of d===300?[-15,-10,-5,0,5,10,15]:[-1.5,0,1.5]){const q=geoMove(p.lat,p.lon,end.hdg+90,k);lights.push({...q,color:'#fff6dc',size:3,kind:'als'});}}
   for(let k=0;k<4;k++){const touch=geoMove(end.lat,end.lon,end.hdg,Math.min(330,r.length*.2)),q=geoMove(touch.lat,touch.lon,end.hdg-90,half+15+k*9);papi.push({...q,angle:[3.5,3.17,2.83,2.5][k],alt:a.elevation+1});}}}
 return{images,lights,papi};}
export const pointsGeoJSON=(pts:{lat:number;lon:number;[k:string]:unknown}[])=>({type:'FeatureCollection' as const,features:pts.map(p=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[p.lon,p.lat]},properties:{...p}}))});
/** PAPI colours (white above, red below each box's angle) as seen from the aircraft. */
export function papiLights(papi:{lat:number;lon:number;angle:number;alt:number}[],viewer:{lat:number;lon:number;alt:number}){return papi.map(k=>{const ang=Math.atan2(viewer.alt-k.alt,Math.max(1,geoDistance(viewer,k)))*180/Math.PI;return{...k,color:ang>k.angle?'#fff6dc':'#ff2a2a',size:5,kind:'papi'};});}
function puffTexture(seed:number){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!,r=rnd(`puff${seed}`);
 for(let i=0;i<26;i++){const px=60+r()*136,py=70+r()*110,rad=26+r()*46,g=x.createRadialGradient(px,py,0,px,py,rad),shade=Math.round(255-(py-70)*.45);g.addColorStop(0,`rgba(${shade},${shade},${Math.min(255,shade+6)},.55)`);g.addColorStop(.6,`rgba(${shade},${shade},${Math.min(255,shade+6)},.25)`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,rad,0,7);x.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
/** Soft cumulus from painted puff sprites, generated from the reported cloud layers around the aircraft. */
export class ThreeClouds{group=new THREE.Group();placed:Placed;private key='';private mats:THREE.SpriteMaterial[];
 constructor(private layer:ThreeLayer){this.mats=[0,1,2,3,4,5].map(k=>new THREE.SpriteMaterial({map:puffTexture(k),transparent:true,depthWrite:false}));this.placed=layer.add(this.group,{lat:999,lon:999});}
 update(lat:number,lon:number,wx:Weather|null,brightness:number){const grey=wx&&wx.precip!=='none'?.72:1,b=Math.max(.12,brightness)*grey;for(const m of this.mats)m.color.setRGB(b,b,b*1.02);
  const anchor=this.placed,key=JSON.stringify(wx?.clouds??[]);if(Math.abs(lat-anchor.lat)<.05&&Math.abs(lon-anchor.lon)<.05&&this.key===key)return;
  this.key=key;anchor.lat=lat;anchor.lon=lon;anchor.alt=0;this.group.clear();if(!wx)return;const kx=111320*Math.cos(lat*Math.PI/180);
  wx.clouds.forEach((cl,li)=>{const p=COVER_OKTAS[cl.cover]/8,per=cl.cover==='OVC'?3:cl.cover==='BKN'?2:1,cell=3500,R=8;for(let i=-R;i<=R;i++)for(let j=-R;j<=R;j++){if(i*i+j*j>R*R)continue;const ci=Math.round(lat*111320/cell)+i,cj=Math.round(lon*kx/cell)+j;
   for(let k=0;k<per;k++){const r=rnd(`${li}:${cl.base|0}:${cl.cover}:${ci}:${cj}:${k}`);if(r()>p)continue;const cx=(cj+r()-.5)*cell-lon*kx,cy=(ci+r()-.5)*cell-lat*111320,cb=!!cl.cb&&r()<.25,w=cb?4500:cl.cover==='OVC'||cl.cover==='BKN'?2600+r()*1800:900+r()*1400,h=cb?6000:cl.cover==='OVC'?500:400+r()*700,puffs=cb?9:cl.cover==='OVC'?6:4+Math.floor(r()*3);
    for(let n=0;n<puffs;n++){const s=new THREE.Sprite(this.mats[Math.floor(r()*this.mats.length)]),size=w*(.45+r()*.35);s.position.set(cx+(r()-.5)*w*.7,cy+(r()-.5)*w*.5,cl.base+size*.28+r()*h*.6);s.scale.set(size,size*(cb?1.1:.62),1);this.group.add(s);}}}});}
 static inside(wx:Weather|null,alt:number){if(!wx)return 0;let v=0;for(const l of wx.clouds){const top=l.base+(l.cb?7000:l.cover==='OVC'?650:l.cover==='BKN'?550:400),edge=Math.min(alt-l.base,top-alt);if(edge>0){const dense=COVER_OKTAS[l.cover]>=6?1:COVER_OKTAS[l.cover]>=4?.35:.12;v=Math.max(v,Math.min(1,edge/70)*dense);}}return v;}
 destroy(){this.layer.remove(this.placed);}}
/** Rain/snow streaks, in-cloud whiteout and lightning drawn on a lightweight 2D overlay. */
export class WeatherOverlay{private ctx:CanvasRenderingContext2D;private drops:{x:number;y:number;s:number}[]=[];
 constructor(private canvas:HTMLCanvasElement){this.ctx=canvas.getContext('2d')!;for(let i=0;i<500;i++)this.drops.push({x:Math.random(),y:Math.random(),s:.5+Math.random()});}
 draw(o:{rain:number;snow:number;cloud:number;flash:number;fog:string;speed:number;dt:number}){const c=this.canvas,w=c.clientWidth,h=c.clientHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const x=this.ctx;x.clearRect(0,0,w,h);
  if(o.cloud>.02){x.fillStyle=o.fog;x.globalAlpha=Math.min(.97,o.cloud);x.fillRect(0,0,w,h);x.globalAlpha=1;}
  const n=Math.round(500*Math.max(o.rain,o.snow*.7));if(n){const slant=.15+o.speed*.004;x.strokeStyle=o.snow?'rgba(240,244,250,.8)':'rgba(200,210,225,.45)';x.fillStyle='rgba(245,248,252,.85)';x.lineWidth=1;x.beginPath();
   for(let i=0;i<n;i++){const d=this.drops[i];d.y+=(o.snow?.12:1.4+o.speed*.008)*d.s*o.dt;d.x+=o.snow?Math.sin(d.y*9)*.002:slant*.2*d.s*o.dt;if(d.y>1){d.y-=1;d.x=Math.random();}if(d.x>1)d.x-=1;const px=d.x*w,py=d.y*h;if(o.snow){x.moveTo(px+2,py);x.arc(px,py,1.6*d.s,0,7);}else{x.moveTo(px,py);x.lineTo(px-slant*18*d.s,py-18*d.s);}}
   if(o.snow)x.fill();else x.stroke();}
  if(o.flash>.02){x.fillStyle=`rgba(235,240,255,${o.flash*.6})`;x.fillRect(0,0,w,h);}}}
export type LiveTraffic={hex:string;flight:string;reg:string;type:string;category:string;lat:number;lon:number;ground:boolean;alt:number|null;gs:number;track:number;rate:number;age:number;at:number};
export type TrafficModel={object:()=>Promise<THREE.Object3D>;ground:number;scale:number};
/** ICAO type designator (ADS-B "t" field) to the closest model in the fleet. */
const TYPE_MAP:[RegExp,string][]=[[/^A38/,'a380'],[/^B74/,'b744'],[/^A35/,'a359'],[/^B77/,'b773'],[/^B78/,'b789'],[/^(A310|A30|A33|A34|B76|MD1|DC10)/,'a333'],[/^B75/,'b752'],[/^(B73|B3[789]M|B3XM|MD8|MD9)/,'b738'],[/^(A321|A21N)/,'a321'],[/^(A318|A319|A320|A19N|A20N)/,'jet'],[/^(BCS|A22)/,'cs300'],[/^(E1[79]|E19|E29|E75|E17|E2)/,'e190'],[/^(CRJ|CL60|B46|RJ)/,'crj900'],[/^(DH8|Q4)/,'q400'],[/^(AT4|AT7|ATR|SF34|D328|J41|SW4|B190|DHC6)/,'atr42'],[/^(C25|C5|C6|C7|LJ|GLF|GL|FA|F2TH|F900|CL3|E55|E50|E35|PC24|HDJT|PRM|H25|BE40)/,'citation'],[/^(BE[0-9]|PA3|P46|C3[0-9]|C4|DA42|PA44|PA31|P68|BE58|BE55)/,'twin'],[/^(C1|PA|SR2|DA2|DA4|M20|P28|TB|DR4|C2)/,'pa28'],[/^(GLID|AS[GKW]|DG|LS[0-9]|DUO|ARCP)/,'ask21']];
export function trafficModelId(type:string,category:string){for(const [re,id] of TYPE_MAP)if(re.test(type))return id;return category==='A5'?'b773':category==='A4'?'b752':category==='A3'?'jet':category==='A2'?'e190':category==='A1'?'pa28':category==='B1'?'ask21':'jet';}
/** Real-world ADS-B traffic drawn with matching models, extrapolated between reports; labels go to a map layer. */
export class ThreeTraffic{private live=new Map<string,{placed:Placed;d:LiveTraffic;ground:number}>();private loading=new Set<string>();
 constructor(private layer:ThreeLayer,private resolve:(id:string)=>TrafficModel){}
 async sync(list:LiveTraffic[]){const seen=new Set<string>();for(const t of list.slice(0,36)){seen.add(t.hex);const known=this.live.get(t.hex);if(known){known.d=t;continue;}if(this.loading.has(t.hex))continue;this.loading.add(t.hex);
   try{const m=this.resolve(trafficModelId(t.type,t.category)),obj=await m.object();this.live.set(t.hex,{placed:this.layer.add(obj,{lat:t.lat,lon:t.lon,scale:m.scale}),d:t,ground:m.ground});}catch{}finally{this.loading.delete(t.hex);}}
  for(const [k,v] of this.live)if(!seen.has(k)){this.layer.remove(v.placed,false);this.live.delete(k);}}
 update(now:number,ground:(lat:number,lon:number)=>number){for(const v of this.live.values()){const d=v.d,dt=Math.min(60,(now-d.at)/1000+d.age),p=geoMove(d.lat,d.lon,d.track,d.gs*.5144*dt),alt=d.ground||d.alt===null?ground(p.lat,p.lon)+v.ground:d.alt*.3048+d.rate*.00508*dt;Object.assign(v.placed,{lat:p.lat,lon:p.lon,alt,heading:d.track,pitch:d.ground?0:Math.atan2(d.rate*.00508,Math.max(30,d.gs*.5144)),roll:0});}}
 positions(){return[...this.live.values()].map(v=>({...v.d,lat:v.placed.lat,lon:v.placed.lon,altM:v.placed.alt}));}
 list(){return[...this.live.values()].map(v=>v.d);}
 destroy(){for(const v of this.live.values())this.layer.remove(v.placed,false);this.live.clear();}}
/** Solar elevation (degrees) for day/night lighting decisions. */
export function sunElevation(date:Date,lat:number,lon:number){const d=(date.getTime()/864e5)+2440587.5-2451545,g=(357.529+.98560028*d)*Math.PI/180,q=280.459+.98564736*d,L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*Math.PI/180,e=(23.439-3.6e-7*d)*Math.PI/180,ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),gmst=(18.697374558+24.06570982441908*d)%24,lst=(gmst*15+lon)*Math.PI/180,ha=lst-ra,la=lat*Math.PI/180;return Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha))*180/Math.PI;}


/** Solar azimuth (degrees clockwise from north). */
export function sunAzimuth(date:Date,lat:number,lon:number){const d=(date.getTime()/864e5)+2440587.5-2451545,g=(357.529+.98560028*d)*Math.PI/180,q=280.459+.98564736*d,L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*Math.PI/180,e=(23.439-3.6e-7*d)*Math.PI/180,ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),gmst=(18.697374558+24.06570982441908*d)%24,ha=(gmst*15+lon)*Math.PI/180-ra,la=lat*Math.PI/180;return(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(la)-Math.tan(dec)*Math.cos(la))*180/Math.PI+180)%360;}
export const bearingTo=geoBearing;
