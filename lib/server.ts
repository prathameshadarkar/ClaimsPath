import postgres from 'postgres';
import {seed,Workspace} from './claims';
export const bindings=()=>({OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL});
let client: ReturnType<typeof postgres> | undefined;
function sql(){if(!process.env.DATABASE_URL)throw Error('Connect a PostgreSQL database and run pnpm db:setup.');return client??=postgres(process.env.DATABASE_URL,{max:1,prepare:false,idle_timeout:20,connect_timeout:10});}
async function local(){
 if(process.env.VERCEL || process.env.CLAIMPATH_LOCAL_STORAGE!=='1')return null;
 const {DatabaseSync}=await import('node:sqlite');const {mkdirSync}=await import('node:fs');mkdirSync('.data',{recursive:true});
 const db=new DatabaseSync('.data/workspaces.sqlite');db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)');return db;
}
export async function workspace(req:Request){
 const match=req.headers.get('cookie')?.match(/(?:^|;\s*)claimpath_session=([a-f0-9-]{36})(?:;|$)/);const id=match?.[1]||crypto.randomUUID();const db=await local();let row:{data:string;version:number}|undefined;
 try{row=db?db.prepare('SELECT data,version FROM workspaces WHERE id=?').get(id) as typeof row:(await sql()`SELECT data,version FROM workspaces WHERE id=${id}`)[0] as typeof row;
 if(row)return {id,state:JSON.parse(row.data) as Workspace,version:row.version,fresh:false};
 const state=seed(),data=JSON.stringify(state),now=new Date().toISOString();
 if(db)db.prepare('INSERT INTO workspaces(id,data,version,updated_at) VALUES(?,?,0,?)').run(id,data,now);else await sql()`INSERT INTO workspaces(id,data,version,updated_at) VALUES(${id},${data},0,${now})`;
 return {id,state,version:0,fresh:true};}finally{db?.close()}
}
export function respond(w:{id:string},data:unknown,status=200){return Response.json(data,{status,headers:{'Set-Cookie':`claimpath_session=${w.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.VERCEL?'; Secure':''}`,'Cache-Control':'no-store'}})}
export async function save(w:{id:string;state:Workspace;version:number}){const db=await local(),data=JSON.stringify(w.state),now=new Date().toISOString();try{const changed=db?db.prepare('UPDATE workspaces SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(data,now,w.id,w.version).changes:(await sql()`UPDATE workspaces SET data=${data},version=version+1,updated_at=${now} WHERE id=${w.id} AND version=${w.version} RETURNING id`).length;if(!changed)throw Error('This workspace changed in another tab. Reload and retry.');}finally{db?.close()}}
export function originCheck(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw Error('Request origin is not allowed.');}
export function event(w:{state:Workspace},claimId:string,action:string,detail:string,actor='You'){w.state.events.unshift({id:crypto.randomUUID(),claimId,action,detail,at:new Date().toISOString(),actor});w.state.events=w.state.events.slice(0,300);}
