// ============================================
// SGE-NG - LANÇAMENTO E GESTÃO DE NOTAS
// Interface para o professor lançar avaliações
// e notas dos alunos
// ============================================

const SGEGrades = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const schoolId = user?.schoolId;
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [years, terms, sections, subjects, assignments, classes] = await Promise.all([
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('assignments', { schoolId }),
            SGEDb.query('classes', { schoolId })
        ]);

        const activeYear = years[0];
        if (!activeYear) return SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');

        const openTerms = terms.filter(t => t.schoolYearId === activeYear.id && t.status === 'open');

        // Filtrar por permissões do professor
        let myAssignments = assignments.filter(a => a.schoolYearId === activeYear.id);
        if (user.role === 'professor') {
            myAssignments = myAssignments.filter(a => a.teacherId === user.id || a.teacherId === user.staffId);
        }

        let html = SGEComponents.pageHeader('Notas', 'Lançamento e gestão de avaliações', [
            { label: '+ Nova Avaliação', type: 'primary', onClick: 'SGEGrades.openAssessmentModal()' },
            { label: 'Solicitar Correção', type: 'warning', onClick: 'SGEGrades.openCorrectionModal()' }
        ]);

        if (openTerms.length === 0) {
            html += SGEComponents.alert('Nenhum trimestre aberto. Peça à direção para abrir um trimestre.', 'warning');
            return html;
        }

        if (myAssignments.length === 0) {
            html += SGEComponents.emptyState('Nenhuma atribuição encontrada. Contacte a direção.');
            return html;
        }

        // Agrupar por turma e disciplina
        const grouped = {};
        for (const a of myAssignments) {
            const sec = sections.find(s => s.id === a.sectionId);
            const sub = subjects.find(s => s.id === a.subjectId);
            const cls = sec ? classes.find(c => c.id === sec.classId) : null;
            const key = `${sec?.name || a.sectionId}-${sub?.name || a.subjectId}`;
            if (!grouped[key]) {
                grouped[key] = { section: sec, subject: sub, class: cls, assignment: a };
            }
        }

        html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
        for (const [key, group] of Object.entries(grouped)) {
            const level = group.class ? SGEUtils.getEducationLevel(group.class.number) : 'ciclo1';
            const scale = SGEUtils.getGradeScale(level);

            // Contar avaliações e notas
            const assessments = await SGEDb.query('assessments', {
                sectionId: group.section?.id, subjectId: group.subject?.id,
                termId: openTerms[0]?.id, schoolYearId: activeYear.id
            });

            html += `
                <div class="sge-card hover:shadow-md transition-shadow cursor-pointer"
                     onclick="SGEGrades.openGradeSheet('${group.section?.id}', '${group.subject?.id}', '${openTerms[0]?.id}')">
                    <div class="flex items-start justify-between mb-2">
                        <div>
                            <h3 class="font-bold text-gray-900">${_esc(group.subject?.name || '---')}</h3>
                            <p class="text-sm text-gray-500">${_esc(group.class?.name || '')} ${_esc(group.section?.name || '')}</p>
                        </div>
                        ${SGEComponents.badge(scale.type === 'qualitative' ? 'Qualitativa' : `0-${scale.max}`, 'info')}
                    </div>
                    <div class="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        <span>📝 ${assessments.length} avaliação(ões)</span>
                        <span>📅 ${openTerms[0]?.name || '---'}</span>
                    </div>
                    <div class="mt-2 text-xs text-primary-600 font-medium">Clique para lançar notas →</div>
                </div>
            `;
        }
        html += `</div>`;

        return html;
    }

    // ============================================
    // FOLHA DE NOTAS (GRADE SHEET)
    // ============================================

    async function openGradeSheet(sectionId, subjectId, termId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const [students, assessments, section, subject, classes, gradeConfigs] = await Promise.all([
            SGEDb.query('students', { schoolId, sectionId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('assessments', { sectionId, subjectId, termId }),
            SGEDb.get('sections', sectionId),
            SGEDb.get('subjects', subjectId),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('grade_config', { schoolId, active: true })
        ]);

        const cls = section ? classes.find(c => c.id === section.classId) : null;
        const level = cls ? SGEUtils.getEducationLevel(cls.number) : 'ciclo1';
        const scale = SGEUtils.getGradeScale(level);
        const term = await SGEDb.get('terms', termId);

        // Buscar todas as notas
        const allGrades = await SGEDb.query('grades', { sectionId, subjectId, termId });
        const computedGrades = await SGEDb.query('computed_grades', { sectionId, subjectId, termId });

        // Conteúdo do modal
        let content = `
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <h3 class="font-bold">${_esc(subject?.name)} - ${_esc(cls?.name)} ${_esc(section?.name)}</h3>
                    <p class="text-xs text-gray-500">${term?.name} · Escala: ${scale.type === 'qualitative' ? 'Qualitativa' : '0 a ' + scale.max}</p>
                </div>
                <button class="btn btn-sm btn-success" onclick="SGEGrades.saveAllGrades('${sectionId}','${subjectId}','${termId}')">
                    💾 Guardar Tudo
                </button>
            </div>
        `;

        if (students.length === 0) {
            content += SGEComponents.emptyState('Nenhum aluno nesta turma.');
        } else {
            content += `<div class="overflow-x-auto"><table class="sge-table sge-table-compact">`;
            content += `<thead><tr>
                <th class="sticky left-0 bg-gray-50 z-10">Aluno</th>`;

            // Colunas de avaliações
            assessments.forEach(a => {
                content += `<th class="text-center min-w-[80px]">
                    <div class="text-xs font-medium">${_esc(a.name)}</div>
                    <div class="text-[10px] text-gray-400">${a.typeName || ''}</div>
                </th>`;
            });

            // Coluna MAC
            if (gradeConfigs.find(g => g.type === 'MAC')) {
                content += `<th class="text-center bg-primary-50 min-w-[70px]"><div class="text-xs font-bold text-primary-700">MAC</div></th>`;
            }
            // Coluna Comportamento
            content += `<th class="text-center min-w-[70px]"><div class="text-xs font-medium">Comp.</div></th>`;
            content += `</tr></thead><tbody>`;

            for (const student of students) {
                const studentGrades = allGrades.filter(g => g.studentId === student.id);
                const computed = computedGrades.find(g => g.studentId === student.id);

                content += `<tr>`;
                content += `<td class="sticky left-0 bg-white z-10 font-medium text-xs whitespace-nowrap">${_esc(student.name)}</td>`;

                // Células de notas por avaliação
                assessments.forEach(a => {
                    const grade = studentGrades.find(g => g.assessmentId === a.id);
                    const value = grade?.value ?? '';

                    if (scale.type === 'qualitative') {
                        content += `<td class="text-center">
                            <select class="w-full text-center text-xs border rounded py-1 grade-input"
                                data-student="${student.id}" data-assessment="${a.id}"
                                data-section="${sectionId}" data-subject="${subjectId}" data-term="${termId}">
                                <option value="">---</option>
                                ${scale.options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${SGEUtils.qualitativeLabel(o)}</option>`).join('')}
                            </select>
                        </td>`;
                    } else {
                        content += `<td class="text-center">
                            <input type="number" min="${scale.min}" max="${scale.max}" step="0.1"
                                value="${value}"
                                class="w-16 text-center text-xs border rounded py-1 grade-input ${value !== '' ? SGEUtils.gradeColorClass(parseFloat(value), scale.max) : ''}"
                                data-student="${student.id}" data-assessment="${a.id}"
                                data-section="${sectionId}" data-subject="${subjectId}" data-term="${termId}"
                                onchange="SGEGrades._onGradeChange(this, ${scale.max})">
                        </td>`;
                    }
                });

                // MAC
                if (gradeConfigs.find(g => g.type === 'MAC')) {
                    const mac = computed?.mac ?? '---';
                    const macClass = mac !== '---' ? SGEUtils.gradeColorClass(parseFloat(mac), scale.max) : '';
                    content += `<td class="text-center bg-primary-50 font-bold text-sm ${macClass}" id="mac-${student.id}">${mac !== '---' ? parseFloat(mac).toFixed(1) : '---'}</td>`;
                }

                // Comportamento
                const behavior = await SGEDb.query('behavior_grades', { studentId: student.id, sectionId, termId });
                const behValue = behavior[0]?.value ?? '';
                content += `<td class="text-center">
                    <input type="number" min="0" max="20" step="1" value="${behValue}"
                        class="w-14 text-center text-xs border rounded py-1 behavior-input"
                        data-student="${student.id}" data-section="${sectionId}" data-term="${termId}"
                        onchange="SGEGrades._onBehaviorChange(this)">
                </td>`;

                content += `</tr>`;
            }

            content += `</tbody></table></div>`;
        }

        SGEComponents.openModal({
            title: `Notas: ${subject?.name}`,
            content,
            size: 'full',
            footer: `
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('generic-modal').classList.add('hidden')">Fechar</button>
                <button class="btn btn-sm btn-success" onclick="SGEGrades.saveAllGrades('${sectionId}','${subjectId}','${termId}')">💾 Guardar Todas as Notas</button>
            `
        });
    }

    // ============================================
    // GUARDAR NOTAS
    // ============================================

    async function saveAllGrades(sectionId, subjectId, termId) {
        const inputs = document.querySelectorAll('.grade-input');
        const behaviorInputs = document.querySelectorAll('.behavior-input');
        let saved = 0;

        for (const input of inputs) {
            const studentId = input.dataset.student;
            const assessmentId = input.dataset.assessment;
            const value = input.value;

            if (value === '') continue;

            // Validar nota
            const numValue = parseFloat(value);
            const max = parseFloat(input.max) || 20;
            if (!isNaN(numValue) && (numValue < 0 || numValue > max)) {
                SGENotifications.warning(`Nota inválida para aluno ${studentId}: ${value}`);
                continue;
            }

            // Verificar se já existe
            const existing = await SGEDb.query('grades', { studentId, assessmentId, termId });
            if (existing.length > 0) {
                existing[0].value = value;
                existing[0].updatedAt = SGEUtils.nowISO();
                await SGEDb.put('grades', existing[0]);
            } else {
                await SGEDb.put('grades', {
                    studentId, assessmentId, subjectId, sectionId, termId,
                    schoolYearId: (await SGEDb.query('school_years', { schoolId: SGEAuth.getUserSchoolId(), status: 'active' }))[0]?.id,
                    value, teacherId: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                });
            }
            saved++;
        }

        // Guardar comportamento
        for (const input of behaviorInputs) {
            const studentId = input.dataset.student;
            const value = input.value;
            if (value === '') continue;

            // CÓDIGO CORRIGIDO (mover para fora do loop)
async function saveAllGrades(sectionId, subjectId, termId) {
    const inputs = document.querySelectorAll('.grade-input');
    const behaviorInputs = document.querySelectorAll('.behavior-input');
    let saved = 0;
    
    // Mover queries para fora do loop
    const schoolId = SGEAuth.getUserSchoolId();
    const years = await SGEDb.query('school_years', { schoolId, status: 'active' });
    const schoolYearId = years[0]?.id;
    
    for (const input of inputs) {
        // ... (usar schoolYearId diretamente)
    }
    
    for (const input of behaviorInputs) {
        // ... (usar schoolYearId diretamente)
    }
}
                    value: parseFloat(value),
                    qualitative: SGEUtils.behaviorToQualitative(parseFloat(value)),
                    teacherId: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                });
            }
        }

        // Recalcular MACs
        if (window.SGEGradeEngine) {
            await SGEGradeEngine.recalculateSection(sectionId, subjectId, termId);
        }

        SGENotifications.success(`${saved} nota(s) guardada(s)!`);
    }

    // ============================================
    // CRIAR AVALIAÇÃO
    // ============================================

    async function openAssessmentModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [types, years, terms] = await Promise.all([
            SGEDb.query('assessment_types', { schoolId, status: 'active' }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');
        const openTerms = terms.filter(t => t.schoolYearId === years[0].id && t.status === 'open');
        if (!openTerms.length) return SGENotifications.warning('Nenhum trimestre aberto.');

        const typeOpts = types.map(t => ({ value: t.id, label: `${t.name} (peso: ${t.weight})` }));
        const termOpts = openTerms.map(t => ({ value: t.id, label: t.name }));

        // Turmas do professor
        const assignments = await SGEDb.query('assignments', { schoolId, schoolYearId: years[0].id });
        const myAssign = SGEAuth.getUserRole() === 'professor'
            ? assignments.filter(a => a.teacherId === SGEAuth.getUserId())
            : assignments;
        const sections = await SGEDb.query('sections', { schoolId });
        const subjects = await SGEDb.query('subjects', { schoolId });
        const classes = await SGEDb.query('classes', { schoolId });

        const sectionOpts = [...new Set(myAssign.map(a => a.sectionId))].map(sid => {
            const sec = sections.find(s => s.id === sid);
            const cls = sec ? classes.find(c => c.id === sec.classId) : null;
            return { value: sid, label: `${cls?.name || ''} ${sec?.name || ''}` };
        });

        const subjectOpts = [...new Set(myAssign.map(a => a.subjectId))].map(sid => {
            const sub = subjects.find(s => s.id === sid);
            return { value: sid, label: sub?.name || sid };
        });

        SGEComponents.openFormModal({
            title: 'Nova Avaliação',
            fields: [
                { name: 'name', label: 'Nome da Avaliação', type: 'text', required: true, placeholder: 'Ex: 1º Teste de Matemática', grid: 'full' },
                { name: 'typeId', label: 'Tipo de Avaliação', type: 'select', required: true, options: typeOpts },
                { name: 'sectionId', label: 'Turma', type: 'select', required: true, options: sectionOpts },
                { name: 'subjectId', label: 'Disciplina', type: 'select', required: true, options: subjectOpts },
                { name: 'termId', label: 'Trimestre', type: 'select', required: true, options: termOpts },
                { name: 'date', label: 'Data', type: 'date', required: true },
                { name: 'maxScore', label: 'Pontuação Máxima', type: 'number', min: 1, max: 100, defaultValue: 20 }
            ],
            onSubmit: async (data) => {
                const typeName = types.find(t => t.id === data.typeId)?.name || '';
                await SGEDb.put('assessments', {
                    schoolId, schoolYearId: years[0].id,
                    ...data, typeName,
                    teacherId: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Avaliação criada!');
                SGERouter.navigate('/grades');
            }
        });
    }

    // ============================================
    // SOLICITAÇÃO DE CORREÇÃO DE NOTA
    // ============================================

    async function openCorrectionModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] });
        const studentOpts = students.map(s => ({ value: s.id, label: `${s.name} (${s.enrollmentNumber || ''})` }));

        SGEComponents.openFormModal({
            title: 'Solicitar Correção de Nota',
            fields: [
                { name: 'studentId', label: 'Aluno', type: 'select', required: true, options: studentOpts },
                { name: 'reason', label: 'Motivo da Correção', type: 'textarea', required: true,
                    placeholder: 'Explique o motivo da solicitação de alteração...', grid: 'full' },
                { name: 'currentGrade', label: 'Nota Atual', type: 'text' },
                { name: 'proposedGrade', label: 'Nota Proposta', type: 'text' }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('grade_corrections', {
                    schoolId, ...data,
                    teacherId: SGEAuth.getUserId(),
                    status: 'pending',
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Solicitação enviada à Direção Pedagógica.');
            }
        });
    }

    // ============================================
    // EVENTOS DE INPUT
    // ============================================

    function _onGradeChange(input, max) {
        const val = parseFloat(input.value);
        input.className = input.className.replace(/grade-\w+/g, '');
        if (!isNaN(val)) {
            input.classList.add(SGEUtils.gradeColorClass(val, max));
        }
    }

    function _onBehaviorChange(input) {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0 && val <= 20) {
            const qual = SGEUtils.behaviorToQualitative(val);
            input.title = qual;
        }
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openGradeSheet, saveAllGrades, openAssessmentModal, openCorrectionModal, _onGradeChange, _onBehaviorChange };
})();
window.SGEGrades = SGEGrades;