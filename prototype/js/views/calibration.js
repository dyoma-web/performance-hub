// ============================================================
// Performance Hub — Admin Calibration Panel View
// ============================================================
import { state, getUser, getTeam, formatDate, statusLabel, statusColor, renderAvatar, navigate } from '../app.js';
import * as Data from '../data.js';

// -------------------------------------------------------
// Demo data for calibration log
// -------------------------------------------------------
const CALIBRATION_LOG = [
    {
        name: 'Carlos Herrera',
        team: 'Ingenier\u00eda',
        avatar: 'CH',
        originalScore: 3,
        adjustedScore: 3,
        rationale: 'Puntaje consistente con evidencia presentada. No requiere ajuste.',
    },
    {
        name: 'Elena Vega',
        team: 'Dise\u00f1o de Producto',
        avatar: 'EV',
        originalScore: 4,
        adjustedScore: 3,
        rationale: 'Se reduce de 4 a 3: la evidencia adjunta no sustenta un puntaje Sobresaliente seg\u00fan los criterios acordados. Se reconoce desempe\u00f1o s\u00f3lido.',
    },
    {
        name: 'Marco Torres',
        team: 'Ingenier\u00eda',
        avatar: 'MT',
        originalScore: 3,
        adjustedScore: 3,
        rationale: 'Evaluaci\u00f3n alineada con pares y facilitador. Evidencia de automatizaci\u00f3n documentada en Jira.',
    },
];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function getScaleItem(value) {
    return Data.SCALE.find(s => s.value === value) || Data.SCALE[0];
}

function scaleColor(value) {
    const item = getScaleItem(value);
    return item.color === 'gold' ? 'accent' : item.color;
}

// -------------------------------------------------------
// Render
// -------------------------------------------------------
export function render() {
    const cycle = state.currentCycle;
    const stats = Data.adminStats;

    // ---- Header ----
    const header = `
    <header class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
        <div>
            <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                <span class="material-symbols-outlined text-xs align-middle mr-1">tune</span>
                Calibraci\u00f3n de evaluaciones
            </p>
            <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Panel de Calibraci\u00f3n
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                Ciclo <span class="font-bold text-slate-700 dark:text-slate-300">${cycle.name}</span> \u2014
                <span class="text-highlight font-bold">${stats.pendingCalibrations} evaluaciones</span> pendientes de calibraci\u00f3n.
            </p>
        </div>
        <div class="flex gap-3 flex-shrink-0">
            <button class="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                    data-action="navigate" data-param="admin-cycles">
                <span class="material-symbols-outlined text-lg text-slate-500">arrow_back</span>
                Volver a Ciclos
            </button>
        </div>
    </header>`;

    // ---- Score Distribution ----
    const maxPercent = Math.max(...stats.scoreDistribution.map(sd => sd.percent), 1);

    const scoreDistribution = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-accent">bar_chart</span>
                Distribuci\u00f3n de Puntajes
            </h3>
            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">
                ${stats.scoreDistribution.reduce((s, d) => s + d.count, 0)} evaluaciones
            </span>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div class="space-y-5">
                ${stats.scoreDistribution.map(sd => {
                    const scaleItem = getScaleItem(sd.score);
                    const barColor = scaleColor(sd.score);
                    // Bar width as percentage of max for better visual proportions
                    const barWidth = Math.round((sd.percent / maxPercent) * 100);

                    return `
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2.5 w-44 flex-shrink-0">
                            <div class="w-8 h-8 rounded-full bg-${barColor}/15 flex items-center justify-center text-${barColor} font-bold text-sm">${sd.score}</div>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${scaleItem.label}</span>
                        </div>
                        <div class="flex-1 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                            <div class="h-full bg-${barColor}/80 rounded-xl transition-all duration-500 flex items-center" style="width: ${barWidth}%">
                                ${barWidth > 20 ? `<span class="text-[10px] font-extrabold text-white ml-3">${sd.percent}%</span>` : ''}
                            </div>
                            ${barWidth <= 20 ? `<span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400" style="left: calc(${barWidth}% + 8px)">${sd.percent}%</span>` : ''}
                        </div>
                        <div class="w-20 text-right flex-shrink-0">
                            <span class="text-sm font-extrabold text-slate-700 dark:text-slate-300">${sd.count}</span>
                            <span class="text-[10px] text-slate-400 font-semibold ml-1">eval.</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Disclaimer -->
            <div class="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5 leading-relaxed">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5 flex-shrink-0">info</span>
                    <span>Esta vista muestra la distribuci\u00f3n real. No existe una distribuci\u00f3n "ideal" \u2014 el objetivo es consistencia de criterios, no cuotas.</span>
                </p>
            </div>
        </div>
    </section>`;

    // ---- Bias Alerts ----
    const biasAlerts = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-highlight">report</span>
                Alertas de Sesgo
            </h3>
            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">
                ${stats.biasAlerts.length} alerta${stats.biasAlerts.length !== 1 ? 's' : ''}
            </span>
        </div>

        ${stats.biasAlerts.length > 0 ? `
        <div class="space-y-4">
            ${stats.biasAlerts.map(alert => {
                const isError = alert.severity === 'error';
                const color = isError ? 'highlight' : 'accent';
                const icon = isError ? 'error' : 'warning';
                const borderColor = isError ? 'highlight' : 'accent';

                return `
                <div class="bg-white dark:bg-slate-900 border-2 border-${borderColor}/20 rounded-2xl p-5 shadow-sm">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-${color} text-xl">${icon}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <p class="text-sm font-bold text-slate-900 dark:text-white">${alert.teamName}</p>
                                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-${color}/10 text-${color}">
                                    ${isError ? 'Cr\u00edtico' : 'Advertencia'}
                                </span>
                            </div>
                            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">${alert.alert}</p>
                            <div class="flex items-center gap-3 mt-4">
                                <button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-${color}/10 text-${color} hover:bg-${color}/20 transition-colors cursor-pointer"
                                        data-action="show-toast" data-param="Abriendo evaluaciones de ${alert.teamName} (demo)">
                                    <span class="material-symbols-outlined text-sm">visibility</span>
                                    Revisar evaluaciones
                                </button>
                                <button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        data-action="show-toast" data-param="Mensaje enviado al facilitador de ${alert.teamName} (demo)">
                                    <span class="material-symbols-outlined text-sm">mail</span>
                                    Contactar facilitador
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        ` : `
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
            <span class="material-symbols-outlined text-4xl text-primary/30 mb-3 block">verified_user</span>
            <p class="text-sm text-slate-500 font-semibold">No se detectaron alertas de sesgo.</p>
            <p class="text-xs text-slate-400 mt-1">El sistema analiza tendencia central, efecto halo y discrepancias entre evaluadores.</p>
        </div>
        `}
    </section>`;

    // ---- Calibration Log ----
    const calibrationLog = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-primary">edit_note</span>
                Log de Calibraci\u00f3n
            </h3>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <!-- Table header -->
            <div class="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <div class="col-span-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Colaborador</div>
                <div class="col-span-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Equipo</div>
                <div class="col-span-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Original</div>
                <div class="col-span-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Ajustado</div>
                <div class="col-span-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.1em]">Racional</div>
            </div>

            <!-- Rows -->
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
                ${CALIBRATION_LOG.map(row => {
                    const origColor = scaleColor(row.originalScore);
                    const adjColor = scaleColor(row.adjustedScore);
                    const wasAdjusted = row.originalScore !== row.adjustedScore;
                    const origLabel = getScaleItem(row.originalScore).label;
                    const adjLabel = getScaleItem(row.adjustedScore).label;

                    return `
                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 items-start ${wasAdjusted ? 'bg-highlight/[0.02]' : ''}">
                        <!-- Colaborador -->
                        <div class="sm:col-span-2 flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">${row.avatar}</div>
                            <span class="text-sm font-bold text-slate-900 dark:text-white">${row.name}</span>
                        </div>

                        <!-- Equipo -->
                        <div class="sm:col-span-2 flex items-center">
                            <span class="text-sm text-slate-600 dark:text-slate-400">${row.team}</span>
                        </div>

                        <!-- Puntaje original -->
                        <div class="sm:col-span-1 flex items-center">
                            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-${origColor}/10">
                                <span class="w-5 h-5 rounded-full bg-${origColor}/20 flex items-center justify-center text-${origColor} font-bold text-[10px]">${row.originalScore}</span>
                                <span class="text-[10px] font-bold text-${origColor} hidden lg:inline">${origLabel}</span>
                            </div>
                        </div>

                        <!-- Puntaje ajustado -->
                        <div class="sm:col-span-1 flex items-center gap-1.5">
                            ${wasAdjusted ? '<span class="material-symbols-outlined text-highlight text-sm">arrow_forward</span>' : ''}
                            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${wasAdjusted ? 'bg-highlight/10 ring-1 ring-highlight/20' : 'bg-' + adjColor + '/10'}">
                                <span class="w-5 h-5 rounded-full ${wasAdjusted ? 'bg-highlight/20' : 'bg-' + adjColor + '/20'} flex items-center justify-center ${wasAdjusted ? 'text-highlight' : 'text-' + adjColor} font-bold text-[10px]">${row.adjustedScore}</span>
                                <span class="text-[10px] font-bold ${wasAdjusted ? 'text-highlight' : 'text-' + adjColor} hidden lg:inline">${adjLabel}</span>
                            </div>
                        </div>

                        <!-- Racional -->
                        <div class="sm:col-span-6">
                            <textarea
                                class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[44px]"
                                rows="2"
                                placeholder="Justificaci\u00f3n del ajuste (obligatorio)..."
                            >${row.rationale}</textarea>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Add row + audit note -->
            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-primary text-sm mt-0.5">gavel</span>
                        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Todo ajuste queda registrado en el log de auditor\u00eda con fecha, autor y justificaci\u00f3n.
                        </p>
                    </div>
                    <button class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all cursor-pointer"
                            data-action="show-toast" data-param="Calibraciones guardadas exitosamente (demo)">
                        <span class="material-symbols-outlined text-sm">save</span>
                        Guardar calibraciones
                    </button>
                </div>
            </div>
        </div>
    </section>`;

    // ---- Quality Metrics ----
    const qualityMetrics = `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold text-lg flex items-center gap-2.5">
                <span class="material-symbols-outlined text-primary">analytics</span>
                M\u00e9tricas de Calidad
            </h3>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Evidence attached -->
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-xl">attach_file</span>
                    </div>
                    <div>
                        <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Evaluaciones con evidencia</span>
                    </div>
                </div>
                <div class="flex items-end gap-2 mb-3">
                    <span class="text-3xl font-extrabold text-primary leading-none">68%</span>
                </div>
                <div class="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div class="h-full bg-primary rounded-full transition-all" style="width: 68%"></div>
                </div>
                <p class="text-[10px] text-slate-400 font-semibold">27 de 40 evaluaciones incluyen al menos 1 enlace de evidencia</p>
            </div>

            <!-- Average comment length -->
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-accent text-xl">text_fields</span>
                    </div>
                    <div>
                        <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Largo promedio de comentarios</span>
                    </div>
                </div>
                <div class="flex items-end gap-2 mb-3">
                    <span class="text-3xl font-extrabold text-accent leading-none">142</span>
                    <span class="text-xs text-slate-400 font-semibold mb-0.5">caracteres</span>
                </div>
                <div class="flex items-center gap-3 mt-2">
                    <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-accent rounded-full" style="width: 71%"></div>
                    </div>
                    <span class="text-[10px] font-bold text-accent">Bueno</span>
                </div>
                <p class="text-[10px] text-slate-400 font-semibold mt-2">M\u00ednimo recomendado: 50 caracteres. Objetivo: 120+</p>
            </div>

            <!-- Completion rate by phase -->
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-highlight/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-highlight text-xl">checklist</span>
                    </div>
                    <div>
                        <span class="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.1em]">Completitud por fase</span>
                    </div>
                </div>
                <div class="space-y-3">
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[11px] text-primary">rate_review</span>
                                Autoevaluaci\u00f3n
                            </span>
                            <span class="text-xs font-extrabold text-primary">77%</span>
                        </div>
                        <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width: 77%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[11px] text-accent">group</span>
                                Feedback pares
                            </span>
                            <span class="text-xs font-extrabold text-accent">48%</span>
                        </div>
                        <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-accent rounded-full" style="width: 48%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[11px] text-highlight">supervisor_account</span>
                                Rev. facilitador
                            </span>
                            <span class="text-xs font-extrabold text-highlight">23%</span>
                        </div>
                        <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-highlight rounded-full" style="width: 23%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>`;

    // ---- Assemble ----
    return `
    <div class="max-w-6xl mx-auto space-y-0">
        ${header}
        ${scoreDistribution}
        ${biasAlerts}
        ${calibrationLog}
        ${qualityMetrics}
    </div>`;
}
