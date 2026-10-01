import { cleanCode,getToken,apiError } from "@/lib/game";
import { actAdventure } from "@/lib/adventureServer";
export async function POST(request:Request,context:{params:Promise<{code:string}>}){try{const {code}=await context.params;return Response.json(await actAdventure(cleanCode(code),getToken(request),await request.json()),{headers:{"Cache-Control":"no-store"}});}catch(cause){return apiError(cause);}}
