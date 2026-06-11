# Performance Hub

Plataforma de gestión de evaluaciones de desempeño 360° y feedback continuo para culturas horizontales: ciclos de evaluación, check-ins mensuales, feedback de pares, calibración y planes de desarrollo.

**🔗 Beta en línea:** https://dyoma-web.github.io/performance-hub/ (se despliega automáticamente con cada push a `main`)

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `app/` | Aplicación web — Vite + React + TypeScript + Tailwind CSS v4 |
| `supabase/` | Esquema de base de datos, migraciones y seed (Postgres / Supabase) |
| `docs/` | Especificación funcional del producto |
| `prototype/` | Prototipo original de alta fidelidad (vanilla JS) — solo referencia |

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS v4, React Router
- **Backend:** Supabase (Postgres, Auth, Row Level Security, Storage)
- **Deploy:** Vercel

## Desarrollo local

```bash
cd app
cp .env.example .env.local   # completar con credenciales de Supabase
npm install
npm run dev
```

## Plan de desarrollo (beta)

- [x] **Fase 1 — Fundación:** repo, scaffold, design system
- [x] **Fase 2 — Datos:** esquema Postgres + RLS + seed (ver [supabase/README.md](supabase/README.md))
- [x] **Fase 3 — Auth + Shell:** login, navegación por rol (RBAC), usuarios demo
- [ ] **Fase 4 — Evaluación núcleo:** objetivos + autoevaluación funcional
- [ ] **Fase 5 — Multi-fuente:** check-ins, peer feedback, revisión del facilitador
- [ ] **Fase 6 — Conversación:** reunión 1:1, acuerdos, plan de desarrollo vivo
- [ ] **Fase 7 — Admin:** ciclos, calibración, reportes, directorio
- [ ] **Fase 8 — Beta:** tests, accesibilidad, deploy
