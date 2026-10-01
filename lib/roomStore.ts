import { neon } from '@neondatabase/serverless';
import { GameError } from './game';
export type RoomRow={code:string;state:string;version:number};
let init:Promise<unknown>|undefined;
let local:import('node:sqlite').DatabaseSync|undefined;
async function localDb(){
 if(process.env.VERCEL)throw new GameError('The journey database is not configured yet.',503);
 if(!local){const [{DatabaseSync},{mkdirSync},{resolve}]=await Promise.all([import('node:sqlite'),import('node:fs'),import('node:path')]);mkdirSync('.data',{recursive:true});local=new DatabaseSync(resolve('.data/journeys.sqlite'));local.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS adventure_rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)');}
 return local;
}
function postgres(){return neon(process.env.DATABASE_URL!,{fullResults:true});}
async function ensure(){if(!process.env.DATABASE_URL)return;init??=postgres().query('CREATE TABLE IF NOT EXISTS adventure_rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL)').catch(error=>{init=undefined;throw error;});await init;}
export async function readRoom(code:string):Promise<RoomRow|undefined>{await ensure();if(process.env.DATABASE_URL){const result=await postgres().query('SELECT code,state,version FROM adventure_rooms WHERE code=$1',[code]);return result.rows[0] as RoomRow|undefined;}return (await localDb()).prepare('SELECT code,state,version FROM adventure_rooms WHERE code=?').get(code) as RoomRow|undefined;}
export async function insertRoom(code:string,state:string,now:number){await ensure();if(process.env.DATABASE_URL){await postgres().query('INSERT INTO adventure_rooms(code,state,created_at) VALUES($1,$2,$3)',[code,state,now]);}else (await localDb()).prepare('INSERT INTO adventure_rooms(code,state,created_at) VALUES(?,?,?)').run(code,state,now);}
export async function saveRoom(code:string,state:string,version:number){await ensure();if(process.env.DATABASE_URL){const result=await postgres().query('UPDATE adventure_rooms SET state=$1,version=version+1 WHERE code=$2 AND version=$3 RETURNING version',[state,code,version]);return result.rows.length>0;}return Number((await localDb()).prepare('UPDATE adventure_rooms SET state=?,version=version+1 WHERE code=? AND version=?').run(state,code,version).changes)>0;}
export async function storageHealth(){await ensure();if(process.env.DATABASE_URL){await postgres().query('SELECT 1');return 'postgres';}await localDb();return 'sqlite-local';}
