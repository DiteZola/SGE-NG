// ============================================
// SGE-NG - CONFIGURAÇÃO FINANCEIRA
// Emolumentos, propinas, taxas, multas,
// descontos e planos de pagamento
// ============================================

const SGEFinConfig = (() => {
    'use strict';

    const FEE_TYPES = [
        { value: 'matricula', label: 'Matrícula' },
        { value: 'propina', label: 'Propina Mensal' },
        { value: 'seguro', label: 'Seguro Escolar' },
        { value: 'material', label: 'Material Didático' },
        { value: 'farda', label: 'Farda / Uniforme' },
        { value: 'exame', label: 'Taxa de Exame' },
        { value: 'certificado', label: 'Taxa de Certificado' },
        { value: 'declaracao', label: 'Taxa de Declaração' },
        { value: 'multa', label: 'Multa por Atraso' },
        { value: 'reinscricao', label: 'Reinscrição' },
        { value: 'outro', label: 'Outro' }
    ];

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [configs, years, classes] = await Promise.all([
            SGEDb.query('financial_config', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] })
        ]);

        const activeYear = years[0];

        let html = SGEComponents.pageHeader('Configuração Financeira', 'Emolumentos, propinas e taxas', [
            { label: '+ Nova Taxa', type: 'primary', onClick: 'SGEFinConfig.openCreateModal()' }
        ]);

        if (!activeYear) {
            html += SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');
            return html;
        }

        const yearConfigs = configs.filter(c => c.schoolYearId === activeYear.id);

        if (yearConfigs.length === 0) {
            html += SGEComponents.emptyState('Nenhuma configuração financeira.',
                `<button class="btn btn-primary btn-sm" onclick="SGEFinConfig.openCreateModal()">+ Criar Primeira Taxa</button>`);
            return html;
        }

        html += SGEComponents.renderTable({
            columns: [
                { key: 'feeType', label: 'Tipo', sortable: true,
                    render: (v) => {
                        const t = FEE_TYPES.find(f => f.value === v);
                        const colors = { matricula: 'info', propina: 'success', multa: 'danger', seguro: 'warning' };
                        return SGEComponents.badge(t?.label || v, colors[v] || 'neutral');
                    }
                },
                { key: 'description', label: 'Descrição', sortable: true },
                { key: 'classId', label: 'Classe',
                    render: (v) => v ? (classes.find(c => c.id === v)?.name || '---') : SGEComponents.badge('Todas', 'neutral')
                },
                { key: 'amount', label: 'Valor (Kz)', sortable: true,
                    render: (v) => `<span class="font-bold">${SGEUtils.formatCurrency(v)}</span>`
                },
                { key: 'frequency', label: 'Frequência',
                    render: (v) => {
                        const labels = { once: 'Única', monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' };
                        return labels[v] || v || '---';
                    }
                },
                { key: 'dueDay', label: 'Dia Vencimento', width: '100px',
                    render: (v) => v ? `Dia ${v}` : '---'
                },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) }
            ],
            data: yearConfigs,
            actions: [
                { label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGEFinConfig.openEditModal(row.id) },
                { label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGEFinConfig.deleteConfig(row.id) }
            ],
            searchPlaceholder: 'Pesquisar taxa...'
        });

        return html;
    }

    async function _getClassOptions() {
        const classes = await SGEDb.query('classes', { schoolId: SGEAuth.getUserSchoolId() }, { orderBy: ['order', 'asc'] });
        return [{ value: '', label: 'Todas as Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))];
    }

    async function openCreateModal() {
        const classOpts = await _getClassOptions();
        const years = await SGEDb.query('school_years', { schoolId: SGEAuth.getUserSchoolId(), status: 'active' });
        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');

        SGEComponents.openFormModal({
            title: 'Nova Configuração Financeira',
            fields: [
                { name: 'feeType', label: 'Tipo de Taxa', type: 'select', required: true, options: FEE_TYPES },
                { name: 'description', label: 'Descrição', type: 'text', required: true, placeholder: 'Ex: Propina Mensal - Primário', grid: 'full' },
                { name: 'classId', label: 'Classe', type: 'select', options: classOpts, help: 'Deixe vazio para aplicar a todas' },
                { name: 'amount', label: 'Valor (Kz)', type: 'number', required: true, min: 0, step: 100, placeholder: 'Ex: 15000' },
                { name: 'frequency', label: 'Frequência', type: 'select', required: true,
                    options: [
                        { value: 'once', label: 'Pagamento Único' },
                        { value: 'monthly', label: 'Mensal' },
                        { value: 'quarterly', label: 'Trimestral' },
                        { value: 'yearly', label: 'Anual' }
                    ]
                },
                { name: 'dueDay', label: 'Dia de Vencimento', type: 'number', min: 1, max: 31, defaultValue: 10,
                    help: 'Dia do mês em que vence (para taxas mensais)' },
                { name: 'lateFeePercent', label: 'Multa por Atraso (%)', type: 'number', min: 0, max: 100, defaultValue: 0,
                    help: 'Percentagem de multa por dia de atraso (0 = sem multa)' }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('financial_config', {
                    schoolId: SGEAuth.getUserSchoolId(),
                    schoolYearId: years[0].id,
                    ...data,
                    status: 'active',
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Taxa configurada!');
                SGERouter.navigate('/financial/config');
            }
        });
    }

    async function openEditModal(id) {
        const config = await SGEDb.get('financial_config', id);
        if (!config) return;
        const classOpts = await _getClassOptions();

        SGEComponents.openFormModal({
            title: 'Editar Configuração Financeira',
            fields: [
                { name: 'feeType', label: 'Tipo', type: 'select', required: true, options: FEE_TYPES },
                { name: 'description', label: 'Descrição', type: 'text', required: true, grid: 'full' },
                { name: 'classId', label: 'Classe', type: 'select', options: classOpts },
                { name: 'amount', label: 'Valor (Kz)', type: 'number', required: true, min: 0, step: 100 },
                { name: 'frequency', label: 'Frequência', type: 'select', required: true,
                    options: [{ value: 'once', label: 'Única' }, { value: 'monthly', label: 'Mensal' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'yearly', label: 'Anual' }] },
                { name: 'dueDay', label: 'Dia Vencimento', type: 'number', min: 1, max: 31 },
                { name: 'lateFeePercent', label: 'Multa Atraso (%)', type: 'number', min: 0, max: 100 }
            ],
            data: config,
            onSubmit: async (data) => {
                Object.assign(config, data);
                await SGEDb.put('financial_config', config);
                SGENotifications.success('Configuração atualizada!');
                SGERouter.navigate('/financial/config');
            }
        });
    }

    async function deleteConfig(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Taxa', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('financial_config', id);
        SGENotifications.success('Taxa eliminada.');
        SGERouter.navigate('/financial/config');
    }

    return { render, openCreateModal, openEditModal, deleteConfig, FEE_TYPES };
})();
window.SGEFinConfig = SGEFinConfig;