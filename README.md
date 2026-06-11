# Performance Hub

Plataforma de gestión de evaluaciones de desempeño 360° y feedback continuo para culturas horizontales: ciclos de evaluación, check-ins mensuales, feedback de pares, calibración y planes de desarrollo.

**🔗 Beta en línea:** https://dyoma-web.github.io/performance-hub/ (se despliega automáticamente con cada push a `main`)

**Cuentas demo** (contraseña `Demo1234!`): `alejandra@demo360.co` (colaboradora) · `sara@demo360.co` (facilitadora) · `daniela@demo360.co` (People Ops/admin)

## Funcionalidades

| Rol | Módulos |
|---|---|
| **Colaborador** | Objetivos del ciclo (peso + métrica + evidencia), autoevaluación de 4 bloques, check-ins mensuales (Continúa/Ajusta/Inicia), feedback a pares, reunión 1:1 con firma, plan de desarrollo vivo |
| **Facilitador** | Estado del equipo, solicitud de feedback de pares, evaluación con contexto comparativo (auto + promedio de pares + citas), reuniones 1:1 con acuerdos |
| **People Ops** | Configuración de ciclos (pesos, anonimato, workflow de 9 estados), calibración con racional obligatorio y alertas de sesgo, reportes con export CSV, directorio |

### Reglas de negocio aplicadas en la base de datos (no solo en UI)
- Un puntaje **4 "Sobresaliente" sin evidencia es rechazado** por Postgres (CHECK)
- Todo puntaje exige un ejemplo concreto de ≥30 caracteres
- Cambiar una nota en calibración **exige racional ≥20 caracteres**
- **Auditoría inmutable** por triggers (nadie puede alterar el log)
- RBAC con Row Level Security: borradores invisibles para el evaluado, check-ins solo para el facilitador del equipo, solo admin cambia roles

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `app/` | Aplicación web — Vite + React 19 + TypeScript + Tailwind CSS v4 |
| `supabase/` | Esquema de base de datos (16 tablas), RLS (48 políticas) y seed |
| `docs/` | Especificación funcional del producto |
| `prototype/` | Prototipo original de alta fidelidad (vanilla JS) — solo referencia |
| `.github/workflows/` | CI: tests + build + deploy a GitHub Pages |

## Desarrollo local

```bash
cd app
cp .env.example .env.local   # completar con credenciales de Supabase
npm install
npm run dev                  # http://localhost:5173
npm test                     # tests unitarios de reglas de negocio
```

Scripts de base de datos (requieren `SUPABASE_DB_PASSWORD` en el entorno):

```bash
node scripts/apply-migrations.mjs   # aplica supabase/migrations/
node scripts/seed-users.mjs         # crea los 8 usuarios demo
```

## Plan de desarrollo — completado

- [x] **Fase 1 — Fundación:** repo, scaffold, design system
- [x] **Fase 2 — Datos:** esquema Postgres + RLS + auditoría + seed
- [x] **Fase 3 — Auth + Shell:** login, navegación por rol (RBAC), usuarios demo
- [x] **Fase 4 — Evaluación núcleo:** objetivos CRUD + autoevaluación funcional
- [x] **Fase 5 — Multi-fuente:** check-ins, peer feedback, revisión del facilitador
- [x] **Fase 6 — Conversación:** reunión 1:1 con firma bilateral, plan de desarrollo vivo
- [x] **Fase 7 — Admin:** ciclos, calibración, reportes CSV, directorio
- [x] **Fase 8 — Beta:** code-splitting, tests, CI con tests, documentación

## Módulo Personas — completado

- [x] **Fase 1 — Datos y privacidad:** 17 tablas, RLS en 3 niveles (público interno / profesional / sensible solo dueño+TH), multi-rol y multi-cargo, consentimiento habeas data
- [x] **Fase 2 — Estructura organizacional:** áreas jerárquicas, catálogo de cargos, invitaciones serverless (perfil pre-asignado al registrarse)
- [x] **Fase 3 — Mi Perfil:** identificación completa, familia, contactos de emergencia, preferencias (dieta, tallas, hobbies)
- [x] **Fase 4 — Mi Trayectoria:** formación, experiencia, referencias, reconocimientos, HV en Storage privado
- [x] **Fase 5 — Competencias 360:** skills puntuadas por auto/pares/líder + valoración de entregables (calidad/oportunidad/costo)
- [x] **Fase 6 — Organigrama interactivo:** árbol por "reporta a" con multi-cargo, ramas colapsables y visibilidad configurable (rama/equipo/área/compañía)

### Siguientes pasos sugeridos (post-beta)
- Notificaciones por email (Supabase Edge Functions + Resend/SES)
- SSO con Google (Supabase Auth provider)
- Rol invitado por link/token para stakeholders externos
- Histórico multi-ciclo en Mi Desarrollo
- Realtime (badge de notificaciones en vivo)
