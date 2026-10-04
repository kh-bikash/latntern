import {GameError} from '@/lib/game';
import {PHOTOREAL_ONLY,PHOTOREAL_AIRPORTS} from '@/lib/photoreal';
import {airportSearch,createWorld,joinWorld,worldAction,nearbyAirports} from '@/lib/worldFlightServer';
export const dynamic='force-dynamic';
export async function GET(req:Request){const u=new URL(req.url).searchParams,lat=Number(u.get('lat')),lon=Number(u.get('lon'));if(u.has('lat')&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)return Response.json({airports:await nearbyAirports(lat,lon,Math.min(120,Number(u.get('km'))||60))},{headers:{'Cache-Control':'public, s-maxage=86400','CDN-Cache-Control':'public, s-maxage=86400'}});const q=u.get('q')??'';
 // photoreal-only mode offers just the airports inside photogrammetry coverage
 if(PHOTOREAL_ONLY){const all=(await Promise.all(PHOTOREAL_AIRPORTS.map(id=>airportSearch(id).then(r=>r.find(a=>a.id===id))))).filter(a=>!!a),t=q.trim().toLowerCase();
  return Response.json({airports:t?all.filter(a=>[a.id,a.iata,a.name,a.city,a.country].some(v=>String(v??'').toLowerCase().includes(t))):all});}
 return Response.json({airports:await airportSearch(q.slice(0,100))});}
export async function POST(req:Request){try{const b=await req.json(),type=String(b.type),name=String(b.name??'Pilot').slice(0,18),code=String(b.code??'').toUpperCase();if(type==='create')return Response.json(await createWorld(name,String(b.departure),String(b.arrival),{aircraft:b.aircraft,start:b.start,runway:b.runway,arrivalRunway:b.arrivalRunway}));if(type==='join')return Response.json(await joinWorld(code,name,b.aircraft));return Response.json({room:await worldAction(code,req.headers.get('x-player-token')??'',type,b.value)});}catch(e){return Response.json({error:e instanceof Error?e.message:'Flight unavailable'},{status:e instanceof GameError?e.status:500});}}
