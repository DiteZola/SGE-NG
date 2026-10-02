// ============================================
// SGE-NG - PASSES ESCOLARES
// Cartões de identificação para alunos e funcionários
// Layout: 8 passes por folha A4 (configurável)
// Cores configuráveis pelo Diretor
// ============================================

const SGEPasses = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [students, staff, sections, classes] = await Promise.all([
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('staff', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId })
        ]);

        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name}` };
        });

        const savedColor = (await SGEDb.getConfig('pass_color')) || '#2563EB';

        let html = SGEComponents.pageHeader('Passes Escolares', 'Cartões de identificação');

        html += `
            <div class="sge-card mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                        <select id="pass-type" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGEPasses.onTypeChange()">
                            <option value="students">Alunos</option>
                            <option value="staff">Funcionários</option>
                        </select>
                    </div>
                    <div id="pass-section-div">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                        <select id="pass-section" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="">-- Todas --</option>
                            ${sectionOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Cor do Passe</label>
                        <input type="color" id="pass-color" value="${savedColor}"
                            class="w-full h-10 border-2 border-gray-300 rounded-lg cursor-pointer">
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGEPasses.generate()">Gerar</button>
                        <button class="btn btn-success flex-1" onclick="SGEPasses.printPasses()">🖨️ Imprimir</button>
                    </div>
                </div>
            </div>
            <div id="pass-result"></div>
        `;

        return html;
    }

    function onTypeChange() {
        const type = document.getElementById('pass-type')?.value;
        const sectionDiv = document.getElementById('pass-section-div');
        if (sectionDiv) sectionDiv.style.display = type === 'students' ? '' : 'none';
    }

    async function generate() {
        const type = document.getElementById('pass-type')?.value;
        const sectionId = document.getElementById('pass-section')?.value;
        const color = document.getElementById('pass-color')?.value || '#2563EB';
        const container = document.getElementById('pass-result');
        if (!container) return;

        await SGEDb.setConfig('pass_color', color);

        container.innerHTML = SGEComponents.loadingSpinner('A gerar passes...');

        const schoolId = SGEAuth.getUserSchoolId();
        const [school, students, staff, sections, classes, years] = await Promise.all([
            SGEDb.get('schools', schoolId),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        let people = [];

        if (type === 'students') {
            people = sectionId ? students.filter(s => s.sectionId === sectionId) : students;
            people = people.map(s => {
                const sec = sections.find(se => se.id === s.sectionId);
                const cls = sec ? classes.find(c => c.id === sec.classId) : null;
                return {
                    name: s.name, photo: s.photo,
                    number: s.enrollmentNumber || '---',
                    role: `${cls?.name || ''} ${sec?.name || ''}`.trim(),
                    type: 'Aluno'
                };
            });
        } else {
            people = staff.map(s => ({
                name: s.name || s.fullName, photo: s.photo,
                number: s.id.substring(0, 8).toUpperCase(),
                role: s.staffType || 'Funcionário',
                type: 'Funcionário'
            }));
        }

        if (people.length === 0) {
            container.innerHTML = SGEComponents.emptyState('Nenhuma pessoa encontrada.');
            return;
        }

        const perPage = parseInt(await SGEDb.getConfig('passes_per_page') || '8');
        const activeYear = years[0];
        const darkColor = color;

        let html = `<div id="pass-print-area" class="print-passes">`;

        for (let i = 0; i < people.length; i++) {
            const p = people[i];

            if (i > 0 && i % perPage === 0) {
                html += `<div class="page-break-before"></div>`;
            }

            html += `
                <div class="print-pass-item no-page-break border-2 rounded-lg overflow-hidden" style="border-color:${darkColor}">
                    <div class="w-2 flex-shrink-0" style="background-color:${darkColor}"></div>

                    <div class="flex-shrink-0 w-16 h-20 bg-gray-200 flex items-center justify-center overflow-hidden">
                        ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` :
                        `<div class="text-2xl font-bold text-gray-400">${SGEUtils.getInitials(p.name)}</div>`}
                    </div>

                    <div class="flex-1 px-2 py-1 min-w-0">
                        <p class="font-bold text-[8pt] truncate" style="color:${darkColor}">${_esc(school?.name || 'SGE-NG')}</p>
                        <p class="text-[7pt] text-gray-500">${p.type} · Ano ${_esc(activeYear?.year || '---')}</p>
                        <p class="font-bold text-[9pt] mt-1 truncate">${_esc(p.name)}</p>
                        <p class="text-[7pt] text-gray-600">${_esc(p.role)}</p>
                        <p class="text-[7pt] font-mono text-gray-500">Nº: ${_esc(p.number)}</p>
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        html += `
            <div class="mt-4 sge-card">
                <p class="text-sm text-gray-600">
                    ✅ ${people.length} passe(s) gerado(s) · ${perPage} por página ·
                    ${Math.ceil(people.length / perPage)} folha(s) A4
                </p>
            </div>
        `;

        container.innerHTML = html;
    }

    function printPasses() {
        const area = document.getElementById('pass-print-area');
        if (!area) return SGENotifications.warning('Gere os passes primeiro.');
        window.print();
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, onTypeChange, generate, printPasses };
})();
window.SGEPasses = SGEPasses;