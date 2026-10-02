// ============================================
// SGE-NG - LOGS DE AUDITORIA
// Registo imutável de todas as ações no sistema
// ============================================

const SGEAuditLogs = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const schoolId = user?.schoolId;
        const isAdmin = user?.role === 'admin_geral';

        let html = SGEComponents.pageHeader('Logs de Auditoria', 'Registo de todas as ações no sistema',
            isAdmin ? [{ label: '🗑️ Limpar Logs Antigos', type: 'danger', onClick: 'SGEAuditLogs.purgeOldLogs()' }] : []
        );

        // Filtros
        html += `
            <div class="sge-card mb-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
                        <select id="log-module" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGEAuditLogs.filterLogs()">
                            <option value="">Todos</option>
                            <option value="auth">Autenticação</option>
                            <option value="students">Estudantes</option>
                            <option value="grades">Notas</option>
                            <option value="staff">Funcionários</option>
                            <option value="financial">Financeiro</option>
                            <option value="settings">Configurações</option>
                            <option value="backup">Backup</option>
                            <option value="security">Segurança</option>
                            <option value="recovery">Recuperação</option>
                            <option value="system">Sistema</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Ação</label>
                        <input type="text" id="log-action" placeholder="Ex: login, create..."
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                            oninput="SGEAuditLogs.filterLogs()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                        <input type="date" id="log-date-from"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                            onchange="SGEAuditLogs.filterLogs()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                        <input type="date" id="log-date-to"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                            onchange="SGEAuditLogs.filterLogs()">
                    </div>
                </div>
            </div>
        `;

        html += `<div id="logs-table">${SGEComponents.loadingSpinner()}</div>`;

        setTimeout(() => SGEAuditLogs.filterLogs(), 100);

        return html;
    }

    async function filterLogs() {
        const container = document.getElementById('logs-table');
        if (!container) return;

        const user = SGEAuth.getCurrentUser();
        const schoolId = user?.schoolId;
        const isAdmin = user?.role === 'admin_geral';

        const moduleFilter = document.getElementById('log-module')?.value;
        const actionFilter = document.getElementById('log-action')?.value?.toLowerCase();
        const dateFrom = document.getElementById('log-date-from')?.value;
        const dateTo = document.getElementById('log-date-to')?.value;

        let filters = {};
        if (!isAdmin && schoolId) filters.schoolId = schoolId;
        if (moduleFilter) filters.module = moduleFilter;

        let logs = await SGEDb.query('audit_logs', filters, { orderBy: ['timestamp', 'desc'] });

        // Filtros adicionais
        if (actionFilter) {
            logs = logs.filter(l => l.action?.toLowerCase().includes(actionFilter) || l.description?.toLowerCase().includes(actionFilter));
        }
        if (dateFrom) {
            logs = logs.filter(l => l.timestamp >= dateFrom);
        }
        if (dateTo) {
            logs = logs.filter(l => l.timestamp <= dateTo + 'T23:59:59');
        }

        const moduleColors = {
            auth: 'info', students: 'success', grades: 'warning',
            staff: 'info', financial: 'success', settings: 'neutral',
            backup: 'info', security: 'danger', recovery: 'warning', system: 'neutral'
        };

        container.innerHTML = SGEComponents.renderTable({
            columns: [
                { key: 'timestamp', label: 'Data/Hora', sortable: true, width: '150px',
                    render: (v) => `<span class="text-xs font-mono">${SGEUtils.formatDate(v, true)}</span>` },
                { key: 'userName', label: 'Utilizador', sortable: true,
                    render: (v) => `<span class="font-medium">${_esc(v || 'Sistema')}</span>` },
                { key: 'module', label: 'Módulo', width: '100px',
                    render: (v) => SGEComponents.badge(v, moduleColors[v] || 'neutral') },
                { key: 'action', label: 'Ação', sortable: true,
                    render: (v) => `<code class="text-xs bg-gray-100 px-1 rounded">${_esc(v)}</code>` },
                { key: 'description', label: 'Descrição',
                    render: (v) => `<span class="text-sm text-gray-600">${_esc(v)}</span>` }
            ],
            data: logs,
            searchPlaceholder: 'Pesquisar nos logs...',
            pageSize: 25
        });
    }

    async function purgeOldLogs() {
        const days = 30;
        const ok = await SGEComponents.confirm({
            title: 'Limpar Logs Antigos',
            message: `Eliminar todos os logs com mais de ${days} dias? Esta ação é irreversível.`,
            type: 'danger',
            confirmText: 'Sim, Limpar'
        });
        if (!ok) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();

        const logs = await SGEDb.query('audit_logs', {});
        const oldLogs = logs.filter(l => l.timestamp < cutoffISO);

        for (const log of oldLogs) {
            await SGEDb.remove('audit_logs', log.id, false);
        }

        await SGEDb.addAuditLog({
            userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
            action: 'purge_logs', module: 'system',
            description: `${oldLogs.length} logs antigos eliminados (>${days} dias)`
        });

        SGENotifications.success(`${oldLogs.length} logs eliminados.`);
        filterLogs();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, filterLogs, purgeOldLogs };
})();
window.SGEAuditLogs = SGEAuditLogs;