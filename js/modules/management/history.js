// ============================================
// SGE-NG - HISTÓRICO ESCOLAR
// Percurso académico do aluno ao longo dos anos
// ============================================

const SGEHistory = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const students = await SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] });

        let html = SGEComponents.pageHeader('Histórico Escolar', 'Percurso académico dos alunos');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Selecionar Aluno</label>
                        <select id="history-student" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGEHistory.loadHistory()">
                            <option value="">-- Selecionar Aluno --</option>
                            ${students.map(s => `<option value="${s.id}">${_esc(s.name)} (${s.enrollmentNumber || ''})</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div id="history-result"></div>
        `;

        return html;
    }

    async function loadHistory() {
        const studentId = document.getElementById('history-student')?.value;
        const container = document.getElementById('history-result');
        if (!studentId || !container) return;

        container.innerHTML = SGEComponents.loadingSpinner();

        const schoolId = SGEAuth.getUserSchoolId();
        const [student, enrollments, computedGrades, behaviorGrades, classes, sections, subjects, years] = await Promise.all([
            SGEDb.get('students', studentId),
            SGEDb.query('enrollments', { studentId }, { orderBy: ['createdAt', 'asc'] }),
            SGEDb.query('computed_grades', { studentId }),
            SGEDb.query('behavior_grades', { studentId }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('school_years', { schoolId })
        ]);

        if (!student) {
            container.innerHTML = SGEComponents.alert('Aluno não encontrado.', 'error');
            return;
        }

        const genderArticle = SGEUtils.genderText(student.gender, 'O Aluno', 'A Aluna');
        const genderApproved = SGEUtils.genderText(student.gender, 'Aprovado', 'Aprovada');

        let html = `
            <div class="sge-card mb-4">
                <h3 class="font-bold text-lg">${_esc(student.name)}</h3>
                <p class="text-sm text-gray-500">
                    ${genderArticle} · Matrícula: ${_esc(student.enrollmentNumber || '---')} ·
                    Processo: ${_esc(student.processNumber || '---')}
                </p>
            </div>
        `;

        const yearMap = {};
        years.forEach(y => { yearMap[y.id] = y; });

        const enrollByYear = {};
        enrollments.forEach(e => {
            const yearId = e.schoolYearId || 'unknown';
            if (!enrollByYear[yearId]) enrollByYear[yearId] = [];
            enrollByYear[yearId].push(e);
        });

        if (Object.keys(enrollByYear).length === 0) {
            html += SGEComponents.alert(`${genderArticle} não tem histórico registado. Pode inserir notas de anos anteriores manualmente.`, 'info');
            html += `<button class="btn btn-primary btn-sm mt-2" onclick="SGEHistory.openInsertModal('${studentId}')">+ Inserir Histórico Manual</button>`;
            container.innerHTML = html;
            return;
        }

        for (const [yearId, enrolls] of Object.entries(enrollByYear)) {
            const year = yearMap[yearId];
            const yearGrades = computedGrades.filter(g => g.schoolYearId === yearId);
            const yearBehavior = behaviorGrades.filter(g => g.schoolYearId === yearId);

            const enroll = enrolls[0];
            const section = sections.find(s => s.id === enroll?.sectionId);
            const cls = section ? classes.find(c => c.id === section.classId) : null;

            const isFinal = cls && SGEUtils.isFinalClass(cls.number);
            const level = cls ? SGEUtils.getEducationLevel(cls.number) : 'ciclo1';
            const scale = SGEUtils.getGradeScale(level);

            const terms = await SGEDb.query('terms', { schoolYearId: yearId });

            html += `
                <div class="sge-card mb-4 ${isFinal ? 'border-l-4 border-l-yellow-400' : ''}">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <h4 class="font-bold text-gray-900">${_esc(year?.year || 'Ano Desconhecido')}</h4>
                            <p class="text-sm text-gray-500">${_esc(cls?.name || '---')} · Turma ${_esc(section?.name || '---')}</p>
                        </div>
                        ${isFinal ? SGEComponents.badge('Classe Final', 'warning') : ''}
                    </div>
            `;

            if (yearGrades.length > 0) {
                html += `<div class="overflow-x-auto"><table class="sge-table sge-table-compact">
                    <thead><tr>
                        <th>Disciplina</th>
                        ${terms.map(t => `<th class="text-center">${t.name}</th>`).join('')}
                        <th class="text-center font-bold">MFD</th>
                        <th class="text-center">Comp.</th>
                        <th class="text-center">Estado</th>
                    </tr></thead><tbody>`;

                const subjectIds = [...new Set(yearGrades.map(g => g.subjectId))];
                for (const subId of subjectIds) {
                    const sub = subjects.find(s => s.id === subId);
                    const subGrades = yearGrades.filter(g => g.subjectId === subId);

                    html += `<tr>
                        <td class="font-medium">${_esc(sub?.name || '---')}</td>`;

                    terms.forEach(t => {
                        const tg = subGrades.find(g => g.termId === t.id);
                        const mfd = tg?.mfd;
                        const color = mfd != null ? SGEUtils.gradeColorClass(mfd, scale.max) : '';
                        html += `<td class="text-center ${color}">${mfd != null ? mfd.toFixed(1) : '---'}</td>`;
                    });

                    const allMFDs = subGrades.map(g => g.mfd).filter(v => v != null);
                    const finalMFD = allMFDs.length ? (allMFDs.reduce((a, b) => a + b, 0) / allMFDs.length) : null;
                    const finalColor = finalMFD != null ? SGEUtils.gradeColorClass(finalMFD, scale.max) : '';
                    const passed = finalMFD != null && finalMFD >= (scale.max === 10 ? 5 : 10);

                    html += `<td class="text-center font-bold ${finalColor}">${finalMFD != null ? finalMFD.toFixed(1) : '---'}</td>`;

                    const beh = yearBehavior.find(b => b.subjectId === subId);
                    html += `<td class="text-center">${beh ? SGEUtils.behaviorToQualitative(beh.value) : '---'}</td>`;
                    html += `<td class="text-center">${finalMFD != null ? (passed ? SGEComponents.badge(genderApproved, 'success') : SGEComponents.badge('Reprovado', 'danger')) : '---'}</td>`;
                    html += `</tr>`;
                }

                html += `</tbody></table></div>`;
            } else {
                html += `<p class="text-sm text-gray-400 py-2">Sem notas registadas para este ano.</p>`;
            }

            html += `</div>`;
        }

        html += `<button class="btn btn-secondary btn-sm mt-2" onclick="SGEHistory.openInsertModal('${studentId}')">+ Inserir Histórico de Anos Anteriores</button>`;

        container.innerHTML = html;
    }

    async function openInsertModal(studentId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const classes = await SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] });
        const subjects = await SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] });

        const classOpts = classes.map(c => ({ value: c.id, label: c.name }));
        const subjectOpts = subjects.map(s => ({ value: s.id, label: s.name }));

        SGEComponents.openFormModal({
            title: 'Inserir Histórico Manual',
            size: 'lg',
            fields: [
                { name: 'schoolYear', label: 'Ano Letivo', type: 'text', required: true, placeholder: 'Ex: 2023/2024' },
                { name: 'classId', label: 'Classe', type: 'select', required: true, options: classOpts },
                { name: 'subjectId', label: 'Disciplina', type: 'select', required: true, options: subjectOpts },
                { name: 'grade1', label: '1º Trimestre', type: 'number', min: 0, max: 20, step: 0.1 },
                { name: 'grade2', label: '2º Trimestre', type: 'number', min: 0, max: 20, step: 0.1 },
                { name: 'grade3', label: '3º Trimestre', type: 'number', min: 0, max: 20, step: 0.1 },
                { name: 'finalGrade', label: 'Média Final', type: 'number', min: 0, max: 20, step: 0.1, required: true }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('student_history', {
                    studentId, schoolId,
                    schoolYear: data.schoolYear,
                    classId: data.classId,
                    subjectId: data.subjectId,
                    grades: { t1: data.grade1, t2: data.grade2, t3: data.grade3 },
                    finalGrade: data.finalGrade,
                    source: 'manual',
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Histórico inserido!');
                loadHistory();
            }
        });
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, loadHistory, openInsertModal };
})();
window.SGEHistory = SGEHistory;