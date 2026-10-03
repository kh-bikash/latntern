import {buildWeather,presetWeather,type Weather,type WeatherPreset} from './weather';
import {geoDistance} from './geo';
export type Metar={icaoId:string;lat:number;lon:number;elev:number;rawOb:string;nearest?:boolean;[k:string]:unknown};
const LEVELS=[850,700,500,300,250];
export async function loadMetars(ids:string[],at?:{lat:number;lon:number}):Promise<Metar[]>{const q=new URLSearchParams({ids:ids.filter(Boolean).join(',')});if(at){q.set('lat',at.lat.toFixed(2));q.set('lon',at.lon.toFixed(2));}try{const r=await fetch(`/api/weather?${q}`,{signal:AbortSignal.timeout(10000)});return((await r.json()).metars??[]) as Metar[];}catch{return[];}}
/** Open-Meteo model weather (surface and winds aloft); called from the browser so limits apply per player. */
export async function loadModel(lat:number,lon:number){const vars=LEVELS.flatMap(l=>[`wind_speed_${l}hPa`,`wind_direction_${l}hPa`,`geopotential_height_${l}hPa`]).join(',');try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,dew_point_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,weather_code,precipitation&hourly=${vars}&forecast_hours=1&wind_speed_unit=ms&timezone=GMT`,{signal:AbortSignal.timeout(10000)});return r.ok?await r.json():null;}catch{return null;}}
/** Weather at a position: the closest METAR (within 60 km) for surface conditions, model winds aloft. */
export function weatherAt(preset:WeatherPreset,pos:{lat:number;lon:number},metars:Metar[],model:any,elevation:number):Weather{
 if(preset!=='live')return presetWeather(preset,elevation);const near=[...metars].sort((a,b)=>geoDistance(pos,a)-geoDistance(pos,b))[0],use=near&&geoDistance(pos,near)<60000?near:null;
 if(!use&&!model)return{...presetWeather('clear',elevation),source:'Standard atmosphere (live weather unavailable)'};return buildWeather(use,model,use?Number(use.elev)||elevation:elevation);}
