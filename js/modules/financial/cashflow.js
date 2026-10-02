// ============================================
// SGE-NG - RECEITAS E DESPESAS (FLUXO DE CAIXA)
// Controlo do fluxo de caixa da instituição
// ============================================

const SGECashflow = (() => {
    'use strict';

    const CATEGORIES = {
        income: ['propinas', 'matriculas', 'seguros', 'multas', 'doacoes', 'outros_receitas'],
        expense: ['salarios', 'agua', 'energia', 'internet', 'material', 'manutencao', 'transporte', 'outros_despesas']
    };

    const CATEGORY_LABELS = {
        propinas: 'Propinas', matriculas: 'Matrículas', seguros: 'Seguros',
        multas: 'Multas', doacoes: 'Doações', outros_receitas: 'Outras Receitas',
        salarios: 'Salários', agua: 'Água', energia: 'Energia Elétrica',
        internet: 'Internet', material: 'Material', manutencao: 'Manutenção',
        transporte: 'Transporte', outros_despesas: 'Outras Despesas'
    };

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [cashflow, years] = await Promise.all([
            SGEDb.query('cashflow', { schoolId }, { orderBy: ['date', 'desc'] }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = years[0];
        const yearFlow = activeYear ? cashflow.filter(c => c.schoolYearId === activeYear.id) : cashflow;

        const totalIncome = yearFlow.filter(c => c.type === 'income').reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
        const totalExpense = yearFlow.filter(c => c.type === 'expense').reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
        const balance = totalIncome - totalExpense;

        let html = SGEComponents.pageHeader('Receitas e Despesas', 'Fluxo de caixa da instituição', [
            { label: '+ Receita', type: 'success', onClick: 'SGECashflow.openEntryModal("income")' },
            { label: '+ Despesa', type: 'danger', onClick: 'SGECashflow.openEntryModal("expense")' },
            { label: '↓ Exportar', type: 'primary', onClick: 'SGECashflow.exportExcel()' }
        ]);

        html += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                ${SGEComponents.renderStatCard({ title: 'Total Receitas', value: SGEUtils.formatCurrency(totalIncome), color: 'green', icon: '📈' })}
                ${SGEComponents.renderStatCard({ title: 'Total Despesas', value: SGEUtils.formatCurrency(totalExpense), color: 'red', icon: '📉' })}
                ${SGEComponents.renderStatCard({ title: 'Saldo', value: SGEUtils.formatCurrency(balance), color: balance >= 0 ? 'blue' : 'red', icon: '💵' })}
            </div>
        `;

        html += SGEComponents.renderTable({
            columns: [
                { key: 'date', label: 'Data', sortable: true, render: (v) => SGEUtils.formatDate(v) },
                { key: 'type', label: 'Tipo', width: '90px',
                    render: (v) => v === 'income' ? SGEComponents.badge('Receita', 'success') : SGEComponents.badge('Despesa', 'danger') },
                { key: 'category', label: 'Categoria', sortable: true,
                    render: (v) => CATEGORY_LABELS[v] || v || '---' },
                { key: 'description', label: 'Descrição', sortable: true },
                { key: 'amount', label: 'Valor', sortable: true,
                    render: (v, row) => {
                        const color = row.type === 'income' ? 'text-success-700' : 'text-danger-700';
                        return `<span class="font-bold ${color}">${row.type === 'income' ? '+' : '-'} ${SGEUtils.formatCurrency(v)}</span>`;
                    }
                }
            ],
            data: yearFlow,
            actions: [
                { label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGECashflow.deleteEntry(row.id) }
            ],
            searchPlaceholder: 'Pesquisar...'
        });

        return html;
    }

    function openEntryModal(type = 'income') {
        const isIncome = type === 'income';
        const catOpts = (CATEGORIES[type] || []).map(c => ({ value: c, label: CATEGORY_LABELS[c] || c }));

        SGEComponents.openFormModal({
            title: isIncome ? 'Nova Receita' : 'Nova Despesa',
            fields: [
                { name: 'category', label: 'Categoria', type: 'select', required: true, options: catOpts },
                { name: 'description', label: 'Descrição', type: 'text', required: true, grid: 'full' },
                { name: 'amount', label: 'Valor (Kz)', type: 'number', required: true, min: 0, step: 100 },
                { name: 'date', label: 'Data', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] }
            ],
            onSubmit: async (data) => {
                const schoolId = SGEAuth.getUserSchoolId();
                const years = await SGEDb.query('school_years', { schoolId, status: 'active' });
                await SGEDb.put('cashflow', {
                    schoolId, schoolYearId: years[0]?.id, type, ...data,
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success(isIncome ? 'Receita registada!' : 'Despesa registada!');
                SGERouter.navigate('/financial/cashflow');
            }
        });
    }

    async function deleteEntry(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('cashflow', id);
        SGENotifications.success('Eliminado.');
        SGERouter.navigate('/financial/cashflow');
    }

    async function exportExcel() {
        const schoolId = SGEAuth.getUserSchoolId();
        const cashflow = await SGEDb.query('cashflow', { schoolId }, { orderBy: ['date', 'desc'] });
        if (!cashflow.length) return SGENotifications.warning('Sem dados.');
        const data = cashflow.map(c => ({
            'Data': SGEUtils.formatDate(c.date),
            'Tipo': c.type === 'income' ? 'Receita' : 'Despesa',
            'Categoria': CATEGORY_LABELS[c.category] || c.category,
            'Descrição': c.description,
            'Valor (Kz)': c.amount
        }));
        SGEUtils.exportToExcel(data, 'fluxo_caixa', 'Fluxo de Caixa');
        SGENotifications.success('Excel descarregado!');
    }

    return { render, openEntryModal, deleteEntry, exportExcel };
})();
window.SGECashflow = SGECashflow;