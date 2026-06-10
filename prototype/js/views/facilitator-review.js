// ============================================================
// Performance Hub — Facilitator Review (Evaluaci&oacute;n del Facilitador)
// ============================================================
import { state, renderScaleSelector, getUser, getUserObjectives, getUserReviews, getEvidence, getRoleSkills, renderAvatar, formatDate, timeAgo, statusLabel } from '../app.js';
import { SCALE, BEHAVIORS, CONTRIBUTION_ITEMS } from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function progressBarHTML(percent, colorClass = 'bg-primary') {
    return `
        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div class="${colorClass} h-2 rounded-full transition-all duration-500" style="width: ${Math.min(percent, 100)}%"></div>
        </div>`;
}

function progressColorClass(pct) {
    if (pct >= 75) return 'bg-primary';
    if (pct >= 50) return 'bg-accent';
    return 'bg-highlight';
}

function sectionCardOpen(title, icon, hint) {
    return `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="px-6 pt-6 pb-3 flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-xl mt-0.5">${icon}</span>
            <div>
                <h4 class="font-bold text-base text-slate-800 dark:text-white">${title}</h4>
                ${hint ? `<p class="text-xs text-slate-400 mt-1">${hint}</p>` : ''}
            </div>
        </div>
        <div class="px-6 pb-6 space-y-5">`;
}

function sectionCardClose() {
    return `</div></div>`;
}

/** Compute average score for a given behavior from completed peer reviews */
function peerAverageForBehavior(peerReviews, behaviorId) {
    const scores = [];
    peerReviews.forEach(r => {
        (r.items || []).forEach(item => {
            if (item.block === 'behaviors' && item.itemId === behaviorId && typeof item.score === 'number') {
                scores.push(item.score);
            }
        });
    });
    if (scores.length === 0) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

/** Collect peer comments for a given behavior */
function peerCommentsForBehavior(peerReviews, behaviorId) {
    const comments = [];
    peerReviews.forEach(r => {
        const reviewer = getUser(r.reviewerId);
        (r.items || []).forEach(item => {
            if (item.block === 'behaviors' && item.itemId === behaviorId && item.comment) {
                comments.push({
                    reviewer: reviewer ? reviewer.name : 'Par',
                    score: item.score,
                    comment: item.comment,
                });
            }
        });
    });
    return comments;
}

/** Get evidence-type badge color */
function evidenceTypeColor(type) {
    const map = {
        'peer-feedback': 'primary',
        'jira': 'blue-500',
        'checkin': 'accent',
        '1on1': 'indigo-500',
        'milestone': 'highlight',
    };
    return map[type] || 'slate-400';
}

/** Get evidence-type icon */
function evidenceTypeIcon(type) {
    const map = {
        'peer-feedback': 'group',
        'jira': 'bug_report',
        'checkin': 'event_available',
        '1on1': 'handshake',
        'milestone': 'stars',
    };
    return map[type] || 'description';
}

/** Get evidence-type label (Spanish) */
function evidenceTypeLabel(type) {
    const map = {
        'peer-feedback': 'Peer',
        'jira': 'Jira',
        'checkin': 'Check-in',
        '1on1': '1:1',
        'milestone': 'Hito',
    };
    return map[type] || type;
}

// -------------------------------------------------------
// Render
// -------------------------------------------------------
export function render() {
    // Context: facilitator is the current user (Sara M&eacute;ndez, u2)
    const facilitator = state.currentUser;
    const cycle = state.currentCycle;
    const weights = cycle.config.weights;

    // The evaluatee for demo: Alejandra Rivera (u1)
    const evaluatee = getUser('u1');
    const objectives = getUserObjectives('u1');
    const allReviews = getUserReviews('u1');
    const peerReviews = allReviews.filter(r => r.type === 'peer' && r.status === 'completed');
    const selfReview = allReviews.find(r => r.type === 'self');
    const evidence = getEvidence('u1');
    const skills = getRoleSkills(evaluatee.roleType);

    const selfStatus = selfReview ? selfReview.status : 'pending';
    const peerCount = peerReviews.length;

    // ================================================================
    // RIGHT PANEL — Evidence Timeline (30%)
    // ================================================================
    const evidenceFilterButtons = [
        { type: 'all', label: 'Todos' },
        { type: 'peer-feedback', label: 'Peer' },
        { type: 'jira', label: 'Jira' },
        { type: 'checkin', label: 'Check-in' },
        { type: '1on1', label: '1:1' },
        { type: 'milestone', label: 'Hito' },
    ];

    const rightPanel = `
    <aside class="w-full flex flex-col bg-slate-50/50 dark:bg-slate-950/20 border-l border-slate-200 dark:border-slate-800 h-full">
        <!-- Timeline header -->
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-lg">history</span>
                    Evidencia
                </h3>
                <span class="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">${evidence.length} eventos</span>
            </div>

            <!-- Search -->
            <div class="relative mb-3">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input type="text"
                    class="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    placeholder="Buscar en evidencia..." />
            </div>

            <!-- Filter buttons -->
            <div class="flex flex-wrap gap-1.5">
                ${evidenceFilterButtons.map((f, i) => `
                    <button class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${i === 0 ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary/10 hover:text-primary'}">
                        ${f.label}
                    </button>
                `).join('')}
            </div>
        </div>

        <!-- Timeline entries -->
        <div class="flex-1 overflow-y-auto p-5 relative">
            <div class="absolute left-8 top-0 bottom-0 w-[2px] bg-slate-200 dark:bg-slate-800"></div>

            ${evidence.map(ev => {
                const color = evidenceTypeColor(ev.type);
                const icon = evidenceTypeIcon(ev.type);
                const label = evidenceTypeLabel(ev.type);
                return `
                <div class="relative pl-9 mb-5 group cursor-pointer" title="Haz clic para referenciar esta evidencia">
                    <div class="absolute left-[1px] top-1 w-4 h-4 rounded-full bg-${color} border-[3px] border-slate-50 dark:border-[#0f172a] z-10 shadow-sm"></div>
                    <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm group-hover:border-primary/30 group-hover:shadow-md transition-all">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[10px] font-extrabold text-${color} uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">${icon}</span>
                                ${label}
                            </span>
                            <span class="text-[10px] text-slate-400 font-semibold">${timeAgo(ev.date)}</span>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${ev.summary}</p>
                        <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50 dark:border-slate-800">
                            <span class="text-[10px] text-slate-400 font-bold">${ev.source}</span>
                            <span class="text-[10px] text-slate-300 font-semibold">${formatDate(ev.date)}</span>
                        </div>
                        <div class="hidden group-hover:flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span class="material-symbols-outlined text-primary text-xs">add_link</span>
                            <span class="text-[10px] text-primary font-bold">Referenciar en evaluaci&oacute;n</span>
                        </div>
                    </div>
                </div>`;
            }).join('')}

            ${evidence.length === 0 ? `
            <div class="text-center py-12">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">inbox</span>
                <p class="text-xs text-slate-400 font-semibold">No hay evidencia registrada.</p>
            </div>
            ` : ''}
        </div>
    </aside>`;

    // ================================================================
    // LEFT PANEL (70%)
    // ================================================================

    // ---- Header ----
    const header = `
    <div class="mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div class="flex items-center gap-4">
                ${renderAvatar(evaluatee, 'w-14 h-14 text-lg')}
                <div>
                    <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        Evaluaci&oacute;n de ${evaluatee.name}
                    </h2>
                    <p class="text-sm text-slate-500 mt-0.5">
                        <span class="font-bold text-slate-700 dark:text-slate-300">${evaluatee.position}</span>
                        &middot; Ciclo ${cycle.name}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <button data-action="toggle-scale-info"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                    <span class="material-symbols-outlined text-base">info</span>
                    Ver escala
                </button>
                <div class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10 text-sm font-bold text-primary">
                    <span class="material-symbols-outlined text-base">check_circle</span>
                    <span id="fac-sections-completed">0 de 4 secciones</span>
                </div>
            </div>
        </div>

        <!-- Comparison indicator -->
        <div class="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-accent text-xl mt-0.5">compare_arrows</span>
            <div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Estado de insumos</p>
                <p class="text-xs text-slate-500 mt-0.5">
                    La autoevaluaci&oacute;n a&uacute;n est&aacute; en
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${selfStatus === 'completed' ? 'bg-primary/10 text-primary' : selfStatus === 'draft' ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-400'}">
                        ${statusLabel(selfStatus)}
                    </span>.
                    Hay <strong class="text-primary">${peerCount} evaluaci${peerCount === 1 ? '&oacute;n' : 'ones'} de pares</strong> completada${peerCount === 1 ? '' : 's'}.
                </p>
            </div>
        </div>
    </div>`;

    // ---- Tab navigation ----
    const tabs = [
        { key: 'fac-resultados', label: 'Resultados', weight: weights.results, icon: 'flag' },
        { key: 'fac-comportamientos', label: 'Comportamientos', weight: weights.behaviors, icon: 'handshake' },
        { key: 'fac-habilidades', label: 'Habilidades del Rol', weight: weights.skills, icon: 'psychology' },
        { key: 'fac-contribucion', label: 'Contribuci&oacute;n al Sistema', weight: weights.contribution, icon: 'volunteer_activism' },
    ];

    const tabNav = `
    <div class="flex gap-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-1.5 mb-6 shadow-sm overflow-x-auto">
        ${tabs.map((t, i) => `
            <button class="tab-btn flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap
                ${i === 0 ? 'border-primary text-primary font-bold bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}"
                data-tab-group="facilitator-tabs" data-tab="${t.key}">
                <span class="material-symbols-outlined text-base">${t.icon}</span>
                <span class="hidden md:inline">${t.label}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${i === 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}">${t.weight}%</span>
            </button>
        `).join('')}
    </div>`;

    // ---- Tab 1: Resultados (default visible) ----
    // Collect peer feedforward related to results
    const peerRecognitions = peerReviews.map(r => {
        const reviewer = getUser(r.reviewerId);
        return { name: reviewer ? reviewer.name : 'Par', recognition: r.recognition };
    }).filter(r => r.recognition);

    // Find evidence items that may be relevant to objectives
    const resultEvidence = evidence.filter(e => e.type === 'jira' || e.type === 'checkin');

    const tabResultados = `
    <div class="tab-content space-y-5" data-tab-group="facilitator-tabs" id="fac-resultados">
        ${sectionCardOpen('Evaluaci&oacute;n de Resultados', 'flag', `Eval&uacute;a el nivel de logro de ${evaluatee.name.split(' ')[0]} en cada objetivo. Peso total: ${weights.results}%`)}

            ${objectives.length === 0 ? `
                <div class="text-center py-8 text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p class="text-sm">No hay objetivos registrados para este ciclo.</p>
                </div>
            ` : objectives.map(obj => `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <!-- Objective header -->
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                            <h5 class="font-bold text-sm text-slate-800 dark:text-white">${obj.title}</h5>
                            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-xs">straighten</span>
                                ${obj.metric}
                            </p>
                        </div>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary flex-shrink-0">Peso: ${obj.weight}%</span>
                    </div>

                    <!-- Progress -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-xs font-semibold text-slate-500">Avance reportado</span>
                            <span class="text-xs font-bold ${obj.progress >= 75 ? 'text-primary' : obj.progress >= 50 ? 'text-accent' : 'text-highlight'}">${obj.progress}%</span>
                        </div>
                        ${progressBarHTML(obj.progress, progressColorClass(obj.progress))}
                    </div>

                    ${obj.evidenceLinks && obj.evidenceLinks.length > 0 ? `
                    <div class="flex flex-wrap gap-2">
                        ${obj.evidenceLinks.map(link => `
                            <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500">
                                <span class="material-symbols-outlined text-[11px]">link</span>
                                ${link.length > 35 ? link.substring(0, 35) + '...' : link}
                            </span>
                        `).join('')}
                    </div>` : ''}

                    <!-- Peer feedback snippets for results -->
                    ${peerRecognitions.length > 0 ? `
                    <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl">
                        <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">group</span>
                            Feedback de pares
                        </p>
                        ${peerRecognitions.map(pr => `
                            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-1 italic">&ldquo;${pr.recognition}&rdquo; <span class="not-italic text-[10px] font-bold text-slate-400">&mdash; ${pr.name}</span></p>
                        `).join('')}
                    </div>
                    ` : ''}

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n como facilitador</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('fac-obj-' + obj.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia y comentarios <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="50"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                            rows="3"
                            placeholder="Describe con evidencia concreta tu evaluaci&oacute;n del logro..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>

                    <!-- Nudge with relevant evidence from timeline -->
                    ${resultEvidence.length > 0 ? `
                    <div class="flex items-center gap-2 text-xs text-slate-500 bg-accent/5 p-3 rounded-lg border border-accent/10">
                        <span class="material-symbols-outlined text-accent text-sm">tips_and_updates</span>
                        <span><strong>Evidencia relevante:</strong> ${resultEvidence[0].summary}</span>
                    </div>
                    ` : ''}

                    <!-- Attach evidence link -->
                    <button class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                        <span class="material-symbols-outlined text-sm">attach_file</span>
                        Adjuntar enlace de evidencia
                    </button>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 2: Comportamientos ----
    const tabComportamientos = `
    <div class="tab-content hidden space-y-5" data-tab-group="facilitator-tabs" id="fac-comportamientos">
        ${sectionCardOpen('Evaluaci&oacute;n de Comportamientos', 'handshake', `Eval&uacute;a c&oacute;mo trabaja ${evaluatee.name.split(' ')[0]} con otros. Peso total: ${weights.behaviors}%`)}

            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">tips_and_updates</span>
                    Compara tu evaluaci&oacute;n con el promedio de pares. Las discrepancias mayores a 1 punto merecen reflexi&oacute;n en la reuni&oacute;n 1:1.
                </p>
            </div>

            ${BEHAVIORS.map(beh => {
                const peerAvg = peerAverageForBehavior(peerReviews, beh.id);
                const peerComments = peerCommentsForBehavior(peerReviews, beh.id);

                return `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                            ${beh.name}
                        </h5>
                        <p class="text-xs text-slate-500 mt-1">${beh.description}</p>
                    </div>

                    <!-- Peer aggregated score comparison -->
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-2 flex-1">
                            <span class="material-symbols-outlined text-sm text-primary">group</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Pares:</span>
                            ${peerAvg !== null
                                ? `<span class="text-sm font-extrabold text-primary">${peerAvg} avg</span>
                                   <span class="text-[10px] text-slate-400 font-semibold">(${peerComments.length} evaluaci${peerComments.length === 1 ? '&oacute;n' : 'ones'})</span>`
                                : `<span class="text-xs text-slate-400 italic">Sin datos de pares</span>`
                            }
                        </div>
                        <div class="border-l border-slate-200 dark:border-slate-700 pl-3 flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm text-accent">person</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Tu evaluaci&oacute;n:</span>
                            <span class="text-sm font-extrabold text-accent">___</span>
                        </div>
                    </div>

                    <!-- Peer comments (if any) -->
                    ${peerComments.length > 0 ? `
                    <div class="space-y-2">
                        <p class="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">forum</span>
                            Comentarios de pares
                        </p>
                        ${peerComments.map(pc => `
                            <div class="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-[10px] font-bold text-slate-500">${pc.reviewer}</span>
                                    <span class="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                                        <span class="material-symbols-outlined text-[10px]">star</span> ${pc.score}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">&ldquo;${pc.comment}&rdquo;</p>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n como facilitador</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('fac-beh-' + beh.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia observada <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe una situaci&oacute;n concreta donde observaste este comportamiento..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>`;
            }).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 3: Habilidades del Rol ----
    const tabHabilidades = `
    <div class="tab-content hidden space-y-5" data-tab-group="facilitator-tabs" id="fac-habilidades">
        ${sectionCardOpen('Habilidades del Rol', 'psychology', `Eval&uacute;a las competencias t&eacute;cnicas de ${evaluatee.name.split(' ')[0]}. Peso total: ${weights.skills}%`)}

            <div class="p-3 bg-accent/5 border border-accent/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-accent text-sm mt-0.5">school</span>
                    Habilidades espec&iacute;ficas para el rol de <strong class="text-slate-700 dark:text-slate-300">${evaluatee.position}</strong>. Basa tu evaluaci&oacute;n en evidencia observable de este ciclo.
                </p>
            </div>

            ${skills.map(skill => {
                // Check if peers left any relevant comments (re-use pattern)
                const peerAvg = peerAverageForBehavior(peerReviews, skill.id);

                return `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white">${skill.name}</h5>
                        <p class="text-xs text-slate-500 mt-1">${skill.description}</p>
                    </div>

                    <!-- Peer comparison (if data exists) -->
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-2 flex-1">
                            <span class="material-symbols-outlined text-sm text-primary">group</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Pares:</span>
                            ${peerAvg !== null
                                ? `<span class="text-sm font-extrabold text-primary">${peerAvg} avg</span>`
                                : `<span class="text-xs text-slate-400 italic">Sin datos</span>`
                            }
                        </div>
                        <div class="border-l border-slate-200 dark:border-slate-700 pl-3 flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm text-accent">person</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Tu evaluaci&oacute;n:</span>
                            <span class="text-sm font-extrabold text-accent">___</span>
                        </div>
                    </div>

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n como facilitador</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('fac-skill-' + skill.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe c&oacute;mo ${evaluatee.name.split(' ')[0]} aplic&oacute; esta habilidad este ciclo..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>`;
            }).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 4: Contribuci&oacute;n al Sistema ----
    const tabContribucion = `
    <div class="tab-content hidden space-y-5" data-tab-group="facilitator-tabs" id="fac-contribucion">
        ${sectionCardOpen('Contribuci&oacute;n al Sistema', 'volunteer_activism', `Valora el aporte de ${evaluatee.name.split(' ')[0]} m&aacute;s all&aacute; de sus objetivos. Peso total: ${weights.contribution}%`)}

            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">diversity_3</span>
                    Reconoce el impacto sist&eacute;mico: mentoria, documentaci&oacute;n, mejora de procesos y reducci&oacute;n de fricci&oacute;n para otros.
                </p>
            </div>

            ${CONTRIBUTION_ITEMS.map(item => {
                const peerAvg = peerAverageForBehavior(peerReviews, item.id);

                return `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white">${item.name}</h5>
                        <p class="text-xs text-slate-500 mt-1">${item.description}</p>
                    </div>

                    <!-- Peer comparison -->
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-2 flex-1">
                            <span class="material-symbols-outlined text-sm text-primary">group</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Pares:</span>
                            ${peerAvg !== null
                                ? `<span class="text-sm font-extrabold text-primary">${peerAvg} avg</span>`
                                : `<span class="text-xs text-slate-400 italic">Sin datos</span>`
                            }
                        </div>
                        <div class="border-l border-slate-200 dark:border-slate-700 pl-3 flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm text-accent">person</span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Tu evaluaci&oacute;n:</span>
                            <span class="text-sm font-extrabold text-accent">___</span>
                        </div>
                    </div>

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n como facilitador</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('fac-contrib-' + item.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe la contribuci&oacute;n concreta de ${evaluatee.name.split(' ')[0]} en esta &aacute;rea..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>`;
            }).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Reconocimiento ----
    const reconocimiento = `
    <div class="mt-8">
        ${sectionCardOpen('Reconocimiento', 'favorite', `Destaca lo m&aacute;s valioso que aport&oacute; ${evaluatee.name.split(' ')[0]} este ciclo.`)}
            <div class="p-5 bg-highlight/5 border border-highlight/10 rounded-2xl space-y-3">
                <label class="text-sm font-bold text-slate-700 dark:text-slate-200 block">Lo m&aacute;s valioso que aport&oacute; ${evaluatee.name.split(' ')[0]} este ciclo...</label>
                <p class="text-xs text-slate-400">Como facilitador, tu reconocimiento tiene un peso especial. S&eacute; espec&iacute;fico/a sobre el impacto real.</p>

                ${peerRecognitions.length > 0 ? `
                <div class="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">group</span>
                        Lo que dicen los pares
                    </p>
                    ${peerRecognitions.map(pr => `
                        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-1.5 italic">&ldquo;${pr.recognition}&rdquo; <span class="not-italic text-[10px] font-bold text-slate-400">&mdash; ${pr.name}</span></p>
                    `).join('')}
                </div>
                ` : ''}

                <textarea
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                    rows="3"
                    placeholder="Ej: Lo que m&aacute;s destaco de ${evaluatee.name.split(' ')[0]} este ciclo fue..."></textarea>
            </div>
        ${sectionCardClose()}
    </div>`;

    // ---- Feedforward (2-3 acciones) ----
    const feedforwardRows = Array.from({ length: 3 }, (_, i) => `
        <div class="feedforward-row p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Acci&oacute;n ${i + 1} ${i < 2 ? '<span class="text-highlight ml-1">*</span>' : ''}</span>
                ${i >= 2 ? `<button class="text-xs text-slate-400 hover:text-highlight transition-colors"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
            </div>

            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Acci&oacute;n concreta</label>
                <input type="text"
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Ej: Participar en los standups de ingenier&iacute;a 1x/semana"
                    ${i < 2 ? 'required' : ''} />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Indicador de &eacute;xito</label>
                    <input type="text"
                        class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder="Ej: Asistencia registrada semanalmente"
                        ${i < 2 ? 'required' : ''} />
                </div>
                <div>
                    <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Fecha objetivo</label>
                    <input type="date"
                        class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        ${i < 2 ? 'required' : ''} />
                </div>
            </div>
        </div>
    `).join('');

    // Gather peer feedforward suggestions as reference
    const peerFeedforward = [];
    peerReviews.forEach(r => {
        const reviewer = getUser(r.reviewerId);
        (r.feedforward || []).forEach(ff => {
            peerFeedforward.push({
                name: reviewer ? reviewer.name : 'Par',
                action: ff.action,
                indicator: ff.indicator,
            });
        });
    });

    const feedforward = `
    <div class="mt-8">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 overflow-hidden">
            <div class="px-6 pt-6 pb-3 flex items-start gap-3 bg-primary/5">
                <span class="material-symbols-outlined text-primary text-2xl mt-0.5">rocket_launch</span>
                <div class="flex-1">
                    <h4 class="font-extrabold text-base text-slate-800 dark:text-white">Feedforward: Acciones de Mejora</h4>
                    <p class="text-xs text-slate-500 mt-1">Define al menos <strong class="text-primary">2 acciones concretas</strong> que ${evaluatee.name.split(' ')[0]} debe trabajar el pr&oacute;ximo ciclo.</p>
                </div>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-highlight/10 text-highlight flex-shrink-0">M&iacute;nimo 2</span>
            </div>

            ${peerFeedforward.length > 0 ? `
            <div class="px-6 py-4 bg-accent/5 border-b border-accent/10">
                <p class="text-[10px] font-bold text-accent uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">lightbulb</span>
                    Sugerencias de los pares (como referencia)
                </p>
                ${peerFeedforward.map(pf => `
                    <div class="flex items-start gap-2 mb-2 last:mb-0">
                        <span class="material-symbols-outlined text-accent text-xs mt-0.5">arrow_forward</span>
                        <div>
                            <p class="text-xs text-slate-600 dark:text-slate-400">${pf.action}</p>
                            <p class="text-[10px] text-slate-400 mt-0.5">${pf.name} &middot; Indicador: ${pf.indicator}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="px-6 pb-4 pt-4 space-y-4">
                ${feedforwardRows}
            </div>

            <div class="px-6 pb-6">
                <button class="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-base">add_circle</span>
                    Agregar otra acci&oacute;n
                </button>
            </div>
        </div>
    </div>`;

    // ---- Sticky footer bar ----
    const footer = `
    <div class="sticky bottom-0 left-0 right-0 mt-10 -mx-8 px-8 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 z-10">
        <div class="flex items-center gap-3 text-sm text-slate-500">
            <span class="material-symbols-outlined text-base text-primary">task_alt</span>
            <span id="fac-sections-footer" class="font-semibold">0 de 4 secciones completadas</span>
            <div class="flex -space-x-1.5 ml-2">
                ${tabs.map((_, i) => `
                    <div class="w-7 h-7 rounded-full border-[3px] border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">${i + 1}</div>
                `).join('')}
            </div>
        </div>
        <div class="flex items-center gap-3">
            <button data-action="save-draft"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                <span class="material-symbols-outlined text-base">save</span>
                Guardar borrador
            </button>
            <button data-action="submit-form"
                class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                <span class="material-symbols-outlined text-base">send</span>
                Enviar evaluaci&oacute;n
            </button>
        </div>
    </div>`;

    // ================================================================
    // ASSEMBLE: Two-panel 70/30 layout
    // ================================================================
    return `
        <div class="flex -m-8 h-[calc(100vh-73px)] overflow-hidden">
            <!-- LEFT PANEL (70%) -->
            <section class="w-[70%] overflow-y-auto p-8 pb-24">
                ${header}
                ${tabNav}
                ${tabResultados}
                ${tabComportamientos}
                ${tabHabilidades}
                ${tabContribucion}
                ${reconocimiento}
                ${feedforward}
                ${footer}
            </section>

            <!-- RIGHT PANEL (30%) — Evidence Timeline -->
            <section class="w-[30%] overflow-hidden flex flex-col">
                ${rightPanel}
            </section>
        </div>
    `;
}
