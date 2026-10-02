import {GameError} from '@/lib/game';
import {airportSearch,createWorld,joinWorld,worldAction} from '@/lib/worldFlightServer';
export const dynamic='force-dynamic';
export async function GET(req:Request){const q=new URL(req.url).searchParams.get('q')??'';return Response.json({airports:await airportSearch(q.slice(0,100))});}
export async function POST(req:Request){try{const b=await req.json(),type=String(b.type),name=String(b.name??'Pilot').slice(0,18),code=String(b.code??'').toUpperCase();if(type==='create')return Response.json(await createWorld(name,String(b.departure),String(b.arrival)));if(type==='join')return Response.json(await joinWorld(code,name));return Response.json({room:await worldAction(code,req.headers.get('x-player-token')??'',type,b.value)});}catch(e){return Response.json({error:e instanceof Error?e.message:'Flight unavailable'},{status:e instanceof GameError?e.status:500});}}
