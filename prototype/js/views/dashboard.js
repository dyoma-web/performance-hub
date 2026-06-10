// ============================================================
// Performance Hub — Dashboard View
// ============================================================
import { state, navigate, getUser, getTeam, getUserObjectives, getUserCheckIns, getUserReviews, getUserActionPlan, getEvidence, formatDate, timeAgo, progressColor, statusLabel, statusColor, renderAvatar } from '../app.js';
import * as Data from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const CYCLE_PHASES = [
    { key: 'self-review',      label: 'Autoevaluaci\u00f3n',       icon: 'rate_review' },
    { key: 'peer-feedback',    label: 'Feedback de Pares',    icon: 'group' },
    { key: 'manager-review',   label: 'Revisi\u00f3n Facilitador', icon: 'supervisor_account' },
    { key: 'meeting',          label: 'Reuni\u00f3n 1:1',         icon: 'handshake' },
    { key: 'finalized',        label: 'Finalizado',           icon: 'verified' },
];

function phaseIndex(statusKey) {
    const idx = CYCLE_PHASES.findIndex(p => p.key === statusKey);
    return idx === -1 ? 0 : idx;
}

function getFirstName(fullName) {
    return (fullName || '').split(' ')[0];
}

function cycleProgressPercent() {
    const cycle = state.currentCycle;
    if (!cycle) return 0;
    const start = new Date(cycle.start + 'T00:00:00');
    const end   = new Date(cycle.end + 'T00:00:00');
    const now   = new Date();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
}

function objectivesWeightedProgress(objectives) {
    if (!objectives.length) return 0;
    const totalWeight = objectives.reduce((s, o) => s + o.weight, 0);
    if (totalWeight === 0) return 0;
    return Math.round(objectives.reduce((s, o) => s + (o.progress * o.weight), 0) / totalWeight);
}

function getNextCheckInDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
    const day = nextMonth.getDate();
    const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${day} de ${monthNames[nextMonth.getMonth()]}`;
}

function daysUntilNextCheckIn() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(0, Math.ceil((lastDay - now) / (1000 * 60 * 60 * 24)));
}

// -------------------------------------------------------
// Colaborador Dashboard
// -------------------------------------------------------
function renderColaborador() {
    const user = state.currentUser;
    const objectives = getUserObjectives(user.id);
    const actionPlan = getUserActionPlan(user.id);
    const actions = actionPlan ? actionPlan.actions : [];
    const reviews = getUserReviews(user.id);
    const peerReviews = reviews.filter(r => r.type === 'peer' && r.status === 'completed');
    const checkIns = getUserCheckIns(user.id);
    const cyclePct = cycleProgressPercent();
    const currentPhaseIdx = phaseIndex(state.currentCycle.status);
    const objProgress = objectivesWeightedProgress(objectives);
    const objectivesOnTrack = objectives.filter(o => o.progress >= 50).length;
    const pendingActions = actions.filter(a => a.status === 'pending' || a.status === 'in-progress');
    const completedActions = actions.filter(a => a.status === 'completed');

    return `
    <div class="max-w-6xl mx-auto space-y-8">

        <!-- ============ GREETING ============ -->
        <header class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
                <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                    <span class="material-symbols-outlined text-xs align-middle mr-1">waving_hand</span>
                    Panel de crecimiento
                </p>
                <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    Hola, ${getFirstName(user.name)}
                </h2>
                <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                    Llevas un <span class="text-primary font-extrabold">${cyclePct}%</span> del ciclo
                    <span class="font-bold text-slate-700 dark:text-slate-300">${state.currentCycle.name}</span>.
                    Tu avance ponderado en objetivos es <span class="text-${progressColor(objProgress)} font-extrabold">${objProgress}%</span>.
                </p>
            </div>
            <div class="flex gap-3 flex-shrink-0">
                <button class="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                        data-action="navigate" data-param="self-review">
                    <span class="material-symbols-outlined text-lg text-primary">edit_note</span>
                    Mi Evaluaci\u00f3n
                </button>
            </div>
        </header>

        <!-- ============ CYCLE STEPPER ============ -->
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-sm">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-6">Fases del ciclo</p>
            <div class="flex justify-between relative px-2 lg:px-4">
                <!-- Connector line -->
                <div class="absolute top-5 left-10 right-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <div class="h-full bg-primary rounded-full transition-all duration-700"
                         style="width: ${currentPhaseIdx === 0 ? '0%' : Math.round((currentPhaseIdx / (CYCLE_PHASES.length - 1)) * 100) + '%'}"></div>
                </div>
                ${CYCLE_PHASES.map((phase, i) => {
                    const isCompleted = i < currentPhaseIdx;
                    const isCurrent = i === currentPhaseIdx;
                    const isFuture = i > currentPhaseIdx;

                    let circleClass, labelClass;
                    if (isCompleted) {
                        circleClass = 'bg-primary text-white shadow-lg shadow-primary/30';
                        labelClass = 'text-slate-700 dark:text-slate-300 font-bold';
                    } else if (isCurrent) {
                        circleClass = 'bg-white dark:bg-slate-900 border-[3px] border-accent text-accent shadow-md';
                        labelClass = 'text-accent font-extrabold';
                    } else {
                        circleClass = 'bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400';
                        labelClass = 'text-slate-400 font-medium';
                    }

                    return `
                    <div class="relative z-10 flex flex-col items-center gap-2.5 flex-1">
                        <div class="w-10 h-10 rounded-full ${circleClass} flex items-center justify-center transition-all">
                            ${isCompleted
                                ? '<span class="material-symbols-outlined text-sm">check</span>'
                                : `<span class="material-symbols-outlined text-sm">${phase.icon}</span>`
                            }
                        </div>
                        <span class="text-[10px] lg:text-xs ${labelClass} text-center leading-tight">${phase.label}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- ============ QUICK STATS ============ -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-primary/30 transition-colors group">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg">chat_bubble</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Feedback recibido</span>
                </div>
                <div class="flex items-end gap-2">
                    <span class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">${peerReviews.length}</span>
                    ${peerReviews.length > 0
                        ? `<span class="bg-primary/10 text-primary text-[10px] font-extrabold px-2.5 py-1 rounded-lg mb-0.5">evaluaciones</span>`
                        : `<span class="text-slate-400 text-xs font-semibold mb-0.5">a\u00fan sin feedback</span>`
                    }
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-accent/30 transition-colors group">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-accent text-lg">event_available</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Check-ins completados</span>
                </div>
                <div class="flex items-end gap-2">
                    <span class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">${checkIns.length}</span>
                    <span class="bg-accent/10 text-accent text-[10px] font-extrabold px-2.5 py-1 rounded-lg mb-0.5">de 3 meses</span>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-highlight/30 transition-colors group">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-highlight text-lg">flag</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Objetivos en buen camino</span>
                </div>
                <div class="flex items-end gap-2">
                    <span class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">${objectivesOnTrack}</span>
                    <span class="bg-highlight/10 text-highlight text-[10px] font-extrabold px-2.5 py-1 rounded-lg mb-0.5">de ${objectives.length}</span>
                </div>
            </div>
        </div>

        <!-- ============ MAIN GRID ============ -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">

            <!-- LEFT COLUMN (3/5) -->
            <div class="lg:col-span-3 space-y-8">

                <!-- ACTION PLAN / FEEDFORWARD (PROMINENT) -->
                <section>
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-primary">trending_up</span>
                            Plan de desarrollo
                        </h3>
                        <button class="text-primary text-[10px] font-extrabold tracking-[0.15em] uppercase hover:underline cursor-pointer"
                                data-action="navigate" data-param="development">
                            Ver todo
                        </button>
                    </div>
                    <div class="bg-gradient-to-br from-primary/5 via-white to-accent/5 dark:from-primary/10 dark:via-slate-900 dark:to-accent/10 border-2 border-primary/15 dark:border-primary/20 rounded-2xl overflow-hidden shadow-sm">
                        ${pendingActions.length > 0 ? `
                        <div class="p-6 space-y-4">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="material-symbols-outlined text-sm text-accent">lightbulb</span>
                                <p class="text-[10px] font-extrabold text-accent uppercase tracking-[0.12em]">Acciones Feedforward pendientes</p>
                            </div>
                            ${pendingActions.map((a, idx) => `
                            <div class="flex items-start gap-4 p-4 bg-white/80 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-all group">
                                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span class="text-primary font-extrabold text-sm">${idx + 1}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="font-bold text-sm text-slate-900 dark:text-white leading-snug">${a.action}</p>
                                    <p class="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-xs">straighten</span>
                                        ${a.indicator}
                                    </p>
                                    <div class="flex items-center gap-3 mt-2.5">
                                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                            <span class="material-symbols-outlined text-xs">calendar_today</span>
                                            ${formatDate(a.dueDate)}
                                        </span>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-${statusColor(a.status)}/10 text-${statusColor(a.status)}">
                                            ${statusLabel(a.status)}
                                        </span>
                                    </div>
                                </div>
                                <span class="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg mt-1">chevron_right</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="p-8 text-center">
                            <span class="material-symbols-outlined text-4xl text-primary/30 mb-3 block">task_alt</span>
                            <p class="font-bold text-slate-500">No tienes acciones pendientes</p>
                            <p class="text-xs text-slate-400 mt-1">Las acciones de feedforward aparecer\u00e1n aqu\u00ed cuando se generen.</p>
                        </div>
                        `}
                        ${completedActions.length > 0 ? `
                        <div class="px-6 pb-4">
                            <p class="text-[10px] font-bold text-primary uppercase tracking-wider">${completedActions.length} acci\u00f3n(es) completada(s)</p>
                        </div>
                        ` : ''}
                        <div class="bg-primary/5 dark:bg-primary/10 border-t border-primary/10 px-6 py-4">
                            <p class="text-xs text-slate-600 dark:text-slate-400">
                                <span class="material-symbols-outlined text-xs align-middle text-primary mr-1">info</span>
                                Tu plan de desarrollo se construye con las sugerencias de feedforward de tus evaluadores. Es el elemento m\u00e1s importante para tu crecimiento.
                            </p>
                        </div>
                    </div>
                </section>

                <!-- MY OBJECTIVES -->
                <section>
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-highlight">flag</span>
                            Mis objetivos
                        </h3>
                        <button class="text-primary text-[10px] font-extrabold tracking-[0.15em] uppercase hover:underline cursor-pointer"
                                data-action="navigate" data-param="objectives">
                            Ver detalle
                        </button>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div class="p-6 space-y-6">
                            ${objectives.length > 0 ? objectives.map(obj => {
                                const color = progressColor(obj.progress);
                                return `
                                <div class="space-y-2.5">
                                    <div class="flex justify-between items-start gap-4">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-2 mb-1">
                                                <h4 class="font-bold text-sm text-slate-900 dark:text-white truncate">${obj.title}</h4>
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-${statusColor(obj.status)}/10 text-${statusColor(obj.status)} flex-shrink-0">
                                                    ${statusLabel(obj.status)}
                                                </span>
                                            </div>
                                            <p class="text-xs text-slate-500 font-medium">${obj.metric}</p>
                                        </div>
                                        <div class="flex items-center gap-2 flex-shrink-0">
                                            <span class="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">Peso: ${obj.weight}%</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div class="h-full bg-${color} rounded-full transition-all duration-500" style="width: ${obj.progress}%"></div>
                                        </div>
                                        <span class="text-sm font-extrabold text-${color} min-w-[3rem] text-right">${obj.progress}%</span>
                                    </div>
                                    ${obj.evidenceLinks.length > 0 ? `
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="material-symbols-outlined text-xs text-slate-400">link</span>
                                        ${obj.evidenceLinks.map(link => `
                                        <span class="text-[10px] text-primary font-semibold bg-primary/5 px-2 py-0.5 rounded-md truncate max-w-[200px]">${link}</span>
                                        `).join('')}
                                    </div>
                                    ` : ''}
                                </div>`;
                            }).join('<div class="border-t border-slate-100 dark:border-slate-800"></div>') : `
                            <div class="text-center py-6">
                                <span class="material-symbols-outlined text-3xl text-slate-300 mb-2 block">flag</span>
                                <p class="text-sm text-slate-400 font-semibold">A\u00fan no tienes objetivos registrados para este ciclo.</p>
                            </div>
                            `}
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <p class="text-xs text-slate-500 font-semibold">
                                Avance ponderado global: <span class="text-${progressColor(objProgress)} font-extrabold">${objProgress}%</span>
                            </p>
                            <button class="text-[10px] font-extrabold uppercase tracking-[0.1em] text-primary hover:underline cursor-pointer"
                                    data-action="navigate" data-param="objectives">
                                Gestionar objetivos
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- RIGHT COLUMN (2/5) -->
            <div class="lg:col-span-2 space-y-8">

                <!-- NEXT CHECK-IN -->
                <section>
                    <div class="bg-gradient-to-br from-accent/10 via-white to-primary/5 dark:from-accent/10 dark:via-slate-900 dark:to-primary/10 border-2 border-accent/15 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                        <div class="relative z-10">
                            <div class="flex items-center gap-2 mb-3">
                                <span class="material-symbols-outlined text-accent text-lg">event_upcoming</span>
                                <p class="text-[10px] font-extrabold text-accent uppercase tracking-[0.12em]">Pr\u00f3ximo check-in</p>
                            </div>
                            <p class="font-extrabold text-xl text-slate-900 dark:text-white mb-1">${getNextCheckInDate()}</p>
                            <p class="text-xs text-slate-500 font-medium mb-4">Faltan <span class="text-accent font-bold">${daysUntilNextCheckIn()} d\u00edas</span> para tu registro mensual</p>
                            <button class="bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-accent/20 text-sm cursor-pointer"
                                    data-action="navigate" data-param="checkin">
                                <span class="material-symbols-outlined text-sm align-middle mr-1">edit_note</span>
                                Registrar check-in
                            </button>
                        </div>
                        <span class="material-symbols-outlined absolute -bottom-6 -right-4 text-[8rem] text-accent/5 transform -rotate-12 select-none">calendar_month</span>
                    </div>
                </section>

                <!-- RECENT FEEDBACK -->
                <section>
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-accent">forum</span>
                            Feedback reciente
                        </h3>
                    </div>
                    <div class="space-y-4">
                        ${peerReviews.length > 0 ? peerReviews.map(review => {
                            const reviewer = getUser(review.reviewerId);
                            const reviewerName = reviewer ? reviewer.name : 'An\u00f3nimo';
                            return `
                            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-primary/20 transition-all">
                                <div class="flex items-center gap-3 mb-3">
                                    ${reviewer ? renderAvatar(reviewer, 'w-8 h-8') : '<div class="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs text-slate-500">?</div>'}
                                    <div>
                                        <p class="text-xs font-extrabold text-slate-900 dark:text-white">${reviewerName}</p>
                                        <p class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Feedback de par</p>
                                    </div>
                                </div>
                                ${review.recognition ? `
                                <div class="mb-3">
                                    <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Reconocimiento</p>
                                    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">"${review.recognition}"</p>
                                </div>
                                ` : ''}
                                ${review.feedforward && review.feedforward.length > 0 ? `
                                <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <p class="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">Sugerencias feedforward</p>
                                    ${review.feedforward.map(ff => `
                                    <div class="flex items-start gap-2 mt-1.5">
                                        <span class="material-symbols-outlined text-xs text-accent mt-0.5">arrow_forward</span>
                                        <p class="text-xs text-slate-600 dark:text-slate-400">${ff.action}</p>
                                    </div>
                                    `).join('')}
                                </div>
                                ` : ''}
                            </div>`;
                        }).join('') : `
                        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
                            <span class="material-symbols-outlined text-3xl text-slate-300 mb-2 block">forum</span>
                            <p class="text-sm text-slate-400 font-semibold">A\u00fan no has recibido feedback de pares.</p>
                            <p class="text-xs text-slate-400 mt-1">El feedback aparecer\u00e1 aqu\u00ed cuando tus compa\u00f1eros completen sus evaluaciones.</p>
                        </div>
                        `}
                    </div>
                </section>

            </div>
        </div>

    </div>`;
}

// -------------------------------------------------------
// Facilitador Dashboard
// -------------------------------------------------------
function renderFacilitador() {
    const user = state.currentUser;
    const team = getTeam(user.teamId);
    const teamName = team ? team.name : 'Mi equipo';
    const teamMembers = Data.users.filter(u => u.teamId === user.teamId && u.id !== user.id);
    const cyclePct = cycleProgressPercent();

    return `
    <div class="max-w-6xl mx-auto space-y-8">

        <!-- GREETING -->
        <header>
            <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                <span class="material-symbols-outlined text-xs align-middle mr-1">groups</span>
                Vista de facilitador
            </p>
            <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Hola, ${getFirstName(user.name)}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                Equipo <span class="font-bold text-slate-700 dark:text-slate-300">${teamName}</span> \u2014
                ciclo <span class="font-bold">${state.currentCycle.name}</span> al <span class="text-primary font-extrabold">${cyclePct}%</span>.
            </p>
        </header>

        <!-- TEAM OVERVIEW STATS -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg">group</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Miembros</span>
                </div>
                <span class="text-3xl font-extrabold text-slate-900 dark:text-white">${teamMembers.length}</span>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-accent text-lg">pending_actions</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Fase actual</span>
                </div>
                <span class="text-lg font-extrabold text-accent">${statusLabel(state.currentCycle.status)}</span>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-highlight text-lg">schedule</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Fecha l\u00edmite</span>
                </div>
                <span class="text-lg font-extrabold text-slate-900 dark:text-white">${formatDate(state.currentCycle.end)}</span>
            </div>
        </div>

        <!-- TEAM MEMBERS TABLE -->
        <section>
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-primary">groups</span>
                    Estado del equipo
                </h3>
                <button class="text-primary text-[10px] font-extrabold tracking-[0.15em] uppercase hover:underline cursor-pointer"
                        data-action="navigate" data-param="team-reviews">
                    Gestionar equipo
                </button>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                ${teamMembers.length > 0 ? `
                <div class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${teamMembers.map(member => {
                        const memberReviews = getUserReviews(member.id);
                        const selfReview = memberReviews.find(r => r.type === 'self');
                        const peerReviews = memberReviews.filter(r => r.type === 'peer');
                        const completedPeers = peerReviews.filter(r => r.status === 'completed').length;
                        const managerReview = memberReviews.find(r => r.type === 'facilitator');
                        const memberObjectives = getUserObjectives(member.id);
                        const objPct = objectivesWeightedProgress(memberObjectives);

                        const selfStatus = selfReview ? selfReview.status : 'pending';
                        const managerStatus = managerReview ? managerReview.status : 'pending';
                        const hasMissingSelf = selfStatus === 'pending' || selfStatus === 'draft';

                        return `
                        <div class="p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            ${renderAvatar(member)}
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${member.name}</p>
                                <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">${member.position}</p>
                            </div>

                            <!-- Status pills -->
                            <div class="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${selfStatus === 'completed' ? 'bg-primary/10 text-primary' : selfStatus === 'draft' ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}">
                                    <span class="material-symbols-outlined text-xs">${selfStatus === 'completed' ? 'check_circle' : selfStatus === 'draft' ? 'edit_note' : 'hourglass_empty'}</span>
                                    Auto
                                </span>
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${completedPeers > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}">
                                    <span class="material-symbols-outlined text-xs">${completedPeers > 0 ? 'check_circle' : 'hourglass_empty'}</span>
                                    Pares ${completedPeers}/${peerReviews.length}
                                </span>
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${managerStatus === 'completed' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}">
                                    <span class="material-symbols-outlined text-xs">${managerStatus === 'completed' ? 'check_circle' : 'hourglass_empty'}</span>
                                    Facilitador
                                </span>
                            </div>

                            <!-- Objectives progress -->
                            <div class="flex items-center gap-2 flex-shrink-0 w-28">
                                <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-${progressColor(objPct)} rounded-full" style="width: ${objPct}%"></div>
                                </div>
                                <span class="text-xs font-extrabold text-${progressColor(objPct)} w-8 text-right">${objPct}%</span>
                            </div>

                            <!-- Alert if missing self-review -->
                            ${hasMissingSelf ? `
                            <div class="flex-shrink-0" title="Autoevaluaci\u00f3n pendiente">
                                <span class="material-symbols-outlined text-highlight text-lg">warning</span>
                            </div>
                            ` : ''}
                        </div>`;
                    }).join('')}
                </div>
                ` : `
                <div class="p-8 text-center">
                    <span class="material-symbols-outlined text-3xl text-slate-300 mb-2 block">groups</span>
                    <p class="text-sm text-slate-400 font-semibold">No hay miembros en el equipo.</p>
                </div>
                `}
            </div>
        </section>

        <!-- PENDING ACTIONS FOR FACILITADOR -->
        <section>
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-accent">task_alt</span>
                    Acciones pendientes
                </h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-primary/20 transition-colors cursor-pointer"
                     data-action="navigate" data-param="facilitator-review">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary">rate_review</span>
                        </div>
                        <p class="font-bold text-sm">Completar evaluaciones</p>
                    </div>
                    <p class="text-xs text-slate-500">Revisa y eval\u00faa a los miembros de tu equipo para este ciclo.</p>
                </div>
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-accent/20 transition-colors cursor-pointer"
                     data-action="navigate" data-param="meeting">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-accent">handshake</span>
                        </div>
                        <p class="font-bold text-sm">Programar reuniones 1:1</p>
                    </div>
                    <p class="text-xs text-slate-500">Agenda reuniones de cierre con cada colaborador.</p>
                </div>
            </div>
        </section>

    </div>`;
}

// -------------------------------------------------------
// Admin (People Ops) Dashboard
// -------------------------------------------------------
function renderAdmin() {
    const user = state.currentUser;
    const stats = Data.adminStats;
    const cyclePct = cycleProgressPercent();

    return `
    <div class="max-w-6xl mx-auto space-y-8">

        <!-- GREETING -->
        <header>
            <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                <span class="material-symbols-outlined text-xs align-middle mr-1">admin_panel_settings</span>
                People Ops
            </p>
            <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Hola, ${getFirstName(user.name)}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                Ciclo <span class="font-bold text-slate-700 dark:text-slate-300">${state.currentCycle.name}</span> \u2014
                Avance global <span class="text-primary font-extrabold">${stats.completion}%</span>.
            </p>
        </header>

        <!-- ORG-LEVEL STATS -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg">donut_large</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Completado</span>
                </div>
                <span class="text-3xl font-extrabold text-primary">${stats.completion}%</span>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-accent text-lg">cycle</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Ciclos activos</span>
                </div>
                <span class="text-3xl font-extrabold text-slate-900 dark:text-white">${stats.activeCycles}</span>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-highlight text-lg">tune</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Calibraciones</span>
                </div>
                <span class="text-3xl font-extrabold text-slate-900 dark:text-white">${stats.pendingCalibrations}</span>
                <span class="text-xs text-slate-400 font-semibold ml-1">pendientes</span>
            </div>
            <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <span class="material-symbols-outlined text-slate-500 text-lg">timer</span>
                    </div>
                    <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">D\u00edas restantes</span>
                </div>
                <span class="text-3xl font-extrabold text-slate-900 dark:text-white">${stats.daysToDeadline}</span>
            </div>
        </div>

        <!-- TEAMS PROGRESS -->
        <section>
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-primary">stacked_bar_chart</span>
                    Progreso por equipo
                </h3>
                <button class="text-primary text-[10px] font-extrabold tracking-[0.15em] uppercase hover:underline cursor-pointer"
                        data-action="navigate" data-param="admin-reports">
                    Ver reportes
                </button>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${stats.teamProgress.map(tp => {
                        const overallColor = progressColor(tp.overall);
                        return `
                        <div class="p-5">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">${tp.leadAvatar}</div>
                                    <div>
                                        <p class="text-sm font-bold text-slate-900 dark:text-white">${tp.teamName}</p>
                                        <p class="text-[10px] text-slate-500 font-semibold">L\u00edder: ${tp.lead}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-${statusColor(tp.status)}/10 text-${statusColor(tp.status)}">
                                        ${statusLabel(tp.status)}
                                    </span>
                                    <span class="text-lg font-extrabold text-${overallColor}">${tp.overall}%</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-4">
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-[10px] font-bold text-slate-400">Autoevaluaci\u00f3n</span>
                                        <span class="text-[10px] font-extrabold text-${progressColor(tp.selfReview)}">${tp.selfReview}%</span>
                                    </div>
                                    <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div class="h-full bg-${progressColor(tp.selfReview)} rounded-full" style="width: ${tp.selfReview}%"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-[10px] font-bold text-slate-400">Feedback pares</span>
                                        <span class="text-[10px] font-extrabold text-${progressColor(tp.peerFeedback)}">${tp.peerFeedback}%</span>
                                    </div>
                                    <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div class="h-full bg-${progressColor(tp.peerFeedback)} rounded-full" style="width: ${tp.peerFeedback}%"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-[10px] font-bold text-slate-400">Rev. facilitador</span>
                                        <span class="text-[10px] font-extrabold text-${progressColor(tp.managerReview)}">${tp.managerReview}%</span>
                                    </div>
                                    <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div class="h-full bg-${progressColor(tp.managerReview)} rounded-full" style="width: ${tp.managerReview}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </section>

        <!-- BOTTOM ROW -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

            <!-- SCORE DISTRIBUTION -->
            <section>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-accent">bar_chart</span>
                        Distribuci\u00f3n de puntajes
                    </h3>
                </div>
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div class="space-y-4">
                        ${stats.scoreDistribution.map(sd => {
                            const scaleItem = Data.SCALE.find(s => s.value === sd.score);
                            const barColor = scaleItem ? (scaleItem.color === 'gold' ? 'accent' : scaleItem.color) : 'slate';
                            return `
                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-2 w-36 flex-shrink-0">
                                    <div class="w-7 h-7 rounded-full bg-${barColor}/15 flex items-center justify-center text-${barColor} font-bold text-xs">${sd.score}</div>
                                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${scaleItem ? scaleItem.label : ''}</span>
                                </div>
                                <div class="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-${barColor} rounded-full transition-all" style="width: ${sd.percent}%"></div>
                                </div>
                                <span class="text-xs font-extrabold text-slate-500 w-14 text-right">${sd.count} (${sd.percent}%)</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button class="text-primary text-[10px] font-extrabold tracking-[0.15em] uppercase hover:underline cursor-pointer"
                                data-action="navigate" data-param="admin-calibration">
                            Ir a calibraci\u00f3n
                        </button>
                    </div>
                </div>
            </section>

            <!-- BIAS ALERTS -->
            <section>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-highlight">report</span>
                        Alertas de sesgo
                    </h3>
                </div>
                <div class="space-y-4">
                    ${stats.biasAlerts.length > 0 ? stats.biasAlerts.map(alert => {
                        const isError = alert.severity === 'error';
                        const color = isError ? 'highlight' : 'accent';
                        const icon = isError ? 'error' : 'warning';
                        return `
                        <div class="bg-white dark:bg-slate-900 border-2 border-${color}/20 rounded-2xl p-5 shadow-sm">
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-xl bg-${color}/10 flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-${color}">${icon}</span>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-slate-900 dark:text-white">${alert.teamName}</p>
                                    <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">${alert.alert}</p>
                                </div>
                            </div>
                        </div>`;
                    }).join('') : `
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
                        <span class="material-symbols-outlined text-3xl text-primary/30 mb-2 block">verified_user</span>
                        <p class="text-sm text-slate-400 font-semibold">No se detectaron alertas de sesgo.</p>
                    </div>
                    `}
                </div>
            </section>

        </div>

        <!-- QUICK ACTIONS -->
        <section>
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-primary">bolt</span>
                    Acciones r\u00e1pidas
                </h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-primary/20 transition-colors cursor-pointer"
                     data-action="navigate" data-param="admin-cycles">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary">rebase_edit</span>
                        </div>
                        <p class="font-bold text-sm">Gestionar ciclos</p>
                    </div>
                    <p class="text-xs text-slate-500">Configurar fases, fechas y pesos del ciclo activo.</p>
                </div>
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-accent/20 transition-colors cursor-pointer"
                     data-action="navigate" data-param="admin-calibration">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-accent">tune</span>
                        </div>
                        <p class="font-bold text-sm">Calibraci\u00f3n</p>
                    </div>
                    <p class="text-xs text-slate-500">Revisar distribuci\u00f3n de puntajes y ajustar sesgos.</p>
                </div>
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-highlight/20 transition-colors cursor-pointer"
                     data-action="navigate" data-param="admin-directory">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-highlight">groups</span>
                        </div>
                        <p class="font-bold text-sm">Directorio</p>
                    </div>
                    <p class="text-xs text-slate-500">Consultar y gestionar colaboradores y equipos.</p>
                </div>
            </div>
        </section>

    </div>`;
}

// -------------------------------------------------------
// Main render (exported)
// -------------------------------------------------------
export function render() {
    const role = state.currentUser.role;

    if (role === 'facilitador') return renderFacilitador();
    if (role === 'admin') return renderAdmin();
    return renderColaborador();
}
