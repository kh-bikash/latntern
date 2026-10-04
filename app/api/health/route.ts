import { storageHealth } from '@/lib/roomStore';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({ok:true,version:'6.1.1',game:'hinode-world-flight',world:'streaming-earth-and-japanese-expedition',storage:await storageHealth(),regions:6,missions:12,airports:72603},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'Flight storage unavailable'},{status:503});}}
