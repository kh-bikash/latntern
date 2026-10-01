import { cleanName,cleanCode,apiError } from "@/lib/game";
import { joinAdventure } from "@/lib/adventureServer";
export async function POST(request:Request){try{const body=await request.json() as {code?:unknown;name?:unknown};return Response.json(await joinAdventure(cleanCode(body.code),cleanName(body.name)),{headers:{"Cache-Control":"no-store"}});}catch(cause){return apiError(cause);}}
