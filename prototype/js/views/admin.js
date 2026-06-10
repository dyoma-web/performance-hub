// ============================================================
// Performance Hub — Admin Cycles Hub View
// ============================================================
import { state, getUser, getTeam, formatDate, statusLabel, statusColor, renderAvatar, navigate } from '../app.js';
import * as Data from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function progressColor(pct) {
    if (pct >= 75) return 'primary';
    if (pct >= 50) return 'accent';
    return 'highlight';
}

const WORKFLOW_STATES = [
    { key: 'draft',           label: 'Borrador',             icon: 'draft' },
    { key: 'open',            label: 'Abierto',              icon: 'lock_open' },
    { key: 'self-review',     label: 'Autoevaluaci\u00f3n',  icon: 'rate_review' },
    { key: 'peer-feedback',   label: 'Feedback Pares',       icon: 'group' },
    { key: 'manager-review',  label: 'Rev. Facilitador',     icon: 'supervisor_account' },
    { key: 'meeting',         label: 'Reuni\u00f3n 1:1',     icon: 'handshake' },
    { key: 'calibration',     label: 'Calibraci\u00f3n',     icon: 'tune' },
    { key: 'finalized',       label: 'Finalizado',           icon: 'verified' },
    { key: 'archived',        label: 'Archivado',            icon: 'inventory_2' },
];

function workflowIndex(statusKey) {
    const idx = WORKFLOW_STATES.findIndex(s => s.key === statusKey);
    return idx === -1 ? 0 : idx;
}

// -------------------------------------------------------
// Render
// -------------------------------------------------------
export function render() {
    const cycle = state.currentCycle;
    const stats = Data.adminStats;
    const weights = cycle.config.weights;
    const currentIdx = workflowIndex(cycle.status);

    // Weight bar colors
    const weightColors = {
        results: 'primary',
        behaviors: 'accent',
        skills: 'highlight',
        contribution: 'slate-500',
    };
    const weightLabels = {
        results: 'Resultados',
        behaviors: 'Comportamientos',
        skills: 'Habilidades',
        contribution: 'Contribuci\u00f3n',
    };

    // ---- Header ----
    const header = `
    <header class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
        <div>
            <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                <span class="material-symbols-outlined text-xs align-middle mr-1">rebase_edit</span>
                Administraci\u00f3n de ciclos
            </p>
            <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Gesti\u00f3n de Ciclos
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                Configura, monitorea y administra los ciclos de evaluaci\u00f3n de la organizaci\u00f3n.
            </p>
        </div>
        <div class="flex gap-3 flex-shrink-0">
            <button class="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                    data-action="show-toast" data-param="Exportaci\u00f3n CSV iniciada">
                <span class="material-symbols-outlined text-lg text-slate-500">download</span>
                Exportar CSV
            </button>
            <button class="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all cursor-pointer"
                    data-action="show-toast" data-param="Asistente de configuraci\u00f3n abierto (demo)">
                <span class="material-symbols-outlined text-lg">add_circle</span>
                Configurar Nuevo Ciclo
            </button>
        </div>
    </header>`;

    // ---- KPI Cards ----
    const kpiCards = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <!-- Completitud global -->
        <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-primary/30 transition-colors">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-lg">donut_large</span>
                </div>
                <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Completitud global</span>
            </div>
            <div class="flex items-end gap-2">
                <span class="text-3xl font-extrabold text-primary leading-none">${stats.completion}%</span>
            </div>
            <div class="mt-3 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: ${stats.completion}%"></div>
            </div>
        </div>

        <!-- Ciclos activos -->
        <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-accent/30 transition-colors">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-accent text-lg">cycle</span>
                </div>
                <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Ciclos activos</span>
            </div>
            <span class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">${stats.activeCycles}</span>
        </div>

        <!-- Calibraciones pendientes -->
        <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-highlight/30 transition-colors">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-highlight text-lg">tune</span>
                </div>
                <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Calibraciones pendientes</span>
            </div>
            <div class="flex items-end gap-2">
                <span class="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">${stats.pendingCalibrations}</span>
                <span class="text-xs text-slate-400 font-semibold mb-0.5">evaluaciones</span>
            </div>
        </div>

        <!-- Dias restantes -->
        <div class="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span class="material-symbols-outlined text-slate-500 text-lg">timer</span>
                </div>
                <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">D\u00edas restantes</span>
            </div>
            <div class="flex items-end gap-2">
                <span class="text-3xl font-extrabold ${stats.daysToDeadline <= 7 ? 'text-highlight' : 'text-slate-900 dark:text-white'} leading-none">${stats.daysToDeadline}</span>
                <span class="text-xs text-slate-400 font-semibold mb-0.5">d\u00edas</span>
            </div>
        </div>
    </div>`;

    // ---- Active Cycle Config Card ----
    const cycleConfig = `
    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div class="px-6 pt-6 pb-4 flex items-start justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-xl">settings</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Ciclo Activo: ${cycle.name}</h3>
                    <p class="text-xs text-slate-500 mt-0.5">
                        ${formatDate(cycle.start)} \u2014 ${formatDate(cycle.end)}
                    </p>
                </div>
            </div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-${statusColor(cycle.status)}/10 text-${statusColor(cycle.status)}">
                <span class="material-symbols-outlined text-sm">circle</span>
                ${statusLabel(cycle.status)}
            </span>
        </div>

        <div class="px-6 pb-6">
            <!-- Weight config bars -->
            <div class="mb-5">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-3">Pesos de evaluaci\u00f3n</p>
                <div class="flex h-6 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                    ${Object.entries(weights).map(([key, val]) => `
                        <div class="bg-${weightColors[key]} h-full flex items-center justify-center transition-all" style="width: ${val}%"
                             title="${weightLabels[key]}: ${val}%">
                            <span class="text-[9px] font-extrabold text-white ${val < 15 ? 'hidden' : ''}">${val}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-4 mt-3 flex-wrap">
                    ${Object.entries(weights).map(([key, val]) => `
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-sm bg-${weightColors[key]}"></div>
                            <span class="text-[10px] font-bold text-slate-600 dark:text-slate-400">${weightLabels[key]} <span class="text-slate-400 dark:text-slate-500">${val}%</span></span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Cycle settings summary -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span class="material-symbols-outlined text-primary text-lg">${cycle.config.peerAnonymous ? 'visibility_off' : 'visibility'}</span>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feedback de pares</p>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${cycle.config.peerAnonymous ? 'An\u00f3nimo' : 'Con nombre visible'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span class="material-symbols-outlined text-accent text-lg">attach_file</span>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidencia</p>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${cycle.config.requireEvidenceForAll ? 'Obligatoria en todo' : 'Opcional'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span class="material-symbols-outlined text-highlight text-lg">rocket_launch</span>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feedforward m\u00edn.</p>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${cycle.config.minFeedforwardActions} acciones</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // ---- Team Progress Table ----
    const teamProgress = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-primary">stacked_bar_chart</span>
                Progreso por Equipo
            </h3>
            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">${stats.teamProgress.length} equipos</span>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <!-- Table header -->
            <div class="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <div class="col-span-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Equipo</div>
                <div class="col-span-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">L\u00edder</div>
                <div class="col-span-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Progreso general</div>
                <div class="col-span-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Estado</div>
                <div class="col-span-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Acci\u00f3n</div>
            </div>

            <!-- Team rows -->
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
                ${stats.teamProgress.map((tp, tIdx) => {
                    const overallColor = progressColor(tp.overall);
                    const leadUser = Data.users.find(u => u.avatar === tp.leadAvatar);

                    return `
                    <div class="group">
                        <!-- Main row -->
                        <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                             onclick="document.getElementById('team-detail-${tIdx}').classList.toggle('hidden')">
                            <!-- Team name -->
                            <div class="sm:col-span-3 flex items-center gap-3">
                                <span class="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary transition-colors">expand_more</span>
                                <p class="text-sm font-bold text-slate-900 dark:text-white">${tp.teamName}</p>
                            </div>

                            <!-- Lead -->
                            <div class="sm:col-span-3 flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">${tp.leadAvatar}</div>
                                <span class="text-sm text-slate-700 dark:text-slate-300 font-medium">${tp.lead}</span>
                            </div>

                            <!-- Progress bar -->
                            <div class="sm:col-span-3 flex items-center gap-3">
                                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-${overallColor} rounded-full transition-all duration-500" style="width: ${tp.overall}%"></div>
                                </div>
                                <span class="text-sm font-extrabold text-${overallColor} w-10 text-right">${tp.overall}%</span>
                            </div>

                            <!-- Status badge -->
                            <div class="sm:col-span-2">
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-${statusColor(tp.status)}/10 text-${statusColor(tp.status)}">
                                    ${statusLabel(tp.status)}
                                </span>
                            </div>

                            <!-- Reminder button -->
                            <div class="sm:col-span-1">
                                <button class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                                        data-action="show-toast" data-param="Recordatorio enviado a ${tp.teamName}"
                                        onclick="event.stopPropagation()">
                                    <span class="material-symbols-outlined text-sm">send</span>
                                    <span class="hidden lg:inline">Enviar recordatorio</span>
                                </button>
                            </div>
                        </div>

                        <!-- Expandable detail -->
                        <div id="team-detail-${tIdx}" class="hidden px-6 pb-5">
                            <div class="ml-7 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
                                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em] mb-3">Desglose por fase</p>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <div class="flex justify-between mb-1.5">
                                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                <span class="material-symbols-outlined text-xs text-primary">rate_review</span>
                                                Autoevaluaci\u00f3n
                                            </span>
                                            <span class="text-xs font-extrabold text-${progressColor(tp.selfReview)}">${tp.selfReview}%</span>
                                        </div>
                                        <div class="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div class="h-full bg-${progressColor(tp.selfReview)} rounded-full transition-all" style="width: ${tp.selfReview}%"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="flex justify-between mb-1.5">
                                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                <span class="material-symbols-outlined text-xs text-accent">group</span>
                                                Feedback de pares
                                            </span>
                                            <span class="text-xs font-extrabold text-${progressColor(tp.peerFeedback)}">${tp.peerFeedback}%</span>
                                        </div>
                                        <div class="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div class="h-full bg-${progressColor(tp.peerFeedback)} rounded-full transition-all" style="width: ${tp.peerFeedback}%"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="flex justify-between mb-1.5">
                                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                <span class="material-symbols-outlined text-xs text-highlight">supervisor_account</span>
                                                Rev. facilitador
                                            </span>
                                            <span class="text-xs font-extrabold text-${progressColor(tp.managerReview)}">${tp.managerReview}%</span>
                                        </div>
                                        <div class="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div class="h-full bg-${progressColor(tp.managerReview)} rounded-full transition-all" style="width: ${tp.managerReview}%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    </section>`;

    // ---- Cycle Workflow Visualization ----
    const workflow = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-accent">conversion_path</span>
                Flujo del Ciclo
            </h3>
            <span class="text-xs font-semibold text-slate-400">
                Fase actual: <span class="text-${statusColor(cycle.status)} font-bold">${statusLabel(cycle.status)}</span>
            </span>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-sm overflow-x-auto">
            <div class="flex items-start justify-between relative min-w-[700px] px-2">
                <!-- Connector line -->
                <div class="absolute top-5 left-6 right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <div class="h-full bg-primary rounded-full transition-all duration-700"
                         style="width: ${currentIdx === 0 ? '0%' : Math.round((currentIdx / (WORKFLOW_STATES.length - 1)) * 100) + '%'}"></div>
                </div>

                ${WORKFLOW_STATES.map((ws, i) => {
                    const isCompleted = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isFuture = i > currentIdx;

                    let circleClass, labelClass;
                    if (isCompleted) {
                        circleClass = 'bg-primary text-white shadow-lg shadow-primary/30';
                        labelClass = 'text-slate-700 dark:text-slate-300 font-bold';
                    } else if (isCurrent) {
                        circleClass = 'bg-white dark:bg-slate-900 border-[3px] border-accent text-accent shadow-md ring-4 ring-accent/15';
                        labelClass = 'text-accent font-extrabold';
                    } else {
                        circleClass = 'bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400';
                        labelClass = 'text-slate-400 font-medium';
                    }

                    return `
                    <div class="relative z-10 flex flex-col items-center gap-2 flex-1">
                        <div class="w-10 h-10 rounded-full ${circleClass} flex items-center justify-center transition-all">
                            ${isCompleted
                                ? '<span class="material-symbols-outlined text-sm">check</span>'
                                : `<span class="material-symbols-outlined text-sm">${ws.icon}</span>`
                            }
                        </div>
                        <span class="text-[9px] lg:text-[10px] ${labelClass} text-center leading-tight max-w-[70px]">${ws.label}</span>
                    </div>`;
                }).join('')}
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-6 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 min-w-[700px]">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full bg-primary"></div>
                    <span class="text-[10px] font-bold text-slate-500">Completado</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full border-2 border-accent"></div>
                    <span class="text-[10px] font-bold text-slate-500">Actual</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full border-2 border-slate-200"></div>
                    <span class="text-[10px] font-bold text-slate-500">Pendiente</span>
                </div>
            </div>
        </div>
    </section>`;

    // ---- Assemble ----
    return `
    <div class="max-w-6xl mx-auto space-y-0">
        ${header}
        ${kpiCards}
        ${cycleConfig}
        ${teamProgress}
        ${workflow}
    </div>`;
}
