import postgres from 'postgres';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in .env.local first.');
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
try {await sql`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL)`;console.log('ClaimPath database is ready.');}finally{await sql.end()}
