// ============================================
// SGE-NG - PRESENÇAS E FALTAS
// Controlo de assiduidade de alunos e funcionários
// ============================================

const SGEAttendance = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const schoolId = user?.schoolId;
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [years, sections, classes, shifts] = await Promise.all([
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId })
        ]);

        const activeYear = years[0];
        const today = new Date().toISOString().split('T')[0];

        let html = SGEComponents.pageHeader('Presenças', 'Controlo diário de assiduidade', [
            { label: '↓ Relatório', type: 'success', onClick: 'SGEAttendance.exportReport()' }
        ]);

        const isDirector = ['admin_geral', 'director', 'subdirector'].includes(user.role);

        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return { value: s.id, label: `${cls?.name || ''} ${s.name} (${shift?.name || ''})` };
        });

        // Tab Alunos
        let tabAlunos = `
            <div class="sge-card mb-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                        <select id="att-section" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                            onchange="SGEAttendance.loadAttendance()">
                            <option value="">-- Selecionar --</option>
                            ${sectionOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                        <input type="date" id="att-date" value="${today}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                            onchange="SGEAttendance.loadAttendance()">
                    </div>
                    <div class="flex items-end gap-2">
                        <button class="btn btn-primary flex-1" onclick="SGEAttendance.loadAttendance()">Carregar</button>
                        <button class="btn btn-success flex-1" onclick="SGEAttendance.saveAttendance()">💾 Guardar</button>
                    </div>
                </div>
            </div>
            <div id="attendance-list">${SGEComponents.emptyState('Selecione uma turma e data.')}</div>
        `;

        // Tab Funcionários (só direção)
        let tabFunc = '';
        if (isDirector) {
            tabFunc = `
                <div class="sge-card mb-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                            <input type="date" id="att-staff-date" value="${today}"
                                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                        </div>
                        <div class="flex items-end">
                            <button class="btn btn-primary" onclick="SGEAttendance.loadStaffAttendance()">Carregar</button>
                        </div>
                    </div>
                </div>
                <div id="staff-attendance-list"></div>
            `;
        }

        const tabs = [{ id: 'students', label: 'Alunos', content: tabAlunos }];
        if (isDirector) tabs.push({ id: 'staff', label: 'Funcionários', content: tabFunc });

        html += SGEComponents.renderTabs(tabs);
        return html;
    }

    async function loadAttendance() {
        const sectionId = document.getElementById('att-section')?.value;
        const date = document.getElementById('att-date')?.value;
        const container = document.getElementById('attendance-list');

        if (!sectionId || !date || !container) return;

        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { schoolId, sectionId, status: 'active' }, { orderBy: ['name', 'asc'] });

        if (students.length === 0) {
            container.innerHTML = SGEComponents.emptyState('Nenhum aluno nesta turma.');
            return;
        }

        const attendances = await SGEDb.query('attendance_students', { sectionId, date });
        const attMap = {};
        attendances.forEach(a => { attMap[a.studentId] = a; });

        let html = `<div class="sge-card"><table class="sge-table">
            <thead><tr>
                <th>Nº</th><th>Aluno</th>
                <th class="text-center">Presente</th>
                <th class="text-center">Falta</th>
                <th class="text-center">Falta Just.</th>
                <th class="text-center">Atraso</th>
            </tr></thead><tbody>`;

        students.forEach((s, idx) => {
            const att = attMap[s.id];
            const status = att?.status || 'present';

            html += `<tr>
                <td>${idx + 1}</td>
                <td class="font-medium">${_esc(s.name)}</td>
                <td class="text-center">
                    <input type="radio" name="att-${s.id}" value="present" ${status === 'present' ? 'checked' : ''}
                        class="w-4 h-4 text-success-600">
                </td>
                <td class="text-center">
                    <input type="radio" name="att-${s.id}" value="absent" ${status === 'absent' ? 'checked' : ''}
                        class="w-4 h-4 text-danger-600">
                </td>
                <td class="text-center">
                    <input type="radio" name="att-${s.id}" value="justified" ${status === 'justified' ? 'checked' : ''}
                        class="w-4 h-4 text-yellow-600">
                </td>
                <td class="text-center">
                    <input type="radio" name="att-${s.id}" value="late" ${status === 'late' ? 'checked' : ''}
                        class="w-4 h-4 text-primary-600">
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    async function saveAttendance() {
        const sectionId = document.getElementById('att-section')?.value;
        const date = document.getElementById('att-date')?.value;
        if (!sectionId || !date) return SGENotifications.warning('Selecione turma e data.');

        const schoolId = SGEAuth.getUserSchoolId();
        const years = await SGEDb.query('school_years', { schoolId, status: 'active' });
        const students = await SGEDb.query('students', { schoolId, sectionId, status: 'active' });
        let saved = 0;

        for (const student of students) {
            const radios = document.querySelectorAll(`input[name="att-${student.id}"]`);
            let status = 'present';
            radios.forEach(r => { if (r.checked) status = r.value; });

            const existing = await SGEDb.query('attendance_students', { studentId: student.id, sectionId, date });
            const attData = {
                studentId: student.id, sectionId, date,
                schoolYearId: years[0]?.id,
                status,
                markedBy: SGEAuth.getUserId(),
                createdAt: SGEUtils.nowISO()
            };

            if (existing.length > 0) {
                attData.id = existing[0].id;
            }

            await SGEDb.put('attendance_students', attData);
            saved++;
        }

        SGENotifications.success(`${saved} presença(s) registada(s)!`);
    }

    async function loadStaffAttendance() {
        const date = document.getElementById('att-staff-date')?.value;
        const container = document.getElementById('staff-attendance-list');
        if (!date || !container) return;

        const schoolId = SGEAuth.getUserSchoolId();
        const staff = await SGEDb.query('staff', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] });
        const attendances = await SGEDb.query('attendance_staff', { schoolId, date });
        const attMap = {};
        attendances.forEach(a => { attMap[a.staffId] = a; });

        let html = `<div class="sge-card"><table class="sge-table">
            <thead><tr><th>Funcionário</th><th>Cargo</th><th class="text-center">Presente</th><th class="text-center">Falta</th></tr></thead>
            <tbody>`;

        staff.forEach(s => {
            const att = attMap[s.id];
            const status = att?.status || 'present';
            html += `<tr>
                <td class="font-medium">${_esc(s.name)}</td>
                <td>${_esc(s.staffType)}</td>
                <td class="text-center"><input type="radio" name="satt-${s.id}" value="present" ${status === 'present' ? 'checked' : ''} class="w-4 h-4 text-success-600"></td>
                <td class="text-center"><input type="radio" name="satt-${s.id}" value="absent" ${status === 'absent' ? 'checked' : ''} class="w-4 h-4 text-danger-600"></td>
            </tr>`;
        });

        html += `</tbody></table>
            <button class="btn btn-success mt-4" onclick="SGEAttendance.saveStaffAttendance()">💾 Guardar</button>
        </div>`;
        container.innerHTML = html;
    }

    async function saveStaffAttendance() {
        const date = document.getElementById('att-staff-date')?.value;
        if (!date) return;

        const schoolId = SGEAuth.getUserSchoolId();
        const staff = await SGEDb.query('staff', { schoolId, status: 'active' });
        let saved = 0;

        for (const s of staff) {
            const radios = document.querySelectorAll(`input[name="satt-${s.id}"]`);
            let status = 'present';
            radios.forEach(r => { if (r.checked) status = r.value; });

            const existing = await SGEDb.query('attendance_staff', { staffId: s.id, schoolId, date });
            const data = { staffId: s.id, schoolId, date, status, markedBy: SGEAuth.getUserId(), createdAt: SGEUtils.nowISO() };
            if (existing.length > 0) data.id = existing[0].id;

            await SGEDb.put('attendance_staff', data);
            saved++;
        }
        SGENotifications.success(`${saved} registo(s) guardado(s)!`);
    }

    async function exportReport() {
        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { schoolId, status: 'active' });
        const attendances = await SGEDb.query('attendance_students', { schoolId });

        const data = students.map(s => {
            const sAtt = attendances.filter(a => a.studentId === s.id);
            return {
                'Aluno': s.name,
                'Matrícula': s.enrollmentNumber || '',
                'Presenças': sAtt.filter(a => a.status === 'present').length,
                'Faltas': sAtt.filter(a => a.status === 'absent').length,
                'Faltas Just.': sAtt.filter(a => a.status === 'justified').length,
                'Atrasos': sAtt.filter(a => a.status === 'late').length
            };
        });

        SGEUtils.exportToExcel(data, 'assiduidade', 'Presenças');
        SGENotifications.success('Relatório descarregado!');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, loadAttendance, saveAttendance, loadStaffAttendance, saveStaffAttendance, exportReport };
})();
window.SGEAttendance = SGEAttendance;