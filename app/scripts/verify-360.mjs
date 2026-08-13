// Verificación post-migración 0014 (solo lectura)
import pg from 'pg'

const client = new pg.Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.eolmqwqfqazzszosmrbh',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  const q = async (label, sql) => {
    const { rows } = await client.query(sql)
    console.log(`\n== ${label} ==`)
    console.table(rows)
  }
  await q('Familias', `select key, name from role_families order by sort_order`)
  await q('Competencias por tipo', `select comp_type, count(*)::int as n from competencies group by comp_type order by comp_type`)
  await q('Preguntas de bienestar', `select code, category from wellbeing_questions order by sort_order`)
  await q('Perfiles: familia y jerarquía', `select p.name, p.role, f.key as familia, m.name as lider
    from profiles p left join role_families f on f.id = p.family_id
    left join profiles m on m.id = p.manager_id
    where p.is_active and p.archived_at is null order by p.name`)
  await q('Usuarios en auth', `select email, created_at::date from auth.users order by created_at`)
  await q('Ciclo activo', `select id, name, status from cycles where status not in ('finalized','archived')`)
} finally {
  await client.end()
}
