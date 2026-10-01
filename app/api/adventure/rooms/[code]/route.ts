import { cleanCode,getToken,apiError } from "@/lib/game";
import { getAdventure } from "@/lib/adventureServer";
export async function GET(request:Request,context:{params:Promise<{code:string}>}){try{const {code}=await context.params;return Response.json(await getAdventure(cleanCode(code),getToken(request)),{headers:{"Cache-Control":"no-store"}});}catch(cause){return apiError(cause);}}
