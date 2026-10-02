// ============================================
// SGE-NG - COMISSÕES DE JÚRI
// Gestão de júris para classes finais e exames
// do IIº Ciclo (6ª, 9ª, 12ª, 13ª Classes)
// ============================================

const SGEJury = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [commissions, classes, staff, years] = await Promise.all([
            SGEDb.query('jury_commissions', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = years[0];
        const finalClasses = classes.filter(c => c.isFinal);

        let html = SGEComponents.pageHeader('Comissões de Júri', 'Júris para classes finais e exames', [
            { label: '+ Nova Comissão', type: 'primary', onClick: 'SGEJury.openCreateModal()' }
        ]);

        if (!activeYear) {
            html += SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');
            return html;
        }

        if (finalClasses.length === 0) {
            html += SGEComponents.alert('Nenhuma classe final configurada (6ª, 9ª, 12ª, 13ª).', 'info');
            return html;
        }

        const yearCommissions = commissions.filter(c => c.schoolYearId === activeYear.id);

        if (yearCommissions.length === 0) {
            html += SGEComponents.emptyState('Nenhuma comissão de júri criada.',
                `<button class="btn btn-primary btn-sm" onclick="SGEJury.openCreateModal()">+ Criar Comissão</button>`);
            return html;
        }

        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        for (const comm of yearCommissions) {
            const cls = classes.find(c => c.id === comm.classId);
            const members = await SGEDb.query('jury_members', { commissionId: comm.id });

            const president = members.find(m => m.role === 'president');
            const presidentStaff = president ? staff.find(s => s.id === president.staffId) : null;

            const vogals = members.filter(m => m.role === 'vogal');
            const secretary = members.find(m => m.role === 'secretary');

            html += `
                <div class="sge-card ${comm.status === 'active' ? 'border-l-4 border-l-primary-500' : ''}">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-bold text-gray-900">Júri - ${_esc(cls?.name || '---')}</h3>
                            <p class="text-xs text-gray-500">${_esc(comm.examType || 'Exame Final')}</p>
                        </div>
                        ${SGEComponents.statusBadge(comm.status)}
                    </div>

                    <div class="space-y-2 text-sm mb-4">
                        <div class="flex items-center gap-2">
                            <span class="text-gray-500 w-24">Presidente:</span>
                            <span class="font-medium">${_esc(presidentStaff?.name || '---')}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-gray-500 w-24">Secretário:</span>
                            <span class="font-medium">${_esc(staff.find(s => s.id === secretary?.staffId)?.name || '---')}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-gray-500 w-24">Vogais:</span>
                            <span class="font-medium">${vogals.map(v => _esc(staff.find(s => s.id === v.staffId)?.name || '')).filter(Boolean).join(', ') || '---'}</span>
                        </div>
                    </div>

                    <div class="flex gap-2 pt-3 border-t border-gray-100">
                        <button class="btn btn-sm btn-primary" onclick="SGEJury.openJuryWork('${comm.id}')">
                            📋 Trabalhar no Júri
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="SGEJury.editCommission('${comm.id}')">Editar</button>
                        <button class="btn btn-sm btn-danger-outline" onclick="SGEJury.deleteCommission('${comm.id}')">Eliminar</button>
                    </div>
                </div>
            `;
        }
        html += `</div>`;

        return html;
    }

    async function openCreateModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [classes, staff, years] = await Promise.all([
            SGEDb.query('classes', { schoolId, isFinal: true }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');

        const classOpts = classes.map(c => ({ value: c.id, label: c.name }));
        const teacherOpts = staff.filter(s =>
            s.staffType === 'professor' || s.role === 'professor' || s.role === 'director' || s.role === 'subdirector'
        ).map(s => ({ value: s.id, label: s.name || s.fullName }));

        SGEComponents.openFormModal({
            title: 'Nova Comissão de Júri',
            size: 'md',
            fields: [
                { name: 'classId', label: 'Classe Final', type: 'select', required: true, options: classOpts },
                { name: 'examType', label: 'Tipo de Exame', type: 'select', required: true,
                    options: ['Exame Final', 'Exame de Recuperação', 'Exame Extraordinário', 'Prova de Passagem'] },
                { name: 'presidentId', label: 'Presidente do Júri', type: 'select', required: true, options: teacherOpts },
                { name: 'secretaryId', label: 'Secretário', type: 'select', required: true, options: teacherOpts },
                { name: 'vogal1Id', label: '1º Vogal', type: 'select', required: true, options: teacherOpts },
                { name: 'vogal2Id', label: '2º Vogal', type: 'select', options: teacherOpts },
                { name: 'examDate', label: 'Data do Exame', type: 'date' }
            ],
            onSubmit: async (data) => {
                const commId = SGEUtils.generateUUID();
                await SGEDb.put('jury_commissions', {
                    id: commId, schoolId,
                    schoolYearId: years[0].id,
                    classId: data.classId,
                    examType: data.examType,
                    examDate: data.examDate || null,
                    status: 'active',
                    createdAt: SGEUtils.nowISO()
                });

                const memberRoles = [
                    { staffId: data.presidentId, role: 'president' },
                    { staffId: data.secretaryId, role: 'secretary' },
                    { staffId: data.vogal1Id, role: 'vogal' }
                ];
                if (data.vogal2Id) memberRoles.push({ staffId: data.vogal2Id, role: 'vogal' });

                for (const m of memberRoles) {
                    await SGEDb.put('jury_members', {
                        commissionId: commId, ...m,
                        createdAt: SGEUtils.nowISO()
                    });
                }

                SGENotifications.success('Comissão de Júri criada!');
                SGERouter.navigate('/jury');
            }
        });
    }

    async function openJuryWork(commissionId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const [comm, members, staff, students, computedGrades, subjects, classes] = await Promise.all([
            SGEDb.get('jury_commissions', commissionId),
            SGEDb.query('jury_members', { commissionId }),
            SGEDb.query('staff', { schoolId }),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('computed_grades', { schoolId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('classes', { schoolId })
        ]);

        const cls = classes.find(c => c.id === comm.classId);
        const president = members.find(m => m.role === 'president');
        const presidentStaff = president ? staff.find(s => s.id === president.staffId) : null;

        let content = `
            <div class="mb-4 p-3 bg-primary-50 rounded-lg">
                <p class="text-sm"><strong>Presidente:</strong> ${_esc(presidentStaff?.name || '---')}</p>
                <p class="text-sm"><strong>Exame:</strong> ${_esc(comm.examType)} · ${_esc(cls?.name)}</p>
            </div>
            <p class="text-sm text-gray-500 mb-4">Como Presidente do Júri, pode validar e ajustar as notas finais dos alunos.</p>
        `;

        content += `<table class="sge-table sge-table-compact">
            <thead><tr><th>Aluno</th><th class="text-center">MFD Atual</th><th class="text-center">Nota Júri</th><th class="text-center">Resultado</th></tr></thead>
            <tbody>`;

        for (const student of students.slice(0, 30)) {
            const sGrades = computedGrades.filter(g => g.studentId === student.id);
            const avgMFD = sGrades.length > 0
                ? sGrades.reduce((sum, g) => sum + (g.mfd || 0), 0) / sGrades.length
                : null;

            const juryResult = await SGEDb.query('jury_results', { commissionId, studentId: student.id });
            const juryGrade = juryResult[0]?.finalGrade ?? '';

            content += `<tr>
                <td class="font-medium text-sm">${_esc(student.name)}</td>
                <td class="text-center ${avgMFD != null ? SGEUtils.gradeColorClass(avgMFD, 20) : ''}">${avgMFD != null ? avgMFD.toFixed(1) : '---'}</td>
                <td class="text-center">
                    <input type="number" min="0" max="20" step="0.1" value="${juryGrade}"
                        class="w-16 text-center text-xs border rounded py-1 jury-grade"
                        data-student="${student.id}" data-commission="${commissionId}">
                </td>
                <td class="text-center" id="jury-status-${student.id}">---</td>
            </tr>`;
        }

        content += `</tbody></table>`;

        SGEComponents.openModal({
            title: `Trabalho do Júri - ${cls?.name}`,
            content,
            size: 'xl',
            footer: `
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('generic-modal').classList.add('hidden')">Fechar</button>
                <button class="btn btn-sm btn-success" onclick="SGEJury.saveJuryResults('${commissionId}')">💾 Guardar Resultados do Júri</button>
            `
        });
    }

    async function saveJuryResults(commissionId) {
        const inputs = document.querySelectorAll('.jury-grade');
        let saved = 0;

        for (const input of inputs) {
            const studentId = input.dataset.student;
            const value = input.value;
            if (value === '') continue;

            const existing = await SGEDb.query('jury_results', { commissionId, studentId });
            const data = {
                commissionId, studentId,
                finalGrade: parseFloat(value),
                approved: parseFloat(value) >= 10,
                validatedBy: SGEAuth.getUserId(),
                createdAt: SGEUtils.nowISO()
            };

            if (existing.length > 0) data.id = existing[0].id;
            await SGEDb.put('jury_results', data);
            saved++;

            const statusEl = document.getElementById(`jury-status-${studentId}`);
            if (statusEl) {
                statusEl.innerHTML = parseFloat(value) >= 10
                    ? SGEComponents.badge('Aprovado', 'success')
                    : SGEComponents.badge('Reprovado', 'danger');
            }
        }

        SGENotifications.success(`${saved} resultado(s) do júri guardado(s)!`);
    }

    async function editCommission(id) {
        SGENotifications.info('Edição de comissão em desenvolvimento.');
    }

    async function deleteCommission(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Comissão', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;

        const members = await SGEDb.query('jury_members', { commissionId: id });
        for (const m of members) await SGEDb.remove('jury_members', m.id);
        const results = await SGEDb.query('jury_results', { commissionId: id });
        for (const r of results) await SGEDb.remove('jury_results', r.id);
        await SGEDb.remove('jury_commissions', id);

        SGENotifications.success('Comissão eliminada.');
        SGERouter.navigate('/jury');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openJuryWork, saveJuryResults, editCommission, deleteCommission };
})();
window.SGEJury = SGEJury;