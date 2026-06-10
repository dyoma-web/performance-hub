// ============================================================
// Performance Hub — Mi Desarrollo (Growth Map) View
// ============================================================
import { state, getUser, getUserObjectives, getUserReviews, getUserActionPlan, renderAvatar, formatDate, timeAgo, statusLabel } from '../app.js';
import * as Data from '../data.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function getFirstName(fullName) {
    return (fullName || '').split(' ')[0];
}

function progressColor(pct) {
    if (pct >= 75) return 'primary';
    if (pct >= 50) return 'accent';
    return 'highlight';
}

function statusColorClass(status) {
    const map = {
        'pending': 'slate', 'in-progress': 'accent', 'completed': 'primary',
    };
    return map[status] || 'slate';
}

function daysRemaining(dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `Vencido hace ${Math.abs(diff)} d\u00edas`, overdue: true, days: diff };
    if (diff === 0) return { text: 'Vence hoy', overdue: false, days: 0 };
    if (diff === 1) return { text: 'Vence ma\u00f1ana', overdue: false, days: 1 };
    return { text: `${diff} d\u00edas restantes`, overdue: false, days: diff };
}

/**
 * Extract strengths: behaviors/items scored >= 3 across completed peer reviews.
 * Returns an array of { id, name, description, sources, avgScore, quotes }
 */
function extractStrengths(reviews) {
    const strengthMap = {};

    reviews.forEach(r => {
        if (r.status !== 'completed') return;
        const reviewer = getUser(r.reviewerId);
        const reviewerName = reviewer ? reviewer.name : 'An\u00f3nimo';

        // Check scored items
        if (r.items && r.items.length > 0) {
            r.items.forEach(item => {
                if (item.score >= 3) {
                    if (!strengthMap[item.itemId]) {
                        const behavior = Data.BEHAVIORS.find(b => b.id === item.itemId);
                        strengthMap[item.itemId] = {
                            id: item.itemId,
                            name: behavior ? behavior.name : item.itemId,
                            description: behavior ? behavior.description : '',
                            sources: [],
                            scores: [],
                            quotes: [],
                        };
                    }
                    strengthMap[item.itemId].sources.push(reviewerName);
                    strengthMap[item.itemId].scores.push(item.score);
                    if (item.comment) {
                        strengthMap[item.itemId].quotes.push({
                            text: item.comment,
                            author: reviewerName,
                        });
                    }
                }
            });
        }

        // Check recognition
        if (r.recognition) {
            const key = '_recognition_' + r.reviewerId;
            if (!strengthMap[key]) {
                strengthMap[key] = {
                    id: key,
                    name: 'Reconocimiento general',
                    description: '',
                    sources: [],
                    scores: [],
                    quotes: [],
                    isRecognition: true,
                };
            }
            strengthMap[key].sources.push(reviewerName);
            strengthMap[key].quotes.push({
                text: r.recognition,
                author: reviewerName,
            });
        }
    });

    return Object.values(strengthMap)
        .map(s => ({
            ...s,
            avgScore: s.scores.length > 0 ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10 : null,
            sourceCount: s.sources.length,
        }))
        .sort((a, b) => b.sourceCount - a.sourceCount);
}

/**
 * Extract growth areas: items with scores 1-2 or feedforward suggestions.
 * Returns { areas, feedforward }
 */
function extractGrowthAreas(reviews) {
    const areaMap = {};
    const feedforwardItems = [];

    reviews.forEach(r => {
        if (r.status !== 'completed') return;
        const reviewer = getUser(r.reviewerId);
        const reviewerName = reviewer ? reviewer.name : 'An\u00f3nimo';

        // Low-scored items
        if (r.items && r.items.length > 0) {
            r.items.forEach(item => {
                if (item.score >= 1 && item.score <= 2) {
                    if (!areaMap[item.itemId]) {
                        const behavior = Data.BEHAVIORS.find(b => b.id === item.itemId);
                        areaMap[item.itemId] = {
                            id: item.itemId,
                            name: behavior ? behavior.name : item.itemId,
                            description: behavior ? behavior.description : '',
                            feedback: [],
                            scores: [],
                        };
                    }
                    areaMap[item.itemId].scores.push(item.score);
                    if (item.comment) {
                        areaMap[item.itemId].feedback.push({
                            text: item.comment,
                            author: reviewerName,
                        });
                    }
                }
            });
        }

        // Feedforward suggestions
        if (r.feedforward && r.feedforward.length > 0) {
            r.feedforward.forEach(ff => {
                feedforwardItems.push({
                    ...ff,
                    reviewerName,
                    reviewType: r.type,
                });
            });
        }
    });

    return {
        areas: Object.values(areaMap),
        feedforward: feedforwardItems,
    };
}

/**
 * Build timeline events from multiple data sources.
 */
function buildGrowthTimeline(userId) {
    const events = [];

    // Evidence timeline
    const evidence = Data.evidenceTimeline.filter(e => e.userId === userId);
    evidence.forEach(e => {
        const iconMap = {
            'peer-feedback': { icon: 'forum', color: 'accent', label: 'Feedback de par' },
            'checkin': { icon: 'event_available', color: 'primary', label: 'Check-in' },
            '1on1': { icon: 'handshake', color: 'highlight', label: 'Reuni\u00f3n 1:1' },
            'milestone': { icon: 'flag', color: 'primary', label: 'Hito' },
            'jira': { icon: 'task_alt', color: 'accent', label: 'Entregable' },
        };
        const meta = iconMap[e.type] || { icon: 'circle', color: 'slate', label: e.type };
        events.push({
            date: e.date,
            icon: meta.icon,
            color: meta.color,
            label: meta.label,
            source: e.source,
            summary: e.summary,
        });
    });

    // Check-ins
    const checkIns = Data.checkIns.filter(c => c.userId === userId);
    checkIns.forEach(ci => {
        // Only add if not already in evidence timeline
        const exists = events.some(ev => ev.date === ci.date && ev.label === 'Check-in');
        if (!exists) {
            events.push({
                date: ci.date,
                icon: 'event_available',
                color: 'primary',
                label: 'Check-in',
                source: `Check-in de ${formatDate(ci.date)}`,
                summary: ci.achievements ? ci.achievements.substring(0, 120) + (ci.achievements.length > 120 ? '...' : '') : '',
            });
        }
    });

    // Sort descending
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    return events;
}

// -------------------------------------------------------
// Section: Header
// -------------------------------------------------------
function renderHeader(user) {
    return `
    <header class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
                <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2">
                    <span class="material-symbols-outlined text-xs align-middle mr-1">spa</span>
                    Tu trayectoria de crecimiento
                </p>
                <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    Mi Mapa de Crecimiento
                </h2>
                <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                    Hola, ${getFirstName(user.name)}. Este es el resumen de tu crecimiento en el ciclo
                    <span class="font-bold text-slate-700 dark:text-slate-300">${state.currentCycle.name}</span>.
                    Aqu\u00ed confluyen las fortalezas que reconocen en ti, las \u00e1reas donde puedes crecer y tu plan de acci\u00f3n vivo.
                </p>
            </div>
            <div class="flex gap-3 flex-shrink-0">
                <button class="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                        data-action="navigate" data-param="self-review">
                    <span class="material-symbols-outlined text-lg text-primary">rate_review</span>
                    Mi Evaluaci\u00f3n
                </button>
            </div>
        </div>
    </header>`;
}

// -------------------------------------------------------
// Section: Strengths Map
// -------------------------------------------------------
function renderStrengthsMap(strengths) {
    if (strengths.length === 0) {
        return `
        <section class="mb-8">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-lg">star</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Mapa de fortalezas</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Lo que otros reconocen consistentemente en ti</p>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
                <span class="material-symbols-outlined text-5xl text-primary/20 mb-3 block">star</span>
                <p class="text-sm text-slate-500 font-semibold">A\u00fan no hay suficiente feedback para identificar fortalezas</p>
                <p class="text-xs text-slate-400 mt-1">Cuando tus pares completen sus evaluaciones, tus fortalezas recurrentes aparecer\u00e1n aqu\u00ed.</p>
            </div>
        </section>`;
    }

    // Separate recognition from scored strengths
    const scoredStrengths = strengths.filter(s => !s.isRecognition);
    const recognitions = strengths.filter(s => s.isRecognition);

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-lg">star</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Mapa de fortalezas</h3>
                <p class="text-xs text-slate-400 mt-0.5">Lo que otros reconocen consistentemente en ti</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${scoredStrengths.map(s => `
            <div class="bg-gradient-to-br from-primary/[0.04] to-white dark:from-primary/[0.08] dark:to-slate-900 border-2 border-primary/15 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-primary text-sm">star</span>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-slate-900 dark:text-white">${s.name}</h4>
                            ${s.description ? `<p class="text-[10px] text-slate-400 mt-0.5">${s.description}</p>` : ''}
                        </div>
                    </div>
                    ${s.avgScore !== null ? `
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="w-7 h-7 rounded-full bg-primary text-white text-xs font-extrabold flex items-center justify-center">${s.avgScore}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="mb-3">
                    <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.sourceCount >= 2 ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">
                        <span class="material-symbols-outlined text-xs">group</span>
                        ${s.sourceCount >= 2 ? 'Reconocido consistentemente' : `Identificado por ${s.sourceCount} fuente`}
                    </span>
                </div>

                ${s.quotes.length > 0 ? `
                <div class="space-y-2">
                    ${s.quotes.slice(0, 2).map(q => `
                    <div class="p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">"${q.text.length > 150 ? q.text.substring(0, 150) + '...' : q.text}"</p>
                        <p class="text-[10px] text-slate-400 font-semibold mt-1.5 flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">person</span>
                            ${q.author}
                        </p>
                    </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>

        ${recognitions.length > 0 ? `
        <div class="mt-4 space-y-3">
            ${recognitions.map(r => r.quotes.map(q => `
            <div class="bg-gradient-to-r from-accent/[0.05] to-white dark:from-accent/[0.08] dark:to-slate-900 border border-accent/15 rounded-2xl p-5 shadow-sm">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-accent text-lg mt-0.5">favorite</span>
                    <div>
                        <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">"${q.text}"</p>
                        <p class="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">person</span>
                            ${q.author}
                            <span class="mx-1">\u00b7</span>
                            Reconocimiento
                        </p>
                    </div>
                </div>
            </div>
            `).join('')).join('')}
        </div>
        ` : ''}
    </section>`;
}

// -------------------------------------------------------
// Section: Growth Areas
// -------------------------------------------------------
function renderGrowthAreas(growthData, actionPlan) {
    const { areas, feedforward } = growthData;
    const actions = actionPlan ? actionPlan.actions : [];

    if (areas.length === 0 && feedforward.length === 0) {
        return `
        <section class="mb-8">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-accent text-lg">trending_up</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">\u00c1reas de crecimiento</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Oportunidades para seguir mejorando</p>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
                <span class="material-symbols-outlined text-4xl text-accent/20 mb-3 block">trending_up</span>
                <p class="text-sm text-slate-500 font-semibold">Sin \u00e1reas de crecimiento identificadas a\u00fan</p>
                <p class="text-xs text-slate-400 mt-1">Las sugerencias de feedforward y \u00e1reas con puntajes bajos se mostrar\u00e1n aqu\u00ed.</p>
            </div>
        </section>`;
    }

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-accent text-lg">trending_up</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">\u00c1reas de crecimiento</h3>
                <p class="text-xs text-slate-400 mt-0.5">Oportunidades para seguir mejorando, con feedback espec\u00edfico</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            ${areas.length > 0 ? `
            <div class="p-6 space-y-4 ${feedforward.length > 0 ? 'border-b border-slate-100 dark:border-slate-800' : ''}">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-2">Comportamientos con oportunidad de mejora</p>
                ${areas.map(area => {
                    const avgScore = area.scores.length > 0 ? Math.round((area.scores.reduce((a, b) => a + b, 0) / area.scores.length) * 10) / 10 : null;
                    // Find matching actions from the plan
                    const relatedActions = actions.filter(a => {
                        const lowerAction = a.action.toLowerCase();
                        const lowerName = area.name.toLowerCase();
                        return lowerAction.includes(lowerName) || lowerName.includes(lowerAction.split(' ')[0]);
                    });

                    return `
                    <div class="p-4 bg-accent/[0.03] border border-accent/10 rounded-xl">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-accent text-lg">trending_up</span>
                                <div>
                                    <h4 class="font-bold text-sm text-slate-900 dark:text-white">${area.name}</h4>
                                    ${area.description ? `<p class="text-[10px] text-slate-400">${area.description}</p>` : ''}
                                </div>
                            </div>
                            ${avgScore !== null ? `
                            <span class="w-7 h-7 rounded-full bg-accent text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">${avgScore}</span>
                            ` : ''}
                        </div>

                        ${area.feedback.length > 0 ? `
                        <div class="space-y-2 mb-3">
                            ${area.feedback.map(fb => `
                            <div class="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${fb.text}</p>
                                <p class="text-[10px] text-slate-400 font-semibold mt-1">\u2014 ${fb.author}</p>
                            </div>
                            `).join('')}
                        </div>
                        ` : ''}

                        ${relatedActions.length > 0 ? `
                        <div class="p-2.5 bg-primary/[0.04] border border-primary/10 rounded-lg">
                            <p class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">task_alt</span>
                                Acci\u00f3n en tu plan
                            </p>
                            ${relatedActions.map(a => `
                            <p class="text-xs text-slate-600 dark:text-slate-400">${a.action}</p>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </div>
            ` : ''}

            ${feedforward.length > 0 ? `
            <div class="p-6">
                <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-3">Sugerencias de feedforward recibidas</p>
                <div class="space-y-3">
                    ${feedforward.map(ff => `
                    <div class="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span class="material-symbols-outlined text-accent text-sm mt-0.5">arrow_forward</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">${ff.action}</p>
                            <div class="flex flex-wrap items-center gap-3 mt-1.5">
                                ${ff.indicator ? `
                                <span class="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">straighten</span>
                                    ${ff.indicator}
                                </span>
                                ` : ''}
                                <span class="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">person</span>
                                    ${ff.reviewerName}
                                </span>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Active Action Plan
// -------------------------------------------------------
function renderActionPlan(actionPlan) {
    const actions = actionPlan ? actionPlan.actions : [];

    if (actions.length === 0) {
        return `
        <section class="mb-8">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-highlight text-lg">rocket_launch</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Plan de acci\u00f3n activo</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Tus compromisos de desarrollo para este ciclo</p>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
                <span class="material-symbols-outlined text-4xl text-highlight/20 mb-3 block">rocket_launch</span>
                <p class="text-sm text-slate-500 font-semibold">A\u00fan no tienes un plan de acci\u00f3n definido</p>
                <p class="text-xs text-slate-400 mt-1">Tu plan se construye a partir de las sugerencias de feedforward y los acuerdos de tu reuni\u00f3n 1:1.</p>
            </div>
        </section>`;
    }

    const completed = actions.filter(a => a.status === 'completed').length;
    const total = actions.length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `
    <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-highlight text-lg">rocket_launch</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Plan de acci\u00f3n activo</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Tus compromisos de desarrollo para este ciclo</p>
                </div>
            </div>
            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">${completed} de ${total}</span>
        </div>

        <!-- Overall progress bar -->
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Progreso general del plan</p>
                    <span class="text-sm font-extrabold text-${progressColor(progressPct)}">${progressPct}%</span>
                </div>
                <div class="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-${progressColor(progressPct)} rounded-full transition-all duration-700" style="width: ${progressPct}%"></div>
                </div>
            </div>

            <!-- Action cards -->
            <div class="p-6 space-y-4">
                ${actions.map((action, idx) => {
                    const remaining = daysRemaining(action.dueDate);
                    const color = statusColorClass(action.status);

                    return `
                    <div class="p-5 rounded-2xl border-2 ${action.status === 'completed' ? 'border-primary/20 bg-primary/[0.02]' : remaining.overdue ? 'border-highlight/20 bg-highlight/[0.02]' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'} hover:shadow-md transition-all">
                        <div class="flex items-start gap-4">
                            <!-- Status toggle -->
                            <button class="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg border-2 ${action.status === 'completed' ? 'border-primary bg-primary' : action.status === 'in-progress' ? 'border-accent bg-accent/10' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'} flex items-center justify-center transition-all hover:scale-110"
                                data-action="toggle-action-status" data-param="${action.id}">
                                ${action.status === 'completed'
                                    ? '<span class="material-symbols-outlined text-white text-sm">check</span>'
                                    : action.status === 'in-progress'
                                        ? '<span class="material-symbols-outlined text-accent text-sm">more_horiz</span>'
                                        : ''
                                }
                            </button>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-start justify-between gap-3 mb-2">
                                    <h4 class="font-bold text-sm text-slate-900 dark:text-white ${action.status === 'completed' ? 'line-through opacity-60' : ''} leading-snug">${action.action}</h4>
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 bg-${color}/10 text-${color}">
                                        ${statusLabel(action.status)}
                                    </span>
                                </div>

                                <!-- Indicator -->
                                <p class="text-xs text-slate-500 mb-2.5 flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-xs">straighten</span>
                                    ${action.indicator}
                                </p>

                                <!-- Meta: due date + days remaining + responsible -->
                                <div class="flex flex-wrap items-center gap-3 mb-3">
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                        <span class="material-symbols-outlined text-xs">calendar_today</span>
                                        ${formatDate(action.dueDate)}
                                    </span>
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold ${remaining.overdue ? 'text-highlight' : remaining.days <= 7 ? 'text-accent' : 'text-slate-400'}">
                                        <span class="material-symbols-outlined text-xs">${remaining.overdue ? 'warning' : 'timer'}</span>
                                        ${remaining.text}
                                    </span>
                                    ${action.responsible ? (() => {
                                        const resp = getUser(action.responsible);
                                        return resp ? `
                                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                            <span class="material-symbols-outlined text-xs">person</span>
                                            ${resp.name}
                                        </span>` : '';
                                    })() : ''}
                                </div>

                                <!-- Check-in notes area -->
                                <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="material-symbols-outlined text-xs text-slate-400">chat_bubble_outline</span>
                                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas de seguimiento</p>
                                    </div>
                                    ${action.checkins && action.checkins.length > 0 ? `
                                    <div class="space-y-1.5 mb-2">
                                        ${action.checkins.map(ci => `
                                        <div class="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <p class="text-xs text-slate-600 dark:text-slate-400">${ci.note}</p>
                                            <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(ci.date)}</p>
                                        </div>
                                        `).join('')}
                                    </div>
                                    ` : ''}
                                    <textarea
                                        rows="1"
                                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                                        placeholder="Agrega una nota de avance..."
                                        id="action-checkin-${action.id}"
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <div class="px-6 pb-6">
                <div class="p-4 bg-primary/[0.03] border border-primary/10 rounded-xl">
                    <p class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span class="material-symbols-outlined text-primary text-sm mt-0.5">tips_and_updates</span>
                        <span>Tu plan de acci\u00f3n es un documento vivo. Agrega notas de seguimiento y actualiza el estado conforme avanzas. Esto alimentar\u00e1 tu pr\u00f3xima evaluaci\u00f3n.</span>
                    </p>
                </div>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Growth Timeline
// -------------------------------------------------------
function renderGrowthTimeline(userId) {
    const events = buildGrowthTimeline(userId);

    if (events.length === 0) {
        return `
        <section class="mb-8">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span class="material-symbols-outlined text-slate-500 text-lg">timeline</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">L\u00ednea de crecimiento</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Tu historial de actividad y logros</p>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
                <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-3 block">timeline</span>
                <p class="text-sm text-slate-500 font-semibold">Tu l\u00ednea de tiempo comenzar\u00e1 a llenarse con tus actividades</p>
            </div>
        </section>`;
    }

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <span class="material-symbols-outlined text-slate-500 text-lg">timeline</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">L\u00ednea de crecimiento</h3>
                <p class="text-xs text-slate-400 mt-0.5">Tu historial de actividad y logros en este ciclo</p>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="p-6">
                <div class="relative">
                    <!-- Timeline line -->
                    <div class="absolute left-[15px] top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                    <div class="space-y-5">
                        ${events.map((ev, idx) => `
                        <div class="relative pl-10">
                            <!-- Timeline dot -->
                            <div class="absolute left-[7px] top-3 w-[18px] h-[18px] bg-white dark:bg-slate-900 border-[3px] border-${ev.color} rounded-full z-10 ${idx === 0 ? 'ring-4 ring-' + ev.color + '/20' : ''}"></div>

                            <div class="pb-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-${ev.color}/10 text-${ev.color}">
                                        <span class="material-symbols-outlined text-xs">${ev.icon}</span>
                                        ${ev.label}
                                    </span>
                                    <span class="text-[10px] text-slate-400 font-semibold">${formatDate(ev.date)}</span>
                                    <span class="text-[10px] text-slate-300">\u00b7</span>
                                    <span class="text-[10px] text-slate-400">${timeAgo(ev.date)}</span>
                                </div>
                                ${ev.source ? `<p class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-0.5">${ev.source}</p>` : ''}
                                ${ev.summary ? `<p class="text-xs text-slate-500 leading-relaxed">${ev.summary}</p>` : ''}
                            </div>
                        </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Section: Next Steps (Most Urgent Action)
// -------------------------------------------------------
function renderNextSteps(actionPlan) {
    const actions = actionPlan ? actionPlan.actions : [];
    const pending = actions
        .filter(a => a.status !== 'completed')
        .map(a => ({ ...a, ...daysRemaining(a.dueDate) }))
        .sort((a, b) => {
            // Overdue first, then by days ascending
            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;
            return a.days - b.days;
        });

    if (pending.length === 0) {
        return `
        <section class="mb-8">
            <div class="bg-gradient-to-br from-primary/10 via-white to-accent/5 dark:from-primary/10 dark:via-slate-900 dark:to-accent/10 border-2 border-primary/15 rounded-2xl p-8 text-center shadow-sm">
                <span class="material-symbols-outlined text-4xl text-primary mb-3 block">celebration</span>
                <h3 class="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Todas tus acciones est\u00e1n al d\u00eda</h3>
                <p class="text-sm text-slate-500">Has completado todas las acciones de tu plan de desarrollo. Sigue as\u00ed y prep\u00e1rate para la pr\u00f3xima revisi\u00f3n.</p>
            </div>
        </section>`;
    }

    const urgent = pending[0];
    const resp = urgent.responsible ? getUser(urgent.responsible) : null;

    return `
    <section class="mb-8">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-highlight/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-highlight text-lg">priority_high</span>
            </div>
            <div>
                <h3 class="font-extrabold text-lg text-slate-900 dark:text-white">Siguiente paso</h3>
                <p class="text-xs text-slate-400 mt-0.5">La acci\u00f3n m\u00e1s urgente de tu plan</p>
            </div>
        </div>

        <div class="bg-gradient-to-br ${urgent.overdue ? 'from-highlight/10 via-white to-highlight/5 border-highlight/20' : 'from-accent/10 via-white to-primary/5 border-accent/20'} dark:from-accent/10 dark:via-slate-900 dark:to-primary/10 border-2 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <span class="material-symbols-outlined absolute -bottom-4 -right-2 text-[7rem] ${urgent.overdue ? 'text-highlight/5' : 'text-accent/5'} transform -rotate-12 select-none">rocket_launch</span>
            <div class="relative z-10">
                <div class="flex items-start justify-between gap-4 mb-3">
                    <div>
                        ${urgent.overdue ? `
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-highlight/15 text-highlight mb-2">
                            <span class="material-symbols-outlined text-xs">warning</span>
                            Acci\u00f3n vencida
                        </span>
                        ` : `
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/15 text-accent mb-2">
                            <span class="material-symbols-outlined text-xs">timer</span>
                            ${urgent.text}
                        </span>
                        `}
                        <h4 class="text-lg font-extrabold text-slate-900 dark:text-white">${urgent.action}</h4>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-4 mb-4">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span class="material-symbols-outlined text-xs">straighten</span>
                        ${urgent.indicator}
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span class="material-symbols-outlined text-xs">calendar_today</span>
                        ${formatDate(urgent.dueDate)}
                    </span>
                    ${resp ? `
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span class="material-symbols-outlined text-xs">person</span>
                        ${resp.name}
                    </span>
                    ` : ''}
                </div>

                <button class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                    data-action="navigate" data-param="checkin">
                    <span class="material-symbols-outlined text-base">edit_note</span>
                    Registrar avance
                </button>
            </div>
        </div>
    </section>`;
}

// -------------------------------------------------------
// Main render (exported)
// -------------------------------------------------------
export function render() {
    const user = state.currentUser;
    const reviews = getUserReviews(user.id);
    const completedReviews = reviews.filter(r => r.status === 'completed');
    const actionPlan = getUserActionPlan(user.id);
    const strengths = extractStrengths(completedReviews);
    const growthData = extractGrowthAreas(completedReviews);

    return `
    <div class="max-w-5xl mx-auto pb-12">
        ${renderHeader(user)}
        ${renderStrengthsMap(strengths)}
        ${renderGrowthAreas(growthData, actionPlan)}
        ${renderActionPlan(actionPlan)}
        ${renderGrowthTimeline(user.id)}
        ${renderNextSteps(actionPlan)}
    </div>`;
}
