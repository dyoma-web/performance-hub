// ============================================================
// Performance Hub — Peer Feedback View
// ============================================================
import { state, renderScaleSelector, getUser, renderAvatar, formatDate } from '../app.js';
import { BEHAVIORS, FEEDBACK_TIPS, SCALE } from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function sectionCard(title, icon, hint) {
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

function vagueWarningHTML(id) {
    return `<div id="warn-${id}" class="vague-warning hidden flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-highlight/5 border border-highlight/10 rounded-lg">
        <span class="material-symbols-outlined text-highlight text-xs">warning</span>
        <span class="text-[10px] font-semibold text-highlight">El comentario es muy breve. Intenta ser m&aacute;s espec&iacute;fico para que tu feedback sea &uacute;til.</span>
    </div>`;
}

// -------------------------------------------------------
// Render
// -------------------------------------------------------
export function render() {
    const reviewer = state.currentUser;
    const peer = getUser('u1'); // Alejandra Rivera — demo evaluatee
    const cycle = state.currentCycle;
    const isAnonymous = cycle.config.peerAnonymous;

    // ----------------------------------------------------------------
    // 1. Header
    // ----------------------------------------------------------------
    const header = `
    <div class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div class="flex items-center gap-4">
                ${renderAvatar(peer, 'w-14 h-14 text-lg')}
                <div>
                    <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary text-3xl">rate_review</span>
                        Feedback para ${peer.name}
                    </h2>
                    <p class="text-sm text-slate-500 mt-1">${peer.position} &middot; Ciclo <strong class="text-slate-700 dark:text-slate-300">${cycle.name}</strong></p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button data-action="toggle-scale-info"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                    <span class="material-symbols-outlined text-base">info</span>
                    Ver escala
                </button>
            </div>
        </div>

        <!-- Tone nudge -->
        <div class="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-xl mt-0.5">emoji_objects</span>
            <div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Tu feedback es una herramienta de crecimiento</p>
                <p class="text-xs text-slate-500 mt-0.5">S&eacute; directo, espec&iacute;fico y amable. Un buen feedback ayuda a la otra persona a entender <strong>qu&eacute;</strong> hizo bien, <strong>qu&eacute;</strong> puede mejorar y <strong>c&oacute;mo</strong> lograrlo.</p>
            </div>
        </div>
    </div>`;

    // ----------------------------------------------------------------
    // 2. Writing Guide Panel (collapsible)
    // ----------------------------------------------------------------
    const writingGuide = `
    <div class="mb-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <button
                class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onclick="document.getElementById('writing-guide-content').classList.toggle('hidden'); this.querySelector('.expand-icon').classList.toggle('rotate-180');">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-accent text-xl">menu_book</span>
                    <div class="text-left">
                        <h4 class="font-bold text-sm text-slate-800 dark:text-white">Gu&iacute;a para escribir buen feedback</h4>
                        <p class="text-xs text-slate-400 mt-0.5">Ejemplos de qu&eacute; evitar y c&oacute;mo mejorar tus comentarios</p>
                    </div>
                </div>
                <span class="material-symbols-outlined expand-icon text-slate-400 transition-transform duration-300">expand_more</span>
            </button>

            <div id="writing-guide-content" class="hidden px-6 pb-6">
                <!-- Formula -->
                <div class="mb-4 p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-accent text-lg mt-0.5">science</span>
                        <div>
                            <p class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">La f&oacute;rmula del buen feedback</p>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-accent/20 rounded-xl text-xs font-bold text-accent">
                                    <span class="material-symbols-outlined text-xs">location_on</span>
                                    Situaci&oacute;n
                                </span>
                                <span class="text-slate-300 font-bold">+</span>
                                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-primary/20 rounded-xl text-xs font-bold text-primary">
                                    <span class="material-symbols-outlined text-xs">visibility</span>
                                    Comportamiento observable
                                </span>
                                <span class="text-slate-300 font-bold">+</span>
                                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-highlight/20 rounded-xl text-xs font-bold text-highlight">
                                    <span class="material-symbols-outlined text-xs">bolt</span>
                                    Impacto concreto
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bad vs Better examples -->
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
            </div>
        </div>
    </div>`;

    // ----------------------------------------------------------------
    // 3. Behaviors Section
    // ----------------------------------------------------------------
    const behaviorsSection = `
    <div class="mb-6">
        ${sectionCard('Evaluaci&oacute;n de Comportamientos', 'handshake', 'Eval&uacute;a c&oacute;mo observaste cada comportamiento en ' + peer.name + ' durante este ciclo.')}

            <div class="p-3 bg-primary/5 border border-primary/10 rounded-xl mb-2">
                <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">tips_and_updates</span>
                    Basa tu evaluaci&oacute;n en hechos observados, no en suposiciones. Si no tuviste oportunidad de observar un comportamiento, ind&iacute;calo en el comentario.
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
                            ${renderScaleSelector('peer-beh-' + beh.id)}
                        </div>
                    </div>

                    <!-- Observed example textarea -->
                    <div>
                        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Ejemplo espec&iacute;fico observado <span class="text-highlight">*</span>
                        </label>
                        <textarea required data-min-chars="30"
                            id="ta-beh-${beh.id}"
                            class="peer-textarea w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                            rows="3"
                            placeholder="Describe una situaci&oacute;n concreta donde observaste este comportamiento..."></textarea>
                        <div class="flex items-center justify-between">
                            <span class="char-counter text-xs mt-1 text-slate-400"></span>
                            <span class="text-[10px] text-slate-300 mt-1 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[10px]">lightbulb</span>
                                Describe una situaci&oacute;n concreta donde observaste este comportamiento
                            </span>
                        </div>
                        ${vagueWarningHTML('beh-' + beh.id)}
                    </div>
                </div>
            `).join('')}

        ${sectionCardClose()}
    </div>`;

    // ----------------------------------------------------------------
    // 4. Reconocimiento
    // ----------------------------------------------------------------
    const reconocimiento = `
    <div class="mb-6">
        ${sectionCard('Reconocimiento', 'favorite', 'Destaca la contribuci&oacute;n m&aacute;s importante de ' + peer.name + ' este ciclo.')}
            <div class="p-5 bg-highlight/5 border border-highlight/10 rounded-2xl space-y-3">
                <label class="text-sm font-bold text-slate-700 dark:text-slate-200 block">
                    Lo m&aacute;s valioso que ${peer.name} aport&oacute; este ciclo...
                </label>
                <p class="text-xs text-slate-400">
                    Piensa en aquello que marc&oacute; una diferencia real para el equipo, un proyecto o la organizaci&oacute;n.
                    S&eacute; espec&iacute;fico sobre el impacto.
                </p>
                <textarea data-min-chars="30"
                    id="ta-recognition"
                    class="peer-textarea w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[80px]"
                    rows="3"
                    placeholder="Ej: Lo m&aacute;s valioso fue c&oacute;mo elev&oacute; la calidad visual del equipo con el nuevo sistema de tokens. Todos estamos dise&ntilde;ando m&aacute;s r&aacute;pido y m&aacute;s consistente."></textarea>
                <div class="flex items-center justify-between">
                    <span class="char-counter text-xs mt-1 text-slate-400"></span>
                </div>
                ${vagueWarningHTML('recognition')}
            </div>
        ${sectionCardClose()}
    </div>`;

    // ----------------------------------------------------------------
    // 5. Feedforward
    // ----------------------------------------------------------------
    const feedforwardRows = [0, 1].map(i => `
        <div class="feedforward-row p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Sugerencia ${i + 1} <span class="text-highlight ml-1">*</span></span>
            </div>

            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Acci&oacute;n concreta</label>
                <textarea required data-min-chars="30"
                    id="ta-ff-action-${i}"
                    class="peer-textarea w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y min-h-[70px]"
                    rows="2"
                    placeholder="Ej: Compartir avances de dise&ntilde;o al 50% del sprint para tener m&aacute;s tiempo de iteraci&oacute;n con el equipo."></textarea>
                <div class="flex items-center justify-between">
                    <span class="char-counter text-xs mt-1 text-slate-400"></span>
                </div>
                ${vagueWarningHTML('ff-action-' + i)}
            </div>

            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Indicador de &eacute;xito</label>
                <input type="text" required
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Ej: Al menos 2 WIPs compartidos por sprint en el canal de equipo" />
            </div>
        </div>
    `).join('');

    const feedforward = `
    <div class="mb-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 overflow-hidden">
            <div class="px-6 pt-6 pb-3 flex items-start gap-3 bg-primary/5">
                <span class="material-symbols-outlined text-primary text-2xl mt-0.5">rocket_launch</span>
                <div class="flex-1">
                    <h4 class="font-extrabold text-base text-slate-800 dark:text-white">Feedforward: &iquest;Qu&eacute; le sugieres para el pr&oacute;ximo ciclo?</h4>
                    <p class="text-xs text-slate-500 mt-1">Propone <strong class="text-primary">1-2 acciones concretas</strong> que ayuden a ${peer.name} a crecer. Incluye c&oacute;mo medir&iacute;a el &eacute;xito de cada una.</p>
                </div>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-highlight/10 text-highlight flex-shrink-0">1&ndash;2 acciones</span>
            </div>

            <div class="px-6 pb-6 pt-4 space-y-4">
                ${feedforwardRows}
            </div>
        </div>
    </div>`;

    // ----------------------------------------------------------------
    // 6. Anonymity Notice
    // ----------------------------------------------------------------
    const anonymityNotice = `
    <div class="mb-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="px-6 py-5 flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl ${isAnonymous ? 'bg-primary/10' : 'bg-accent/10'} flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined ${isAnonymous ? 'text-primary' : 'text-accent'} text-xl">
                        ${isAnonymous ? 'visibility_off' : 'visibility'}
                    </span>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                        Visibilidad de tu feedback
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${isAnonymous ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}">
                            ${isAnonymous ? 'An&oacute;nimo' : 'Nominal'}
                        </span>
                    </h4>
                    <p class="text-xs text-slate-500 mt-1.5">
                        ${isAnonymous
                            ? 'Este feedback ser&aacute; <strong class="text-primary">an&oacute;nimo</strong>. ' + peer.name + ' ver&aacute; los comentarios pero <strong>no sabr&aacute; qui&eacute;n los escribi&oacute;</strong>.'
                            : 'Este feedback ser&aacute; <strong class="text-accent">nominal</strong> (tu nombre ser&aacute; visible para ' + peer.name + '). Esto fomenta la confianza y la conversaci&oacute;n directa.'
                        }
                    </p>
                    ${!isAnonymous ? `
                    <div class="mt-3 flex items-center gap-2 p-2.5 bg-accent/5 border border-accent/10 rounded-xl">
                        <span class="material-symbols-outlined text-accent text-sm">person</span>
                        <span class="text-xs text-slate-600 dark:text-slate-400">
                            ${peer.name} ver&aacute; que este feedback fue escrito por <strong class="text-slate-700 dark:text-slate-300">${reviewer.name}</strong>.
                        </span>
                    </div>` : ''}
                </div>
            </div>
        </div>
    </div>`;

    // ----------------------------------------------------------------
    // 7. Footer
    // ----------------------------------------------------------------
    const footer = `
    <div class="sticky bottom-0 left-0 right-0 mt-10 -mx-8 px-8 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 z-10">
        <div class="flex items-center gap-2 text-sm text-slate-500">
            <span class="material-symbols-outlined text-base text-primary">task_alt</span>
            <span class="font-semibold">Feedback para ${peer.name}</span>
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
                Enviar feedback
            </button>
        </div>
    </div>`;

    // ----------------------------------------------------------------
    // Assemble
    // ----------------------------------------------------------------
    return `
        <div class="max-w-4xl mx-auto pb-24">
            ${header}
            ${writingGuide}
            ${behaviorsSection}
            ${reconocimiento}
            ${feedforward}
            ${anonymityNotice}
            ${footer}
        </div>

        <!-- Vague-comment warnings handled by app.js bindViewEvents() -->
    `;
}
