// Estado actual de asignaciones de pares y política (solo lectura)
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/dump-360-pares.mjs
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
    if (rows.length === 0) console.log('(sin filas)')
    else console.table(rows)
  }
  await q('Política del ciclo', `select c.name, p.peer_target, p.random_enabled, p.eval_deadline
    from cycle_eval_policies p join cycles c on c.id = p.cycle_id`)
  await q('Asignaciones PAR actuales', `select ev.name as evaluador, ee.name as evaluado, a.origin, a.status
    from evaluation_assignments a
    join profiles ev on ev.id = a.evaluator_id
    join profiles ee on ee.id = a.evaluatee_id
    where a.kind = 'par' order by ev.name, ee.name`)
  await q('Resumen por estado/tipo', `select kind, status, count(*)::int as n
    from evaluation_assignments group by kind, status order by kind, status`)
  await q('Reviews enviadas', `select type, count(*)::int as n from reviews
    where status = 'submitted' group by type`)
} finally {
  await client.end()
}
