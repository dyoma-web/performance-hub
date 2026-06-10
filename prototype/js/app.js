// ============================================================
// Performance Hub — App Core (Router, State, Utilities)
// ============================================================
import * as Data from './data.js';

// -------------------------------------------------------
// State
// -------------------------------------------------------
export const state = {
    currentUser: Data.users[0],       // Alejandra (colaborador) por defecto
    currentView: 'dashboard',
    currentCycle: Data.cycles[0],
    viewingUserId: null,               // Para facilitador viendo a otro
    sidebarOpen: true,
    toasts: [],
};

// -------------------------------------------------------
// Router
// -------------------------------------------------------
const routes = {};

export function registerView(name, renderFn) {
    routes[name] = renderFn;
}

export function navigate(view, params = {}) {
    state.currentView = view;
    window.location.hash = `#/${view}`;
    render(params);
}

export function render(params = {}) {
    const container = document.getElementById('app-content');
    if (!container) return;
    const renderFn = routes[state.currentView];
    if (renderFn) {
        container.innerHTML = '';
        container.innerHTML = renderFn(params);
        bindViewEvents();
        updateNav();
    }
}

function bindViewEvents() {
    // Bind all [data-action] elements
    document.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', (e) => {
            const action = el.dataset.action;
            const param = el.dataset.param || '';
            handleAction(action, param, e);
        });
    });
    // Bind rating selectors
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            document.querySelectorAll(`.rating-btn[data-group="${group}"]`).forEach(b => {
                b.classList.remove('border-primary', 'bg-primary/5', 'font-bold', 'ring-2', 'ring-primary/30');
                b.classList.add('border-slate-200', 'dark:border-slate-700');
                b.querySelector('.rating-dot')?.classList.remove('bg-primary', 'text-white');
                b.querySelector('.rating-dot')?.classList.add('border-2', 'border-slate-200');
            });
            btn.classList.add('border-primary', 'bg-primary/5', 'font-bold', 'ring-2', 'ring-primary/30');
            btn.classList.remove('border-slate-200', 'dark:border-slate-700');
            const dot = btn.querySelector('.rating-dot');
            if (dot) {
                dot.classList.add('bg-primary', 'text-white');
                dot.classList.remove('border-2', 'border-slate-200');
            }
        });
    });
    // Bind tab switches
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabGroup = btn.dataset.tabGroup;
            const tabTarget = btn.dataset.tab;
            document.querySelectorAll(`.tab-btn[data-tab-group="${tabGroup}"]`).forEach(t => {
                t.classList.remove('border-primary', 'text-primary', 'font-bold');
                t.classList.add('border-transparent', 'text-slate-400');
            });
            btn.classList.add('border-primary', 'text-primary', 'font-bold');
            btn.classList.remove('border-transparent', 'text-slate-400');
            document.querySelectorAll(`.tab-content[data-tab-group="${tabGroup}"]`).forEach(c => {
                c.classList.add('hidden');
            });
            const target = document.getElementById(tabTarget);
            if (target) target.classList.remove('hidden');
        });
    });
    // Textarea character guidance
    document.querySelectorAll('textarea[data-min-chars]').forEach(ta => {
        const min = parseInt(ta.dataset.minChars);
        const counter = ta.parentElement.querySelector('.char-counter');
        if (counter) {
            ta.addEventListener('input', () => {
                const len = ta.value.length;
                counter.textContent = `${len} caracteres${len < min ? ` (mínimo ${min})` : ' ✓'}`;
                counter.className = `char-counter text-xs mt-1 ${len < min ? 'text-highlight' : 'text-primary'}`;
            });
        }
    });
    // Vague-comment warnings for peer-textarea elements
    document.querySelectorAll('.peer-textarea').forEach(ta => {
        ta.addEventListener('input', () => {
            const len = ta.value.length;
            const container = ta.closest('.space-y-3, .space-y-4, div');
            let warning = container ? container.querySelector('.vague-warning') : null;
            if (!warning) {
                const parent = ta.parentElement;
                warning = parent ? parent.querySelector('.vague-warning') : null;
            }
            if (warning) {
                if (len > 0 && len < 30) {
                    warning.classList.remove('hidden');
                } else {
                    warning.classList.add('hidden');
                }
            }
        });
    });
    // Collapsible sections
    document.querySelectorAll('[data-toggle]').forEach(el => {
        el.addEventListener('click', () => {
            const target = document.getElementById(el.dataset.toggle);
            if (target) target.classList.toggle('hidden');
        });
    });
    // Team row expand (admin)
    document.querySelectorAll('[data-expand]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('button[data-action]')) return;
            const target = document.getElementById(el.dataset.expand);
            if (target) target.classList.toggle('hidden');
            const chevron = el.querySelector('.expand-chevron');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    });
}

function handleAction(action, param, event) {
    switch (action) {
        case 'navigate':
            navigate(param);
            break;
        case 'switch-role':
            switchRole(param);
            break;
        case 'toggle-sidebar':
            state.sidebarOpen = !state.sidebarOpen;
            document.getElementById('sidebar')?.classList.toggle('-translate-x-full');
            break;
        case 'show-toast':
            showToast(param);
            break;
        case 'save-draft':
            showToast('Borrador guardado exitosamente');
            break;
        case 'submit-form':
            if (validateCurrentForm()) {
                showToast('Enviado exitosamente');
            }
            break;
        case 'toggle-scale-info':
            document.getElementById('scale-info-panel')?.classList.toggle('hidden');
            break;
        default:
            console.log('Action:', action, param);
    }
}

// -------------------------------------------------------
// Role switching
// -------------------------------------------------------
export function switchRole(userId) {
    const user = Data.users.find(u => u.id === userId);
    if (user) {
        state.currentUser = user;
        renderShell();
        navigate('dashboard');
    }
}

// -------------------------------------------------------
// Navigation
// -------------------------------------------------------
function updateNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        const view = link.dataset.view;
        if (view === state.currentView) {
            link.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
            link.classList.remove('text-slate-500', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        } else {
            link.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
            link.classList.add('text-slate-500', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        }
    });
}

// -------------------------------------------------------
// Utilities
// -------------------------------------------------------
export function getUser(id) { return Data.users.find(u => u.id === id); }
export function getTeam(id) { return Data.teams.find(t => t.id === id); }
export function getUserObjectives(userId) { return Data.objectives.filter(o => o.userId === userId); }
export function getUserCheckIns(userId) { return Data.checkIns.filter(c => c.userId === userId); }
export function getUserReviews(userId) { return Data.reviews.filter(r => r.evaluateeId === userId); }
export function getUserActionPlan(userId) { return Data.actionPlans.find(a => a.userId === userId); }
export function getEvidence(userId) { return Data.evidenceTimeline.filter(e => e.userId === userId); }
export function getRoleSkills(roleType) { return Data.ROLE_SKILLS[roleType] || Data.ROLE_SKILLS.default; }

export function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7) return `Hace ${diff} días`;
    if (diff < 30) return `Hace ${Math.floor(diff / 7)} sem.`;
    return formatDate(dateStr);
}

export function progressColor(pct) {
    if (pct >= 75) return 'primary';
    if (pct >= 50) return 'accent';
    return 'highlight';
}

export function statusLabel(status) {
    const map = {
        'draft': 'Borrador', 'open': 'Abierto', 'self-review': 'Autoevaluación',
        'peer-feedback': 'Feedback de Pares', 'manager-review': 'Revisión Facilitador',
        'meeting': 'Reunión 1:1', 'calibration': 'Calibración',
        'finalized': 'Finalizado', 'archived': 'Archivado',
        'pending': 'Pendiente', 'in-progress': 'En progreso',
        'completed': 'Completado', 'scheduled': 'Programada',
    };
    return map[status] || status;
}

export function statusColor(status) {
    const map = {
        'draft': 'slate', 'open': 'primary', 'self-review': 'accent',
        'peer-feedback': 'accent', 'manager-review': 'primary',
        'meeting': 'primary', 'calibration': 'highlight',
        'finalized': 'primary', 'archived': 'slate',
        'pending': 'slate', 'in-progress': 'accent', 'completed': 'primary',
        'scheduled': 'accent',
    };
    return map[status] || 'slate';
}

export function renderScaleSelector(groupId, selected = null) {
    return Data.SCALE.map(s => `
        <button class="rating-btn py-3 px-3 border ${selected === s.value ? 'border-primary bg-primary/5 font-bold ring-2 ring-primary/30' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm hover:border-primary/50 transition-all flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800"
            data-group="${groupId}" data-value="${s.value}" title="${s.description}">
            <span class="rating-dot w-7 h-7 rounded-full flex items-center justify-center text-xs ${selected === s.value ? 'bg-primary text-white' : 'border-2 border-slate-200'}">${s.value}</span>
            <span class="text-[10px] leading-tight text-center">${s.label}</span>
        </button>
    `).join('');
}

export function renderAvatar(user, size = 'w-10 h-10') {
    const colors = ['bg-primary', 'bg-highlight', 'bg-accent', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'];
    const colorIndex = user.id.charCodeAt(1) % colors.length;
    return `<div class="${size} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">${user.avatar}</div>`;
}

// -------------------------------------------------------
// Toast notifications
// -------------------------------------------------------
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-primary', error: 'bg-highlight', warning: 'bg-accent' };
    toast.className = `${colors[type] || colors.success} text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 transform translate-y-4 opacity-0 transition-all duration-300`;
    const icons = { success: 'check_circle', error: 'error', warning: 'warning' };
    toast.innerHTML = `<span class="material-symbols-outlined text-lg">${icons[type] || icons.success}</span>${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// -------------------------------------------------------
// Form validation
// -------------------------------------------------------
function validateCurrentForm() {
    let valid = true;
    document.querySelectorAll('textarea[required]').forEach(ta => {
        if (!ta.value.trim()) {
            ta.classList.add('ring-2', 'ring-highlight');
            valid = false;
        } else {
            ta.classList.remove('ring-2', 'ring-highlight');
        }
    });
    if (!valid) showToast('Por favor completa todos los campos obligatorios', 'error');
    return valid;
}

// -------------------------------------------------------
// Shell rendering
// -------------------------------------------------------
export function renderShell() {
    const app = document.getElementById('app');
    if (!app) return;

    const u = state.currentUser;
    const role = u.role;
    const navItems = getNavItems(role);

    app.innerHTML = `
    <div class="flex h-screen overflow-hidden">
        <!-- Sidebar -->
        <aside id="sidebar" class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col flex-shrink-0 transition-transform duration-300 z-40 fixed lg:relative h-full">
            <div class="p-6 flex items-center gap-3">
                <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
                    <span class="material-symbols-outlined text-white text-xl">insights</span>
                </div>
                <div>
                    <h1 class="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Hub<span class="text-primary">.</span></h1>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Performance</p>
                </div>
            </div>

            <nav class="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
                ${navItems.map(item => `
                    <a class="nav-link flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all font-semibold text-sm ${item.view === state.currentView ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}"
                       data-view="${item.view}" data-action="navigate" data-param="${item.view}">
                        <span class="material-symbols-outlined text-lg">${item.icon}</span>
                        ${item.label}
                    </a>
                `).join('')}
            </nav>

            <!-- Role Switcher -->
            <div class="p-4 border-t border-slate-100 dark:border-slate-800">
                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-3 px-2">Cambiar rol (demo)</p>
                <select id="role-switcher" class="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-primary focus:border-primary">
                    ${Data.users.filter(usr => ['u1','u2','u6'].includes(usr.id)).map(usr => `
                        <option value="${usr.id}" ${usr.id === u.id ? 'selected' : ''}>${usr.name} (${usr.role === 'admin' ? 'People Ops' : usr.role === 'facilitador' ? 'Facilitador' : 'Colaborador'})</option>
                    `).join('')}
                </select>
            </div>

            <!-- User card -->
            <div class="p-4">
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    ${renderAvatar(u)}
                    <div class="overflow-hidden">
                        <p class="text-sm font-bold truncate">${u.name}</p>
                        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">${u.position}</p>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main content -->
        <main class="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
            <!-- Top bar -->
            <header class="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-8 py-4 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <button class="lg:hidden" data-action="toggle-sidebar">
                        <span class="material-symbols-outlined">menu</span>
                    </button>
                    <div>
                        <p class="text-primary font-extrabold text-[10px] tracking-[0.2em] uppercase">${state.currentCycle.name} • ${statusLabel(state.currentCycle.status)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <button class="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Notificaciones">
                        <span class="material-symbols-outlined text-slate-400">notifications</span>
                        <span class="absolute top-1 right-1 w-2 h-2 bg-highlight rounded-full"></span>
                    </button>
                </div>
            </header>

            <!-- Content area -->
            <div id="app-content" class="p-8">
            </div>
        </main>
    </div>

    <!-- Toast container -->
    <div id="toast-container" class="fixed bottom-6 right-6 z-50 flex flex-col gap-3"></div>

    <!-- Scale reference panel -->
    <div id="scale-info-panel" class="hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this)this.classList.add('hidden')">
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-extrabold">Escala de evaluación</h3>
                <button onclick="document.getElementById('scale-info-panel').classList.add('hidden')" class="p-1 hover:bg-slate-100 rounded-lg">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="space-y-4">
                ${Data.SCALE.map(s => `
                    <div class="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <div class="w-10 h-10 rounded-full bg-${s.color === 'gold' ? 'accent' : s.color} flex items-center justify-center text-white font-bold flex-shrink-0">${s.value}</div>
                        <div>
                            <p class="font-bold text-sm">${s.label}</p>
                            <p class="text-xs text-slate-500 mt-1">${s.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-6 p-4 bg-highlight/5 border border-highlight/10 rounded-xl">
                <p class="text-xs text-slate-600 dark:text-slate-400"><strong class="text-highlight">Regla importante:</strong> Todo puntaje debe ir acompañado de al menos un ejemplo concreto y observable. Los puntajes de 4 requieren evidencia documentada.</p>
            </div>
        </div>
    </div>
    `;

    // Bind shell events
    document.getElementById('role-switcher')?.addEventListener('change', (e) => {
        switchRole(e.target.value);
    });
    document.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', () => {
            const action = el.dataset.action;
            const param = el.dataset.param || '';
            if (action === 'navigate') navigate(param);
            if (action === 'toggle-sidebar') {
                document.getElementById('sidebar')?.classList.toggle('-translate-x-full');
            }
        });
    });
}

function getNavItems(role) {
    const base = [
        { view: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    ];

    if (role === 'colaborador') {
        return [...base,
            { view: 'self-review', icon: 'rate_review', label: 'Mi Evaluación' },
            { view: 'objectives', icon: 'flag', label: 'Mis Objetivos' },
            { view: 'checkin', icon: 'event_available', label: 'Check-in Mensual' },
            { view: 'development', icon: 'trending_up', label: 'Mi Desarrollo' },
        ];
    }
    if (role === 'facilitador') {
        return [...base,
            { view: 'team-reviews', icon: 'groups', label: 'Mi Equipo' },
            { view: 'facilitator-review', icon: 'rate_review', label: 'Evaluar' },
            { view: 'checkin', icon: 'event_available', label: 'Check-ins' },
            { view: 'meeting', icon: 'handshake', label: 'Reuniones 1:1' },
        ];
    }
    if (role === 'admin') {
        return [...base,
            { view: 'admin-cycles', icon: 'rebase_edit', label: 'Ciclos' },
            { view: 'admin-calibration', icon: 'tune', label: 'Calibración' },
            { view: 'admin-reports', icon: 'assessment', label: 'Reportes' },
            { view: 'admin-directory', icon: 'groups', label: 'Directorio' },
        ];
    }
    return base;
}

// -------------------------------------------------------
// Init
// -------------------------------------------------------
export function init() {
    renderShell();
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    state.currentView = hash;
    render();
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    if (hash !== state.currentView) {
        state.currentView = hash;
        render();
    }
});
