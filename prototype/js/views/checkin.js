// ============================================================
// Performance Hub — Check-in Mensual View
// ============================================================
import { state, getUserCheckIns, getUserObjectives, formatDate, timeAgo, renderAvatar, getUser } from '../app.js';
import { CHECKIN_PROMPTS } from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getCurrentMonthLabel() {
    const now = new Date();
    return `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;
}

function progressColor(pct) {
    if (pct >= 75) return 'primary';
    if (pct >= 50) return 'accent';
    return 'highlight';
}

function statusBadge(status) {
    const map = {
        'in-progress': { label: 'En progreso', color: 'accent' },
        'completed': { label: 'Completado', color: 'primary' },
        'pending': { label: 'Pendiente', color: 'slate' },
        'at-risk': { label: 'En riesgo', color: 'highlight' },
    };
    const s = map[status] || map['pending'];
    return `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-${s.color}/10 text-${s.color}">${s.label}</span>`;
}

// -------------------------------------------------------
// Section: New Check-in Form
// -------------------------------------------------------
function renderNewCheckinForm() {
    const user = state.currentUser;
    const objectives = getUserObjectives(user.id);
    const monthLabel = getCurrentMonthLabel();

    return `
    <section class="mb-10">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span class="material-symbols-outlined text-white text-2xl">event_available</span>
            </div>
            <div>
                <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Check-in de ${monthLabel}
                </h2>
                <p class="text-sm text-slate-500 mt-0.5">
                    Conversaci&oacute;n r&aacute;pida de 20-30 minutos sobre tu progreso
                </p>
            </div>
        </div>

        <!-- Guidance banner -->
        <div class="bg-primary/5 border border-primary/10 rounded-2xl p-5 mb-8 flex items-start gap-4">
            <span class="material-symbols-outlined text-primary text-xl mt-0.5">tips_and_updates</span>
            <div class="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <p class="font-semibold text-slate-800 dark:text-slate-200">Completa este check-in en menos de 15 minutos</p>
                <p>Piensa en <strong class="text-primary">hechos concretos, no opiniones</strong>. Este registro alimenta tu evaluaci&oacute;n trimestral y te ayuda a tener mejor visibilidad con tu facilitador/a.</p>
            </div>
        </div>

        <!-- Form card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">

            <!-- 1. Logros -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <label class="flex items-center gap-3 mb-3">
                    <span class="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg">emoji_events</span>
                    </span>
                    <div>
                        <span class="font-bold text-sm text-slate-900 dark:text-white">&iquest;Qu&eacute; lograste este mes?</span>
                        <span class="text-xs text-slate-400 ml-2">Obligatorio</span>
                    </div>
                </label>
                <textarea
                    id="checkin-achievements"
                    required
                    data-min-chars="30"
                    rows="4"
                    class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                    placeholder="Ej: Complet&eacute; 30 de 45 tokens del design system. Publiqu&eacute; documentaci&oacute;n interactiva en Storybook. Entregu&eacute; la auditor&iacute;a de accesibilidad de 3 flujos cr&iacute;ticos."
                ></textarea>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-[10px] text-slate-400 italic">Menciona entregables, m&eacute;tricas o resultados espec&iacute;ficos</p>
                    <span class="char-counter text-xs text-slate-400">0 caracteres (m&iacute;nimo 30)</span>
                </div>
            </div>

            <!-- 2. Obstaculos -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <label class="flex items-center gap-3 mb-3">
                    <span class="w-9 h-9 bg-highlight/10 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-highlight text-lg">block</span>
                    </span>
                    <div>
                        <span class="font-bold text-sm text-slate-900 dark:text-white">&iquest;Qu&eacute; obst&aacute;culos tuviste?</span>
                        <span class="text-xs text-slate-400 ml-2">Obligatorio</span>
                    </div>
                </label>
                <textarea
                    id="checkin-blockers"
                    required
                    data-min-chars="20"
                    rows="3"
                    class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                    placeholder="Ej: El equipo de backend a&uacute;n no tiene el API de temas lista, lo que bloquea la implementaci&oacute;n de dark mode."
                ></textarea>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-[10px] text-slate-400 italic">Identifica bloqueos reales, no excusas. Esto ayuda a tu facilitador/a a apoyarte</p>
                    <span class="char-counter text-xs text-slate-400">0 caracteres (m&iacute;nimo 20)</span>
                </div>
            </div>

            <!-- 3. Apoyo necesario -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <label class="flex items-center gap-3 mb-3">
                    <span class="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-accent text-lg">support_agent</span>
                    </span>
                    <div>
                        <span class="font-bold text-sm text-slate-900 dark:text-white">&iquest;En qu&eacute; necesitas apoyo?</span>
                    </div>
                </label>
                <textarea
                    id="checkin-support"
                    rows="3"
                    class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                    placeholder="Ej: Necesito 2 horas de pairing con Carlos para validar integraci&oacute;n de tokens CSS. Tambi&eacute;n una reuni&oacute;n con QA para alinear criterios de accesibilidad."
                ></textarea>
                <p class="text-[10px] text-slate-400 italic mt-1">Pedir ayuda no es debilidad, es estrategia. S&eacute; espec&iacute;fico/a en lo que necesitas</p>
            </div>

            <!-- 4. Feedback rapido: Continua / Ajusta / Inicia -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center gap-3 mb-4">
                    <span class="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-slate-500 text-lg">conversion_path</span>
                    </span>
                    <div>
                        <span class="font-bold text-sm text-slate-900 dark:text-white">Feedback r&aacute;pido: Contin&uacute;a / Ajusta / Inicia</span>
                        <p class="text-xs text-slate-400 mt-0.5">Reflexi&oacute;n breve sobre tu propio desempe&ntilde;o</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Continua -->
                    <div class="relative">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-xl"></div>
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl pt-4 p-4 bg-primary/[0.02]">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="material-symbols-outlined text-primary text-base">play_arrow</span>
                                <span class="font-bold text-xs text-primary uppercase tracking-wider">Contin&uacute;a</span>
                            </div>
                            <p class="text-[11px] text-slate-500 mb-3">${CHECKIN_PROMPTS.continue}</p>
                            <textarea
                                id="checkin-fb-continue"
                                rows="3"
                                class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                                placeholder="Ej: Las sesiones de office hours..."
                            ></textarea>
                        </div>
                    </div>

                    <!-- Ajusta -->
                    <div class="relative">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-accent rounded-t-xl"></div>
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl pt-4 p-4 bg-accent/[0.02]">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="material-symbols-outlined text-accent text-base">tune</span>
                                <span class="font-bold text-xs text-accent uppercase tracking-wider">Ajusta</span>
                            </div>
                            <p class="text-[11px] text-slate-500 mb-3">${CHECKIN_PROMPTS.adjust}</p>
                            <textarea
                                id="checkin-fb-adjust"
                                rows="3"
                                class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:ring-2 focus:ring-accent focus:border-accent transition-all resize-none"
                                placeholder="Ej: Dedicar bloques m&aacute;s largos a..."
                            ></textarea>
                        </div>
                    </div>

                    <!-- Inicia -->
                    <div class="relative">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-highlight rounded-t-xl"></div>
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl pt-4 p-4 bg-highlight/[0.02]">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="material-symbols-outlined text-highlight text-base">add_circle</span>
                                <span class="font-bold text-xs text-highlight uppercase tracking-wider">Inicia</span>
                            </div>
                            <p class="text-[11px] text-slate-500 mb-3">${CHECKIN_PROMPTS.start}</p>
                            <textarea
                                id="checkin-fb-start"
                                rows="3"
                                class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:ring-2 focus:ring-highlight focus:border-highlight transition-all resize-none"
                                placeholder="Ej: Hacer una sesi&oacute;n semanal de..."
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. Actualizacion de objetivos -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center gap-3 mb-4">
                    <span class="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg">flag</span>
                    </span>
                    <div>
                        <span class="font-bold text-sm text-slate-900 dark:text-white">Actualizaci&oacute;n de objetivos</span>
                        <p class="text-xs text-slate-400 mt-0.5">Revisa el avance de tus objetivos del ciclo actual</p>
                    </div>
                </div>

                ${objectives.length > 0 ? `
                    <div class="space-y-4">
                        ${objectives.map((obj, idx) => `
                            <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                <div class="flex items-start justify-between gap-4 mb-3">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Obj ${idx + 1}</span>
                                            <span class="text-xs font-semibold text-slate-400">&middot;</span>
                                            <span class="text-xs font-semibold text-slate-400">Peso: ${obj.weight}%</span>
                                            ${statusBadge(obj.status)}
                                        </div>
                                        <h4 class="font-bold text-sm text-slate-900 dark:text-white">${obj.title}</h4>
                                        <p class="text-xs text-slate-500 mt-0.5">${obj.metric}</p>
                                    </div>
                                </div>

                                <!-- Progress bar -->
                                <div class="mb-3">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progreso actual</span>
                                        <span class="text-xs font-extrabold text-${progressColor(obj.progress)}">${obj.progress}%</span>
                                    </div>
                                    <div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div class="h-full bg-${progressColor(obj.progress)} rounded-full transition-all duration-500" style="width: ${obj.progress}%"></div>
                                    </div>
                                </div>

                                <!-- Update inputs -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nuevo progreso (%)</label>
                                        <input
                                            type="number"
                                            min="0" max="100"
                                            value="${obj.progress}"
                                            class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                            id="obj-progress-${obj.id}"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nota breve</label>
                                        <input
                                            type="text"
                                            class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                            placeholder="Ej: Avance en tokens de color..."
                                            id="obj-note-${obj.id}"
                                        />
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center py-8 text-slate-400">
                        <span class="material-symbols-outlined text-4xl mb-2">flag</span>
                        <p class="text-sm">No tienes objetivos registrados en este ciclo.</p>
                    </div>
                `}
            </div>

            <!-- Action buttons -->
            <div class="p-6 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p class="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">info</span>
                    Puedes guardar borrador y completar despu&eacute;s. El env&iacute;o es visible para tu facilitador/a.
                </p>
                <div class="flex items-center gap-3">
                    <button
                        data-action="save-draft"
                        class="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-base">save</span>
                        Guardar borrador
                    </button>
                    <button
                        data-action="submit-form"
                        class="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-base">send</span>
                        Enviar check-in
                    </button>
                </div>
            </div>
        </div>
    </section>
    `;
}

// -------------------------------------------------------
// Section: Check-in History (Timeline)
// -------------------------------------------------------
function renderCheckinHistory() {
    const user = state.currentUser;
    const checkIns = getUserCheckIns(user.id).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (checkIns.length === 0) {
        return `
        <section>
            <div class="flex items-center gap-3 mb-6">
                <span class="material-symbols-outlined text-slate-400 text-2xl">history</span>
                <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">Historial de check-ins</h3>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                <span class="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">event_busy</span>
                <p class="text-sm text-slate-500 font-semibold">A&uacute;n no tienes check-ins registrados</p>
                <p class="text-xs text-slate-400 mt-1">Tu primer check-in aparecer&aacute; aqu&iacute; como parte de tu l&iacute;nea de tiempo</p>
            </div>
        </section>
        `;
    }

    return `
    <section>
        <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-slate-400 text-2xl">history</span>
            <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">Historial de check-ins</h3>
            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">${checkIns.length} registro${checkIns.length !== 1 ? 's' : ''}</span>
        </div>

        <!-- Timeline -->
        <div class="relative">
            <!-- Timeline line -->
            <div class="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

            <div class="space-y-6">
                ${checkIns.map((ci, idx) => {
                    const dateObj = new Date(ci.date + 'T00:00:00');
                    const monthName = MONTHS_ES[dateObj.getMonth()];
                    const year = dateObj.getFullYear();

                    return `
                    <div class="relative pl-12">
                        <!-- Timeline dot -->
                        <div class="absolute left-[11px] top-6 w-[18px] h-[18px] bg-white dark:bg-slate-900 border-[3px] border-primary rounded-full z-10 ${idx === 0 ? 'ring-4 ring-primary/20' : ''}"></div>

                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <!-- Header -->
                            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <span class="material-symbols-outlined text-primary">calendar_month</span>
                                    <div>
                                        <h4 class="font-bold text-sm text-slate-900 dark:text-white">Check-in de ${monthName} ${year}</h4>
                                        <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(ci.date)} &middot; ${timeAgo(ci.date)}</p>
                                    </div>
                                </div>
                                ${idx === 0 ? '<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">M&aacute;s reciente</span>' : ''}
                            </div>

                            <div class="p-6 space-y-5">
                                <!-- Logros -->
                                ${ci.achievements ? `
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="material-symbols-outlined text-primary text-base">emoji_events</span>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Logros</span>
                                    </div>
                                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${ci.achievements}</p>
                                </div>
                                ` : ''}

                                <!-- Obstaculos -->
                                ${ci.blockers ? `
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="material-symbols-outlined text-highlight text-base">block</span>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Obst&aacute;culos</span>
                                    </div>
                                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${ci.blockers}</p>
                                </div>
                                ` : ''}

                                <!-- Apoyo solicitado -->
                                ${ci.support ? `
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="material-symbols-outlined text-accent text-base">support_agent</span>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Apoyo solicitado</span>
                                    </div>
                                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${ci.support}</p>
                                </div>
                                ` : ''}

                                <!-- Feedback: Continua / Ajusta / Inicia -->
                                ${ci.feedback && (ci.feedback.continue || ci.feedback.adjust || ci.feedback.start) ? `
                                <div>
                                    <div class="flex items-center gap-2 mb-3">
                                        <span class="material-symbols-outlined text-slate-400 text-base">conversion_path</span>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Feedback r&aacute;pido</span>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        ${ci.feedback.continue ? `
                                        <div class="rounded-xl border border-primary/20 bg-primary/[0.03] p-3">
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1 mb-1.5">
                                                <span class="material-symbols-outlined text-xs">play_arrow</span> Contin&uacute;a
                                            </span>
                                            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${ci.feedback.continue}</p>
                                        </div>
                                        ` : ''}
                                        ${ci.feedback.adjust ? `
                                        <div class="rounded-xl border border-accent/20 bg-accent/[0.03] p-3">
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1 mb-1.5">
                                                <span class="material-symbols-outlined text-xs">tune</span> Ajusta
                                            </span>
                                            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${ci.feedback.adjust}</p>
                                        </div>
                                        ` : ''}
                                        ${ci.feedback.start ? `
                                        <div class="rounded-xl border border-highlight/20 bg-highlight/[0.03] p-3">
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-highlight flex items-center gap-1 mb-1.5">
                                                <span class="material-symbols-outlined text-xs">add_circle</span> Inicia
                                            </span>
                                            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${ci.feedback.start}</p>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                                ` : ''}

                                <!-- Actualizacion de objetivos -->
                                ${ci.objectiveUpdates ? `
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="material-symbols-outlined text-primary text-base">flag</span>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actualizaci&oacute;n de objetivos</span>
                                    </div>
                                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-2.5 border border-slate-100 dark:border-slate-700">${ci.objectiveUpdates}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    </section>
    `;
}

// -------------------------------------------------------
// Main render
// -------------------------------------------------------
export function render() {
    return `
    <div class="max-w-4xl mx-auto">
        ${renderNewCheckinForm()}
        ${renderCheckinHistory()}
    </div>
    `;
}
