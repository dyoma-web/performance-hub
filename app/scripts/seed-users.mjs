// Crea los usuarios demo en Supabase Auth (con contraseña) y asigna
// rol/equipo/posición en profiles. Idempotente: omite emails existentes.
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/seed-users.mjs
import pg from 'pg'

const ref = 'eolmqwqfqazzszosmrbh'
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD en el entorno')
  process.exit(1)
}

const DEMO_PASSWORD = 'Demo1234!'

const TEAMS = {
  peopleOps: '00000000-0000-4000-a000-000000000010',
  diseno: '00000000-0000-4000-a000-000000000011',
  ingenieria: '00000000-0000-4000-a000-000000000012',
  marketing: '00000000-0000-4000-a000-000000000013',
}

const USERS = [
  { id: '00000000-0000-4000-a000-0000000000a1', email: 'alejandra@demo360.co', name: 'Alejandra Rivera', role: 'colaborador', team: TEAMS.diseno, position: 'Senior UI Designer', roleType: 'designer', avatar: 'AR' },
  { id: '00000000-0000-4000-a000-0000000000a2', email: 'sara@demo360.co', name: 'Sara Méndez', role: 'facilitador', team: TEAMS.diseno, position: 'Design Lead', roleType: 'designer', avatar: 'SM' },
  { id: '00000000-0000-4000-a000-0000000000a3', email: 'carlos@demo360.co', name: 'Carlos Herrera', role: 'colaborador', team: TEAMS.ingenieria, position: 'Frontend Engineer', roleType: 'engineer', avatar: 'CH' },
  { id: '00000000-0000-4000-a000-0000000000a4', email: 'elena@demo360.co', name: 'Elena Vega', role: 'colaborador', team: TEAMS.diseno, position: 'Product Designer', roleType: 'designer', avatar: 'EV' },
  { id: '00000000-0000-4000-a000-0000000000a5', email: 'marco@demo360.co', name: 'Marco Torres', role: 'colaborador', team: TEAMS.ingenieria, position: 'Backend Engineer', roleType: 'engineer', avatar: 'MT' },
  { id: '00000000-0000-4000-a000-0000000000a6', email: 'daniela@demo360.co', name: 'Daniela Ruiz', role: 'admin', team: TEAMS.peopleOps, position: 'People Ops Lead', roleType: 'default', avatar: 'DR' },
  { id: '00000000-0000-4000-a000-0000000000a7', email: 'jorge@demo360.co', name: 'Jorge Castillo', role: 'facilitador', team: TEAMS.ingenieria, position: 'Engineering Manager', roleType: 'engineer', avatar: 'JC' },
  { id: '00000000-0000-4000-a000-0000000000a8', email: 'lucia@demo360.co', name: 'Lucía Paredes', role: 'colaborador', team: TEAMS.marketing, position: 'Marketing Specialist', roleType: 'marketing', avatar: 'LP' },
]

const client = new pg.Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${ref}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  for (const u of USERS) {
    const exists = await client.query('select 1 from auth.users where email = $1', [u.email])
    if (exists.rowCount > 0) {
      console.log(`• ${u.email} ya existe, omitido`)
      continue
    }
    await client.query('begin')
    // Usuario en Auth con email confirmado y contraseña bcrypt
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
      [u.id, u.email, DEMO_PASSWORD, u.name]
    )
    await client.query(
      `insert into auth.identities
         (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
       values
         (gen_random_uuid(), $1::uuid, $2::text, 'email',
          jsonb_build_object('sub', $2::text, 'email', $3::text, 'email_verified', true),
          now(), now(), now())`,
      [u.id, u.id, u.email]
    )
    // El trigger handle_new_user ya creó el perfil; asignamos rol/equipo
    // (deshabilitando temporalmente la protección, somos owner de la tabla)
    await client.query('alter table public.profiles disable trigger profiles_protect')
    await client.query(
      `update public.profiles
         set role = $2, team_id = $3, position = $4, role_type = $5, avatar = $6, name = $7
       where id = $1`,
      [u.id, u.role, u.team, u.position, u.roleType, u.avatar, u.name]
    )
    await client.query('alter table public.profiles enable trigger profiles_protect')
    await client.query('commit')
    console.log(`✓ ${u.email} (${u.role})`)
  }

  const count = await client.query(
    `select role, count(*)::int as n from public.profiles group by role order by role`
  )
  console.log('\nPerfiles por rol:', count.rows.map((r) => `${r.role}=${r.n}`).join(', '))
} catch (e) {
  await client.query('rollback').catch(() => {})
  throw e
} finally {
  await client.end()
}
