// ============================================
// SGE-NG - DECLARAÇÕES
// Emissão de declarações com ou sem notas
// (Frequência, Conclusão, Matrícula, etc.)
// ============================================

const SGEDeclarations = (() => {
    'use strict';

    const DECLARATION_TYPES = [
        { value: 'frequency', label: 'Declaração de Frequência' },
        { value: 'enrollment', label: 'Declaração de Matrícula' },
        { value: 'completion', label: 'Declaração de Conclusão' },
        { value: 'grades', label: 'Declaração de Notas' },
        { value: 'transfer', label: 'Declaração de Transferência' },
        { value: 'custom', label: 'Declaração Personalizada' }
    ];

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const students = await SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] });

        let html = SGEComponents.pageHeader('Declarações', 'Emissão de declarações escolares');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Declaração</label>
                        <select id="dec-type" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGEDeclarations.onTypeChange()">
                            ${DECLARATION_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
                        <select id="dec-student" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Selecionar --</option>
                            ${students.map(s => `<option value="${s.id}">${s.name} (${s.enrollmentNumber || ''})</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGEDeclarations.generate()">Gerar</button>
                        <button class="btn btn-success flex-1" onclick="SGEDeclarations.printDec()">🖨️ Imprimir</button>
                    </div>
                </div>
                <div id="dec-custom-body" class="hidden mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Corpo da Declaração</label>
                    <textarea id="dec-body-text" rows="6" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                        placeholder="Escreva o texto da declaração..."></textarea>
                </div>
            </div>
            <div id="dec-result"></div>
        `;

        return html;
    }

    function onTypeChange() {
        const type = document.getElementById('dec-type')?.value;
        const customDiv = document.getElementById('dec-custom-body');
        if (customDiv) {
            customDiv.classList.toggle('hidden', type !== 'custom');
        }
    }

    async function generate() {
        const type = document.getElementById('dec-type')?.value;
        const studentId = document.getElementById('dec-student')?.value;
        const container = document.getElementById('dec-result');
        if (!studentId || !container) return SGENotifications.warning('Selecione um aluno.');

        container.innerHTML = SGEComponents.loadingSpinner();

        const schoolId = SGEAuth.getUserSchoolId();
        const [student, school, section, classes, years, computedGrades, subjects] = await Promise.all([
            SGEDb.getDecrypted('students', studentId),
            SGEDb.get('schools', schoolId),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('computed_grades', { studentId }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] })
        ]);

        if (!student) { container.innerHTML = SGEComponents.alert('Aluno não encontrado.', 'error'); return; }

        const sec = section.find(s => s.id === student.sectionId);
        const cls = sec ? classes.find(c => c.id === sec.classId) : null;
        const activeYear = years[0];
        const today = SGEUtils.formatDateExtended(new Date());

        const gMasc = student.gender !== 'F';
        const artigo = gMasc ? 'o' : 'a';
        const aluno = gMasc ? 'aluno' : 'aluna';
        const matriculado = gMasc ? 'matriculado' : 'matriculada';
        const frequentando = gMasc ? 'frequentando' : 'frequentando';

        let body = '';

        switch (type) {
            case 'frequency':
                body = `Declaro, para os devidos efeitos, que ${artigo} ${aluno} <strong>${_esc(student.name)}</strong>, portador${gMasc ? '' : 'a'} do BI/Cédula nº <strong>${_esc(student.documentNumber || '---')}</strong>, encontra-se ${frequentando} a <strong>${_esc(cls?.name || '---')}</strong>, Turma <strong>${_esc(sec?.name || '---')}</strong>, nesta instituição de ensino, no ano letivo <strong>${_esc(activeYear?.year || '---')}</strong>.`;
                break;

            case 'enrollment':
                body = `Declaro, para os devidos efeitos, que ${artigo} ${aluno} <strong>${_esc(student.name)}</strong>, com o nº de matrícula <strong>${_esc(student.enrollmentNumber || '---')}</strong> e nº de processo <strong>${_esc(student.processNumber || '---')}</strong>, está ${matriculado}${gMasc ? '' : 'a'} na <strong>${_esc(cls?.name || '---')}</strong>, Turma <strong>${_esc(sec?.name || '---')}</strong>, Turno <strong>---</strong>, no ano letivo <strong>${_esc(activeYear?.year || '---')}</strong>.`;
                break;

            case 'completion':
                body = `Declaro, para os devidos efeitos, que ${artigo} ${aluno} <strong>${_esc(student.name)}</strong>, concluiu com aproveitamento a <strong>${_esc(cls?.name || '---')}</strong> no ano letivo <strong>${_esc(activeYear?.year || '---')}</strong>, tendo obtido as classificações constantes no histórico escolar anexo.`;
                break;

            case 'grades':
                body = `Declaro, para os devidos efeitos, que ${artigo} ${aluno} <strong>${_esc(student.name)}</strong>, ${matriculado}${gMasc ? '' : 'a'} na <strong>${_esc(cls?.name || '---')}</strong>, obteve as seguintes classificações no ano letivo <strong>${_esc(activeYear?.year || '---')}</strong>:`;
                break;

            case 'transfer':
                body = `Declaro, para os devidos efeitos, que ${artigo} ${aluno} <strong>${_esc(student.name)}</strong>, com o nº de matrícula <strong>${_esc(student.enrollmentNumber || '---')}</strong>, esteve ${matriculado}${gMasc ? '' : 'a'} nesta instituição na <strong>${_esc(cls?.name || '---')}</strong> durante o ano letivo <strong>${_esc(activeYear?.year || '---')}</strong>, tendo sido transferido${gMasc ? '' : 'a'} a pedido do encarregado de educação.`;
                break;

            case 'custom':
                body = document.getElementById('dec-body-text')?.value || '';
                break;
        }

        // Notas (para declaração de notas)
        let gradesTable = '';
        if (type === 'grades' && computedGrades.length > 0) {
            const subjectIds = [...new Set(computedGrades.map(g => g.subjectId))];
            gradesTable = `<table class="w-full border-collapse mt-4 text-sm">
                <thead><tr class="bg-gray-100">
                    <th class="border border-gray-400 px-2 py-1 text-left">Disciplina</th>
                    <th class="border border-gray-400 px-2 py-1 text-center">Classificação</th>
                </tr></thead><tbody>`;
            for (const sid of subjectIds) {
                const sub = subjects.find(s => s.id === sid);
                const sg = computedGrades.filter(g => g.subjectId === sid);
                const mfd = sg.length ? (sg.reduce((a, g) => a + (g.mfd || 0), 0) / sg.length) : null;
                gradesTable += `<tr>
                    <td class="border border-gray-300 px-2 py-1">${_esc(sub?.name || '---')}</td>
                    <td class="border border-gray-300 px-2 py-1 text-center font-bold">${mfd != null ? mfd.toFixed(1) + ' valores' : '---'}</td>
                </tr>`;
            }
            gradesTable += `</tbody></table>`;
        }

        const decTypeLabel = DECLARATION_TYPES.find(t => t.value === type)?.label || 'Declaração';

        let html = `
            <div id="dec-print-area" class="sge-card max-w-2xl mx-auto" style="min-height:600px">
                <!-- Cabeçalho -->
                <div class="text-center mb-8">
                    ${school?.logo ? `<img src="${school.logo}" class="w-16 h-16 mx-auto mb-2">` : ''}
                    <h2 class="text-xl font-bold">${_esc(school?.name || 'SGE-NG')}</h2>
                    <p class="text-sm text-gray-600">${_esc(school?.address || '')}</p>
                    <p class="text-sm text-gray-500">Tel: ${_esc(school?.phone || '---')} · Email: ${_esc(school?.email || '---')}</p>
                    ${school?.nif ? `<p class="text-xs text-gray-400">NIF: ${_esc(school.nif)}</p>` : ''}
                </div>

                <h3 class="text-center text-lg font-bold mb-6 underline">${decTypeLabel.toUpperCase()}</h3>

                <div class="text-sm leading-relaxed text-justify mb-6">
                    ${body}
                </div>

                ${gradesTable}

                <p class="text-sm mt-8 text-right">
                    ${_esc(school?.municipality || 'Luanda')}, ${today}
                </p>

                <!-- Assinatura -->
                <div class="mt-16 text-center">
                    <div style="border-top:1px solid #000; width:200px; margin:0 auto 4px"></div>
                    <p class="text-sm font-bold">${_esc(school?.director || 'O Diretor da Escola')}</p>
                    <p class="text-xs text-gray-500">Diretor da Escola</p>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function printDec() {
        const area = document.getElementById('dec-print-area');
        if (!area) return SGENotifications.warning('Gere a declaração primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, onTypeChange, generate, printDec };
})();
window.SGEDeclarations = SGEDeclarations;