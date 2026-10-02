import { storageHealth } from '@/lib/roomStore';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({ok:true,version:'2.0.0',world:'free-roaming-2d',storage:await storageHealth(),regions:16,crossings:64},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'Journey storage unavailable'},{status:503});}}
