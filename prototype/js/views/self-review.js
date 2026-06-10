// ============================================================
// Performance Hub — Self-Review (Autoevaluacion) View
// ============================================================
import { state, renderScaleSelector, getUserObjectives, getRoleSkills, formatDate, showToast } from '../app.js';
import { SCALE, BEHAVIORS, CONTRIBUTION_ITEMS, FEEDBACK_TIPS } from '../data.js';

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

// -------------------------------------------------------
// Render
// -------------------------------------------------------
export function render() {
    const user = state.currentUser;
    const cycle = state.currentCycle;
    const weights = cycle.config.weights;
    const objectives = getUserObjectives(user.id);
    const skills = getRoleSkills(user.roleType);

    // ---- Header ----
    const header = `
    <div class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
                <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                    <span class="material-symbols-outlined text-primary text-3xl">rate_review</span>
                    Mi Autoevaluaci&oacute;n
                </h2>
                <p class="text-sm text-slate-500 mt-1">Ciclo <strong class="text-slate-700 dark:text-slate-300">${cycle.name}</strong> &middot; T&oacute;mate tu tiempo, s&eacute; honesto/a y usa ejemplos concretos.</p>
            </div>
            <div class="flex items-center gap-3">
                <button data-action="toggle-scale-info"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                    <span class="material-symbols-outlined text-base">info</span>
                    Ver escala
                </button>
                <div class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10 text-sm font-bold text-primary">
                    <span class="material-symbols-outlined text-base">check_circle</span>
                    <span id="sections-completed-header">0 de 4 secciones</span>
                </div>
            </div>
        </div>

        <!-- Progress nudge -->
        <div class="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-accent text-xl mt-0.5">lightbulb</span>
            <div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Consejo</p>
                <p class="text-xs text-slate-500 mt-0.5">Puedes guardar tu borrador en cualquier momento y regresar despu&eacute;s. La evaluaci&oacute;n solo se env&iacute;a cuando presionas <strong>&ldquo;Enviar evaluaci&oacute;n&rdquo;</strong>.</p>
            </div>
        </div>
    </div>`;

    // ---- Tab navigation ----
    const tabs = [
        { key: 'resultados', label: 'Resultados', weight: weights.results, icon: 'flag' },
        { key: 'comportamientos', label: 'Comportamientos', weight: weights.behaviors, icon: 'handshake' },
        { key: 'habilidades', label: 'Habilidades del Rol', weight: weights.skills, icon: 'psychology' },
        { key: 'contribucion', label: 'Contribuci&oacute;n al Sistema', weight: weights.contribution, icon: 'volunteer_activism' },
    ];

    const tabNav = `
    <div class="flex gap-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-1.5 mb-6 shadow-sm overflow-x-auto">
        ${tabs.map((t, i) => `
            <button class="tab-btn flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap
                ${i === 0 ? 'border-primary text-primary font-bold bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}"
                data-tab-group="review-tabs" data-tab="tab-${t.key}">
                <span class="material-symbols-outlined text-base">${t.icon}</span>
                <span class="hidden md:inline">${t.label}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${i === 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}">${t.weight}%</span>
            </button>
        `).join('')}
    </div>`;

    // ---- Tab 1: Resultados ----
    const tabResultados = `
    <div class="tab-content space-y-5" data-tab-group="review-tabs" id="tab-resultados">
        ${sectionCardOpen('Evaluaci&oacute;n de Resultados', 'flag', `Eval&uacute;a tu nivel de logro en cada objetivo. Peso total: ${weights.results}%`)}

            ${objectives.length === 0 ? `
                <div class="text-center py-8 text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p class="text-sm">No tienes objetivos registrados para este ciclo.</p>
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
                            <span class="text-xs font-semibold text-slate-500">Avance</span>
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

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('obj-' + obj.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia y comentarios <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="50"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                            rows="3"
                            placeholder="Describe con evidencia concreta tu nivel de logro..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>

                    <!-- Evidence link button -->
                    <button class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors" data-action="add-evidence-link" data-param="${obj.id}">
                        <span class="material-symbols-outlined text-sm">attach_file</span>
                        Adjuntar enlace de evidencia
                    </button>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 2: Comportamientos ----
    const tabComportamientos = `
    <div class="tab-content hidden space-y-5" data-tab-group="review-tabs" id="tab-comportamientos">
        ${sectionCardOpen('Evaluaci&oacute;n de Comportamientos', 'handshake', `Reflexiona sobre c&oacute;mo trabajas con otros. Peso total: ${weights.behaviors}%`)}

            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">tips_and_updates</span>
                    Piensa en situaciones espec&iacute;ficas donde demostraste (o no) cada comportamiento. Un buen ejemplo incluye contexto, acci&oacute;n y resultado.
                </p>
            </div>

            ${BEHAVIORS.map(beh => `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                            ${beh.name}
                        </h5>
                        <p class="text-xs text-slate-500 mt-1">${beh.description}</p>
                    </div>

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('beh-' + beh.id)}
                        </div>
                    </div>

                    <!-- Example textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Ejemplo observado <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe una situaci&oacute;n concreta donde demostraste este comportamiento..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 3: Habilidades del Rol ----
    const tabHabilidades = `
    <div class="tab-content hidden space-y-5" data-tab-group="review-tabs" id="tab-habilidades">
        ${sectionCardOpen('Habilidades del Rol', 'psychology', `Eval&uacute;a tus competencias t&eacute;cnicas espec&iacute;ficas. Peso total: ${weights.skills}%`)}

            <div class="p-3 bg-accent/5 border border-accent/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-accent text-sm mt-0.5">school</span>
                    Estas habilidades son espec&iacute;ficas para tu rol de <strong class="text-slate-700 dark:text-slate-300">${user.position}</strong>. Evalu&aacute;las con base en tu desempe&ntilde;o real este ciclo.
                </p>
            </div>

            ${skills.map(skill => `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white">${skill.name}</h5>
                        <p class="text-xs text-slate-500 mt-1">${skill.description}</p>
                    </div>

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('skill-' + skill.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe c&oacute;mo aplicaste esta habilidad este ciclo..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Tab 4: Contribucion al Sistema ----
    const tabContribucion = `
    <div class="tab-content hidden space-y-5" data-tab-group="review-tabs" id="tab-contribucion">
        ${sectionCardOpen('Contribuci&oacute;n al Sistema', 'volunteer_activism', `Valora tu aporte m&aacute;s all&aacute; de tus objetivos individuales. Peso total: ${weights.contribution}%`)}

            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">diversity_3</span>
                    Esta secci&oacute;n reconoce tu impacto en el equipo y la organizaci&oacute;n. No se trata de hacer m&aacute;s, sino de hacer mejor.
                </p>
            </div>

            ${CONTRIBUTION_ITEMS.map(item => `
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                        <h5 class="font-bold text-sm text-slate-800 dark:text-white">${item.name}</h5>
                        <p class="text-xs text-slate-500 mt-1">${item.description}</p>
                    </div>

                    <!-- Rating -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">Tu calificaci&oacute;n</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${renderScaleSelector('contrib-' + item.id)}
                        </div>
                    </div>

                    <!-- Evidence textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Evidencia <span class="text-highlight">*</span></label>
                        <textarea required data-min-chars="30"
                            class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                            rows="2"
                            placeholder="Describe tu contribuci&oacute;n concreta en esta &aacute;rea..."></textarea>
                        <span class="char-counter text-xs mt-1 text-slate-400"></span>
                    </div>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ---- Reconocimiento ----
    const reconocimiento = `
    <div class="mt-8">
        ${sectionCardOpen('Reconocimiento', 'favorite', 'Reflexiona sobre tu mayor aporte este ciclo.')}
            <div class="p-5 bg-highlight/5 border border-highlight/10 rounded-2xl space-y-3">
                <label class="text-sm font-bold text-slate-700 dark:text-slate-200 block">Lo m&aacute;s valioso que aportaste este ciclo...</label>
                <p class="text-xs text-slate-400">Piensa en aquello que te enorgullece, que hizo una diferencia real para tu equipo o para la organizaci&oacute;n.</p>
                <textarea
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                    rows="3"
                    placeholder="Ej: Lo que m&aacute;s me enorgullece es haber creado la gu&iacute;a de migraci&oacute;n de tokens, que permiti&oacute; al equipo de frontend reducir 2 sprints de trabajo..."></textarea>
            </div>
        ${sectionCardClose()}
    </div>`;

    // ---- Feedforward ----
    const defaultRows = 3;
    const feedforwardRows = Array.from({ length: defaultRows }, (_, i) => `
        <div class="feedforward-row p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Acci&oacute;n ${i + 1} ${i < 2 ? '<span class="text-highlight ml-1">*</span>' : ''}</span>
                ${i >= 2 ? `<button class="text-xs text-slate-400 hover:text-highlight transition-colors" data-action="remove-feedforward-row" data-param="${i}"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
            </div>

            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Acci&oacute;n concreta</label>
                <input type="text"
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Ej: Compartir avances de dise&ntilde;o al 50% del sprint en el canal de equipo"
                    ${i < 2 ? 'required' : ''} />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Indicador de &eacute;xito</label>
                    <input type="text"
                        class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder="Ej: Al menos 2 WIPs compartidos por sprint"
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

    const feedforward = `
    <div class="mt-8">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 overflow-hidden">
            <div class="px-6 pt-6 pb-3 flex items-start gap-3 bg-primary/5">
                <span class="material-symbols-outlined text-primary text-2xl mt-0.5">rocket_launch</span>
                <div class="flex-1">
                    <h4 class="font-extrabold text-base text-slate-800 dark:text-white">Feedforward: Acciones de Mejora</h4>
                    <p class="text-xs text-slate-500 mt-1">Define al menos <strong class="text-primary">2 acciones concretas</strong> para mejorar el pr&oacute;ximo ciclo. No se trata de lo que fall&oacute;, sino de c&oacute;mo quieres crecer.</p>
                </div>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-highlight/10 text-highlight flex-shrink-0">M&iacute;nimo 2</span>
            </div>

            <div id="feedforward-container" class="px-6 pb-4 pt-4 space-y-4">
                ${feedforwardRows}
            </div>

            <div class="px-6 pb-6">
                <button data-action="add-feedforward-row"
                    class="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-base">add_circle</span>
                    Agregar otra acci&oacute;n
                </button>
            </div>
        </div>
    </div>`;

    // ---- Feedback writing tips (collapsible) ----
    const feedbackTips = `
    <div class="mt-8">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <button data-action="toggle-feedback-tips"
                class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onclick="document.getElementById('feedback-tips-content').classList.toggle('hidden'); this.querySelector('.expand-icon').classList.toggle('rotate-180');">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-accent text-xl">menu_book</span>
                    <div class="text-left">
                        <h4 class="font-bold text-sm text-slate-800 dark:text-white">Consejos para escribir mejor feedback</h4>
                        <p class="text-xs text-slate-400 mt-0.5">Ejemplos de qu&eacute; evitar y c&oacute;mo mejorar tus comentarios</p>
                    </div>
                </div>
                <span class="material-symbols-outlined expand-icon text-slate-400 transition-transform duration-300">expand_more</span>
            </button>

            <div id="feedback-tips-content" class="hidden px-6 pb-6">
                <div class="space-y-3">
                    ${FEEDBACK_TIPS.map((tip, i) => `
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="p-3 bg-highlight/5 border border-highlight/10 rounded-xl">
                                <div class="flex items-center gap-1.5 mb-1.5">
                                    <span class="material-symbols-outlined text-highlight text-xs">close</span>
                                    <span class="text-[10px] font-bold uppercase tracking-wider text-highlight">Evitar</span>
                                </div>
                                <p class="text-xs text-slate-600 dark:text-slate-400 italic">&ldquo;${tip.bad}&rdquo;</p>
                            </div>
                            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl">
                                <div class="flex items-center gap-1.5 mb-1.5">
                                    <span class="material-symbols-outlined text-primary text-xs">check</span>
                                    <span class="text-[10px] font-bold uppercase tracking-wider text-primary">Mejor</span>
                                </div>
                                <p class="text-xs text-slate-600 dark:text-slate-400">&ldquo;${tip.better}&rdquo;</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="mt-4 p-3 bg-accent/5 border border-accent/10 rounded-xl">
                    <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span class="material-symbols-outlined text-accent text-sm mt-0.5">tips_and_updates</span>
                        <span><strong>F&oacute;rmula:</strong> <em>Situaci&oacute;n</em> (cu&aacute;ndo/d&oacute;nde) + <em>Comportamiento</em> (qu&eacute; hiciste) + <em>Impacto</em> (qu&eacute; result&oacute;). Esto aplica tanto para logros como para &aacute;reas de mejora.</span>
                    </p>
                </div>
            </div>
        </div>
    </div>`;

    // ---- Sticky footer bar ----
    const footer = `
    <div class="sticky bottom-0 left-0 right-0 mt-10 -mx-8 px-8 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 z-10">
        <div class="flex items-center gap-2 text-sm text-slate-500">
            <span class="material-symbols-outlined text-base text-primary">task_alt</span>
            <span id="sections-completed-footer" class="font-semibold">0 de 4 secciones completadas</span>
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

    // ---- Assemble everything ----
    return `
        <div class="max-w-4xl mx-auto pb-24">
            ${header}
            ${tabNav}
            ${tabResultados}
            ${tabComportamientos}
            ${tabHabilidades}
            ${tabContribucion}
            ${reconocimiento}
            ${feedforward}
            ${feedbackTips}
            ${footer}
        </div>
    `;
}
