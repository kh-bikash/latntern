// Real METAR observations from the NOAA Aviation Weather Center (public US government data).
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;data:unknown}>();
async function cached(url:string,ttl=300000){const hit=cache.get(url);if(hit&&Date.now()-hit.at<ttl)return hit.data;const res=await fetch(url,{headers:{'User-Agent':'hinode-world-flight/5 (browser flight game)'},signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error(`weather ${res.status}`);const text=await res.text(),data=text.trim()?JSON.parse(text):[];cache.set(url,{at:Date.now(),data});if(cache.size>400)cache.delete(cache.keys().next().value!);return data;}
const pick=(m:any)=>({icaoId:m.icaoId,obsTime:m.obsTime,temp:m.temp,dewp:m.dewp,wdir:m.wdir,wspd:m.wspd,wgst:m.wgst,visib:m.visib,altim:m.altim,wxString:m.wxString,clouds:m.clouds,rawOb:m.rawOb,lat:m.lat,lon:m.lon,elev:m.elev,name:m.name,fltCat:m.fltCat});
export async function GET(req:Request){const u=new URL(req.url).searchParams;try{
 const ids=(u.get('ids')??'').toUpperCase().split(',').filter(s=>/^[A-Z0-9]{3,4}$/.test(s)).slice(0,6);let list:any[]=[];
 if(ids.length)list=(await cached(`https://aviationweather.gov/api/data/metar?ids=${ids.join(',')}&format=json`)) as any[];
 const lat=Number(u.get('lat')),lon=Number(u.get('lon')),missing=ids.filter(id=>!list.some(m=>m.icaoId===id));
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&(missing.length||!ids.length)){const r=1.2,box=[lat-r,lon-r,lat+r,lon+r].map(v=>Math.round(v*10)/10);const near=(await cached(`https://aviationweather.gov/api/data/metar?bbox=${box.join(',')}&format=json`)) as any[];near.sort((a,b)=>Math.hypot(a.lat-lat,(a.lon-lon)*Math.cos(lat*Math.PI/180))-Math.hypot(b.lat-lat,(b.lon-lon)*Math.cos(lat*Math.PI/180)));if(near[0])list=[...list,{...near[0],nearest:true}];}
 return Response.json({metars:list.map(m=>({...pick(m),nearest:!!m.nearest}))});}catch(e){return Response.json({metars:[],error:e instanceof Error?e.message:'Weather unavailable'},{status:200});}}
