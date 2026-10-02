import { storageHealth } from '@/lib/roomStore';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({ok:true,version:'3.0.0',game:'hinode-dawn-wing',world:'real-japanese-terrain',storage:await storageHealth(),regions:6,missions:12},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'Flight storage unavailable'},{status:503});}}
