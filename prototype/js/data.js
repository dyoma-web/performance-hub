// ============================================================
// Performance Hub — Datos Demo / Seed Data
// ============================================================

export const SCALE = [
    { value: 1, label: 'En desarrollo', description: 'Requiere apoyo frecuente; resultados inconsistentes', color: 'highlight', icon: 'trending_down' },
    { value: 2, label: 'Cumple lo esperado', description: 'Entrega lo acordado con autonomía básica', color: 'accent', icon: 'check_circle' },
    { value: 3, label: 'Sólido / Consistente', description: 'Supera expectativas de forma repetida y sostenida', color: 'primary', icon: 'trending_up' },
    { value: 4, label: 'Sobresaliente', description: 'Impacto excepcional; eleva al equipo y al sistema', color: 'gold', icon: 'stars' },
];

export const BEHAVIORS = [
    { id: 'colab', name: 'Colaboración', description: 'Trabaja efectivamente con otros, comparte conocimiento y apoya al equipo.' },
    { id: 'comm', name: 'Comunicación directa y respetuosa', description: 'Expresa ideas con claridad, escucha activamente y da feedback constructivo.' },
    { id: 'account', name: 'Accountability', description: 'Asume responsabilidad por sus compromisos y resultados.' },
    { id: 'client', name: 'Orientación al cliente', description: 'Entiende y prioriza las necesidades del cliente interno o externo.' },
    { id: 'learn', name: 'Aprendizaje y mejora continua', description: 'Busca activamente aprender, experimenta y mejora procesos.' },
];

export const ROLE_SKILLS = {
    designer: [
        { id: 'design-think', name: 'Pensamiento de diseño', description: 'Aplica metodologías de diseño centrado en el usuario.' },
        { id: 'visual', name: 'Craft visual', description: 'Produce entregables de alta calidad visual y coherencia.' },
        { id: 'prototype', name: 'Prototipado', description: 'Crea prototipos efectivos para validar hipótesis.' },
        { id: 'systems', name: 'Pensamiento sistémico', description: 'Diseña considerando el sistema completo, no solo la pantalla.' },
    ],
    engineer: [
        { id: 'code-quality', name: 'Calidad de código', description: 'Escribe código limpio, testeable y mantenible.' },
        { id: 'architecture', name: 'Criterio técnico', description: 'Toma decisiones técnicas fundamentadas y sostenibles.' },
        { id: 'debugging', name: 'Resolución de problemas', description: 'Diagnostica y resuelve problemas complejos eficientemente.' },
        { id: 'automation', name: 'Automatización', description: 'Identifica y automatiza tareas repetitivas.' },
    ],
    marketing: [
        { id: 'strategy', name: 'Planeación estratégica', description: 'Define y ejecuta planes con visión de mediano plazo.' },
        { id: 'analytics', name: 'Orientación a datos', description: 'Basa decisiones en métricas y análisis.' },
        { id: 'creativity', name: 'Creatividad aplicada', description: 'Genera ideas innovadoras con impacto medible.' },
        { id: 'stakeholder', name: 'Gestión de aliados', description: 'Coordina eficazmente con múltiples partes interesadas.' },
    ],
    default: [
        { id: 'planning', name: 'Planeación y organización', description: 'Prioriza, planifica y cumple plazos de forma autónoma.' },
        { id: 'autonomy', name: 'Autonomía', description: 'Trabaja de forma independiente sin supervisión constante.' },
        { id: 'judgment', name: 'Criterio', description: 'Toma decisiones acertadas con la información disponible.' },
        { id: 'adaptability', name: 'Adaptabilidad', description: 'Se ajusta a cambios con actitud constructiva.' },
    ],
};

export const CONTRIBUTION_ITEMS = [
    { id: 'process', name: 'Mejora de procesos', description: 'Identificó e implementó mejoras en flujos de trabajo del equipo.' },
    { id: 'mentoring', name: 'Mentoría', description: 'Apoyó activamente el crecimiento de otros colaboradores.' },
    { id: 'docs', name: 'Documentación', description: 'Creó o mejoró documentación que beneficia al equipo/empresa.' },
    { id: 'friction', name: 'Reducción de fricción', description: 'Eliminó obstáculos o simplificó procesos para otros.' },
];

export const CHECKIN_PROMPTS = {
    continue: '¿Qué deberías seguir haciendo? (algo que funciona bien)',
    adjust: '¿Qué deberías ajustar? (algo que puede mejorar)',
    start: '¿Qué deberías empezar a hacer? (algo nuevo)',
};

export const FEEDBACK_TIPS = [
    { bad: 'Buen trabajo', better: 'Tu presentación del rediseño del checkout fue clara y persuasiva. El equipo de ingeniería pudo empezar a implementar al día siguiente.' },
    { bad: 'Necesita mejorar', better: 'En las últimas 3 reuniones de sprint, los entregables llegaron 2-3 días después del deadline. Propongo que revisemos juntos la estimación de tiempos.' },
    { bad: 'Es muy bueno en lo que hace', better: 'En el proyecto de accesibilidad, identificó 12 violaciones WCAG que nadie más había detectado, lo que evitó una demanda potencial.' },
    { bad: 'No colabora bien', better: 'En el proyecto X, no compartió los avances de diseño hasta la fecha final, lo que dejó solo 2 días para revisión técnica. Sugiero syncs semanales de 15 min.' },
];

// -------------------------------------------------------
// Usuarios demo
// -------------------------------------------------------
export const users = [
    {
        id: 'u1', name: 'Alejandra Rivera', email: 'alejandra@empresa.com',
        role: 'colaborador', teamId: 't1', position: 'Senior UI Designer',
        avatar: 'AR', roleType: 'designer',
    },
    {
        id: 'u2', name: 'Sara Méndez', email: 'sara@empresa.com',
        role: 'facilitador', teamId: 't1', position: 'Design Lead',
        avatar: 'SM', roleType: 'designer',
    },
    {
        id: 'u3', name: 'Carlos Herrera', email: 'carlos@empresa.com',
        role: 'colaborador', teamId: 't2', position: 'Frontend Engineer',
        avatar: 'CH', roleType: 'engineer',
    },
    {
        id: 'u4', name: 'Elena Vega', email: 'elena@empresa.com',
        role: 'colaborador', teamId: 't1', position: 'Product Designer',
        avatar: 'EV', roleType: 'designer',
    },
    {
        id: 'u5', name: 'Marco Torres', email: 'marco@empresa.com',
        role: 'colaborador', teamId: 't2', position: 'Backend Engineer',
        avatar: 'MT', roleType: 'engineer',
    },
    {
        id: 'u6', name: 'Daniela Ruiz', email: 'daniela@empresa.com',
        role: 'admin', teamId: 't0', position: 'People Ops Lead',
        avatar: 'DR', roleType: 'default',
    },
    {
        id: 'u7', name: 'Jorge Castillo', email: 'jorge@empresa.com',
        role: 'facilitador', teamId: 't2', position: 'Engineering Manager',
        avatar: 'JC', roleType: 'engineer',
    },
    {
        id: 'u8', name: 'Lucía Paredes', email: 'lucia@empresa.com',
        role: 'colaborador', teamId: 't3', position: 'Marketing Specialist',
        avatar: 'LP', roleType: 'marketing',
    },
];

export const teams = [
    { id: 't0', name: 'People Ops', parentId: null },
    { id: 't1', name: 'Diseño de Producto', parentId: null },
    { id: 't2', name: 'Ingeniería', parentId: null },
    { id: 't3', name: 'Marketing', parentId: null },
];

// -------------------------------------------------------
// Ciclo activo
// -------------------------------------------------------
export const cycles = [
    {
        id: 'c1',
        name: 'Q4 2025',
        start: '2025-10-01',
        end: '2025-12-31',
        status: 'open', // draft | open | self-review | peer-feedback | manager-review | meeting | calibration | finalized | archived
        config: {
            weights: { results: 40, behaviors: 30, skills: 20, contribution: 10 },
            peerAnonymous: false,
            requireEvidenceForAll: true,
            minFeedforwardActions: 2,
        },
    },
];

// -------------------------------------------------------
// Objetivos (para Alejandra Rivera - u1)
// -------------------------------------------------------
export const objectives = [
    {
        id: 'obj1', cycleId: 'c1', userId: 'u1',
        title: 'Rediseñar el Design System Core',
        metric: 'Completar 45 tokens primarios y documentar en Storybook',
        weight: 40, progress: 75, status: 'in-progress',
        evidenceLinks: ['https://storybook.empresa.com/tokens', 'JIRA-DS-142'],
    },
    {
        id: 'obj2', cycleId: 'c1', userId: 'u1',
        title: 'Mejorar accesibilidad de la plataforma',
        metric: 'Alcanzar cumplimiento WCAG 2.1 AA en flujos críticos',
        weight: 35, progress: 40, status: 'in-progress',
        evidenceLinks: ['https://notion.so/accessibility-audit'],
    },
    {
        id: 'obj3', cycleId: 'c1', userId: 'u1',
        title: 'Mentoría a diseñadores junior',
        metric: '3 juniors con onboarding completado y primer proyecto entregado',
        weight: 25, progress: 90, status: 'in-progress',
        evidenceLinks: [],
    },
];

// -------------------------------------------------------
// Reviews existentes
// -------------------------------------------------------
export const reviews = [
    {
        id: 'r1', cycleId: 'c1', evaluateeId: 'u1', reviewerId: 'u1',
        type: 'self', status: 'draft',
        items: [],
        feedforward: [],
        recognition: '',
    },
    {
        id: 'r2', cycleId: 'c1', evaluateeId: 'u1', reviewerId: 'u2',
        type: 'facilitator', status: 'pending',
        items: [],
        feedforward: [],
        recognition: '',
    },
    {
        id: 'r3', cycleId: 'c1', evaluateeId: 'u1', reviewerId: 'u4',
        type: 'peer', status: 'completed',
        items: [
            { block: 'behaviors', itemId: 'colab', score: 3, comment: 'Alejandra siempre está disponible para revisar diseños y dar feedback constructivo. En el proyecto de checkout, dedicó 3 horas extra para ayudarme con los edge cases de responsive.', evidenceLinks: [] },
            { block: 'behaviors', itemId: 'comm', score: 3, comment: 'Comunica sus ideas con mucha claridad en las critiques de diseño. Siempre basa sus opiniones en principios, no en gustos personales.', evidenceLinks: [] },
        ],
        feedforward: [
            { action: 'Compartir más temprano los WIPs para tener más tiempo de iteración.', indicator: 'WIPs compartidos al 50% del sprint', dueDate: '2026-01-15', responsible: 'u1' },
        ],
        recognition: 'Lo más valioso fue cómo elevó la calidad visual de todo el equipo con el nuevo sistema de tokens. Todos estamos diseñando más rápido y más consistente.',
    },
    {
        id: 'r4', cycleId: 'c1', evaluateeId: 'u1', reviewerId: 'u3',
        type: 'peer', status: 'completed',
        items: [
            { block: 'behaviors', itemId: 'colab', score: 4, comment: 'Cuando el equipo de frontend necesitó los tokens en formato CSS custom properties, Alejandra no solo los entregó sino que creó una guía de migración paso a paso. Esto nos ahorró ~2 sprints de trabajo.', evidenceLinks: ['https://notion.so/token-migration-guide'] },
        ],
        feedforward: [
            { action: 'Participar en los standups de ingeniería 1 vez por semana para alinear mejor diseño-desarrollo.', indicator: 'Asistencia semanal registrada', dueDate: '2026-01-31', responsible: 'u1' },
        ],
        recognition: 'Su guía de migración de tokens fue lo mejor que nos pasó este trimestre. Convirtió un problema técnico en una solución que cualquier dev puede seguir.',
    },
];

// -------------------------------------------------------
// Check-ins mensuales
// -------------------------------------------------------
export const checkIns = [
    {
        id: 'ci1', userId: 'u1', date: '2025-10-31', cycleId: 'c1',
        achievements: 'Completé 30 de 45 tokens del design system. Publiqué la primera versión en Storybook con documentación interactiva.',
        blockers: 'El equipo de backend aún no tiene el API de temas lista, lo que bloquea la implementación de dark mode en los tokens.',
        support: 'Necesito 2 horas de pairing con Carlos (frontend) para validar que los tokens CSS se integran correctamente.',
        feedback: { continue: 'La documentación interactiva en Storybook', adjust: 'Pedir feedback más temprano en el proceso de diseño de tokens', start: 'Hacer una sesión semanal de office hours para dudas de design system' },
        objectiveUpdates: 'Objetivo 1 avanzó del 50% al 65%. Sin cambios en los otros.',
    },
    {
        id: 'ci2', userId: 'u1', date: '2025-11-30', cycleId: 'c1',
        achievements: 'Tokens al 75%. Auditoría de accesibilidad completada en 3 de 5 flujos críticos. Mentoré a 2 juniors que ya entregaron su primer proyecto.',
        blockers: 'La herramienta de auditoría automática (axe) tiene falsos positivos en componentes con shadow DOM.',
        support: 'Reunión con el equipo de QA para alinear criterios de accesibilidad.',
        feedback: { continue: 'Las sesiones de office hours están funcionando muy bien', adjust: 'Dedicar bloques de tiempo más largos a accesibilidad, las interrupciones fragmentan el análisis', start: '' },
        objectiveUpdates: 'Objetivo 1: 75%. Objetivo 2: 40%. Objetivo 3: 90%.',
    },
];

// -------------------------------------------------------
// Planes de acción (feedforward consolidado)
// -------------------------------------------------------
export const actionPlans = [
    {
        id: 'ap1', cycleId: 'c1', userId: 'u1',
        actions: [
            { id: 'a1', action: 'Compartir WIPs al 50% del sprint', indicator: 'Al menos 2 WIPs compartidos por sprint en el canal de diseño', dueDate: '2026-01-15', responsible: 'u1', checkins: [], status: 'pending' },
            { id: 'a2', action: 'Asistir al standup de ingeniería 1x/semana', indicator: 'Asistencia registrada semanalmente', dueDate: '2026-01-31', responsible: 'u1', checkins: [], status: 'pending' },
            { id: 'a3', action: 'Certificarse en WCAG 2.1', indicator: 'Certificación obtenida', dueDate: '2026-03-31', responsible: 'u1', checkins: [], status: 'pending' },
        ],
    },
];

// -------------------------------------------------------
// Timeline de evidencia (eventos agregados)
// -------------------------------------------------------
export const evidenceTimeline = [
    { id: 'e1', userId: 'u1', date: '2025-12-05', type: 'peer-feedback', source: 'Elena Vega', summary: 'Reconocimiento por calidad del sistema de tokens y apoyo en edge cases de responsive.' },
    { id: 'e2', userId: 'u1', date: '2025-11-28', type: 'peer-feedback', source: 'Carlos Herrera', summary: 'La guía de migración de tokens ahorró ~2 sprints al equipo de frontend.' },
    { id: 'e3', userId: 'u1', date: '2025-11-20', type: 'jira', source: 'JIRA-DS-142', summary: 'Design System v2.0 — Status: Done. 34 tokens publicados en Storybook.' },
    { id: 'e4', userId: 'u1', date: '2025-11-15', type: 'checkin', source: 'Check-in Nov', summary: 'Tokens al 75%. Auditoría accesibilidad 3/5 flujos. 2 juniors con proyecto entregado.' },
    { id: 'e5', userId: 'u1', date: '2025-10-31', type: 'checkin', source: 'Check-in Oct', summary: '30/45 tokens completados. Storybook documentación publicada.' },
    { id: 'e6', userId: 'u1', date: '2025-10-15', type: 'milestone', source: 'Hito', summary: '1 año en el equipo de Diseño de Producto.' },
    { id: 'e7', userId: 'u1', date: '2025-10-02', type: '1on1', source: 'Sara Méndez', summary: 'Se discutió ruta de crecimiento hacia Design Lead. Alejandra expresó interés en mentoría y accesibilidad.' },
];

// -------------------------------------------------------
// Datos para Admin
// -------------------------------------------------------
export const adminStats = {
    completion: 72,
    activeCycles: 1,
    pendingCalibrations: 8,
    daysToDeadline: 21,
    teamProgress: [
        { teamId: 't1', teamName: 'Diseño de Producto', lead: 'Sara Méndez', leadAvatar: 'SM', selfReview: 100, peerFeedback: 75, managerReview: 50, overall: 75, status: 'manager-review' },
        { teamId: 't2', teamName: 'Ingeniería', lead: 'Jorge Castillo', leadAvatar: 'JC', selfReview: 90, peerFeedback: 60, managerReview: 20, overall: 57, status: 'peer-feedback' },
        { teamId: 't3', teamName: 'Marketing', lead: 'Por asignar', leadAvatar: '??', selfReview: 40, peerFeedback: 10, managerReview: 0, overall: 17, status: 'self-review' },
    ],
    scoreDistribution: [
        { score: 1, count: 2, percent: 5 },
        { score: 2, count: 8, percent: 20 },
        { score: 3, count: 22, percent: 55 },
        { score: 4, count: 8, percent: 20 },
    ],
    biasAlerts: [
        { teamId: 't2', teamName: 'Ingeniería', alert: 'El 80% de las evaluaciones están en "3 - Sólido". Posible sesgo de tendencia central.', severity: 'warning' },
        { teamId: 't1', teamName: 'Diseño de Producto', alert: '2 calificaciones de "4 - Sobresaliente" sin evidencia adjunta.', severity: 'error' },
    ],
};

// -------------------------------------------------------
// Meetings 1:1
// -------------------------------------------------------
export const meetings = [
    {
        id: 'm1', cycleId: 'c1', evaluateeId: 'u1', facilitatorId: 'u2',
        date: '2026-01-10', time: '10:30', duration: 45,
        status: 'scheduled',
        notes: '',
        agreements: [],
    },
];
