// ============================================
// SGE-NG - PAUTAS TRIMESTRAIS E ANUAIS
// Geração, visualização e impressão de pautas
// com layout oficial e assinaturas
// ============================================

const SGETranscripts = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [years, terms, sections, classes, subjects, school] = await Promise.all([
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.get('schools', schoolId)
        ]);

        const activeYear = years[0];
        if (!activeYear) return SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');

        const yearTerms = terms.filter(t => t.schoolYearId === activeYear.id);

        let html = SGEComponents.pageHeader('Pautas', 'Pautas trimestrais e anuais', [
            { label: '🖨️ Imprimir Pauta', type: 'primary', onClick: 'SGETranscripts.openPrintModal()' }
        ]);

        // Seleção de turma e trimestre
        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name}` };
        });
        const termOpts = [
            ...yearTerms.map(t => ({ value: t.id, label: t.name })),
            { value: 'annual', label: 'Pauta Anual' }
        ];

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                        <select id="pauta-section" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGETranscripts.loadPauta()">
                            <option value="">-- Selecionar Turma --</option>
                            ${sectionOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Período</label>
                        <select id="pauta-term" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGETranscripts.loadPauta()">
                            ${termOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button class="btn btn-primary w-full" onclick="SGETranscripts.loadPauta()">Gerar Pauta</button>
                    </div>
                </div>
            </div>
        `;

        html += `<div id="pauta-result"></div>`;
        return html;
    }

    async function loadPauta() {
        const sectionId = document.getElementById('pauta-section')?.value;
        const termId = document.getElementById('pauta-term')?.value;
        const container = document.getElementById('pauta-result');

        if (!sectionId || !termId || !container) return;

        container.innerHTML = SGEComponents.loadingSpinner('A gerar pauta...');

        const schoolId = SGEAuth.getUserSchoolId();
        const [students, subjects, assignments, section, classes, terms, school, coordinations] = await Promise.all([
            SGEDb.query('students', { schoolId, sectionId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('assignments', { schoolId, sectionId }),
            SGEDb.get('sections', sectionId),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.get('schools', schoolId),
            SGEDb.query('coordinations', { schoolId, sectionId })
        ]);

        const cls = section ? classes.find(c => c.id === section.classId) : null;
        const level = cls ? SGEUtils.getEducationLevel(cls.number) : 'ciclo1';
        const scale = SGEUtils.getGradeScale(level);
        const term = terms.find(t => t.id === termId);
        const isAnnual = termId === 'annual';
        const termName = isAnnual ? 'Pauta Anual' : (term?.name || '---');

        // Disciplinas da turma
        const sectionSubjects = [...new Set(assignments.map(a => a.subjectId))]
            .map(sid => subjects.find(s => s.id === sid))
            .filter(Boolean)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (students.length === 0 || sectionSubjects.length === 0) {
            container.innerHTML = SGEComponents.emptyState('Sem dados para gerar pauta.');
            return;
        }

        // Buscar notas computadas
        const computedGrades = await SGEDb.query('computed_grades', { sectionId });
        const behaviorGrades = await SGEDb.query('behavior_grades', { sectionId });

        // Coordenador (Presidente da Turma)
        const coord = coordinations[0];
        const coordStaff = coord ? await SGEDb.get('staff', coord.teacherId) : null;

        // Gerar tabela da pauta
        let pautaHtml = `
            <div class="sge-card print-pauta" id="pauta-print-area">
                <!-- Cabeçalho da Pauta -->
                <div class="text-center mb-4">
                    <h2 class="text-lg font-bold">${_esc(school?.name || 'SGE-NG')}</h2>
                    <p class="text-sm text-gray-600">${_esc(school?.address || '')}</p>
                    <h3 class="text-md font-bold mt-3">PAUTA ${isAnnual ? 'ANUAL' : termName.toUpperCase()}</h3>
                    <p class="text-sm">
                        Classe: <strong>${_esc(cls?.name || '---')}</strong> ·
                        Turma: <strong>${_esc(section?.name || '---')}</strong> ·
                        Ano Letivo: <strong>${_esc((await SGEDb.query('school_years', { schoolId, status: 'active' }))[0]?.year || '---')}</strong>
                    </p>
                </div>

                <div class="overflow-x-auto">
                    <table class="sge-table sge-table-compact" style="font-size:11px">
                        <thead>
                            <tr>
                                <th style="width:30px">Nº</th>
                                <th style="min-width:150px">Nome do Aluno</th>
                                ${sectionSubjects.map(s => `<th class="text-center" style="min-width:50px">${_esc(s.code || s.name.substring(0, 4))}</th>`).join('')}
                                <th class="text-center" style="min-width:50px">MFD</th>
                                <th class="text-center" style="min-width:60px">Comp.</th>
                                <th class="text-center" style="min-width:60px">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        let approvedCount = 0, failedCount = 0;

        students.forEach((student, idx) => {
            const studentComputed = computedGrades.filter(g => g.studentId === student.id);
            const studentBehavior = behaviorGrades.find(g => g.studentId === student.id && g.termId === termId);

            // Calcular MFD média de todas as disciplinas
            const mfds = studentComputed.map(g => g.mfd).filter(v => v !== null && v !== undefined);
            const avgMFD = mfds.length > 0 ? (mfds.reduce((a, b) => a + b, 0) / mfds.length) : null;
            const isApproved = avgMFD !== null && avgMFD >= (scale.max === 10 ? 5 : 10);

            if (isApproved) approvedCount++;
            else if (avgMFD !== null) failedCount++;

            pautaHtml += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td class="font-medium">${_esc(student.name)}</td>`;

            sectionSubjects.forEach(sub => {
                const cg = studentComputed.find(g => g.subjectId === sub.id);
                const mfd = cg?.mfd;
                const colorClass = mfd !== null && mfd !== undefined ? SGEUtils.gradeColorClass(mfd, scale.max) : '';
                pautaHtml += `<td class="text-center ${colorClass}">${mfd !== null && mfd !== undefined ? mfd.toFixed(1) : '---'}</td>`;
            });

            const mfdColor = avgMFD !== null ? SGEUtils.gradeColorClass(avgMFD, scale.max) : '';
            pautaHtml += `<td class="text-center font-bold ${mfdColor}">${avgMFD !== null ? avgMFD.toFixed(1) : '---'}</td>`;
            pautaHtml += `<td class="text-center">${studentBehavior ? SGEUtils.behaviorToQualitative(studentBehavior.value) : '---'}</td>`;
            pautaHtml += `<td class="text-center">${avgMFD !== null ? (isApproved ? SGEComponents.badge('Aprovado', 'success') : SGEComponents.badge('Reprovado', 'danger')) : '---'}</td>`;
            pautaHtml += `</tr>`;
        });

        pautaHtml += `
                        </tbody>
                    </table>
                </div>

                <!-- Resumo -->
                <div class="flex gap-6 mt-4 text-sm">
                    <span>Total: <strong>${students.length}</strong></span>
                    <span class="text-success-600">Aprovados: <strong>${approvedCount}</strong></span>
                    <span class="text-danger-600">Reprovados: <strong>${failedCount}</strong></span>
                </div>

                <!-- Assinaturas -->
                <div class="print-signatures mt-8 grid grid-cols-5 gap-4 text-center text-xs">
                    <div class="print-signature-block">
                        <div class="print-signature-title">Vogal</div>
                        <div class="print-signature-line"></div>
                        <div class="print-signature-name">_______________</div>
                    </div>
                    <div class="print-signature-block">
                        <div class="print-signature-title">Vogal</div>
                        <div class="print-signature-line"></div>
                        <div class="print-signature-name">_______________</div>
                    </div>
                    <div class="print-signature-block">
                        <div class="print-signature-title">Coordenador de Turma (Presidente)</div>
                        <div class="print-signature-line"></div>
                        <div class="print-signature-name">${_esc(coordStaff?.name || '_______________')}</div>
                    </div>
                    <div class="print-signature-block">
                        <div class="print-signature-title">Subdiretor Pedagógico</div>
                        <div class="print-signature-line"></div>
                        <div class="print-signature-name">${_esc(school?.subdirector || '_______________')}</div>
                    </div>
                    <div class="print-signature-block">
                        <div class="print-signature-title">Diretor da Escola</div>
                        <div class="print-signature-line"></div>
                        <div class="print-signature-name">${_esc(school?.director || '_______________')}</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = pautaHtml;
    }

    function openPrintModal() {
        const pautaEl = document.getElementById('pauta-print-area');
        if (!pautaEl) return SGENotifications.warning('Gere uma pauta primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, loadPauta, openPrintModal };
})();
window.SGETranscripts = SGETranscripts;