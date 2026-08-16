// Crea DOS usuarios de prueba para videos/demos de la Evaluación 360:
//   · Pepito Pérez  (líder demo)     pepito.perez@demo360.co / Demo1234!
//   · John Doe      (operativo demo) john.doe@demo360.co     / Demo1234!
// John reporta a Pepito → el trigger del organigrama crea la evaluación
// líder→subordinado y las autoevaluaciones automáticamente. Se agrega
// una de par John→Pepito. Evalúan SOLO entre ellos: no tocan datos de
// personas reales. Para retirarlos tras el video: archivarlos desde el
// Directorio (sus asignaciones pendientes se retiran solas).
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/seed-demo-eval-users.mjs
import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD en el entorno')
  process.exit(1)
}

const DEMO_PASSWORD = 'Demo1234!'
const FAM = {
  consultoria: '00000000-0000-4000-f000-000000000001',
  creativo: '00000000-0000-4000-f000-000000000002',
}

const USERS = [
  { id: '00000000-0000-4000-d000-0000000000d1', email: 'pepito.perez@demo360.co', name: 'Pepito Pérez', position: 'Gestor de Proyectos (demo)', family: FAM.consultoria, avatar: 'PP' },
  { id: '00000000-0000-4000-d000-0000000000d2', email: 'john.doe@demo360.co', name: 'John Doe', position: 'Diseñador Visual (demo)', family: FAM.creativo, avatar: 'JD' },
]

const client = new pg.Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.eolmqwqfqazzszosmrbh',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query('begin')
  for (const u of USERS) {
    const exists = await client.query('select 1 from auth.users where email = $1', [u.email])
    if (exists.rowCount > 0) {
      console.log(`• ${u.email} ya existe, omitido`)
      continue
    }
    await client.query(
      `insert into auth.users
         (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
       values
         ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
          $2, crypt($3, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', $4::text),
          now(), now(), '', '', '', '', '')`,
      [u.id, u.email, DEMO_PASSWORD, u.name],
    )
    await client.query(
      `insert into auth.identities
         (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
       values
         (gen_random_uuid(), $1::uuid, $2::text, 'email',
          jsonb_build_object('sub', $2::text, 'email', $3::text, 'email_verified', true),
          now(), now(), now())`,
      [u.id, u.id, u.email],
    )
    console.log(`✓ ${u.email} creado`)
  }

  // Perfiles: datos + jerarquía demo (John reporta a Pepito).
  // El trigger de protección exige admin/TH; como corre sin sesión, se pausa.
  await client.query('alter table public.profiles disable trigger profiles_protect')
  await client.query(
    `update public.profiles set name = $2, position = $3, family_id = $4, avatar = $5,
       role = 'colaborador', must_change_password = false
     where id = $1`,
    [USERS[0].id, USERS[0].name, USERS[0].position, USERS[0].family, USERS[0].avatar],
  )
  await client.query(
    `update public.profiles set name = $2, position = $3, family_id = $4, avatar = $5,
       role = 'colaborador', must_change_password = false
     where id = $1`,
    [USERS[1].id, USERS[1].name, USERS[1].position, USERS[1].family, USERS[1].avatar],
  )
  await client.query('alter table public.profiles enable trigger profiles_protect')
  // Este update dispara la sincronización → líder Pepito→John + autoevaluaciones
  await client.query(`update public.profiles set manager_id = $2 where id = $1`,
    [USERS[1].id, USERS[0].id])

  // Par demo: John evalúa a Pepito (transversales)
  const { rows: cycles } = await client.query(
    `select id from cycles where status not in ('finalized','archived') order by start_date desc limit 1`)
  if (cycles.length > 0) {
    await client.query(
      `insert into evaluation_assignments (cycle_id, evaluator_id, evaluatee_id, kind, origin)
       values ($1, $2, $3, 'par', 'manual')
       on conflict (cycle_id, evaluator_id, evaluatee_id, kind) do nothing`,
      [cycles[0].id, USERS[1].id, USERS[0].id],
    )
  }
  await client.query('commit')

  const { rows } = await client.query(
    `select ev.name as evaluador, ee.name as evaluado, a.kind, a.status
     from evaluation_assignments a
     join profiles ev on ev.id = a.evaluator_id
     join profiles ee on ee.id = a.evaluatee_id
     where a.evaluator_id = any($1::uuid[]) order by ev.name, a.kind`,
    [[USERS[0].id, USERS[1].id]],
  )
  console.log('\nAsignaciones de los usuarios demo:')
  console.table(rows)
  console.log(`\nCredenciales (ambos): ${DEMO_PASSWORD}`)
} catch (e) {
  await client.query('rollback').catch(() => {})
  throw e
} finally {
  await client.end()
}
