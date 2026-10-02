// ============================================
// SGE-NG - CERTIFICADOS E DIPLOMAS
// Emissão para classes finais (6ª, 9ª, 12ª, 13ª)
// Conforme critérios do MED Angola
// ============================================

const SGECertificates = (() => {
    'use strict';

    const CERT_TYPES = [
        { value: 'primary', label: 'Certificado do Ensino Primário (6ª Classe)', classNum: 6 },
        { value: 'cycle1', label: 'Certificado do Iº Ciclo (9ª Classe)', classNum: 9 },
        { value: 'cycle2', label: 'Diploma do IIº Ciclo (12ª Classe)', classNum: 12 },
        { value: 'cycle2_13', label: 'Diploma do IIº Ciclo (13ª Classe)', classNum: 13 }
    ];

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const students = await SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] });

        let html = SGEComponents.pageHeader('Certificados e Diplomas', 'Emissão para classes finais');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Certificado</label>
                        <select id="cert-type" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            ${CERT_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
                        <select id="cert-student" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Selecionar --</option>
                            ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGECertificates.generate()">Gerar</button>
                        <button class="btn btn-success flex-1" onclick="SGECertificates.printCert()">🖨️ Imprimir</button>
                    </div>
                </div>
            </div>
            <div id="cert-result"></div>
        `;

        return html;
    }

    async function generate() {
        const certType = document.getElementById('cert-type')?.value;
        const studentId = document.getElementById('cert-student')?.value;
        const container = document.getElementById('cert-result');
        if (!studentId || !container) return SGENotifications.warning('Selecione um aluno.');

        container.innerHTML = SGEComponents.loadingSpinner();

        const schoolId = SGEAuth.getUserSchoolId();
        const [student, school, section, classes, computedGrades, subjects, history, years] = await Promise.all([
            SGEDb.getDecrypted('students', studentId),
            SGEDb.get('schools', schoolId),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('computed_grades', { studentId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('student_history', { studentId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        if (!student) { container.innerHTML = SGEComponents.alert('Aluno não encontrado.', 'error'); return; }

        const certInfo = CERT_TYPES.find(t => t.value === certType);
        const sec = section.find(s => s.id === student.sectionId);
        const cls = sec ? classes.find(c => c.id === sec.classId) : null;
        const gMasc = student.gender !== 'F';

        const aprovado = gMasc ? 'APROVADO' : 'APROVADA';
        const concluiu = gMasc ? 'concluiu' : 'concluiu';
        const habilitado = gMasc ? 'habilitado' : 'habilitada';

        // Verificar se tem notas suficientes
        const allGrades = [...computedGrades, ...history];
        if (allGrades.length === 0) {
            container.innerHTML = SGEComponents.alert(
                `${gMasc ? 'O Aluno' : 'A Aluna'} não tem notas registadas. Insira o histórico escolar antes de emitir o certificado.`,
                'warning'
            );
            return;
        }

        const subjectIds = [...new Set(computedGrades.map(g => g.subjectId))];
        const studentSubjects = subjectIds.map(sid => subjects.find(s => s.id === sid)).filter(Boolean);

        const today = SGEUtils.formatDateExtended(new Date());
        const certNumber = `CERT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

        let html = `
            <div id="cert-print-area" class="print-certificate mx-auto bg-white p-8" style="max-width:210mm; min-height:297mm; font-family:'Times New Roman',serif">
                <div class="print-certificate-border border-4 double border-blue-900 p-8 min-h-[250mm] flex flex-col">

                    <!-- Cabeçalho -->
                    <div class="text-center mb-6">
                        <p class="text-sm text-gray-600">REPÚBLICA DE ANGOLA</p>
                        <p class="text-sm text-gray-600">MINISTÉRIO DA EDUCAÇÃO</p>
                        ${school?.logo ? `<img src="${school.logo}" class="w-20 h-20 mx-auto my-3">` : '<div class="h-16"></div>'}
                        <h2 class="text-2xl font-bold text-blue-900">${_esc(school?.name || '---')}</h2>
                        <p class="text-sm">${_esc(school?.address || '')}</p>
                        ${school?.decree ? `<p class="text-xs text-gray-500">${_esc(school.decree)}</p>` : ''}
                    </div>

                    <!-- Título -->
                    <div class="text-center my-8">
                        <h1 class="text-3xl font-bold text-blue-900 tracking-wider">
                            ${certInfo?.classNum <= 9 ? 'CERTIFICADO' : 'DIPLOMA'}
                        </h1>
                        <p class="text-sm text-gray-600 mt-1">Nº ${certNumber}</p>
                    </div>

                    <!-- Corpo -->
                    <div class="text-center text-lg leading-relaxed flex-1">
                        <p class="mb-4">
                            Certifico que <strong>${_esc(student.name)}</strong>,
                            ${gMasc ? 'filho' : 'filha'} de <strong>${_esc(student.guardianName || '---')}</strong>,
                            natural de <strong>${_esc(student.naturalidade || '---')}</strong>,
                            nascido${gMasc ? '' : 'a'} a <strong>${student.birthDate ? SGEUtils.formatDate(student.birthDate) : '---'}</strong>,
                        </p>
                        <p class="mb-4">
                            ${concluiu} com aproveitamento a <strong>${_esc(certInfo?.label || cls?.name || '---')}</strong>
                            do <strong>${certInfo?.classNum <= 6 ? 'Ensino Primário' : certInfo?.classNum <= 9 ? 'Iº Ciclo do Ensino Secundário' : 'IIº Ciclo do Ensino Secundário'}</strong>,
                            no ano letivo de <strong>${_esc((years[0]?.year) || '---')}</strong>,
                        </p>
                        <p class="mb-4">
                            tendo obtido as seguintes classificações:
                        </p>

                        <!-- Tabela de Notas -->
                        <table class="w-3/4 mx-auto border-collapse text-sm mb-6">
                            <thead>
                                <tr class="bg-blue-50">
                                    <th class="border-2 border-blue-900 px-3 py-1 text-left">Disciplina</th>
                                    <th class="border-2 border-blue-900 px-3 py-1 text-center">Classificação</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${studentSubjects.map(sub => {
                                    const sg = computedGrades.filter(g => g.subjectId === sub.id);
                                    const mfd = sg.length ? (sg.reduce((a, g) => a + (g.mfd || 0), 0) / sg.length) : null;
                                    return `<tr>
                                        <td class="border border-blue-300 px-3 py-1">${_esc(sub.name)}</td>
                                        <td class="border border-blue-300 px-3 py-1 text-center font-bold">${mfd != null ? mfd.toFixed(1) + ' val.' : '---'}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>

                        <p class="font-bold text-lg text-blue-900">
                            Pelo que é ${habilitado}${gMasc ? '' : 'a'} com o presente
                            ${certInfo?.classNum <= 9 ? 'Certificado' : 'Diploma'}.
                        </p>
                    </div>

                    <!-- Data e Assinaturas -->
                    <div class="mt-8">
                        <p class="text-right text-sm mb-8">
                            ${_esc(school?.municipality || 'Luanda')}, ${today}
                        </p>

                        <div class="grid grid-cols-3 gap-8 text-center text-sm">
                            <div>
                                <div style="border-top:1px solid #000; width:100%; margin-bottom:4px"></div>
                                <p class="font-bold">O Diretor da Escola</p>
                                <p class="text-xs text-gray-500">${_esc(school?.director || '---')}</p>
                            </div>
                            <div>
                                <div style="border-top:1px solid #000; width:100%; margin-bottom:4px"></div>
                                <p class="font-bold">O Subdiretor Pedagógico</p>
                                <p class="text-xs text-gray-500">${_esc(school?.subdirector || '---')}</p>
                            </div>
                            <div>
                                <div style="border-top:1px solid #000; width:100%; margin-bottom:4px"></div>
                                <p class="font-bold">O Secretário</p>
                                <p class="text-xs text-gray-500">_______________</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function printCert() {
        const area = document.getElementById('cert-print-area');
        if (!area) return SGENotifications.warning('Gere o certificado primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, generate, printCert };
})();
window.SGECertificates = SGECertificates;