// ============================================
// SGE-NG - BACKUP E RESTAURAÇÃO
// Cópia de segurança e recuperação de dados
// ============================================

const SGEBackup = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const canRestore = ['admin_geral', 'director'].includes(user?.role);

        let html = SGEComponents.pageHeader('Backup e Restauro', 'Cópias de segurança da base de dados');

        // Ações de Backup
        html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="sge-card">
                    <h3 class="font-bold text-gray-900 mb-3">💾 Criar Backup</h3>
                    <p class="text-sm text-gray-600 mb-4">Exporta todos os dados da escola para um ficheiro JSON que pode ser guardado no seu computador.</p>
                    <div class="space-y-2">
                        <button class="btn btn-primary w-full" onclick="SGEBackup.createFullBackup()">
                            📦 Backup Completo (JSON)
                        </button>
                        <button class="btn btn-success w-full" onclick="SGEBackup.exportAllExcel()">
                            📊 Exportar Tudo em Excel
                        </button>
                    </div>
                </div>

                <div class="sge-card">
                    <h3 class="font-bold text-gray-900 mb-3">🔄 Restaurar Backup</h3>
                    <p class="text-sm text-gray-600 mb-4">Importa dados de um ficheiro de backup anterior. Os dados atuais serão substituídos.</p>
                    <div class="space-y-2">
                        <label class="btn btn-warning w-full cursor-pointer text-center">
                            📂 Selecionar Ficheiro de Backup
                            <input type="file" accept=".json" class="hidden" onchange="SGEBackup.restoreFromFile(this)">
                        </label>
                    </div>
                    ${!canRestore ? '<p class="text-xs text-danger-600 mt-2">⚠️ Apenas Admin e Diretor podem restaurar.</p>' : ''}
                </div>
            </div>
        `;

        // Snapshots de Recuperação
        html += `
            <div class="sge-card mb-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-bold text-gray-900">🕐 Pontos de Recuperação Automáticos</h3>
                    <button class="btn btn-sm btn-primary" onclick="SGEBackup.createManualSnapshot()">+ Criar Ponto Manual</button>
                </div>
                <div id="snapshots-list">${SGEComponents.loadingSpinner()}</div>
            </div>
        `;

        // Informações de Armazenamento
        html += `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-3">📊 Armazenamento Local</h3>
                <div id="storage-info">${SGEComponents.loadingSpinner()}</div>
            </div>
        `;

        // Carregar dados assíncronos
        setTimeout(() => {
            _loadSnapshots();
            _loadStorageInfo();
        }, 100);

        return html;
    }

    async function createFullBackup() {
        SGENotifications.info('A criar backup...');

        try {
            const data = await SGEDb.exportAllData();
            const school = await SGEDb.get('schools', SGEAuth.getUserSchoolId());
            const date = new Date().toISOString().split('T')[0];
            const filename = `SGE-NG_Backup_${school?.name?.replace(/\s/g, '_') || 'Escola'}_${date}.json`;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            await SGEDb.addAuditLog({
                userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
                action: 'backup_created', module: 'backup',
                description: `Backup completo criado: ${filename}`
            });

            SGENotifications.success(`Backup descarregado: ${filename}`);
        } catch (error) {
            console.error('[Backup] Erro:', error);
            SGENotifications.error('Erro ao criar backup.');
        }
    }

    async function exportAllExcel() {
        SGENotifications.info('A exportar para Excel...');

        try {
            const schoolId = SGEAuth.getUserSchoolId();
            const stores = ['students', 'staff', 'grades', 'computed_grades', 'payments', 'attendance_students'];
            const wb = XLSX.utils.book_new();

            for (const store of stores) {
                const data = await SGEDb.query(store, { schoolId });
                if (data.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, store);
                }
            }

            XLSX.writeFile(wb, `SGE-NG_Dados_${new Date().toISOString().split('T')[0]}.xlsx`);
            SGENotifications.success('Excel descarregado!');
        } catch (error) {
            SGENotifications.error('Erro ao exportar.');
        }
    }

    async function restoreFromFile(input) {
        const file = input.files[0];
        if (!file) return;

        const user = SGEAuth.getCurrentUser();
        if (!['admin_geral', 'director'].includes(user?.role)) {
            return SGENotifications.error('Sem permissão para restaurar.');
        }

        const ok = await SGEComponents.confirm({
            title: '⚠️ Restaurar Backup',
            message: 'ATENÇÃO: Os dados atuais serão SUBSTITUÍDOS pelos dados do backup. Deseja continuar?',
            type: 'danger',
            confirmText: 'Sim, Restaurar'
        });
        if (!ok) { input.value = ''; return; }

        try {
            SGENotifications.info('A ler ficheiro de backup...');
            if (file.size > 200 * 1024 * 1024) {
    SGENotifications.error('Ficheiro demasiado grande (máx. 200 MB).');
    input.value = '';
    return;
}

try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.stores) throw new Error('Formato de backup inválido.');
    // ...
} catch (error) {
    SGENotifications.error(`Erro: ${error.message}`);
    input.value = '';
}

            if (!data.stores) throw new Error('Formato de backup inválido.');

            // Criar snapshot de segurança antes de restaurar
            await SGERecovery.createRecoveryPoint('pre-restore');

            const result = await SGEDb.importData(data, false);

            await SGEDb.addAuditLog({
                userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
                action: 'backup_restored', module: 'backup',
                description: `Backup restaurado de ${file.name}: ${result.imported} registos`,
                details: { filename: file.name, imported: result.imported }
            });

            SGENotifications.success(`Backup restaurado! ${result.imported} registos importados.`);
            location.reload();

        } catch (error) {
            console.error('[Backup] Erro na restauração:', error);
            SGENotifications.error(`Erro: ${error.message}`);
        }

        input.value = '';
    }

    async function createManualSnapshot() {
        SGENotifications.info('A criar ponto de recuperação...');
        try {
            const ids = await SGERecovery.createRecoveryPoint('manual');
            SGENotifications.success(`Ponto de recuperação criado (${ids.length} snapshots).`);
            _loadSnapshots();
        } catch (error) {
            SGENotifications.error('Erro ao criar snapshot.');
        }
    }

    async function _loadSnapshots() {
        const container = document.getElementById('snapshots-list');
        if (!container) return;

        try {
            const points = await SGERecovery.getRecoveryPoints();
            const allSnaps = Object.entries(points).flatMap(([store, snaps]) =>
                snaps.map(s => ({ ...s, store }))
            ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (allSnaps.length === 0) {
                container.innerHTML = SGEComponents.emptyState('Nenhum ponto de recuperação.');
                return;
            }

            container.innerHTML = `
                <table class="sge-table sge-table-compact">
                    <thead><tr><th>Data</th><th>Store</th><th>Registos</th><th>Motivo</th><th>Ações</th></tr></thead>
                    <tbody>
                        ${allSnaps.slice(0, 20).map(s => `
                            <tr>
                                <td>${SGEUtils.formatDate(s.timestamp, true)}</td>
                                <td><code class="text-xs bg-gray-100 px-1 rounded">${s.store}</code></td>
                                <td>${s.records}</td>
                                <td class="text-xs text-gray-500">${_esc(s.reason)}</td>
                                <td>
                                    <button class="btn btn-sm btn-warning" onclick="SGEBackup.restoreSnapshot('${s.id}')">Restaurar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch {
            container.innerHTML = '<p class="text-sm text-gray-400">Erro ao carregar snapshots.</p>';
        }
    }

    async function restoreSnapshot(snapshotId) {
        const ok = await SGEComponents.confirm({
            title: 'Restaurar Snapshot',
            message: 'Os dados desta store serão substituídos. Continuar?',
            type: 'warning'
        });
        if (!ok) return;

        const success = await SGERecovery.manualRecover(snapshotId);
        if (success) {
            SGENotifications.success('Snapshot restaurado!');
            _loadSnapshots();
        } else {
            SGENotifications.error('Erro ao restaurar.');
        }
    }

    async function _loadStorageInfo() {
        const container = document.getElementById('storage-info');
        if (!container) return;

        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(1);
                const totalMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(0);
                const percent = Math.round(((estimate.usage || 0) / (estimate.quota || 1)) * 100);

                container.innerHTML = `
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div class="text-center">
                            <p class="text-2xl font-bold text-gray-900">${usedMB} MB</p>
                            <p class="text-xs text-gray-500">Usado</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-gray-900">${totalMB} MB</p>
                            <p class="text-xs text-gray-500">Disponível</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold ${percent > 80 ? 'text-danger-600' : 'text-success-600'}">${percent}%</p>
                            <p class="text-xs text-gray-500">Utilização</p>
                        </div>
                    </div>
                    ${SGEComponents.progressBar(percent, percent > 80 ? 'red' : percent > 60 ? 'yellow' : 'green')}
                `;
            } else {
                container.innerHTML = '<p class="text-sm text-gray-400">Informação de armazenamento não disponível.</p>';
            }
        } catch {
            container.innerHTML = '<p class="text-sm text-gray-400">Erro ao verificar armazenamento.</p>';
        }
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, createFullBackup, exportAllExcel, restoreFromFile, createManualSnapshot, restoreSnapshot };
})();
window.SGEBackup = SGEBackup;