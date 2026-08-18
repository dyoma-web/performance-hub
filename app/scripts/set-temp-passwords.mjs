// Asigna contraseñas temporales a las cuentas del equipo que NUNCA han
// iniciado sesión (last_sign_in_at IS NULL) y las marca con
// must_change_password=true: al entrar por primera vez, la plataforma
// obliga a definir una contraseña propia.
// No toca: cuentas que ya han ingresado, cuentas demo (@demo360.co).
// Imprime el listado correo → contraseña temporal (NO se guarda en el repo).
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/set-temp-passwords.mjs
//       (con un correo como argumento, reinicia SOLO esa cuenta aunque
//        ya haya iniciado sesión):
//       SUPABASE_DB_PASSWORD=... node scripts/set-temp-passwords.mjs correo@dominio
import { randomInt } from 'node:crypto'
import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD en el entorno')
  process.exit(1)
}

// Legible y cumple la regla de la app (≥8, letras y números)
const WORDS = ['Nube', 'Rio', 'Luna', 'Ceiba', 'Andes', 'Coral', 'Selva', 'Brisa', 'Cumbre', 'Delta', 'Faro', 'Isla', 'Lago', 'Monte', 'Palma', 'Roble']
function tempPassword() {
  const w1 = WORDS[randomInt(WORDS.length)]
  const w2 = WORDS[randomInt(WORDS.length)]
  return `${w1}${randomInt(10, 100)}-${w2}${randomInt(10, 100)}`
}

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
  const onlyEmail = process.argv[2]?.trim().toLowerCase() ?? null
  const { rows: users } = await client.query(
    `select u.id, u.email, p.name, u.last_sign_in_at
     from auth.users u
     join public.profiles p on p.id = u.id
     where p.is_active and p.archived_at is null
       and u.email not like '%@demo360.co'
       and ($1::text is null or lower(u.email) = $1)
     order by p.name`, [onlyEmail])
  if (onlyEmail && users.length === 0) throw new Error(`No existe cuenta activa con el correo ${onlyEmail}`)

  // Con correo explícito se reinicia aunque ya haya iniciado sesión
  const skipped = onlyEmail ? [] : users.filter((u) => u.last_sign_in_at != null)
  const targets = onlyEmail ? users : users.filter((u) => u.last_sign_in_at == null)

  await client.query('begin')
  await client.query('alter table public.profiles disable trigger profiles_protect')
  const listado = []
  for (const u of targets) {
    const temp = tempPassword()
    await client.query(
      `update auth.users set encrypted_password = crypt($2, gen_salt('bf')), updated_at = now()
       where id = $1`, [u.id, temp])
    await client.query(
      `update public.profiles set must_change_password = true where id = $1`, [u.id])
    listado.push({ nombre: u.name, correo: u.email, 'contraseña temporal': temp })
  }
  await client.query('alter table public.profiles enable trigger profiles_protect')
  await client.query('commit')

  if (listado.length > 0) {
    console.log('\nCONTRASEÑAS TEMPORALES (obligan a cambiarla al primer ingreso):')
    console.table(listado)
  } else {
    console.log('\nNo hay cuentas pendientes de primer ingreso.')
  }
  if (skipped.length > 0) {
    console.log('\nSin cambios (ya han iniciado sesión, conservan su contraseña):')
    for (const s of skipped) console.log(`  · ${s.name} <${s.email}>`)
  }
} catch (e) {
  await client.query('rollback').catch(() => {})
  throw e
} finally {
  await client.end()
}
