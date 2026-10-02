// ============================================
// SGE-NG - BOLETINS DE NOTAS
// Emissão de cadernetas individuais
// Layout: 4 boletins por folha A4 (configurável)
// ============================================

const SGEReportCards = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [years, terms, sections, classes, students, school] = await Promise.all([
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.get('schools', schoolId)
        ]);

        const activeYear = years[0];
        if (!activeYear) return SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');

        const yearTerms = terms.filter(t => t.schoolYearId === activeYear.id);
        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name}` };
        });

        let html = SGEComponents.pageHeader('Boletins de Notas', 'Cadernetas individuais de aproveitamento');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                        <select id="rc-section" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Todas --</option>
                            ${sectionOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Trimestre</label>
                        <select id="rc-term" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            ${yearTerms.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                            <option value="annual">Anual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Aluno (opcional)</label>
                        <select id="rc-student" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Toda a Turma --</option>
                            ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGEReportCards.generate()">Gerar</button>
                        <button class="btn btn-success flex-1" onclick="SGEReportCards.printAll()">🖨️ Imprimir</button>
                    </div>
                </div>
            </div>
            <div id="rc-result"></div>
        `;

        return html;
    }

    async function generate() {
        const sectionId = document.getElementById('rc-section')?.value;
        const termId = document.getElementById('rc-term')?.value;
        const studentId = document.getElementById('rc-student')?.value;
        const container = document.getElementById('rc-result');
        if (!container) return;

        container.innerHTML = SGEComponents.loadingSpinner('A gerar boletins...');

        const schoolId = SGEAuth.getUserSchoolId();
        const [school, students, subjects, computedGrades, behaviorGrades, section, classes, terms, years, coordinations] = await Promise.all([
            SGEDb.get('schools', schoolId),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('computed_grades', { schoolId }),
            SGEDb.query('behavior_grades', { schoolId }),
            sectionId ? SGEDb.get('sections', sectionId) : null,
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('coordinations', { schoolId })
        ]);

        let filteredStudents = students;
        if (studentId) filteredStudents = students.filter(s => s.id === studentId);
        else if (sectionId) filteredStudents = students.filter(s => s.sectionId === sectionId);

        if (filteredStudents.length === 0) {
            container.innerHTML = SGEComponents.emptyState('Nenhum aluno encontrado.');
            return;
        }

        const activeYear = years[0];
        const isAnnual = termId === 'annual';
        const term = terms.find(t => t.id === termId);
        const termName = isAnnual ? 'Anual' : (term?.name || '---');

        // Configuração de boletins por página
        const perPage = parseInt(await SGEDb.getConfig('report_cards_per_page') || '4');

        let html = '<div id="rc-print-area" class="print-report-cards">';

        for (let i = 0; i < filteredStudents.length; i++) {
            const student = filteredStudents[i];
            const sec = section || sections.find(s => s.id === student.sectionId) || await SGEDb.get('sections', student.sectionId);
            const cls = sec ? classes.find(c => c.id === sec.classId) : null;
            const level = cls ? SGEUtils.getEducationLevel(cls.number) : 'ciclo1';
            const scale = SGEUtils.getGradeScale(level);
            const genderArticle = SGEUtils.genderText(student.gender, 'o aluno', 'a aluna');

            const sGrades = computedGrades.filter(g => g.studentId === student.id &&
                (isAnnual || g.termId === termId));
            const sBehavior = behaviorGrades.find(g => g.studentId === student.id &&
                (isAnnual || g.termId === termId));

            const subjectIds = [...new Set(sGrades.map(g => g.subjectId))];
            const studentSubjects = subjectIds.map(sid => subjects.find(s => s.id === sid)).filter(Boolean);

            // Quebra de página a cada N boletins
            if (i > 0 && i % perPage === 0) {
                html += `<div class="page-break-before"></div>`;
            }

            html += `
                <div class="print-report-card-item no-page-break border-2 border-gray-800 rounded p-3 mb-2" style="font-size:8pt">
                    <!-- Cabeçalho -->
                    <div class="text-center border-b border-gray-400 pb-1 mb-2">
                        <p class="font-bold text-[9pt]">${_esc(school?.name || 'SGE-NG')}</p>
                        <p class="text-[7pt]">BOLETIM DE NOTAS - ${termName.toUpperCase()}</p>
                        <p class="text-[7pt]">Ano Letivo: ${_esc(activeYear?.year || '---')}</p>
                    </div>

                    <!-- Dados do Aluno -->
                    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2 text-[7pt]">
                        <p><strong>Nome:</strong> ${_esc(student.name)}</p>
                        <p><strong>Nº:</strong> ${_esc(student.enrollmentNumber || '---')}</p>
                        <p><strong>Classe:</strong> ${_esc(cls?.name || '---')}</p>
                        <p><strong>Turma:</strong> ${_esc(sec?.name || '---')}</p>
                    </div>

                    <!-- Tabela de Notas -->
                    <table class="w-full border-collapse text-[7pt]" style="font-size:7pt">
                        <thead>
                            <tr class="bg-gray-200">
                                <th class="border border-gray-400 px-1 py-0.5 text-left">Disciplina</th>
                                <th class="border border-gray-400 px-1 py-0.5 text-center w-10">MAC</th>
                                <th class="border border-gray-400 px-1 py-0.5 text-center w-10">MFD</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const sub of studentSubjects) {
                const subGrade = sGrades.find(g => g.subjectId === sub.id);
                const mac = subGrade?.mac;
                const mfd = subGrade?.mfd;
                const color = mfd != null ? (mfd >= (scale.max === 10 ? 5 : 10) ? 'color:green' : 'color:red') : '';

                html += `<tr>
                    <td class="border border-gray-300 px-1 py-0.5">${_esc(sub.name)}</td>
                    <td class="border border-gray-300 px-1 py-0.5 text-center" style="${color}">${mac != null ? mac.toFixed(1) : '---'}</td>
                    <td class="border border-gray-300 px-1 py-0.5 text-center font-bold" style="${color}">${mfd != null ? mfd.toFixed(1) : '---'}</td>
                </tr>`;
            }

            // Comportamento
            const behValue = sBehavior?.value;
            html += `<tr>
                <td class="border border-gray-300 px-1 py-0.5 font-medium">Comportamento</td>
                <td class="border border-gray-300 px-1 py-0.5 text-center" colspan="2">
                    ${behValue != null ? `${behValue}/20 (${SGEUtils.behaviorToQualitative(behValue)})` : '---'}
                </td>
            </tr>`;

            html += `</tbody></table>`;

            // Resultado Final
            const allMFDs = sGrades.map(g => g.mfd).filter(v => v != null);
            const avgMFD = allMFDs.length ? (allMFDs.reduce((a, b) => a + b, 0) / allMFDs.length) : null;
            const passed = avgMFD != null && avgMFD >= (scale.max === 10 ? 5 : 10);
            const resultText = avgMFD != null
                ? (passed ? SGEUtils.genderText(student.gender, 'APROVADO', 'APROVADA') : 'REPROVADO')
                : '---';
            const resultColor = avgMFD != null ? (passed ? 'green' : 'red') : 'gray';

            html += `
                    <div class="mt-2 text-center font-bold text-[8pt]" style="color:${resultColor}">
                        Resultado: ${resultText}
                    </div>

                    <!-- Assinaturas -->
                    <div class="grid grid-cols-3 gap-2 mt-3 text-center text-[6pt]">
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Coordenador de Turma</p>
                        </div>
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Subdiretor Pedagógico</p>
                        </div>
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Diretor da Escola</p>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function printAll() {
        const area = document.getElementById('rc-print-area');
        if (!area) return SGENotifications.warning('Gere os boletins primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, generate, printAll };
})();
window.SGEReportCards = SGEReportCards;// ============================================
// SGE-NG - BOLETINS DE NOTAS
// Emissão de cadernetas individuais
// Layout: 4 boletins por folha A4 (configurável)
// ============================================

const SGEReportCards = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [years, terms, sections, classes, students, school] = await Promise.all([
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.get('schools', schoolId)
        ]);

        const activeYear = years[0];
        if (!activeYear) return SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');

        const yearTerms = terms.filter(t => t.schoolYearId === activeYear.id);
        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name}` };
        });

        let html = SGEComponents.pageHeader('Boletins de Notas', 'Cadernetas individuais de aproveitamento');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                        <select id="rc-section" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Todas --</option>
                            ${sectionOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Trimestre</label>
                        <select id="rc-term" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            ${yearTerms.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                            <option value="annual">Anual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Aluno (opcional)</label>
                        <select id="rc-student" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Toda a Turma --</option>
                            ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGEReportCards.generate()">Gerar</button>
                        <button class="btn btn-success flex-1" onclick="SGEReportCards.printAll()">🖨️ Imprimir</button>
                    </div>
                </div>
            </div>
            <div id="rc-result"></div>
        `;

        return html;
    }

    async function generate() {
        const sectionId = document.getElementById('rc-section')?.value;
        const termId = document.getElementById('rc-term')?.value;
        const studentId = document.getElementById('rc-student')?.value;
        const container = document.getElementById('rc-result');
        if (!container) return;

        container.innerHTML = SGEComponents.loadingSpinner('A gerar boletins...');

        const schoolId = SGEAuth.getUserSchoolId();
        const [school, students, subjects, computedGrades, behaviorGrades, section, classes, terms, years, coordinations] = await Promise.all([
            SGEDb.get('schools', schoolId),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('computed_grades', { schoolId }),
            SGEDb.query('behavior_grades', { schoolId }),
            sectionId ? SGEDb.get('sections', sectionId) : null,
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('terms', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('coordinations', { schoolId })
        ]);

        let filteredStudents = students;
        if (studentId) filteredStudents = students.filter(s => s.id === studentId);
        else if (sectionId) filteredStudents = students.filter(s => s.sectionId === sectionId);

        if (filteredStudents.length === 0) {
            container.innerHTML = SGEComponents.emptyState('Nenhum aluno encontrado.');
            return;
        }

        const activeYear = years[0];
        const isAnnual = termId === 'annual';
        const term = terms.find(t => t.id === termId);
        const termName = isAnnual ? 'Anual' : (term?.name || '---');

        // Configuração de boletins por página
        const perPage = parseInt(await SGEDb.getConfig('report_cards_per_page') || '4');

        let html = '<div id="rc-print-area" class="print-report-cards">';

        for (let i = 0; i < filteredStudents.length; i++) {
            const student = filteredStudents[i];
            const sec = section || sections.find(s => s.id === student.sectionId) || await SGEDb.get('sections', student.sectionId);
            const cls = sec ? classes.find(c => c.id === sec.classId) : null;
            const level = cls ? SGEUtils.getEducationLevel(cls.number) : 'ciclo1';
            const scale = SGEUtils.getGradeScale(level);
            const genderArticle = SGEUtils.genderText(student.gender, 'o aluno', 'a aluna');

            const sGrades = computedGrades.filter(g => g.studentId === student.id &&
                (isAnnual || g.termId === termId));
            const sBehavior = behaviorGrades.find(g => g.studentId === student.id &&
                (isAnnual || g.termId === termId));

            const subjectIds = [...new Set(sGrades.map(g => g.subjectId))];
            const studentSubjects = subjectIds.map(sid => subjects.find(s => s.id === sid)).filter(Boolean);

            // Quebra de página a cada N boletins
            if (i > 0 && i % perPage === 0) {
                html += `<div class="page-break-before"></div>`;
            }

            html += `
                <div class="print-report-card-item no-page-break border-2 border-gray-800 rounded p-3 mb-2" style="font-size:8pt">
                    <!-- Cabeçalho -->
                    <div class="text-center border-b border-gray-400 pb-1 mb-2">
                        <p class="font-bold text-[9pt]">${_esc(school?.name || 'SGE-NG')}</p>
                        <p class="text-[7pt]">BOLETIM DE NOTAS - ${termName.toUpperCase()}</p>
                        <p class="text-[7pt]">Ano Letivo: ${_esc(activeYear?.year || '---')}</p>
                    </div>

                    <!-- Dados do Aluno -->
                    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2 text-[7pt]">
                        <p><strong>Nome:</strong> ${_esc(student.name)}</p>
                        <p><strong>Nº:</strong> ${_esc(student.enrollmentNumber || '---')}</p>
                        <p><strong>Classe:</strong> ${_esc(cls?.name || '---')}</p>
                        <p><strong>Turma:</strong> ${_esc(sec?.name || '---')}</p>
                    </div>

                    <!-- Tabela de Notas -->
                    <table class="w-full border-collapse text-[7pt]" style="font-size:7pt">
                        <thead>
                            <tr class="bg-gray-200">
                                <th class="border border-gray-400 px-1 py-0.5 text-left">Disciplina</th>
                                <th class="border border-gray-400 px-1 py-0.5 text-center w-10">MAC</th>
                                <th class="border border-gray-400 px-1 py-0.5 text-center w-10">MFD</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const sub of studentSubjects) {
                const subGrade = sGrades.find(g => g.subjectId === sub.id);
                const mac = subGrade?.mac;
                const mfd = subGrade?.mfd;
                const color = mfd != null ? (mfd >= (scale.max === 10 ? 5 : 10) ? 'color:green' : 'color:red') : '';

                html += `<tr>
                    <td class="border border-gray-300 px-1 py-0.5">${_esc(sub.name)}</td>
                    <td class="border border-gray-300 px-1 py-0.5 text-center" style="${color}">${mac != null ? mac.toFixed(1) : '---'}</td>
                    <td class="border border-gray-300 px-1 py-0.5 text-center font-bold" style="${color}">${mfd != null ? mfd.toFixed(1) : '---'}</td>
                </tr>`;
            }

            // Comportamento
            const behValue = sBehavior?.value;
            html += `<tr>
                <td class="border border-gray-300 px-1 py-0.5 font-medium">Comportamento</td>
                <td class="border border-gray-300 px-1 py-0.5 text-center" colspan="2">
                    ${behValue != null ? `${behValue}/20 (${SGEUtils.behaviorToQualitative(behValue)})` : '---'}
                </td>
            </tr>`;

            html += `</tbody></table>`;

            // Resultado Final
            const allMFDs = sGrades.map(g => g.mfd).filter(v => v != null);
            const avgMFD = allMFDs.length ? (allMFDs.reduce((a, b) => a + b, 0) / allMFDs.length) : null;
            const passed = avgMFD != null && avgMFD >= (scale.max === 10 ? 5 : 10);
            const resultText = avgMFD != null
                ? (passed ? SGEUtils.genderText(student.gender, 'APROVADO', 'APROVADA') : 'REPROVADO')
                : '---';
            const resultColor = avgMFD != null ? (passed ? 'green' : 'red') : 'gray';

            html += `
                    <div class="mt-2 text-center font-bold text-[8pt]" style="color:${resultColor}">
                        Resultado: ${resultText}
                    </div>

                    <!-- Assinaturas -->
                    <div class="grid grid-cols-3 gap-2 mt-3 text-center text-[6pt]">
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Coordenador de Turma</p>
                        </div>
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Subdiretor Pedagógico</p>
                        </div>
                        <div>
                            <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px"></div>
                            <p class="font-bold">Diretor da Escola</p>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function printAll() {
        const area = document.getElementById('rc-print-area');
        if (!area) return SGENotifications.warning('Gere os boletins primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, generate, printAll };
})();
window.SGEReportCards = SGEReportCards;