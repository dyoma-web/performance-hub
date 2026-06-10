// ============================================================
// Performance Hub — Reunion 1:1 View
// ============================================================
import { state, getUser, getUserObjectives, getUserReviews, getUserActionPlan, renderAvatar, formatDate, timeAgo, statusLabel } from '../app.js';
import * as Data from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function getFirstName(fullName) {
    return (fullName || '').split(' ')[0];
}

function getMeetingForUser(userId) {
    return Data.meetings.find(m =>
        m.evaluateeId === userId || m.facilitatorId === userId
    );
}

function getMeetingParticipants(meeting) {
    const evaluatee = getUser(meeting.evaluateeId);
    const facilitator = getUser(meeting.facilitatorId);
    return { evaluatee, facilitator };
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${hour12}:${m} ${suffix}`;
}

function daysUntil(dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ma\u00f1ana';
    if (diff < 0) return `Hace ${Math.abs(diff)} d\u00edas`;
    return `En ${diff} d\u00edas`;
}

function countPeerFeedbackThemes(reviews) {
    const themes = {};
    reviews.forEach(r => {
        if (r.items && r.items.length > 0) {
            r.items.forEach(item => {
                const behavior = Data.BEHAVIORS.find(b => b.id === item.itemId);
                const name = behavior ? behavior.name : item.itemId;
                if (!themes[name]) themes[name] = { count: 0, avgScore: 0, total: 0 };
                themes[name].count++;
                themes[name].total += item.score;
                themes[name].avgScore = Math.round((themes[name].total / themes[name].count) * 10) / 10;
            });
        }
    });
    return themes;
}

function findDivergences(selfReview, facilitatorReview, peerReviews) {
    const divergences = [];
    // Compare self vs peer averages
    if (selfReview && selfReview.items && selfReview.items.length > 0) {
        selfReview.items.forEach(selfItem => {
            const peerScores = [];
            peerReviews.forEach(pr => {
                const match = pr.items.find(i => i.itemId === selfItem.itemId);
                if (match) peerScores.push(match.score);
            });
            if (peerScores.length > 0) {
                const peerAvg = peerScores.reduce((a, b) => a + b, 0) / peerScores.length;
                const diff = Math.abs(selfItem.score - peerAvg);
                if (diff >= 1) {
                    const behavior = Data.BEHAVIORS.find(b => b.id === selfItem.itemId);
                    divergences.push({
                        area: behavior ? behavior.name : selfItem.itemId,
                        selfScore: selfItem.score,
                        peerAvg: Math.round(peerAvg * 10) / 10,
                        direction: selfItem.score > peerAvg ? 'higher-self' : 'lower-self',
                    });
                }
            }
        });
    }
    return divergences;
}

function findConsistentStrengths(peerReviews) {
    const strengths = {};
    peerReviews.forEach(r => {
        r.items.forEach(item => {
            if (item.score >= 3) {
                if (!strengths[item.itemId]) strengths[item.itemId] = { count: 0, comments: [] };
                strengths[item.itemId].count++;
                if (item.comment) strengths[item.itemId].comments.push(item.comment);
            }
        });
    });
    return Object.entries(strengths)
        .filter(([, v]) => v.count >= 1)
        .map(([id, v]) => {
            const behavior = Data.BEHAVIORS.find(b => b.id === id);
            return { id, name: behavior ? behavior.name : id, count: v.count, comments: v.comments };
        })
        .sort((a, b) => b.count - a.count);
}

function findGrowthAreas(peerReviews) {
    const areas = {};
    peerReviews.forEach(r => {
        r.items.forEach(item => {
            if (item.score <= 2) {
                if (!areas[item.itemId]) areas[item.itemId] = { count: 0, comments: [] };
                areas[item.itemId].count++;
                if (item.comment) areas[item.itemId].comments.push(item.comment);
            }
        });
    });
    return Object.entries(areas).map(([id, v]) => {
        const behavior = Data.BEHAVIORS.find(b => b.id === id);
        return { id, name: behavior ? behavior.name : id, count: v.count, comments: v.comments };
    });
}

function collectFeedforward(reviews) {
    const suggestions = [];
    reviews.forEach(r => {
        if (r.feedforward && r.feedforward.length > 0) {
            const reviewer = getUser(r.reviewerId);
            r.feedforward.forEach(ff => {
                suggestions.push({
                    ...ff,
                    reviewerName: reviewer ? reviewer.name : 'An\u00f3nimo',
                    reviewType: r.type,
                });
            });
        }
    });
    return suggestions;
}

// -------------------------------------------------------
// Section: Meeting Header
// -------------------------------------------------------
function renderMeetingHeader(meeting, evaluatee, facilitator) {
    const isFacilitator = state.currentUser.role === 'facilitador';
    const otherPerson = isFacilitator ? evaluatee : facilitator;
    const roleDesc = isFacilitator
        ? `Reuni\u00f3n con <strong class="text-slate-800 dark:text-slate-200">${getFirstName(evaluatee.name)}</strong>`
        : `Reuni\u00f3n con tu facilitador/a <strong class="text-slate-800 dark:text-slate-200">${getFirstName(facilitator.name)}</strong>`;

    return `
    <header class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
                <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                    <span class="material-symbols-outlined text-xs align-middle mr-1">handshake</span>
                    Espacio de conversaci\u00f3n
                </p>
                <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    Reuni\u00f3n 1:1
                </h2>
                <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                    ${roleDesc}
                </p>
            </div>
        </div>

        <!-- Meeting info card -->
        <div class="mt-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <!-- Participants -->
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        ${renderAvatar(facilitator, 'w-12 h-12')}
                        <div>
                            <p class="text-sm font-bold text-slate-900 dark:text-white">${facilitator.name}</p>
                            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Facilitador/a</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-center px-4">
                        <span class="material-symbols-outlined text-primary text-2xl">sync_alt</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${renderAvatar(evaluatee, 'w-12 h-12')}
                        <div>
                            <p class="text-sm font-bold text-slate-900 dark:text-white">${evaluatee.name}</p>
                            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Colaborador/a</p>
                        </div>
                    </div>
                </div>

                <!-- Date/time -->
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <p class="text-lg font-extrabold text-slate-900 dark:text-white">${formatDate(meeting.date)}</p>
                        <div class="flex items-center justify-end gap-3 mt-1">
                            <span class="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
                                <span class="material-symbols-outlined text-xs">schedule</span>
                                ${formatTime(meeting.time)}
                            </span>
                            <span class="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
                                <span class="material-symbols-outlined text-xs">hourglass_top</span>
                                ${meeting.duration} min
                            </span>
                        </div>
                        <div class="mt-2">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-accent/10 text-accent">
                                <span class="material-symbols-outlined text-xs">event</span>
                                ${daysUntil(meeting.date)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>`;
}

// -------------------------------------------------------
// Section: Pre-meeting Preparation
// -------------------------------------------------------
function renderPreparation(evaluatee, reviews) {
    const selfReview = reviews.find(r => r.type === 'self');
    const facilitatorReview = reviews.find(r => r.type === 'facilitator');
    const peerReviews = reviews.filter(r => r.type === 'peer' && r.status === 'completed');
    const themes = countPeerFeedbackThemes(peerReviews);
    const themeEntries = Object.entries(themes);
    const divergences = findDivergences(selfReview, facilitatorReview, peerReviews);
    const consistentStrengths = findConsistentStrengths(peerReviews);
    const growthAreas = findGrowthAreas(peerReviews);

    const selfStatus = selfReview ? selfReview.status : 'pending';
    const facilitatorStatus = facilitatorReview ? facilitatorReview.status : 'pending';

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-accent text-lg">inventory</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Preparaci\u00f3n previa</h3>
                <p class="text-xs text-slate-400 mt-0.5">Resumen de insumos disponibles para la conversaci\u00f3n</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <!-- Evaluation status overview -->
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-4">Estado de evaluaciones</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <!-- Self-evaluation -->
                    <div class="flex items-center gap-3 p-3 rounded-xl border ${selfStatus === 'completed' || selfStatus === 'draft' ? 'border-primary/20 bg-primary/[0.03]' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}">
                        <div class="w-8 h-8 rounded-lg ${selfStatus === 'completed' ? 'bg-primary/15' : selfStatus === 'draft' ? 'bg-accent/15' : 'bg-slate-100 dark:bg-slate-700'} flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-sm ${selfStatus === 'completed' ? 'text-primary' : selfStatus === 'draft' ? 'text-accent' : 'text-slate-400'}">${selfStatus === 'completed' ? 'check_circle' : selfStatus === 'draft' ? 'edit_note' : 'hourglass_empty'}</span>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Autoevaluaci\u00f3n</p>
                            <p class="text-[10px] text-slate-400 font-semibold">${statusLabel(selfStatus)}</p>
                        </div>
                    </div>
                    <!-- Peer feedback -->
                    <div class="flex items-center gap-3 p-3 rounded-xl border ${peerReviews.length > 0 ? 'border-primary/20 bg-primary/[0.03]' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}">
                        <div class="w-8 h-8 rounded-lg ${peerReviews.length > 0 ? 'bg-primary/15' : 'bg-slate-100 dark:bg-slate-700'} flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-sm ${peerReviews.length > 0 ? 'text-primary' : 'text-slate-400'}">${peerReviews.length > 0 ? 'check_circle' : 'hourglass_empty'}</span>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Feedback de pares</p>
                            <p class="text-[10px] text-slate-400 font-semibold">${peerReviews.length} evaluaci\u00f3n(es) recibida(s)</p>
                        </div>
                    </div>
                    <!-- Facilitator evaluation -->
                    <div class="flex items-center gap-3 p-3 rounded-xl border ${facilitatorStatus === 'completed' ? 'border-primary/20 bg-primary/[0.03]' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}">
                        <div class="w-8 h-8 rounded-lg ${facilitatorStatus === 'completed' ? 'bg-primary/15' : 'bg-slate-100 dark:bg-slate-700'} flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-sm ${facilitatorStatus === 'completed' ? 'text-primary' : 'text-slate-400'}">${facilitatorStatus === 'completed' ? 'check_circle' : 'hourglass_empty'}</span>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Evaluaci\u00f3n facilitador</p>
                            <p class="text-[10px] text-slate-400 font-semibold">${statusLabel(facilitatorStatus)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Peer themes -->
            ${themeEntries.length > 0 ? `
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-3">Temas del feedback de pares</p>
                <div class="flex flex-wrap gap-2">
                    ${themeEntries.map(([name, data]) => `
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${data.avgScore >= 3 ? 'bg-primary/10 text-primary border border-primary/15' : 'bg-accent/10 text-accent border border-accent/15'}">
                            <span class="material-symbols-outlined text-xs">${data.avgScore >= 3 ? 'thumb_up' : 'trending_up'}</span>
                            ${name}
                            <span class="text-[10px] font-semibold opacity-70">(${data.avgScore})</span>
                        </span>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Talking points -->
            <div class="p-6">
                <p class="text-[10px] font-extrabold text-primary uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">auto_awesome</span>
                    Puntos sugeridos para la conversaci\u00f3n
                </p>
                <div class="space-y-3">
                    ${consistentStrengths.length > 0 ? consistentStrengths.map(s => `
                    <div class="flex items-start gap-3 p-3 rounded-xl bg-primary/[0.03] border border-primary/10">
                        <span class="material-symbols-outlined text-primary text-sm mt-0.5">star</span>
                        <div>
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">Fortaleza: ${s.name}</p>
                            <p class="text-xs text-slate-500 mt-0.5">Identificado por ${s.count} fuente${s.count > 1 ? 's' : ''} con puntaje alto</p>
                        </div>
                    </div>
                    `).join('') : ''}

                    ${growthAreas.length > 0 ? growthAreas.map(a => `
                    <div class="flex items-start gap-3 p-3 rounded-xl bg-accent/[0.03] border border-accent/10">
                        <span class="material-symbols-outlined text-accent text-sm mt-0.5">trending_up</span>
                        <div>
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">\u00c1rea de crecimiento: ${a.name}</p>
                            <p class="text-xs text-slate-500 mt-0.5">Se\u00f1alado por ${a.count} evaluador(es) como oportunidad de mejora</p>
                        </div>
                    </div>
                    `).join('') : ''}

                    ${divergences.length > 0 ? divergences.map(d => `
                    <div class="flex items-start gap-3 p-3 rounded-xl bg-highlight/[0.03] border border-highlight/10">
                        <span class="material-symbols-outlined text-highlight text-sm mt-0.5">compare_arrows</span>
                        <div>
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">Divergencia en: ${d.area}</p>
                            <p class="text-xs text-slate-500 mt-0.5">
                                Autoevaluaci\u00f3n: ${d.selfScore} vs. Promedio pares: ${d.peerAvg}
                                ${d.direction === 'higher-self' ? ' \u2014 La autopercepci\u00f3n es m\u00e1s alta' : ' \u2014 Los pares ven mayor fortaleza'}
                            </p>
                        </div>
                    </div>
                    `).join('') : ''}

                    ${consistentStrengths.length === 0 && growthAreas.length === 0 && divergences.length === 0 ? `
                    <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-sm mt-0.5">info</span>
                        <div>
                            <p class="text-sm text-slate-500">Los puntos de conversaci\u00f3n se generar\u00e1n autom\u00e1ticamente cuando haya m\u00e1s evaluaciones completadas.</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Conversation Guide
// -------------------------------------------------------
function renderConversationGuide() {
    const phases = [
        {
            icon: 'favorite', color: 'primary', title: 'Reconocimiento',
            time: '5 min', description: 'Comienza con lo positivo. Reconoce fortalezas espec\u00edficas y logros concretos del ciclo. Esto establece un tono seguro y constructivo.',
            tip: 'Usa los reconocimientos del feedback de pares como punto de partida.',
        },
        {
            icon: 'forum', color: 'accent', title: 'Retroalimentaci\u00f3n',
            time: '15 min', description: 'Explora las \u00e1reas de crecimiento con curiosidad, no con juicio. Compara perspectivas de la autoevaluaci\u00f3n, pares y facilitador.',
            tip: 'Si hay divergencias, preg\u00fantale: "\u00bfC\u00f3mo ves t\u00fa esta \u00e1rea?" antes de compartir tu perspectiva.',
        },
        {
            icon: 'handshake', color: 'highlight', title: 'Acuerdos y Plan de Acci\u00f3n',
            time: '15 min', description: 'Define acciones concretas, medibles y con fecha. Aseg\u00farate de que ambos est\u00e9n de acuerdo en los pr\u00f3ximos pasos.',
            tip: 'Las sugerencias de feedforward ya est\u00e1n pre-cargadas m\u00e1s abajo. \u00dasalas como base.',
        },
        {
            icon: 'check_circle', color: 'primary', title: 'Cierre',
            time: '5 min', description: 'Confirma que ambos entienden los acuerdos. Pregunta c\u00f3mo se siente la persona y si tiene algo m\u00e1s que agregar.',
            tip: 'Termina con una nota de confianza: "Confío en tu capacidad de..."',
        },
    ];

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-lg">route</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Gu\u00eda de conversaci\u00f3n</h3>
                <p class="text-xs text-slate-400 mt-0.5">Estructura sugerida para ${phases.reduce((s, p) => s + parseInt(p.time), 0)} minutos de conversaci\u00f3n significativa</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
                ${phases.map((phase, idx) => `
                <div class="p-5 relative ${idx === 0 ? 'bg-primary/[0.02]' : ''}">
                    <div class="absolute top-0 left-0 right-0 h-1 bg-${phase.color}"></div>
                    <div class="flex items-center gap-2 mb-3 mt-1">
                        <span class="material-symbols-outlined text-${phase.color} text-lg">${phase.icon}</span>
                        <div>
                            <p class="text-xs font-extrabold text-${phase.color} uppercase tracking-wider">${phase.title}</p>
                            <p class="text-[10px] text-slate-400 font-bold">${phase.time}</p>
                        </div>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">${phase.description}</p>
                    <div class="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <p class="text-[10px] text-slate-500 flex items-start gap-1.5">
                            <span class="material-symbols-outlined text-xs text-${phase.color} mt-0.5">tips_and_updates</span>
                            ${phase.tip}
                        </p>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Meeting Notes
// -------------------------------------------------------
function renderNotesArea(meeting) {
    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <span class="material-symbols-outlined text-slate-500 text-lg">edit_note</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Notas de la reuni\u00f3n</h3>
                <p class="text-xs text-slate-400 mt-0.5">Captura los puntos clave de la conversaci\u00f3n</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="p-6">
                <textarea
                    id="meeting-notes"
                    rows="10"
                    data-min-chars="20"
                    class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-y leading-relaxed"
                    placeholder="Escribe aqu\u00ed las notas de la reuni\u00f3n...&#10;&#10;\u2022 Temas discutidos&#10;\u2022 Puntos importantes&#10;\u2022 Compromisos verbales&#10;\u2022 Observaciones sobre el tono de la conversaci\u00f3n"
                >${meeting.notes || ''}</textarea>
                <div class="flex justify-between items-center mt-2">
                    <p class="text-[10px] text-slate-400 italic flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">lock</span>
                        Estas notas son visibles solo para los participantes de esta reuni\u00f3n
                    </p>
                    <span class="char-counter text-xs text-slate-400"></span>
                </div>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Agreements
// -------------------------------------------------------
function renderAgreements(meeting, evaluatee, facilitator, reviews) {
    const feedforwardSuggestions = collectFeedforward(reviews);
    const existingAgreements = meeting.agreements || [];

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-highlight text-lg">task_alt</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Acuerdos mutuos</h3>
                <p class="text-xs text-slate-400 mt-0.5">Acciones concretas que ambos se comprometen a cumplir</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border-2 border-primary/15 rounded-2xl shadow-sm overflow-hidden">
            <!-- Pre-populated from feedforward -->
            ${feedforwardSuggestions.length > 0 ? `
            <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-primary/[0.02]">
                <p class="text-[10px] font-extrabold text-primary uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">lightbulb</span>
                    Sugerencias desde el feedforward (pre-cargadas)
                </p>
                <div class="space-y-3">
                    ${feedforwardSuggestions.map((ff, idx) => `
                    <div class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/30 transition-colors">
                        <div class="flex items-start gap-3">
                            <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span class="text-primary font-extrabold text-xs">${idx + 1}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">${ff.action}</p>
                                <div class="flex flex-wrap items-center gap-3 mt-2">
                                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                        <span class="material-symbols-outlined text-xs">straighten</span>
                                        ${ff.indicator}
                                    </span>
                                    ${ff.dueDate ? `
                                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                        <span class="material-symbols-outlined text-xs">calendar_today</span>
                                        ${formatDate(ff.dueDate)}
                                    </span>
                                    ` : ''}
                                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                        <span class="material-symbols-outlined text-xs">person</span>
                                        Sugerido por ${ff.reviewerName}
                                    </span>
                                </div>
                            </div>
                            <span class="material-symbols-outlined text-primary/40 text-sm flex-shrink-0 mt-1">check_box_outline_blank</span>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Dynamic agreement form -->
            <div class="p-6">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-4">Agregar nuevos acuerdos</p>

                <div id="agreements-container" class="space-y-4">
                    ${existingAgreements.length > 0 ? existingAgreements.map((ag, idx) => renderAgreementRow(idx, evaluatee, facilitator, ag)).join('') : renderAgreementRow(0, evaluatee, facilitator)}
                </div>

                <button class="mt-4 w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                    data-action="add-agreement">
                    <span class="material-symbols-outlined text-base">add_circle</span>
                    Agregar acuerdo
                </button>
            </div>
        </div>
    </section>`;
}

function renderAgreementRow(index, evaluatee, facilitator, existing = null) {
    return `
    <div class="agreement-row p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Acuerdo ${index + 1}</span>
            ${index > 0 ? `
            <button class="text-xs text-slate-400 hover:text-highlight transition-colors" data-action="remove-agreement" data-param="${index}">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
            ` : ''}
        </div>

        <div>
            <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Descripci\u00f3n del acuerdo</label>
            <textarea
                rows="2"
                class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                placeholder="Describe el acuerdo de forma clara y espec\u00edfica..."
            >${existing ? existing.description || '' : ''}</textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Responsable</label>
                <select class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary transition-all">
                    <option value="${evaluatee.id}" ${existing && existing.responsible === evaluatee.id ? 'selected' : ''}>${evaluatee.name}</option>
                    <option value="${facilitator.id}" ${existing && existing.responsible === facilitator.id ? 'selected' : ''}>${facilitator.name}</option>
                    <option value="both" ${existing && existing.responsible === 'both' ? 'selected' : ''}>Ambos</option>
                </select>
            </div>
            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Fecha l\u00edmite</label>
                <input type="date"
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value="${existing ? existing.dueDate || '' : ''}" />
            </div>
            <div>
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Indicador de \u00e9xito</label>
                <input type="text"
                    class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Ej: 2 WIPs por sprint"
                    value="${existing ? existing.indicator || '' : ''}" />
            </div>
        </div>
    </div>`;
}

// -------------------------------------------------------
// Section: Digital Signatures
// -------------------------------------------------------
function renderSignatures(evaluatee, facilitator) {
    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-lg">verified</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Confirmaci\u00f3n de acuerdos</h3>
                <p class="text-xs text-slate-400 mt-0.5">Ambos participantes confirman haber le\u00eddo y acordado los compromisos</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="p-6">
                <div class="bg-primary/[0.03] border border-primary/10 rounded-xl p-4 mb-6">
                    <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span class="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
                        Al hacer clic en "Acepto estos acuerdos", confirmas que participaste en la conversaci\u00f3n, que entiendes los acuerdos y que te comprometes a trabajar en ellos.
                    </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <!-- Facilitator signature -->
                    <div class="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/30 transition-colors">
                        ${renderAvatar(facilitator, 'w-14 h-14 mx-auto')}
                        <p class="text-sm font-bold text-slate-900 dark:text-white mt-3">${facilitator.name}</p>
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">Facilitador/a</p>
                        <button class="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            data-action="sign-meeting" data-param="facilitator">
                            <span class="material-symbols-outlined text-base">draw</span>
                            Acepto estos acuerdos
                        </button>
                    </div>

                    <!-- Collaborator signature -->
                    <div class="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/30 transition-colors">
                        ${renderAvatar(evaluatee, 'w-14 h-14 mx-auto')}
                        <p class="text-sm font-bold text-slate-900 dark:text-white mt-3">${evaluatee.name}</p>
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">Colaborador/a</p>
                        <button class="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            data-action="sign-meeting" data-param="collaborator">
                            <span class="material-symbols-outlined text-base">draw</span>
                            Acepto estos acuerdos
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Footer Actions
// -------------------------------------------------------
function renderFooter() {
    return `
    <div class="sticky bottom-0 left-0 right-0 mt-10 -mx-8 px-8 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 z-10">
        <div class="flex items-center gap-2 text-sm text-slate-500">
            <span class="material-symbols-outlined text-base text-primary">handshake</span>
            <span class="font-semibold">Reuni\u00f3n 1:1</span>
        </div>
        <div class="flex items-center gap-3">
            <button data-action="save-draft"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                <span class="material-symbols-outlined text-base">save</span>
                Guardar notas
            </button>
            <button data-action="submit-form"
                class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                <span class="material-symbols-outlined text-base">check_circle</span>
                Finalizar reuni\u00f3n
            </button>
        </div>
    </div>`;
}

// -------------------------------------------------------
// Empty state (no meeting scheduled)
// -------------------------------------------------------
function renderNoMeeting() {
    const user = state.currentUser;
    const isFacilitator = user.role === 'facilitador';

    return `
    <div class="max-w-4xl mx-auto">
        <header class="mb-8">
            <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                <span class="material-symbols-outlined text-xs align-middle mr-1">handshake</span>
                Espacio de conversaci\u00f3n
            </p>
            <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Reuni\u00f3n 1:1
            </h2>
        </header>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div class="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-4xl">calendar_month</span>
            </div>
            <h3 class="text-xl font-extrabold text-slate-900 dark:text-white mb-2">No hay reuniones programadas</h3>
            <p class="text-sm text-slate-500 max-w-md mx-auto">
                ${isFacilitator
                    ? 'A\u00fan no tienes reuniones 1:1 programadas con tu equipo para este ciclo. Programa una reuni\u00f3n para comenzar el proceso de cierre.'
                    : 'Tu facilitador/a a\u00fan no ha programado la reuni\u00f3n 1:1 de cierre. Te notificaremos cuando est\u00e9 lista.'
                }
            </p>
            ${isFacilitator ? `
            <button class="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                data-action="show-toast" data-param="Funcionalidad de programar reuni\u00f3n pr\u00f3ximamente">
                <span class="material-symbols-outlined text-base">add</span>
                Programar reuni\u00f3n
            </button>
            ` : ''}
        </div>
    </div>`;
}

// -------------------------------------------------------
// Main render (exported)
// -------------------------------------------------------
export function render() {
    const user = state.currentUser;

    // Find a meeting for the current user
    const meeting = Data.meetings.find(m =>
        m.evaluateeId === user.id || m.facilitatorId === user.id
    );

    if (!meeting) return renderNoMeeting();

    const { evaluatee, facilitator } = getMeetingParticipants(meeting);
    if (!evaluatee || !facilitator) return renderNoMeeting();

    const reviews = getUserReviews(meeting.evaluateeId);

    return `
    <div class="max-w-4xl mx-auto pb-24">
        ${renderMeetingHeader(meeting, evaluatee, facilitator)}
        ${renderPreparation(evaluatee, reviews)}
        ${renderConversationGuide()}
        ${renderNotesArea(meeting)}
        ${renderAgreements(meeting, evaluatee, facilitator, reviews)}
        ${renderSignatures(evaluatee, facilitator)}
        ${renderFooter()}
    </div>`;
}
