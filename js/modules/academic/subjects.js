// ============================================
// SGE-NG - GESTÃO DE DISCIPLINAS
// ============================================

const SGESubjects = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [subjects, classes] = await Promise.all([
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] })
        ]);

        let html = SGEComponents.pageHeader('Disciplinas', 'Matérias curriculares lecionadas', [
            { label: '+ Nova Disciplina', type: 'primary', onClick: 'SGESubjects.openCreateModal()' }
        ]);

        if (subjects.length === 0) {
            html += SGEComponents.emptyState('Nenhuma disciplina cadastrada.',
                `<button class="btn btn-primary btn-sm" onclick="SGESubjects.openCreateModal()">+ Criar Disciplina</button>`);
            return html;
        }

        html += SGEComponents.renderTable({
            columns: [
                { key: 'order', label: 'Ordem', width: '60px', sortable: true,
                    render: (v) => `<span class="text-gray-400 text-xs">${v || '-'}</span>` },
                { key: 'name', label: 'Disciplina', sortable: true,
                    render: (v) => `<span class="font-semibold text-gray-900">${_esc(v)}</span>` },
                { key: 'code', label: 'Código', sortable: true },
                { key: 'classId', label: 'Classe',
                    render: (v) => { const c = classes.find(cl => cl.id === v); return c ? _esc(c.name) : '<span class="text-gray-400">Todas</span>'; }
                },
                { key: 'weeklyHours', label: 'H/Semana', width: '80px',
                    render: (v) => v ? `${v}h` : '---' },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) }
            ],
            data: subjects,
            actions: [
                { label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGESubjects.openEditModal(row.id) },
                { label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGESubjects.deleteSubject(row.id) }
            ],
            searchPlaceholder: 'Pesquisar disciplina...'
        });

        return html;
    }

    async function _getClassOptions() {
        const classes = await SGEDb.query('classes', { schoolId: SGEAuth.getUserSchoolId() }, { orderBy: ['order', 'asc'] });
        return [{ value: '', label: 'Todas as Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))];
    }

    async function openCreateModal() {
        const classOptions = await _getClassOptions();
        SGEComponents.openFormModal({
            title: 'Nova Disciplina',
            fields: [
                { name: 'name', label: 'Nome da Disciplina', type: 'text', required: true, placeholder: 'Ex: Matemática', grid: 'full' },
                { name: 'code', label: 'Código', type: 'text', placeholder: 'Ex: MAT' },
                { name: 'classId', label: 'Classe', type: 'select', options: classOptions },
                { name: 'weeklyHours', label: 'Horas Semanais', type: 'number', min: 1, max: 20, defaultValue: 3 },
                { name: 'order', label: 'Ordem nos Documentos', type: 'number', min: 0, defaultValue: 0,
                    help: 'Define a ordem de aparição nos boletins e pautas' }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('subjects', {
                    schoolId: SGEAuth.getUserSchoolId(),
                    ...data, courseId: null,
                    status: 'active', createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Disciplina criada!');
                SGERouter.navigate('/academic/subjects');
            }
        });
    }

    async function openEditModal(id) {
        const subject = await SGEDb.get('subjects', id);
        if (!subject) return;
        const classOptions = await _getClassOptions();

        SGEComponents.openFormModal({
            title: 'Editar Disciplina',
            fields: [
                { name: 'name', label: 'Nome', type: 'text', required: true, grid: 'full' },
                { name: 'code', label: 'Código', type: 'text' },
                { name: 'classId', label: 'Classe', type: 'select', options: classOptions },
                { name: 'weeklyHours', label: 'Horas Semanais', type: 'number', min: 1, max: 20 },
                { name: 'order', label: 'Ordem', type: 'number', min: 0 }
            ],
            data: subject,
            onSubmit: async (data) => {
                Object.assign(subject, data);
                await SGEDb.put('subjects', subject);
                SGENotifications.success('Disciplina atualizada!');
                SGERouter.navigate('/academic/subjects');
            }
        });
    }

    async function deleteSubject(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Disciplina', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('subjects', id);
        SGENotifications.success('Disciplina eliminada.');
        SGERouter.navigate('/academic/subjects');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, deleteSubject };
})();
window.SGESubjects = SGESubjects;