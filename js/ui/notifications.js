// ============================================
// SGE-NG - SISTEMA DE NOTIFICAÇÕES E TOASTS
// Alertas visuais temporários e persistentes
// ============================================

const SGENotifications = (() => {
    'use strict';

    let _toastCounter = 0;
    const _activeToasts = new Map();

    // ============================================
    // TOAST NOTIFICATIONS (Temporários)
    // ============================================

    /**
     * Mostra uma notificação toast
     * @param {string} message - Texto da notificação
     * @param {string} type - 'success'|'error'|'warning'|'info' (default: 'info')
     * @param {number} duration - Duração em ms (default: 4000, 0 = permanente)
     * @param {object} options - Opções extras
     *   options.title: string - Título opcional
     *   options.action: { label, onClick } - Botão de ação
     * @returns {string} ID do toast (para fechar manualmente)
     */
    function show(message, type = 'info', duration = 4000, options = {}) {
        const container = document.getElementById('toast-container');
        if (!container) return '';

        const id = `toast-${++_toastCounter}`;
        const { title = '', action = null } = options;

        const icons = {
            success: `<svg class="w-5 h-5 text-success-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
            error: `<svg class="w-5 h-5 text-danger-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
            warning: `<svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>`,
            info: `<svg class="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        };

        const actionHtml = action ? `
            <button class="toast-action-btn mt-2 text-xs font-semibold underline hover:no-underline"
                style="color: inherit;">${action.label}</button>
        ` : '';

        const toastEl = document.createElement('div');
        toastEl.id = id;
        toastEl.className = `toast toast-${type} rounded-lg shadow-lg p-4 flex items-start gap-3 pointer-events-all`;
        toastEl.innerHTML = `
            ${icons[type] || icons.info}
            <div class="flex-1 min-w-0">
                ${title ? `<p class="text-sm font-semibold mb-0.5">${_escape(title)}</p>` : ''}
                <p class="text-sm">${_escape(message)}</p>
                ${actionHtml}
            </div>
            <button class="toast-close-btn flex-shrink-0 p-0.5 rounded hover:bg-black hover:bg-opacity-5 opacity-60 hover:opacity-100 transition-opacity">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;

        container.appendChild(toastEl);
        _activeToasts.set(id, toastEl);

        // Fechar ao clicar X
        toastEl.querySelector('.toast-close-btn').onclick = () => dismiss(id);

        // Ação
        if (action && action.onClick) {
            const actionBtn = toastEl.querySelector('.toast-action-btn');
            if (actionBtn) actionBtn.onclick = () => { action.onClick(); dismiss(id); };
        }

        // Auto-dismiss
        if (duration > 0) {
            const timer = setTimeout(() => dismiss(id), duration);
            toastEl._timer = timer;

            // Pausar timer ao passar o mouse
            toastEl.onmouseenter = () => clearTimeout(toastEl._timer);
            toastEl.onmouseleave = () => {
                toastEl._timer = setTimeout(() => dismiss(id), duration / 2);
            };
        }

        return id;
    }

    /**
     * Fecha um toast específico
     * @param {string} id - ID do toast
     */
    function dismiss(id) {
        const toast = _activeToasts.get(id);
        if (!toast) return;

        if (toast._timer) clearTimeout(toast._timer);

        toast.classList.add('toast-exit');
        setTimeout(() => {
            toast.remove();
            _activeToasts.delete(id);
        }, 300);
    }

    /**
     * Fecha todos os toasts
     */
    function dismissAll() {
        _activeToasts.forEach((_, id) => dismiss(id));
    }

    // ============================================
    // ATALHOS RÁPIDOS
    // ============================================

    function success(message, duration = 4000) {
        return show(message, 'success', duration);
    }

    function error(message, duration = 6000) {
        return show(message, 'error', duration);
    }

    function warning(message, duration = 5000) {
        return show(message, 'warning', duration);
    }

    function info(message, duration = 4000) {
        return show(message, 'info', duration);
    }

    // ============================================
    // NOTIFICAÇÕES DO SISTEMA (Persistentes)
    // ============================================

    /**
     * Carrega notificações não lidas do utilizador
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async function loadNotifications(userId) {
        if (!userId) return [];
        try {
            return SGEDb.query('notifications', { userId, read: false }, {
                orderBy: ['date', 'desc'],
                limit: 50
            });
        } catch {
            return [];
        }
    }

    /**
     * Marca notificação como lida
     * @param {string} notificationId
     */
    async function markAsRead(notificationId) {
        try {
            const notif = await SGEDb.get('notifications', notificationId);
            if (notif) {
                notif.read = true;
                notif.readAt = SGEUtils.nowISO();
                await SGEDb.put('notifications', notif, true);
            }
        } catch (e) {
            console.error('[Notifications] Erro ao marcar como lida:', e);
        }
    }

    /**
     * Marca todas as notificações como lidas
     * @param {string} userId
     */
    async function markAllAsRead(userId) {
        try {
            const unread = await loadNotifications(userId);
            for (const notif of unread) {
                notif.read = true;
                notif.readAt = SGEUtils.nowISO();
                await SGEDb.put('notifications', notif, false);
            }
            updateBadge(0);
        } catch (e) {
            console.error('[Notifications] Erro ao marcar todas:', e);
        }
    }

    /**
     * Atualiza o badge de notificações no header
     * @param {number} count
     */
    function updateBadge(count) {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    /**
     * Inicializa o painel de notificações do header
     * @param {string} userId
     */
    async function initNotificationPanel(userId) {
        const btn = document.getElementById('btn-notifications');
        if (!btn) return;

        // Carregar contagem inicial
        const unread = await loadNotifications(userId);
        updateBadge(unread.length);

        // Clique para abrir dropdown de notificações
        btn.onclick = async () => {
            const notifications = await loadNotifications(userId);
            updateBadge(notifications.length);

            let content = '';
            if (notifications.length === 0) {
                content = `<div class="text-center py-6 text-gray-400 text-sm">
                    <svg class="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    Sem notificações novas
                </div>`;
            } else {
                content = notifications.slice(0, 10).map(n => `
                    <div class="flex items-start gap-3 p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                         onclick="SGENotifications.markAsRead('${n.id}')">
                        <div class="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0"></div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">${_escape(n.title || 'Notificação')}</p>
                            <p class="text-xs text-gray-500 truncate mt-0.5">${_escape(n.message || '')}</p>
                            <p class="text-xs text-gray-400 mt-1">${SGEUtils.formatDate(n.date, true)}</p>
                        </div>
                    </div>
                `).join('');

                if (notifications.length > 10) {
                    content += `<div class="text-center py-2 text-xs text-primary-600 cursor-pointer hover:underline">
                        Ver todas (${notifications.length})
                    </div>`;
                }
            }

            SGEComponents.openModal({
                title: `Notificações (${notifications.length})`,
                content: content,
                size: 'sm',
                footer: notifications.length > 0 ? `
                    <button class="btn btn-sm btn-secondary" onclick="SGENotifications.markAllAsRead('${userId}'); this.closest('#generic-modal').classList.add('hidden');">
                        Marcar todas como lidas
                    </button>
                ` : ''
            });
        };
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    function _escape(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        show, dismiss, dismissAll,
        success, error, warning, info,
        loadNotifications, markAsRead, markAllAsRead,
        updateBadge, initNotificationPanel
    };
})();

window.SGENotifications = SGENotifications;