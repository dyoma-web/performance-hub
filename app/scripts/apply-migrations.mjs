// Aplica las migraciones de /supabase/migrations a la base de datos del proyecto.
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/apply-migrations.mjs
// La contraseña NUNCA se escribe en el repo.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ref = 'eolmqwqfqazzszosmrbh'
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD en el entorno')
  process.exit(1)
}

const candidates = [
  // pooler (IPv4) en modo sesión — distintos clusters/regiones posibles
  ...['us-west-2', 'us-east-1', 'us-east-2', 'us-west-1', 'sa-east-1'].flatMap((r) => [
    { host: `aws-1-${r}.pooler.supabase.com`, user: `postgres.${ref}` },
    { host: `aws-0-${r}.pooler.supabase.com`, user: `postgres.${ref}` },
  ]),
  // conexión directa (IPv6)
  { host: `db.${ref}.supabase.co`, user: 'postgres' },
]

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: 5432,
      user: c.user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    })
    try {
      await client.connect()
      console.log(`✓ Conectado vía ${c.host}`)
      return client
    } catch (e) {
      console.log(`✗ ${c.host}: ${e.message}`)
      try { await client.end() } catch { /* ignorar */ }
    }
  }
  throw new Error('No se pudo conectar por ningún host candidato')
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', '..', 'supabase', 'migrations')

const client = await connect()
try {
  for (const file of readdirSync(migrationsDir).sort()) {
    if (!file.endsWith('.sql')) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    process.stdout.write(`Aplicando ${file} ... `)
    await client.query(sql)
    console.log('OK')
  }

  // Verificación
  const tables = await client.query(
    `select count(*)::int as n from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`
  )
  const policies = await client.query(
    `select count(*)::int as n from pg_policies where schemaname = 'public'`
  )
  const rls = await client.query(
    `select count(*)::int as n from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`
  )
  const catalog = await client.query(`select count(*)::int as n from public.catalog_items`)
  const cycle = await client.query(`select name, status from public.cycles`)
  console.log(`\nTablas públicas: ${tables.rows[0].n}`)
  console.log(`Tablas con RLS activo: ${rls.rows[0].n}`)
  console.log(`Políticas RLS: ${policies.rows[0].n}`)
  console.log(`Ítems de catálogo: ${catalog.rows[0].n}`)
  console.log(`Ciclo: ${cycle.rows.map((r) => `${r.name} (${r.status})`).join(', ')}`)
} finally {
  await client.end()
}
