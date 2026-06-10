# Base de datos — Supabase

Migraciones SQL versionadas del esquema de Performance Hub.

## Esquema (16 tablas)

| Tabla | Propósito |
|---|---|
| `teams`, `profiles` | Estructura organizacional y usuarios (extiende `auth.users`) |
| `cycles` | Ciclos de evaluación con workflow de 9 estados y config (pesos, anonimato) |
| `catalog_items` | Comportamientos, habilidades por rol y contribución (configurables) |
| `objectives` | Objetivos del ciclo (bloque Resultados) con peso y evidencia |
| `reviews`, `review_items` | Evaluaciones multi-fuente (self/peer/facilitator/stakeholder) |
| `feedforward_items` | Acciones propuestas en cada review |
| `plan_actions`, `action_notes` | Plan de desarrollo vivo con notas de avance |
| `checkins` | Check-ins mensuales (Continúa/Ajusta/Inicia) |
| `meetings`, `agreements` | Reuniones 1:1 con acuerdos y firma bilateral |
| `calibrations` | Ajustes de calibración con racional obligatorio |
| `notifications` | Notificaciones in-app |
| `audit_log` | Auditoría inmutable (solo insert vía trigger, lectura solo admin) |

## Reglas de negocio a nivel de BD

- **"No 4 sin evidencia"** (spec §5/§14): `CHECK` en `review_items` — un puntaje 4 exige link de evidencia o comentario ≥80 caracteres. Todo puntaje exige comentario ≥30 caracteres.
- **Racional de calibración obligatorio** (§7): `CHECK` en `calibrations` — cambiar una nota sin racional ≥20 caracteres es rechazado.
- **Auditoría inmutable** (§8): triggers `AFTER INSERT/UPDATE/DELETE` sobre cycles, reviews, review_items, calibrations, plan_actions y objectives; sin políticas de update/delete.
- **RBAC vía RLS** (§2): colaborador ve lo suyo; facilitador ve su equipo; peer solo sus reviews asignadas; el evaluado solo ve feedback `submitted`; admin gestiona todo. Solo admin cambia roles/equipos (trigger).

## Cómo aplicar

**Opción A — SQL Editor (recomendada para empezar):** en el dashboard de Supabase → SQL Editor → pegar y ejecutar `0001_initial_schema.sql` y luego `0002_seed_base.sql`.

**Opción B — Supabase CLI:**
```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```
