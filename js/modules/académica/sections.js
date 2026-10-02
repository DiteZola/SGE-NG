// ============================================
// SGE-NG - GESTÃO DE TURMAS
// Agrupamento de alunos por classe e turno
// ============================================

const SGESections = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [sections, classes, shifts, schoolYears] = await Promise.all([
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = schoolYears[0];
        const students = activeYear
            ? await SGEDb.query('students', { schoolId, schoolYearId: activeYear.id, status: 'active' })
            : [];

        let html = SGEComponents.pageHeader('Turmas', 'Agrupamento de alunos por classe e turno', [
            { label: '+ Nova Turma', type: 'primary', onClick: 'SGESections.openCreateModal()' }
        ]);

        if (!activeYear) {
            html += SGEComponents.alert('Nenhum ano letivo ativo. Crie um ano letivo primeiro.', 'warning');
            return html;
        }

        if (sections.length === 0) {
            html += SGEComponents.emptyState('Nenhuma turma cadastrada.',
                `<button class="btn btn-primary btn-sm" onclick="SGESections.openCreateModal()">+ Criar Turma</button>`
            );
            return html;
        }

        // Tabela de turmas
        const tableData = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            const studentCount = students.filter(st => st.sectionId === s.id).length;

            return {
                ...s,
                className: cls?.name || '---',
                shiftName: shift?.name || '---',
                studentCount,
                capacity: s.capacity || 40
            };
        });

        html += SGEComponents.renderTable({
            columns: [
                { key: 'name', label: 'Turma', sortable: true, render: (v) => `<span class="font-semibold">${_esc(v)}</span>` },
                { key: 'className', label: 'Classe', sortable: true },
                { key: 'shiftName', label: 'Turno' },
                {
                    key: 'studentCount', label: 'Alunos', sortable: true,
                    render: (v, row) => {
                        const pct = Math.round((v / row.capacity) * 100);
                        const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
                        return `<div class="flex items-center gap-2">
                            <span class="font-medium">${v}/${row.capacity}</span>
                            <div class="w-16">${SGEComponents.progressBar(pct, color)}</div>
                        </div>`;
                    }
                },
                {
                    key: 'status', label: 'Estado',
                    render: (v) => SGEComponents.statusBadge(v)
                }
            ],
            data: tableData,
            actions: [
                {
                    label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGESections.openEditModal(row.id)
                },
                {
                    label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGESections.deleteSection(row.id)
                }
            ],
            searchPlaceholder: 'Pesquisar turma...'
        });

        return html;
    }

    async function openCreateModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [classes, shifts, years] = await Promise.all([
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo primeiro.');

        const classOptions = classes.map(c => ({ value: c.id, label: c.name }));
        const shiftOptions = shifts.map(s => ({ value: s.id, label: s.name }));

        SGEComponents.openFormModal({
            title: 'Nova Turma',
            fields: [
                { name: 'name', label: 'Nome da Turma', type: 'text', required: true, placeholder: 'Ex: A, B, C' },
                { name: 'classId', label: 'Classe', type: 'select', required: true, options: classOptions },
                { name: 'shiftId', label: 'Turno', type: 'select', required: true, options: shiftOptions },
                { name: 'capacity', label: 'Capacidade Máxima', type: 'number', min: 1, max: 100, defaultValue: 40 },
                { name: 'room', label: 'Sala', type: 'text', placeholder: 'Ex: Sala 101' }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('sections', {
                    schoolId, schoolYearId: years[0].id,
                    ...data, status: 'active', createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Turma criada!');
                SGERouter.navigate('/academic/sections');
            }
        });
    }

    async function openEditModal(id) {
        const section = await SGEDb.get('sections', id);
        if (!section) return;

        const schoolId = SGEAuth.getUserSchoolId();
        const [classes, shifts] = await Promise.all([
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('shifts', { schoolId })
        ]);

        SGEComponents.openFormModal({
            title: 'Editar Turma',
            fields: [
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'classId', label: 'Classe', type: 'select', required: true, options: classes.map(c => ({ value: c.id, label: c.name })) },
                { name: 'shiftId', label: 'Turno', type: 'select', required: true, options: shifts.map(s => ({ value: s.id, label: s.name })) },
                { name: 'capacity', label: 'Capacidade', type: 'number', min: 1, max: 100 },
                { name: 'room', label: 'Sala', type: 'text' }
            ],
            data: section,
            onSubmit: async (data) => {
                Object.assign(section, data);
                await SGEDb.put('sections', section);
                SGENotifications.success('Turma atualizada!');
                SGERouter.navigate('/academic/sections');
            }
        });
    }

    async function deleteSection(id) {
        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { sectionId: id, status: 'active' });

        if (students.length > 0) {
            return SGENotifications.warning(`Não pode eliminar: ${students.length} aluno(s) nesta turma.`);
        }

        const confirmed = await SGEComponents.confirm({
            title: 'Eliminar Turma',
            message: 'Tem a certeza que deseja eliminar esta turma?',
            type: 'danger'
        });
        if (!confirmed) return;

        await SGEDb.remove('sections', id);
        SGENotifications.success('Turma eliminada.');
        SGERouter.navigate('/academic/sections');
    }

    function _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    return { render, openCreateModal, openEditModal, deleteSection };
})();

window.SGESections = SGESections;