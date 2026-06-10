-- ============================================================
-- Performance Hub — Migración 0002: datos base
-- Equipos, ciclo activo y catálogos (comportamientos, habilidades,
-- contribución). Los usuarios demo se crean en la Fase 3 vía Auth.
-- ============================================================

-- EQUIPOS (UUIDs fijos para referenciar desde seeds posteriores)
insert into public.teams (id, name) values
  ('00000000-0000-4000-a000-000000000010', 'People Ops'),
  ('00000000-0000-4000-a000-000000000011', 'Diseño de Producto'),
  ('00000000-0000-4000-a000-000000000012', 'Ingeniería'),
  ('00000000-0000-4000-a000-000000000013', 'Marketing');

-- CICLO ACTIVO (Q2 2026, en fase de autoevaluación)
insert into public.cycles (id, name, start_date, end_date, status) values
  ('00000000-0000-4000-a000-000000000020', 'Q2 2026', '2026-04-01', '2026-06-30', 'self-review');

-- COMPORTAMIENTOS (§4.1-B)
insert into public.catalog_items (kind, key, name, description, sort_order) values
  ('behavior', 'colab',   'Colaboración', 'Trabaja efectivamente con otros, comparte conocimiento y apoya al equipo.', 1),
  ('behavior', 'comm',    'Comunicación directa y respetuosa', 'Expresa ideas con claridad, escucha activamente y da feedback constructivo.', 2),
  ('behavior', 'account', 'Accountability', 'Asume responsabilidad por sus compromisos y resultados.', 3),
  ('behavior', 'client',  'Orientación al cliente', 'Entiende y prioriza las necesidades del cliente interno o externo.', 4),
  ('behavior', 'learn',   'Aprendizaje y mejora continua', 'Busca activamente aprender, experimenta y mejora procesos.', 5);

-- HABILIDADES POR ROL (§4.1-C)
insert into public.catalog_items (kind, key, role_type, name, description, sort_order) values
  ('skill', 'design-think', 'designer', 'Pensamiento de diseño', 'Aplica metodologías de diseño centrado en el usuario.', 1),
  ('skill', 'visual',       'designer', 'Craft visual', 'Produce entregables de alta calidad visual y coherencia.', 2),
  ('skill', 'prototype',    'designer', 'Prototipado', 'Crea prototipos efectivos para validar hipótesis.', 3),
  ('skill', 'systems',      'designer', 'Pensamiento sistémico', 'Diseña considerando el sistema completo, no solo la pantalla.', 4),
  ('skill', 'code-quality', 'engineer', 'Calidad de código', 'Escribe código limpio, testeable y mantenible.', 1),
  ('skill', 'architecture', 'engineer', 'Criterio técnico', 'Toma decisiones técnicas fundamentadas y sostenibles.', 2),
  ('skill', 'debugging',    'engineer', 'Resolución de problemas', 'Diagnostica y resuelve problemas complejos eficientemente.', 3),
  ('skill', 'automation',   'engineer', 'Automatización', 'Identifica y automatiza tareas repetitivas.', 4),
  ('skill', 'strategy',     'marketing', 'Planeación estratégica', 'Define y ejecuta planes con visión de mediano plazo.', 1),
  ('skill', 'analytics',    'marketing', 'Orientación a datos', 'Basa decisiones en métricas y análisis.', 2),
  ('skill', 'creativity',   'marketing', 'Creatividad aplicada', 'Genera ideas innovadoras con impacto medible.', 3),
  ('skill', 'stakeholder',  'marketing', 'Gestión de aliados', 'Coordina eficazmente con múltiples partes interesadas.', 4),
  ('skill', 'planning',     'default', 'Planeación y organización', 'Prioriza, planifica y cumple plazos de forma autónoma.', 1),
  ('skill', 'autonomy',     'default', 'Autonomía', 'Trabaja de forma independiente sin supervisión constante.', 2),
  ('skill', 'judgment',     'default', 'Criterio', 'Toma decisiones acertadas con la información disponible.', 3),
  ('skill', 'adaptability', 'default', 'Adaptabilidad', 'Se ajusta a cambios con actitud constructiva.', 4);

-- CONTRIBUCIÓN AL SISTEMA (§4.1-D)
insert into public.catalog_items (kind, key, name, description, sort_order) values
  ('contribution', 'process',   'Mejora de procesos', 'Identificó e implementó mejoras en flujos de trabajo del equipo.', 1),
  ('contribution', 'mentoring', 'Mentoría', 'Apoyó activamente el crecimiento de otros colaboradores.', 2),
  ('contribution', 'docs',      'Documentación', 'Creó o mejoró documentación que beneficia al equipo/empresa.', 3),
  ('contribution', 'friction',  'Reducción de fricción', 'Eliminó obstáculos o simplificó procesos para otros.', 4);
