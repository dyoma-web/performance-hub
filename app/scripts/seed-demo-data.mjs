// Datos sintéticos globales para demo — idempotente (guardas WHERE NOT EXISTS).
// Uso:  SUPABASE_DB_PASSWORD=... node scripts/seed-demo-data.mjs
import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD')
  process.exit(1)
}
const c = new pg.Client({
  host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
  user: 'postgres.eolmqwqfqazzszosmrbh', password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const CY = '00000000-0000-4000-a000-000000000020'
const U = {
  ale: '00000000-0000-4000-a000-0000000000a1',  // Alejandra (designer, mgr Sara)
  sara: '00000000-0000-4000-a000-0000000000a2', // Facilitadora Diseño
  car: '00000000-0000-4000-a000-0000000000a3',  // Carlos (engineer, mgr Jorge)
  ele: '00000000-0000-4000-a000-0000000000a4',  // Elena (designer, mgr Sara)
  mar: '00000000-0000-4000-a000-0000000000a5',  // Marco (engineer, mgr Jorge)
  dani: '00000000-0000-4000-a000-0000000000a6', // Admin
  jor: '00000000-0000-4000-a000-0000000000a7',  // Facilitador Ingeniería
  luc: '00000000-0000-4000-a000-0000000000a8',  // Lucía (marketing, mgr Daniela)
}

// ---------- helpers ----------
async function objective(user, title, metric, weight, progress) {
  await c.query(
    `insert into objectives (cycle_id, user_id, title, metric, weight, progress, status)
     select $1, $2, $3, $4, $5, $6, 'in-progress'
     where not exists (select 1 from objectives where user_id = $2 and title = $3)`,
    [CY, user, title, metric, weight, progress]
  )
  const { rows } = await c.query(`select id from objectives where user_id = $1 and title = $2`, [user, title])
  return rows[0].id
}

async function review(evaluatee, reviewer, type, recognition) {
  const { rows } = await c.query(
    `select id from reviews where cycle_id = $1 and evaluatee_id = $2 and reviewer_id = $3 and type = $4`,
    [CY, evaluatee, reviewer, type]
  )
  let id
  if (rows.length > 0) {
    id = rows[0].id
    await c.query(
      `update reviews set status = 'submitted', submitted_at = coalesce(submitted_at, now()),
       recognition = coalesce(recognition, $2) where id = $1`,
      [id, recognition]
    )
  } else {
    const r = await c.query(
      `insert into reviews (cycle_id, evaluatee_id, reviewer_id, type, status, recognition, submitted_at)
       values ($1, $2, $3, $4, 'submitted', $5, now()) returning id`,
      [CY, evaluatee, reviewer, type, recognition]
    )
    id = r.rows[0].id
  }
  return id
}

async function item(reviewId, block, ref, score, comment, links = []) {
  await c.query(
    `insert into review_items (review_id, block, item_ref, score, comment, evidence_links)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (review_id, block, item_ref) do nothing`,
    [reviewId, block, ref, score, comment, links]
  )
}

async function ff(reviewId, action, indicator, due, responsible) {
  await c.query(
    `insert into feedforward_items (review_id, action, indicator, due_date, responsible_id)
     select $1, $2, $3, $4, $5
     where not exists (select 1 from feedforward_items where review_id = $1 and action = $2)`,
    [reviewId, action, indicator, due, responsible]
  )
}

async function checkin(user, date, achievements, blockers, cont, adj) {
  await c.query(
    `insert into checkins (cycle_id, user_id, checkin_date, achievements, blockers, fb_continue, fb_adjust, status)
     select $1, $2, $3, $4, $5, $6, $7, 'submitted'
     where not exists (select 1 from checkins where user_id = $2 and checkin_date = $3)`,
    [CY, user, date, achievements, blockers, cont, adj]
  )
}

async function skillRate(skillName, user, rater, relation, score, comment) {
  await c.query(
    `insert into skill_ratings (skill_id, user_id, rater_id, relation, score, comment)
     select s.id, $2, $3, $4, $5, $6 from skills s
     where s.name = $1 and (s.role_type is null or s.role_type = (select role_type from profiles where id = $2))
     limit 1
     on conflict (skill_id, user_id, rater_id) do nothing`,
    [skillName, user, rater, relation, score, comment]
  )
}

// ---------- OBJETIVOS ----------
const oAle2 = await objective(U.ale, 'Mejorar accesibilidad de la plataforma', 'WCAG 2.1 AA en 5 flujos críticos', 35, 60)
const oAle3 = await objective(U.ale, 'Mentoría a diseñadores junior', '2 juniors con primer proyecto entregado', 25, 90)
const oCar1 = await objective(U.car, 'Migrar el frontend a componentes compartidos', '80% de vistas usando la librería común', 50, 65)
const oCar2 = await objective(U.car, 'Reducir tiempo de build del CI', 'Pipeline bajo 5 minutos', 50, 40)
const oEle1 = await objective(U.ele, 'Rediseño del flujo de onboarding', 'Tasa de activación +15%', 60, 70)
const oEle2 = await objective(U.ele, 'Investigación de usuarios trimestral', '12 entrevistas y 2 informes accionables', 40, 85)
const oMar1 = await objective(U.mar, 'API de notificaciones v2', 'Lanzada con 99.9% uptime', 55, 50)
const oMar2 = await objective(U.mar, 'Documentar los servicios core', '6 servicios con docs completas', 45, 30)
const oLuc1 = await objective(U.luc, 'Campaña de lanzamiento Q2', 'CPL bajo $8.000 y 500 leads', 70, 45)
const oLuc2 = await objective(U.luc, 'Calendario editorial constante', '8 piezas/mes publicadas', 30, 55)
console.log('✓ Objetivos')

// ---------- AUTOEVALUACIONES (submitted) ----------
const sAle = await review(U.ale, U.ale, 'self', 'Elevé la calidad visual del equipo con el sistema de tokens; hoy todos diseñamos más rápido y consistente.')
const { rows: aleObjs } = await c.query(`select id, title from objectives where user_id = $1`, [U.ale])
for (const o of aleObjs) {
  await item(sAle, 'results', o.id, 3, `Avance sostenido en "${o.title}" con entregas mensuales verificables en el tablero del equipo.`)
}
await item(sAle, 'skills', 'design-think', 3, 'Lideré 4 sesiones de design thinking con stakeholders para validar el rediseño del checkout.')
await item(sAle, 'skills', 'visual', 4, 'El nuevo sistema visual redujo inconsistencias entre pantallas; auditoría interna pasó de 62 a 12 hallazgos.', ['https://storybook.demo360.co/tokens'])
await item(sAle, 'contribution', 'mentoring', 4, 'Mentoreé a dos juniors que ya entregaron su primer proyecto end-to-end sin acompañamiento; documenté la ruta de onboarding que ahora usa todo el equipo.')
await item(sAle, 'contribution', 'docs', 3, 'Documenté la guía de migración de tokens que el equipo de frontend usa como referencia.')

const sCar = await review(U.car, U.car, 'self', 'Mi mayor aporte fue la librería de componentes compartidos que destrabó a los dos squads.')
await item(sCar, 'results', oCar1, 3, 'La librería común ya cubre el 65% de las vistas; quedan los módulos legados de reportes.')
await item(sCar, 'results', oCar2, 2, 'El build bajó de 12 a 8 minutos; aún no llego a la meta de 5 por las pruebas E2E.')
await item(sCar, 'behaviors', 'colab', 3, 'Hice pairing semanal con Marco para alinear los contratos del API de notificaciones.')
await item(sCar, 'skills', 'code-quality', 3, 'Subí la cobertura de tests del módulo de pagos del 40% al 72% este trimestre.')

const sEle = await review(U.ele, U.ele, 'self', 'La investigación con usuarios cambió decisiones de roadmap dos veces este ciclo.')
await item(sEle, 'results', oEle1, 3, 'El nuevo onboarding está en A/B test con señales positivas (+11% activación a la fecha).')
await item(sEle, 'results', oEle2, 3, 'Completé 10 de 12 entrevistas y el primer informe ya cambió la prioridad del backlog.')
await item(sEle, 'behaviors', 'learn', 3, 'Tomé el curso de research avanzado y apliqué la técnica de jobs-to-be-done en el estudio de onboarding.')

const sMar = await review(U.mar, U.mar, 'self', 'Sostuve la operación del API mientras desarrollaba la v2 sin incidentes mayores.')
await item(sMar, 'results', oMar1, 3, 'La v2 está en staging con pruebas de carga superadas (1.200 rps sostenidos).')
await item(sMar, 'results', oMar2, 2, 'Solo he documentado 2 de 6 servicios; necesito bloques de tiempo protegidos.')
await item(sMar, 'behaviors', 'account', 3, 'Asumí el on-call de febrero y resolví los 3 incidentes dentro del SLA acordado.')

const sLuc = await review(U.luc, U.luc, 'self', 'Mantuve la presencia de marca constante pese a ser equipo de una sola persona.')
await item(sLuc, 'results', oLuc1, 2, 'La campaña arrancó tarde por dependencias de diseño; el CPL va en $11.000 y optimizando.')
await item(sLuc, 'results', oLuc2, 3, 'El calendario editorial se ha cumplido 2 meses seguidos con 8 piezas mensuales.')
console.log('✓ Autoevaluaciones')

// ---------- PEER REVIEWS (submitted) ----------
const pAleEle = await review(U.ele, U.ale, 'peer', 'Elena trae la voz del usuario a cada decisión; su research nos salvó de construir lo equivocado.')
await item(pAleEle, 'behaviors', 'client', 3, 'En el rediseño de onboarding insistió en validar con usuarios reales antes de entregar, y tenía razón: cambió el flujo completo.')
await item(pAleEle, 'behaviors', 'comm', 3, 'Sus informes de investigación son claros y accionables; el último cambió la prioridad del backlog en una semana.')

const pMarCar = await review(U.car, U.mar, 'peer', 'Carlos es el primero en ofrecer ayuda cuando algo se rompe, sin importar de quién sea el código.')
await item(pMarCar, 'behaviors', 'colab', 3, 'Cuando mi deploy rompió staging un viernes, se quedó conmigo hasta resolverlo aunque no era su módulo.')
await item(pMarCar, 'behaviors', 'account', 3, 'Asume los bugs de la librería compartida como propios y los prioriza sin que nadie se lo pida.')

const pCarMar = await review(U.mar, U.car, 'peer', 'Marco es la persona más confiable del equipo en producción: si está de on-call, dormimos tranquilos.')
await item(pCarMar, 'behaviors', 'account', 3, 'Resolvió los 3 incidentes de febrero dentro del SLA y documentó el postmortem de cada uno.')
await item(pCarMar, 'behaviors', 'learn', 2, 'Le cuesta delegar y pedir ayuda; en el incidente del día 14 tardó 4 horas en escalar cuando el equipo pudo ayudar antes.')

const pLucEle = await review(U.ele, U.luc, 'peer', 'Trabajar con Elena en la campaña fue fácil: entiende marketing sin perder el rigor de diseño.')
await item(pLucEle, 'behaviors', 'colab', 3, 'Me entregó las piezas de la campaña con dos días de anticipación y se ofreció a iterar los copys conmigo.')
console.log('✓ Peer reviews')

// ---------- EVALUACIONES DE FACILITADOR (insumo de calibración) ----------
// Sara -> Alejandra (desempeño alto)
const fAle = await review(U.ale, U.sara, 'facilitator', 'Alejandra elevó el estándar de todo el equipo este ciclo; su sistema de tokens es el cimiento del que todos construyen.')
for (const o of aleObjs) {
  await item(fAle, 'results', o.id, 3, `Cumplimiento verificable de "${o.title}" según el tablero del ciclo y los check-ins mensuales.`)
}
await item(fAle, 'behaviors', 'colab', 4, 'La guía de migración que escribió ahorró ~2 sprints al equipo de frontend según estimación de Jorge.', ['https://notion.demo360.co/token-migration'])
await item(fAle, 'behaviors', 'comm', 3, 'Sus critiques son directas y basadas en principios; el equipo las busca activamente.')
await item(fAle, 'behaviors', 'account', 3, 'Cumplió cada compromiso de los check-ins sin necesidad de seguimiento.')
await item(fAle, 'skills', 'visual', 4, 'La auditoría de consistencia visual pasó de 62 hallazgos a 12 tras su sistema.', ['https://storybook.demo360.co/tokens'])
await item(fAle, 'skills', 'systems', 3, 'Diseña pensando en el ecosistema completo: cada componente nuevo considera los flujos existentes.')
await item(fAle, 'contribution', 'mentoring', 4, 'Sus dos mentees entregaron su primer proyecto sin acompañamiento, y la ruta de onboarding que documentó ya es el estándar del área de diseño para nuevos ingresos.')
await item(fAle, 'contribution', 'process', 3, 'Las office hours semanales que instauró redujeron las interrupciones ad-hoc del equipo.')
await ff(fAle, 'Liderar la definición del roadmap del design system para Q3', 'Roadmap aprobado por las 3 áreas consumidoras', '2026-08-15', U.ale)
await ff(fAle, 'Delegar la operación diaria del design system a un junior', 'Junior resolviendo tickets sin escalamiento', '2026-09-01', U.ale)

// Sara -> Elena (sólida)
const fEle = await review(U.ele, U.sara, 'facilitator', 'Elena consolidó la práctica de investigación; el equipo ya no decide sin datos de usuarios.')
await item(fEle, 'results', oEle1, 3, 'El A/B del onboarding muestra +11% de activación; en línea con la meta del ciclo.')
await item(fEle, 'results', oEle2, 3, 'Diez entrevistas completadas y un informe que redirigió el backlog del trimestre.')
await item(fEle, 'behaviors', 'client', 3, 'Trae la voz del usuario a cada decisión de producto; lo validan sus pares.')
await item(fEle, 'behaviors', 'comm', 3, 'Informes claros y presentaciones concisas; el último research se entendió sin necesidad de reunión.')
await item(fEle, 'behaviors', 'learn', 3, 'Incorporó jobs-to-be-done por iniciativa propia y entrenó al equipo en la técnica.')
await item(fEle, 'skills', 'design-think', 3, 'Facilita sesiones de ideación efectivas; la del onboarding produjo el concepto ganador.')
await item(fEle, 'skills', 'prototype', 2, 'Sus prototipos toman más tiempo del planeado; conviene trabajar fidelidad progresiva en lugar de pixel-perfect desde el inicio.')
await item(fEle, 'contribution', 'docs', 3, 'El repositorio de research que organizó es consultado por producto y marketing.')
await ff(fEle, 'Practicar prototipado de fidelidad progresiva en los próximos 3 proyectos', 'Tiempo de prototipado reducido 30%', '2026-08-30', U.ele)
await ff(fEle, 'Presentar el informe trimestral de research al comité directivo', 'Presentación realizada con decisiones derivadas', '2026-07-20', U.ele)

// Jorge -> Carlos (tendencia central: casi todo 3)
const fCar = await review(U.car, U.jor, 'facilitator', 'Carlos es el pegamento técnico del equipo: la librería compartida existe gracias a su insistencia.')
await item(fCar, 'results', oCar1, 3, 'La librería cubre 65% de las vistas y los dos squads la adoptaron sin fricción.')
await item(fCar, 'results', oCar2, 3, 'El build pasó de 12 a 8 minutos; el plan para llegar a 5 es razonable.')
await item(fCar, 'behaviors', 'colab', 3, 'El pairing semanal con Marco alineó los contratos del API sin retrabajos.')
await item(fCar, 'behaviors', 'comm', 3, 'Comunica decisiones técnicas con claridad en los RFC del equipo.')
await item(fCar, 'behaviors', 'account', 3, 'Asume la librería compartida como responsabilidad propia, incluyendo sus bugs.')
await item(fCar, 'skills', 'code-quality', 3, 'Cobertura del módulo de pagos subió al 72%; el código nuevo entra con tests.')
await item(fCar, 'skills', 'architecture', 3, 'El diseño de la librería de componentes balanceó bien flexibilidad y simplicidad.')
await item(fCar, 'contribution', 'friction', 3, 'Automatizó el setup local que antes tomaba un día y ahora toma 30 minutos.')
await ff(fCar, 'Llevar el build del CI a menos de 5 minutos', 'Pipeline principal bajo 5 min sostenido', '2026-08-31', U.car)
await ff(fCar, 'Escribir el RFC de versionado de la librería compartida', 'RFC aprobado por ambos squads', '2026-07-31', U.car)

// Jorge -> Marco (mayoría 3, un 2)
const fMar = await review(U.mar, U.jor, 'facilitator', 'Marco sostiene producción con una confiabilidad que el resto del equipo da por sentada.')
await item(fMar, 'results', oMar1, 3, 'La v2 del API superó las pruebas de carga y está lista para el rollout gradual.')
await item(fMar, 'results', oMar2, 2, 'La documentación va en 2 de 6 servicios; acordamos bloques protegidos de 4 horas semanales.')
await item(fMar, 'behaviors', 'account', 3, 'On-call impecable en febrero: 3 incidentes resueltos en SLA con postmortems publicados.')
await item(fMar, 'behaviors', 'colab', 3, 'Apoyó a Carlos en los contratos del API aportando el contexto de producción.')
await item(fMar, 'behaviors', 'learn', 2, 'Escala tarde cuando está bloqueado; lo conversamos y acordamos una regla de 60 minutos.')
await item(fMar, 'skills', 'debugging', 3, 'Diagnosticó la fuga de memoria del worker en horas, un problema que llevaba semanas intermitente.')
await item(fMar, 'skills', 'automation', 3, 'Automatizó los runbooks de los 3 incidentes más frecuentes del on-call.')
await item(fMar, 'contribution', 'docs', 3, 'Sus postmortems son el estándar de calidad que ahora usa todo el equipo.')
await ff(fMar, 'Aplicar la regla de escalar bloqueos a los 60 minutos', 'Cero bloqueos de más de 1 hora sin escalar', '2026-07-15', U.mar)
await ff(fMar, 'Completar la documentación de los 4 servicios restantes', '6 de 6 servicios documentados', '2026-09-15', U.mar)

// Daniela -> Lucía (en desarrollo: 2s)
const fLuc = await review(U.luc, U.dani, 'facilitator', 'Lucía sostiene sola un frente que necesitaría dos personas; su constancia con el calendario editorial es destacable.')
await item(fLuc, 'results', oLuc1, 2, 'La campaña arrancó 3 semanas tarde y el CPL va en $11.000 frente a la meta de $8.000; hay plan de optimización en curso.')
await item(fLuc, 'results', oLuc2, 3, 'El calendario editorial se ha cumplido dos meses consecutivos con las 8 piezas.')
await item(fLuc, 'behaviors', 'comm', 2, 'Los reportes de campaña llegan tarde y sin conclusiones accionables; acordamos una plantilla quincenal.')
await item(fLuc, 'behaviors', 'account', 2, 'Los retrasos se comunicaron tarde; trabajaremos avisos tempranos cuando una dependencia se atrase.')
await item(fLuc, 'behaviors', 'learn', 3, 'Completó la certificación de Meta Ads por iniciativa propia y la aplicó en la campaña.')
await item(fLuc, 'skills', 'analytics', 2, 'El análisis de campañas se queda en métricas de vanidad; acordamos enfocarlo en CPL y conversión.')
await item(fLuc, 'skills', 'creativity', 3, 'Las piezas del calendario editorial tienen identidad propia y engagement creciente.')
await item(fLuc, 'contribution', 'process', 2, 'El proceso de aprobación de piezas que propuso aún genera cuellos de botella; iteraremos juntas.')
await ff(fLuc, 'Implementar reporte quincenal de campañas con la plantilla acordada', 'Reportes entregados a tiempo 3 quincenas seguidas', '2026-08-01', U.luc)
await ff(fLuc, 'Optimizar el CPL de la campaña a la meta de $8.000', 'CPL ≤ $8.000 sostenido 2 semanas', '2026-08-15', U.luc)
console.log('✓ Evaluaciones de facilitador')

// ---------- CHECK-INS ----------
await checkin(U.car, '2026-05-30', 'Librería compartida al 65% de adopción; build del CI bajó a 8 minutos.', 'Las pruebas E2E son el cuello de botella del pipeline.', 'El pairing semanal con Marco', 'Reservar tiempo para el RFC de versionado')
await checkin(U.ele, '2026-05-28', 'Diez entrevistas completadas; el A/B del onboarding va +11% en activación.', 'Conseguir usuarios del segmento enterprise para entrevistar.', 'El repositorio de research', 'Prototipar con menos fidelidad al inicio')
await checkin(U.mar, '2026-05-29', 'API v2 superó pruebas de carga; postmortems de febrero publicados.', 'La documentación avanza lento sin bloques protegidos.', 'Los runbooks automatizados', 'Escalar bloqueos antes de 1 hora')
await checkin(U.luc, '2026-05-27', 'Calendario editorial cumplido segundo mes seguido; certificación Meta Ads obtenida.', 'La campaña depende de piezas de diseño que llegan tarde.', 'La constancia del calendario', 'Avisar temprano cuando algo se atrase')
console.log('✓ Check-ins')

// ---------- REUNIONES Y PLAN ----------
await c.query(
  `insert into meetings (cycle_id, evaluatee_id, facilitator_id, scheduled_at, status)
   select $1, $2, $3, now() + interval '3 days', 'scheduled'
   where not exists (select 1 from meetings where cycle_id = $1 and evaluatee_id = $2 and facilitator_id = $3)`,
  [CY, U.car, U.jor]
)
for (const [user, action, indicator, due, status] of [
  [U.car, 'Llevar el build del CI a menos de 5 minutos', 'Pipeline bajo 5 min sostenido', '2026-08-31', 'in-progress'],
  [U.ele, 'Practicar prototipado de fidelidad progresiva', 'Tiempo de prototipado -30%', '2026-08-30', 'pending'],
  [U.mar, 'Aplicar la regla de escalar a los 60 minutos', 'Cero bloqueos >1h sin escalar', '2026-07-15', 'in-progress'],
]) {
  await c.query(
    `insert into plan_actions (cycle_id, user_id, action, indicator, due_date, responsible_id, status)
     select $1, $2, $3, $4, $5, $2, $6
     where not exists (select 1 from plan_actions where user_id = $2 and action = $3)`,
    [CY, user, action, indicator, due, status]
  )
}
console.log('✓ Reuniones y plan de acción')

// ---------- COMPETENCIAS 360 ----------
await skillRate('Craft visual', U.ale, U.ale, 'self', 4, null)
await skillRate('Pensamiento sistémico', U.ale, U.ale, 'self', 4, null)
await skillRate('Comunicación', U.ale, U.ale, 'self', 3, null)
await skillRate('Craft visual', U.ale, U.sara, 'leader', 4, 'La auditoría visual pasó de 62 a 12 hallazgos con su sistema de tokens.')
await skillRate('Liderazgo', U.ale, U.sara, 'leader', 3, 'Lidera con el ejemplo; el siguiente paso es delegar la operación diaria.')
await skillRate('Trabajo en equipo', U.ale, U.car, 'peer', 4, 'Su guía de migración nos ahorró dos sprints al equipo de frontend.')
await skillRate('Calidad de código', U.car, U.car, 'self', 3, null)
await skillRate('Resolución de problemas', U.car, U.car, 'self', 4, null)
await skillRate('Calidad de código', U.car, U.jor, 'leader', 3, 'Cobertura del 72% en pagos; el código nuevo siempre entra con tests.')
await skillRate('Criterio técnico', U.car, U.jor, 'leader', 3, 'El diseño de la librería balanceó flexibilidad y simplicidad.')
await skillRate('Trabajo en equipo', U.car, U.mar, 'peer', 4, 'Se quedó un viernes hasta arreglar un deploy roto que ni siquiera era suyo.')
await skillRate('Pensamiento de diseño', U.ele, U.ele, 'self', 3, null)
await skillRate('Pensamiento de diseño', U.ele, U.sara, 'leader', 3, 'Sus sesiones de ideación producen conceptos accionables.')
await skillRate('Comunicación', U.ele, U.ale, 'peer', 3, 'Sus informes de research se entienden sin necesidad de reunión.')
console.log('✓ Competencias 360')

// ---------- VALORACIÓN DE TRABAJO ----------
await c.query(
  `insert into work_ratings (user_id, evaluator_id, project, quality, timeliness, comment)
   select $1, $2, $3, 4, 3, 'Entrega sólida y bien probada; una semana de retraso por dependencias externas bien comunicado.'
   where not exists (select 1 from work_ratings where user_id = $1 and project = $3)`,
  [U.car, U.jor, 'Librería de componentes v1']
)
console.log('✓ Valoración de trabajo')

// ---------- PERFILES PERSONALES ----------
await c.query(
  `insert into personal_info (user_id, document_type, document_number, birth_date, phone, city, marital_status, blood_type, contract_type, household, consent_given_at)
   values
   ($1, 'CC', '1.098.765.432', '1995-08-22', '+57 312 555 4321', 'Bogotá', 'soltero', 'A+', 'indefinido', 'solo', now()),
   ($2, 'CC', '1.045.678.901', '1997-02-14', '+57 315 555 8765', 'Medellín', 'union-libre', 'O-', 'indefinido', 'pareja', now())
   on conflict (user_id) do nothing`,
  [U.car, U.ele]
)
await c.query(
  `insert into dependents (user_id, full_name, relationship, birth_date, lives_together, is_core_family)
   select * from (values
     ($1::uuid, 'Hernando Herrera', 'padre', '1965-03-10'::date, false, true),
     ($1::uuid, 'Cecilia Mora', 'madre', '1968-11-25'::date, false, true),
     ($2::uuid, 'Andrés Felipe Soto', 'pareja', '1996-06-30'::date, true, true)
   ) as v(user_id, full_name, relationship, birth_date, lives_together, is_core_family)
   where not exists (select 1 from dependents d where d.user_id = v.user_id and d.full_name = v.full_name)`,
  [U.car, U.ele]
)
await c.query(
  `insert into emergency_contacts (user_id, full_name, relationship, phone)
   select * from (values
     ($1::uuid, 'Cecilia Mora', 'Madre', '+57 311 555 0011'),
     ($2::uuid, 'Andrés Felipe Soto', 'Pareja', '+57 316 555 0022')
   ) as v(user_id, full_name, relationship, phone)
   where not exists (select 1 from emergency_contacts e where e.user_id = v.user_id and e.full_name = v.full_name)`,
  [U.car, U.ele]
)
await c.query(
  `insert into pets (user_id, name, species, breed, birth_date)
   select * from (values
     ($1::uuid, 'Misifu', 'gato', 'Criollo', '2021-05-01'::date),
     ($2::uuid, 'Rocco', 'perro', 'Golden Retriever', '2020-09-15'::date)
   ) as v(user_id, name, species, breed, birth_date)
   where not exists (select 1 from pets p where p.user_id = v.user_id and p.name = v.name)`,
  [U.car, U.ele]
)
await c.query(
  `insert into personal_preferences (user_id, diet, shirt_size, hobbies, celebrate_birthday)
   values ($1, 'omnivoro', 'L', 'Ciclismo, videojuegos', true),
          ($2, 'vegano', 'S', 'Cerámica, yoga', false)
   on conflict (user_id) do nothing`,
  [U.car, U.ele]
)
// Celebraciones: Carlos no celebra Halloween (con nota); Elena sí casi todo
await c.query(
  `insert into celebration_preferences (user_id, celebration_id, participates, notes)
   select v.user_id, c.id, v.participates, v.notes
   from (values
     ($1::uuid, 'Halloween', false, 'Por convicciones familiares no lo celebramos en casa.'),
     ($1::uuid, 'Navidad', true, null),
     ($2::uuid, 'Halloween', true, null),
     ($2::uuid, 'Día de la Familia', true, 'Mi familia es mi pareja y mi perro.'),
     ($2::uuid, 'Semana Santa', false, null)
   ) as v(user_id, name, participates, notes)
   join celebrations c on c.name = v.name
   on conflict (user_id, celebration_id) do nothing`,
  [U.car, U.ele]
)
console.log('✓ Perfiles personales')

// ---------- TRAYECTORIA ----------
await c.query(
  `insert into education (user_id, title, institution, location, level, start_date, end_date, description)
   select * from (values
     ($1::uuid, 'Ingeniería de Sistemas', 'Universidad de los Andes', 'Bogotá', 'pregrado', '2013-01-20'::date, '2018-06-15'::date, 'Énfasis en ingeniería de software.'),
     ($2::uuid, 'Diseño Industrial', 'Pontificia Universidad Javeriana', 'Bogotá', 'pregrado', '2014-01-15'::date, '2019-11-30'::date, 'Tesis en diseño centrado en el usuario.'),
     ($2::uuid, 'Especialización en UX Research', 'UOC', 'Remoto', 'especializacion', '2023-02-01'::date, '2024-01-30'::date, 'Métodos cualitativos y cuantitativos de investigación.')
   ) as v(user_id, title, institution, location, level, start_date, end_date, description)
   where not exists (select 1 from education e where e.user_id = v.user_id and e.title = v.title)`,
  [U.car, U.ele]
)
await c.query(
  `insert into work_experience (user_id, company, position, start_date, end_date, description)
   select * from (values
     ($1::uuid, 'Globant', 'Software Engineer', '2018-08-01'::date, '2023-12-15'::date, 'Frontend para clientes de banca en React y TypeScript.'),
     ($2::uuid, 'Estudio Caoba', 'Diseñadora UX', '2020-01-15'::date, '2025-01-30'::date, 'Investigación y diseño de producto para startups.')
   ) as v(user_id, company, position, start_date, end_date, description)
   where not exists (select 1 from work_experience w where w.user_id = v.user_id and w.company = v.company)`,
  [U.car, U.ele]
)
await c.query(
  `insert into recognitions (user_id, title, granted_by, date_granted, description, is_internal)
   select $1, 'Informe de research del trimestre', 'Equipo de Producto', '2026-04-20', 'Su estudio de onboarding redirigió el roadmap del Q2.', true
   where not exists (select 1 from recognitions where user_id = $1 and title = 'Informe de research del trimestre')`,
  [U.ele]
)
console.log('✓ Trayectoria')

// ---------- RESUMEN ----------
const counts = await c.query(`
  select 'reviews enviadas' as k, count(*)::int as n from reviews where status = 'submitted'
  union all select 'items calificados', count(*)::int from review_items where score is not null
  union all select 'facilitator reviews', count(*)::int from reviews where type = 'facilitator' and status = 'submitted'
  union all select 'check-ins', count(*)::int from checkins where status <> 'draft'
  union all select 'skill ratings', count(*)::int from skill_ratings
  union all select 'plan actions', count(*)::int from plan_actions`)
console.log('\nResumen:', counts.rows.map((r) => `${r.k}=${r.n}`).join(' · '))
await c.end()
