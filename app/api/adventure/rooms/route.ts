import { cleanName,apiError } from "@/lib/game";
import { createAdventure } from "@/lib/adventureServer";
export async function POST(request:Request){try{const body=await request.json() as {name?:unknown;difficulty?:import('@/lib/adventure').Difficulty};return Response.json(await createAdventure(cleanName(body.name),body.difficulty),{headers:{"Cache-Control":"no-store"}});}catch(cause){return apiError(cause);}}
