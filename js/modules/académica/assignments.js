// ============================================
// SGE-NG - ATRIBUIÇÕES
// Associação de professores a turmas/disciplinas
// e coordenações de turma
// ============================================

const SGEAssignments = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [assignments, coordinations, staff, sections, subjects, classes, shifts, years] = await Promise.all([
            SGEDb.query('assignments', { schoolId }),
            SGEDb.query('coordinations', { schoolId }),
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = years[0];
        const teachers = staff.filter(s => s.staffType === 'professor' || s.role === 'professor');

        let html = SGEComponents.pageHeader('Atribuições', 'Professores, turmas, disciplinas e coordenações', [
            { label: '+ Atribuir Professor', type: 'primary', onClick: 'SGEAssignments.openAssignModal()' },
            { label: '+ Coordenador de Turma', type: 'success', onClick: 'SGEAssignments.openCoordinationModal()' }
        ]);

        if (!activeYear) {
            html += SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');
            return html;
        }

        // Tabs: Atribuições | Coordenações
        const yearAssignments = assignments.filter(a => a.schoolYearId === activeYear.id);
        const yearCoordinations = coordinations.filter(c => c.schoolYearId === activeYear.id);

        // Helper para nomes
        const getTeacherName = (id) => { const t = teachers.find(s => s.id === id || s.userId === id); return t?.name || t?.fullName || '---'; };
        const getSectionName = (id) => {
            const s = sections.find(sec => sec.id === id);
            if (!s) return '---';
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return `${cls?.name || ''} ${s.name || ''} (${shift?.name || ''})`;
        };
        const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || '---';

        // Tab 1: Atribuições de Professores
        let tab1Content = '';
        if (yearAssignments.length === 0) {
            tab1Content = SGEComponents.emptyState('Nenhuma atribuição neste ano letivo.');
        } else {
            tab1Content = SGEComponents.renderTable({
                columns: [
                    { key: 'teacherId', label: 'Professor', render: (v) => `<span class="font-medium">${_esc(getTeacherName(v))}</span>` },
                    { key: 'sectionId', label: 'Turma', render: (v) => _esc(getSectionName(v)) },
                    { key: 'subjectId', label: 'Disciplina', render: (v) => _esc(getSubjectName(v)) },
                    { key: 'isAdminTeacher', label: 'Tipo', render: (v) => v ? SGEComponents.badge('Administrativo', 'warning') : SGEComponents.badge('Professor', 'info') }
                ],
                data: yearAssignments,
                actions: [
                    { label: 'Remover', color: 'danger',
                        icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
                        onClick: (row) => SGEAssignments.removeAssignment(row.id) }
                ]
            });
        }

        // Tab 2: Coordenações
        let tab2Content = '';
        if (yearCoordinations.length === 0) {
            tab2Content = SGEComponents.emptyState('Nenhum coordenador atribuído.');
        } else {
            tab2Content = SGEComponents.renderTable({
                columns: [
                    { key: 'teacherId', label: 'Coordenador (Presidente de Turma)', render: (v) => `<span class="font-medium">${_esc(getTeacherName(v))}</span>` },
                    { key: 'sectionId', label: 'Turma', render: (v) => _esc(getSectionName(v)) }
                ],
                data: yearCoordinations,
                actions: [
                    { label: 'Remover', color: 'danger',
                        icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
                        onClick: (row) => SGEAssignments.removeCoordination(row.id) }
                ]
            });
        }

        html += SGEComponents.renderTabs([
            { id: 'assignments', label: `Atribuições (${yearAssignments.length})`, content: tab1Content },
            { id: 'coordinations', label: `Coordenações (${yearCoordinations.length})`, content: tab2Content }
        ]);

        return html;
    }

    async function openAssignModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [staff, sections, subjects, years, classes, shifts] = await Promise.all([
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('shifts', { schoolId })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');

        const teachers = staff.filter(s => s.staffType === 'professor' || s.role === 'professor' || s.staffType === 'administrativo');
        const teacherOpts = teachers.map(t => ({ value: t.id, label: t.name || t.fullName || t.id }));
        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name} (${shift?.name || ''})` };
        });
        const subjectOpts = subjects.map(s => ({ value: s.id, label: s.name }));

        SGEComponents.openFormModal({
            title: 'Atribuir Professor',
            size: 'md',
            fields: [
                { name: 'teacherId', label: 'Professor / Funcionário', type: 'select', required: true, options: teacherOpts },
                { name: 'sectionId', label: 'Turma', type: 'select', required: true, options: sectionOpts },
                { name: 'subjectId', label: 'Disciplina', type: 'select', required: true, options: subjectOpts },
                { name: 'isAdminTeacher', label: 'É administrativo que leciona?', type: 'toggle' }
            ],
            onSubmit: async (data) => {
                // Verificar duplicado
                const existing = await SGEDb.query('assignments', {
                    schoolId, schoolYearId: years[0].id,
                    teacherId: data.teacherId, sectionId: data.sectionId, subjectId: data.subjectId
                });
                if (existing.length > 0) return SGENotifications.warning('Esta atribuição já existe.');

                await SGEDb.put('assignments', {
                    schoolId, schoolYearId: years[0].id,
                    ...data, createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Atribuição criada!');
                SGERouter.navigate('/academic/assignments');
            }
        });
    }

    async function openCoordinationModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [staff, sections, years, classes, shifts] = await Promise.all([
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('shifts', { schoolId })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');

        const teachers = staff.filter(s => s.staffType === 'professor' || s.role === 'professor');
        const teacherOpts = teachers.map(t => ({ value: t.id, label: t.name || t.fullName || t.id }));
        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name} (${shift?.name || ''})` };
        });

        SGEComponents.openFormModal({
            title: 'Coordenador de Turma (Presidente)',
            fields: [
                { name: 'teacherId', label: 'Professor Coordenador', type: 'select', required: true, options: teacherOpts },
                { name: 'sectionId', label: 'Turma', type: 'select', required: true, options: sectionOpts }
            ],
            onSubmit: async (data) => {
                const existing = await SGEDb.query('coordinations', {
                    schoolId, schoolYearId: years[0].id, sectionId: data.sectionId
                });
                if (existing.length > 0) return SGENotifications.warning('Esta turma já tem coordenador.');

                await SGEDb.put('coordinations', {
                    schoolId, schoolYearId: years[0].id,
                    ...data, createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Coordenação atribuída!');
                SGERouter.navigate('/academic/assignments');
            }
        });
    }

    async function removeAssignment(id) {
        const ok = await SGEComponents.confirm({ title: 'Remover Atribuição', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('assignments', id);
        SGENotifications.success('Atribuição removida.');
        SGERouter.navigate('/academic/assignments');
    }

    async function removeCoordination(id) {
        const ok = await SGEComponents.confirm({ title: 'Remover Coordenação', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('coordinations', id);
        SGENotifications.success('Coordenação removida.');
        SGERouter.navigate('/academic/assignments');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openAssignModal, openCoordinationModal, removeAssignment, removeCoordination };
})();
window.SGEAssignments = SGEAssignments;