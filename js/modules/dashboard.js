// ============================================
// SGE-NG - PAINEL DE CONTROLO (DASHBOARD)
// Página inicial com indicadores e gráficos
// ============================================

const SGEDashboard = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        if (!user) return SGEComponents.loadingSpinner();

        const role = user.role;
        const schoolId = user.schoolId;

        // Carregar dados em paralelo
        const [students, staff, schoolYears, sections, payments] = await Promise.all([
            schoolId ? SGEDb.query('students', { schoolId, status: 'active' }) : [],
            schoolId ? SGEDb.query('staff', { schoolId, status: 'active' }) : [],
            schoolId ? SGEDb.query('school_years', { schoolId, status: 'active' }) : [],
            schoolId ? SGEDb.query('sections', { schoolId }) : [],
            schoolId ? SGEDb.query('payments', { schoolId }) : []
        ]);

        const activeYear = schoolYears[0];
        const totalStudents = students.length;
        const totalStaff = staff.length;
        const totalSections = sections.length;

        // Calcular receita do mês
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthlyRevenue = payments
            .filter(p => p.date >= monthStart && p.status === 'paid')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // Gênero
        const maleStudents = students.filter(s => s.gender === 'M').length;
        const femaleStudents = students.filter(s => s.gender === 'F').length;

        let html = '';

        // Cabeçalho de boas-vindas
        html += `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900">
                    Bom dia, ${SGEUtils.capitalize(user.fullName?.split(' ')[0] || user.email)}! 👋
                </h2>
                <p class="text-gray-500 text-sm mt-1">
                    ${activeYear ? 'Ano Letivo ' + activeYear.year : 'Sem ano letivo ativo'} · ${SGEUtils.formatDateExtended(new Date())}
                </p>
            </div>
        `;

        // Cards de estatísticas
        html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">`;
        html += SGEComponents.renderStatCard({
            title: 'Total de Alunos',
            value: SGEUtils.formatNumber(totalStudents),
            color: 'blue',
            icon: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
            change: `${maleStudents}M / ${femaleStudents}F`,
            changeType: 'neutral'
        });
        html += SGEComponents.renderStatCard({
            title: 'Funcionários',
            value: SGEUtils.formatNumber(totalStaff),
            color: 'green',
            icon: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
        });
        html += SGEComponents.renderStatCard({
            title: 'Turmas',
            value: totalSections,
            color: 'purple',
            icon: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
        });
        html += SGEComponents.renderStatCard({
            title: 'Receita do Mês',
            value: SGEUtils.formatCurrency(monthlyRevenue),
            color: 'yellow',
            icon: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        });
        html += `</div>`;

        // Gráficos (apenas para diretor e admin)
        if (['admin_geral', 'director', 'subdirector'].includes(role)) {
            html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">`;

            // Gráfico de distribuição por gênero
            html += `
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Distribuição por Gênero</h3>
                    <div class="h-64">
                        <canvas id="chart-gender"></canvas>
                    </div>
                </div>
            `;

            // Gráfico de alunos por turma
            html += `
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Alunos por Turma</h3>
                    <div class="h-64">
                        <canvas id="chart-sections"></canvas>
                    </div>
                </div>
            `;
            html += `</div>`;
        }

        // Ações rápidas
        html += `
            <div class="sge-card">
                <h3 class="text-sm font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    ${_quickAction('/students', 'Novo Aluno', 'text-primary-600 bg-primary-50', '👤')}
                    ${_quickAction('/grades', 'Lançar Notas', 'text-success-600 bg-success-50', '📝')}
                    ${_quickAction('/attendance', 'Presenças', 'text-yellow-600 bg-yellow-50', '✅')}
                    ${_quickAction('/documents/report-cards', 'Boletins', 'text-purple-600 bg-purple-50', '📄')}
                    ${_quickAction('/financial/payments', 'Pagamentos', 'text-green-600 bg-green-50', '💰')}
                    ${_quickAction('/messages', 'Mensagens', 'text-cyan-600 bg-cyan-50', '💬')}
                </div>
            </div>
        `;

        // Estado do sistema (admin/diretor)
        if (['admin_geral', 'director'].includes(role)) {
            html += `
                <div class="sge-card mt-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Estado do Sistema</h3>
                    <div id="system-health" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${SGEComponents.loadingSpinner('A verificar...')}
                    </div>
                </div>
            `;
        }

        // Inicializar gráficos após renderizar
        setTimeout(() => _initCharts(maleStudents, femaleStudents, sections, students), 100);

        // Verificar saúde do sistema
        if (['admin_geral', 'director'].includes(role)) {
            setTimeout(() => _loadSystemHealth(), 500);
        }

        return html;
    }

    function _quickAction(route, label, colorClass, emoji) {
        return `
            <a href="#" data-route="${route}"
                class="flex flex-col items-center p-4 rounded-lg ${colorClass} hover:opacity-80 transition-opacity text-center">
                <span class="text-2xl mb-1">${emoji}</span>
                <span class="text-xs font-medium">${label}</span>
            </a>
        `;
    }

    function _initCharts(male, female, sections, students) {
        // Gráfico de gênero
        if (document.getElementById('chart-gender')) {
            SGECharts.create('chart-gender', 'doughnut', {
                labels: ['Masculino', 'Feminino'],
                datasets: [{
                    data: [male, female],
                    backgroundColor: ['#2563EB', '#DB2777'],
                    borderWidth: 0
                }]
            }, { cutout: '60%' });
        }

        // Gráfico de turmas
        if (document.getElementById('chart-sections') && sections.length > 0) {
            const sectionData = sections.slice(0, 8).map(s => ({
                label: s.name || s.id.substring(0, 8),
                count: students.filter(st => st.sectionId === s.id).length
            }));

            SGECharts.create('chart-sections', 'bar', {
                labels: sectionData.map(s => s.label),
                datasets: [{
                    label: 'Alunos',
                    data: sectionData.map(s => s.count),
                    backgroundColor: '#2563EB66',
                    borderColor: '#2563EB',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            }, { plugins: { legend: { display: false } } });
        }
    }

    async function _loadSystemHealth() {
        const container = document.getElementById('system-health');
        if (!container) return;

        try {
            const report = await SGESecurity.checkIntegrity();
            const syncStatus = SGESync.getStatus();

            const items = [
                {
                    label: 'Base de Dados',
                    status: report.checks.find(c => c.name === 'IndexedDB')?.status || 'ok',
                    icon: '🗄️'
                },
                {
                    label: 'Firebase',
                    status: SGEFirebase.isOnline() ? 'ok' : 'warning',
                    icon: '☁️'
                },
                {
                    label: 'Sincronização',
                    status: syncStatus.stats.pending > 10 ? 'warning' : 'ok',
                    icon: '🔄'
                },
                {
                    label: 'Criptografia',
                    status: SGECrypto.isReady() ? 'ok' : 'warning',
                    icon: '🔒'
                }
            ];

            container.innerHTML = items.map(item => {
                const colors = {
                    ok: 'bg-success-50 text-success-700 border-success-200',
                    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    error: 'bg-danger-50 text-danger-700 border-danger-200'
                };
                const c = colors[item.status] || colors.ok;
                return `
                    <div class="flex items-center gap-2 p-3 rounded-lg border ${c}">
                        <span class="text-lg">${item.icon}</span>
                        <div>
                            <p class="text-xs font-medium">${item.label}</p>
                            <p class="text-xs opacity-75">${item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'Aviso' : 'Erro'}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch {
            container.innerHTML = '<p class="text-sm text-gray-400 col-span-4">Não foi possível verificar o estado.</p>';
        }
    }

    return { render };
})();

window.SGEDashboard = SGEDashboard;