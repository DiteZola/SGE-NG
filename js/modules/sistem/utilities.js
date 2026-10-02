// ============================================
// SGE-NG - UTILIDADES DO SISTEMA
// Ferramentas operacionais auxiliares
// ============================================

const SGEUtilities = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const isDirector = ['admin_geral', 'director'].includes(user?.role);

        let html = SGEComponents.pageHeader('Utilidades', 'Ferramentas operacionais do sistema');

        html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;

        // 1. Estado do Sistema
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">🔍 Diagnóstico do Sistema</h3>
                <p class="text-sm text-gray-500 mb-3">Verifica a saúde de todos os componentes.</p>
                <button class="btn btn-primary w-full" onclick="SGEUtilities.runDiagnostics()">Executar Diagnóstico</button>
                <div id="diag-result" class="mt-3"></div>
            </div>
        `;

        // 2. Limpar Cache
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">🧹 Limpar Cache</h3>
                <p class="text-sm text-gray-500 mb-3">Remove dados temporários e cache do navegador.</p>
                <button class="btn btn-warning w-full" onclick="SGEUtilities.clearCache()">Limpar Cache</button>
            </div>
        `;

        // 3. Sincronização Manual
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">🔄 Sincronização Manual</h3>
                <p class="text-sm text-gray-500 mb-3">Força a sincronização com o servidor.</p>
                <button class="btn btn-success w-full" onclick="SGEUtilities.forceSync()">Sincronizar Agora</button>
                <div id="sync-result" class="mt-3"></div>
            </div>
        `;

        // 4. Contagem de Registos
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">📊 Contagem de Registos</h3>
                <p class="text-sm text-gray-500 mb-3">Número de registos em cada tabela.</p>
                <button class="btn btn-secondary w-full" onclick="SGEUtilities.countRecords()">Contar Registos</button>
                <div id="count-result" class="mt-3"></div>
            </div>
        `;

        // 5. Gerar Snapshot
        if (isDirector) {
            html += `
                <div class="sge-card">
                    <h3 class="font-bold text-gray-900 mb-3">📸 Ponto de Recuperação</h3>
                    <p class="text-sm text-gray-500 mb-3">Cria um ponto de recuperação manual de segurança.</p>
                    <button class="btn btn-primary w-full" onclick="SGEUtilities.createSnapshot()">Criar Snapshot</button>
                </div>
            `;
        }

        // 6. Informações do Sistema
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">ℹ️ Informações</h3>
                <dl class="text-sm space-y-2">
                    <div class="flex justify-between"><dt class="text-gray-500">Versão</dt><dd class="font-mono">1.0.0</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">Browser</dt><dd class="text-xs">${navigator.userAgent.split(' ').pop()}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">Online</dt><dd>${SGEFirebase.isOnline() ? '✅ Sim' : '❌ Não'}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">IndexedDB</dt><dd>${SGEDb.isReady() ? '✅ OK' : '❌ Erro'}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">Criptografia</dt><dd>${SGECrypto.isReady() ? '✅ Ativa' : '⚠️ Inativa'}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">Service Worker</dt><dd>${'serviceWorker' in navigator ? '✅ Suportado' : '❌ Não'}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">Bluetooth</dt><dd>${'bluetooth' in navigator ? '✅ Suportado' : '❌ Não'}</dd></div>
                </dl>
            </div>
        `;

        html += `</div>`;
        return html;
    }

    async function runDiagnostics() {
        const container = document.getElementById('diag-result');
        if (!container) return;
        container.innerHTML = SGEComponents.loadingSpinner('A diagnosticar...');

        try {
            const report = await SGESecurity.checkIntegrity();
            const syncStatus = SGESync.getStatus();

            let html = '<div class="space-y-1 text-sm">';
            for (const check of report.checks) {
                const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
                html += `<p>${icon} ${check.name}: <strong>${check.status === 'ok' ? 'OK' : check.status}</strong></p>`;
            }
            html += `<p>🔄 Sync: ${syncStatus.stats.pending} pendente(s)</p>`;
            html += `<p class="font-bold mt-2 ${report.status === 'ok' ? 'text-success-600' : 'text-danger-600'}">
                Estado Geral: ${report.status === 'ok' ? 'SAUDÁVEL' : report.status === 'warning' ? 'AVISO' : 'ERRO'}
            </p>`;
            html += '</div>';

            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = SGEComponents.alert('Erro no diagnóstico.', 'error');
        }
    }

    async function clearCache() {
        const ok = await SGEComponents.confirm({
            title: 'Limpar Cache',
            message: 'Limpar cache do navegador e dados temporários?',
            type: 'warning'
        });
        if (!ok) return;

        try {
            if ('caches' in window) {
                const names = await caches.keys();
                for (const name of names) await caches.delete(name);
            }
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    reg.postMessage({ type: 'CLEAR_CACHE' });
                }
            }
            SGENotifications.success('Cache limpo!');
        } catch (error) {
            SGENotifications.error('Erro ao limpar cache.');
        }
    }

    async function forceSync() {
        const container = document.getElementById('sync-result');
        if (!container) return;
        container.innerHTML = SGEComponents.loadingSpinner('A sincronizar...');

        try {
            const schoolId = SGEAuth.getUserSchoolId();
            const result = await SGESync.fullSync(schoolId);
            container.innerHTML = `
                <div class="text-sm space-y-1">
                    <p>✅ Enviados: ${result.pushed}</p>
                    <p>✅ Recebidos: ${result.pulled}</p>
                    <p>⚠️ Erros: ${result.pushErrors}</p>
                </div>
            `;
            SGENotifications.success('Sincronização concluída!');
        } catch (error) {
            container.innerHTML = SGEComponents.alert('Erro na sincronização.', 'error');
        }
    }

    async function countRecords() {
        const container = document.getElementById('count-result');
        if (!container) return;
        container.innerHTML = SGEComponents.loadingSpinner();

        const schoolId = SGEAuth.getUserSchoolId();
        const stores = ['students', 'staff', 'grades', 'computed_grades', 'assessments',
            'attendance_students', 'payments', 'messages', 'events', 'sections', 'subjects'];

        let html = '<div class="space-y-1 text-sm">';
        for (const store of stores) {
            const count = await SGEDb.count(store, { schoolId });
            html += `<div class="flex justify-between">
                <span class="text-gray-600">${store}</span>
                <span class="font-bold">${count}</span>
            </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    async function createSnapshot() {
        SGENotifications.info('A criar ponto de recuperação...');
        try {
            const ids = await SGERecovery.createRecoveryPoint('manual_utility');
            SGENotifications.success(`Snapshot criado (${ids.length} stores).`);
        } catch {
            SGENotifications.error('Erro ao criar snapshot.');
        }
    }

    return { render, runDiagnostics, clearCache, forceSync, countRecords, createSnapshot };
})();
window.SGEUtilities = SGEUtilities;