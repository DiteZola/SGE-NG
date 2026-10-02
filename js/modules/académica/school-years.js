// ============================================
// SGE-NG - GESTÃO DE ANOS LETIVOS
// Criar, abrir, fechar e gerir anos letivos
// e trimestres
// ============================================

const SGESchoolYear = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const years = await SGEDb.query('school_years', { schoolId }, { orderBy: ['year', 'desc'] });

        let html = SGEComponents.pageHeader('Anos Letivos', 'Gestão dos anos escolares e trimestres', [
            { label: '+ Novo Ano Letivo', type: 'primary', icon: '', onClick: 'SGESchoolYear.openCreateModal()' }
        ]);

        if (years.length === 0) {
            html += SGEComponents.emptyState('Nenhum ano letivo cadastrado.',
                `<button class="btn btn-primary btn-sm" onclick="SGESchoolYear.openCreateModal()">+ Criar Primeiro Ano Letivo</button>`
            );
            return html;
        }

        // Cards de anos letivos
        html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
        for (const year of years) {
            const terms = await SGEDb.query('terms', { schoolYearId: year.id });
            const isActive = year.status === 'active';

            html += `
                <div class="sge-card ${isActive ? 'border-l-4 border-l-success-500' : ''}">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">${_esc(year.year)}</h3>
                            <p class="text-xs text-gray-500">
                                ${year.startDate ? SGEUtils.formatDate(year.startDate) : '---'}
                                até
                                ${year.endDate ? SGEUtils.formatDate(year.endDate) : '---'}
                            </p>
                        </div>
                        ${SGEComponents.statusBadge(year.status)}
                    </div>

                    <!-- Trimestres -->
                    <div class="space-y-2 mb-4">
                        ${terms.map(t => `
                            <div class="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                                <span class="font-medium text-gray-700">${t.name}</span>
                                <div class="flex items-center gap-2">
                                    ${SGEComponents.statusBadge(t.status)}
                                    ${isActive && t.status === 'closed' ? `
                                        <button class="text-xs text-primary-600 hover:underline"
                                            onclick="SGESchoolYear.openTerm('${t.id}')">Abrir</button>
                                    ` : ''}
                                    ${isActive && t.status === 'open' ? `
                                        <button class="text-xs text-danger-600 hover:underline"
                                            onclick="SGESchoolYear.closeTerm('${t.id}')">Fechar</button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Ações -->
                    <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
                        ${!isActive ? `
                            <button class="btn btn-sm btn-success-outline" onclick="SGESchoolYear.activateYear('${year.id}')">
                                Ativar
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-danger-outline" onclick="SGESchoolYear.deactivateYear('${year.id}')">
                                Fechar Ano
                            </button>
                        `}
                        <button class="btn btn-sm btn-secondary" onclick="SGESchoolYear.openEditModal('${year.id}')">
                            Editar
                        </button>
                    </div>
                </div>
            `;
        }
        html += `</div>`;

        return html;
    }

    function openCreateModal() {
        const currentYear = new Date().getFullYear();
        SGEComponents.openFormModal({
            title: 'Novo Ano Letivo',
            fields: [
                { name: 'year', label: 'Ano Letivo', type: 'text', required: true, placeholder: `${currentYear}/${currentYear + 1}`, grid: 'full' },
                { name: 'startDate', label: 'Data de Início', type: 'date', required: true },
                { name: 'endDate', label: 'Data de Fim', type: 'date' }
            ],
            onSubmit: async (data) => {
                const schoolId = SGEAuth.getUserSchoolId();
                const yearData = {
                    schoolId, year: data.year,
                    startDate: data.startDate, endDate: data.endDate || null,
                    status: 'active', createdAt: SGEUtils.nowISO()
                };
                const result = await SGEDb.put('school_years', yearData);

                // Criar trimestres automaticamente
                for (let t = 1; t <= 3; t++) {
                    await SGEDb.put('terms', {
                        schoolId, schoolYearId: result.id,
                        number: t, name: t + 'º Trimestre',
                        status: t === 1 ? 'open' : 'closed',
                        startDate: null, endDate: null,
                        createdAt: SGEUtils.nowISO()
                    });
                }

                SGENotifications.success('Ano letivo criado com sucesso!');
                SGERouter.navigate('/academic/school-years');
            }
        });
    }

    async function openEditModal(id) {
        const year = await SGEDb.get('school_years', id);
        if (!year) return SGENotifications.error('Ano letivo não encontrado.');

        SGEComponents.openFormModal({
            title: 'Editar Ano Letivo',
            fields: [
                { name: 'year', label: 'Ano Letivo', type: 'text', required: true, grid: 'full' },
                { name: 'startDate', label: 'Data de Início', type: 'date', required: true },
                { name: 'endDate', label: 'Data de Fim', type: 'date' }
            ],
            data: year,
            onSubmit: async (data) => {
                Object.assign(year, data);
                await SGEDb.put('school_years', year);
                SGENotifications.success('Ano letivo atualizado!');
                SGERouter.navigate('/academic/school-years');
            }
        });
    }

    async function activateYear(id) {
        const confirmed = await SGEComponents.confirm({
            title: 'Ativar Ano Letivo',
            message: 'Deseja ativar este ano letivo? O ano letivo anterior será fechado.',
            type: 'info'
        });
        if (!confirmed) return;

        const schoolId = SGEAuth.getUserSchoolId();
        // Desativar outros anos
        const allYears = await SGEDb.query('school_years', { schoolId, status: 'active' });
        for (const y of allYears) {
            y.status = 'closed';
            await SGEDb.put('school_years', y);
        }

        const year = await SGEDb.get('school_years', id);
        year.status = 'active';
        await SGEDb.put('school_years', year);

        SGENotifications.success('Ano letivo ativado!');
        SGERouter.navigate('/academic/school-years');
    }

    async function deactivateYear(id) {
        const confirmed = await SGEComponents.confirm({
            title: 'Fechar Ano Letivo',
            message: 'Tem a certeza que deseja fechar este ano letivo?',
            type: 'warning'
        });
        if (!confirmed) return;

        const year = await SGEDb.get('school_years', id);
        year.status = 'closed';
        await SGEDb.put('school_years', year);

        SGENotifications.success('Ano letivo fechado.');
        SGERouter.navigate('/academic/school-years');
    }

    async function openTerm(termId) {
        const term = await SGEDb.get('terms', termId);
        if (!term) return;
        term.status = 'open';
        await SGEDb.put('terms', term);
        SGENotifications.success(`${term.name} aberto!`);
        SGERouter.navigate('/academic/school-years');
    }

    async function closeTerm(termId) {
        const confirmed = await SGEComponents.confirm({
            title: 'Fechar Trimestre',
            message: 'Fechar o trimestre impede o lançamento de novas notas. Continuar?',
            type: 'warning'
        });
        if (!confirmed) return;

        const term = await SGEDb.get('terms', termId);
        term.status = 'closed';
        term.endDate = SGEUtils.nowISO();
        await SGEDb.put('terms', term);
        SGENotifications.success(`${term.name} fechado.`);
        SGERouter.navigate('/academic/school-years');
    }

    function _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { render, openCreateModal, openEditModal, activateYear, deactivateYear, openTerm, closeTerm };
})();

window.SGESchoolYear = SGESchoolYear;