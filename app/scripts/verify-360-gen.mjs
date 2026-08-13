// Prueba en seco (dry-run) de generate_evaluation_assignments:
// se ejecuta dentro de una transacción simulando a un admin y se
// hace ROLLBACK al final — no persiste nada.
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/verify-360-gen.mjs
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
  const { rows: [admin] } = await client.query(
    `select p.id, p.name from profiles p
     where p.role = 'admin' or exists (select 1 from user_roles r where r.user_id = p.id and r.role = 'admin')
     order by p.name limit 1`)
  const { rows: [cycle] } = await client.query(
    `select id, name from cycles where status not in ('finalized','archived') order by start_date desc limit 1`)
  console.log(`Simulando como admin: ${admin.name} · ciclo: ${cycle.name}\n`)

  await client.query('begin')
  await client.query(`select set_config('request.jwt.claims',
    json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`, [admin.id])
  const { rows: [gen] } = await client.query(
    'select generate_evaluation_assignments($1) as resumen', [cycle.id])
  console.log('Resumen de generación:', gen.resumen)

  const { rows: porKind } = await client.query(
    `select kind, origin, count(*)::int as n from evaluation_assignments
     where cycle_id = $1 group by kind, origin order by kind, origin`, [cycle.id])
  console.log('\nAsignaciones por tipo/origen:')
  console.table(porKind)

  const { rows: muestra } = await client.query(
    `select ev.name as evaluador, ee.name as evaluado, a.kind
     from evaluation_assignments a
     join profiles ev on ev.id = a.evaluator_id
     join profiles ee on ee.id = a.evaluatee_id
     where a.cycle_id = $1 and a.kind = 'lider'
     order by ev.name limit 8`, [cycle.id])
  console.log('\nMuestra líder→subordinado:')
  console.table(muestra)

  const { rows: pares } = await client.query(
    `select ev.name as evaluador, count(*)::int as pares_asignadas
     from evaluation_assignments a join profiles ev on ev.id = a.evaluator_id
     where a.cycle_id = $1 and a.kind = 'par' group by ev.name order by ev.name limit 8`, [cycle.id])
  console.log('\nPares por evaluador (meta política = 2):')
  console.table(pares)

  await client.query('rollback')
  console.log('\nROLLBACK hecho — nada quedó persistido.')
} catch (e) {
  await client.query('rollback').catch(() => {})
  throw e
} finally {
  await client.end()
}
