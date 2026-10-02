// ============================================
// SGE-NG - ESTATÍSTICAS
// Análise de dados: aproveitamento, assiduidade,
// taxas de aprovação/reprovação
// ============================================

const SGEStatistics = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [students, staff, computedGrades, attendance, sections, classes, subjects, years, terms] = await Promise.all([
            SGEDb.query('students', { schoolId, status: 'active' }),
            SGEDb.query('staff', { schoolId, status: 'active' }),
            SGEDb.query('computed_grades', { schoolId }),
            SGEDb.query('attendance_students', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('subjects', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('school_years', { schoolId, status: 'active' }),
            SGEDb.query('terms', { schoolId })
        ]);

        const activeYear = years[0];
        if (!activeYear) return SGEComponents.alert('Nenhum ano letivo ativo.', 'warning');

        const yearGrades = computedGrades.filter(g => g.schoolYearId === activeYear.id);

        // Calcular estatísticas globais
        const allMFDs = yearGrades.map(g => g.mfd).filter(v => v != null);
        const avgMFD = allMFDs.length ? (allMFDs.reduce((a, b) => a + b, 0) / allMFDs.length) : 0;
        const approved = yearGrades.filter(g => g.mfd != null && g.mfd >= 10).length;
        const failed = yearGrades.filter(g => g.mfd != null && g.mfd < 10).length;
        const totalGraded = approved + failed;
        const approvalRate = totalGraded > 0 ? Math.round((approved / totalGraded) * 100) : 0;

        // Assiduidade
        const totalAtt = attendance.length;
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = attendance.filter(a => a.status === 'absent').length;
        const attendanceRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 0;

        // Gênero
        const male = students.filter(s => s.gender === 'M').length;
        const female = students.filter(s => s.gender === 'F').length;

        let html = SGEComponents.pageHeader('Estatísticas', 'Análise de dados da escola');

        // Cards resumo
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${SGEComponents.renderStatCard({ title: 'Média Geral', value: avgMFD.toFixed(1) + ' val.', color: avgMFD >= 10 ? 'green' : 'red', icon: '📊' })}
                ${SGEComponents.renderStatCard({ title: 'Taxa de Aprovação', value: approvalRate + '%', color: approvalRate >= 50 ? 'green' : 'red', icon: '✅' })}
                ${SGEComponents.renderStatCard({ title: 'Assiduidade', value: attendanceRate + '%', color: attendanceRate >= 80 ? 'green' : 'yellow', icon: '📅' })}
                ${SGEComponents.renderStatCard({ title: 'Alunos', value: `${male}M / ${female}F`, color: 'blue', icon: '👥' })}
            </div>
        `;

        // Gráficos
        html += `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Aprovação vs Reprovação</h3>
                    <div class="h-64"><canvas id="chart-approval"></canvas></div>
                </div>
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Média por Disciplina</h3>
                    <div class="h-64"><canvas id="chart-subjects"></canvas></div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Alunos por Classe</h3>
                    <div class="h-64"><canvas id="chart-classes"></canvas></div>
                </div>
                <div class="sge-card">
                    <h3 class="text-sm font-semibold text-gray-900 mb-4">Assiduidade</h3>
                    <div class="h-64"><canvas id="chart-attendance"></canvas></div>
                </div>
            </div>
        `;

        // Tabela de médias por disciplina
        html += `
            <div class="sge-card">
                <h3 class="text-sm font-semibold text-gray-900 mb-4">Detalhe por Disciplina</h3>
                <table class="sge-table sge-table-compact">
                    <thead><tr>
                        <th>Disciplina</th>
                        <th class="text-center">Nº Alunos</th>
                        <th class="text-center">Média</th>
                        <th class="text-center">Máx</th>
                        <th class="text-center">Mín</th>
                        <th class="text-center">Aprovados</th>
                        <th class="text-center">Reprovados</th>
                        <th class="text-center">Taxa</th>
                    </tr></thead>
                    <tbody>
        `;

        for (const sub of subjects) {
            const subGrades = yearGrades.filter(g => g.subjectId === sub.id && g.mfd != null);
            if (subGrades.length === 0) continue;

            const mfds = subGrades.map(g => g.mfd);
            const avg = mfds.reduce((a, b) => a + b, 0) / mfds.length;
            const max = Math.max(...mfds);
            const min = Math.min(...mfds);
            const app = mfds.filter(m => m >= 10).length;
            const rep = mfds.filter(m => m < 10).length;
            const rate = mfds.length > 0 ? Math.round((app / mfds.length) * 100) : 0;

            html += `<tr>
                <td class="font-medium">${_esc(sub.name)}</td>
                <td class="text-center">${mfds.length}</td>
                <td class="text-center font-bold ${SGEUtils.gradeColorClass(avg, 20)}">${avg.toFixed(1)}</td>
                <td class="text-center text-success-600">${max.toFixed(1)}</td>
                <td class="text-center text-danger-600">${min.toFixed(1)}</td>
                <td class="text-center text-success-600">${app}</td>
                <td class="text-center text-danger-600">${rep}</td>
                <td class="text-center">${SGEComponents.progressBar(rate, rate >= 50 ? 'green' : 'red', `${rate}%`)}</td>
            </tr>`;
        }

        html += `</tbody></table></div>`;

        // Inicializar gráficos
        setTimeout(() => {
            SGECharts.approvalDistribution('chart-approval', { approved, failed, pending: totalGraded === 0 ? 1 : 0 });

            const subjectData = subjects.map(sub => {
                const sg = yearGrades.filter(g => g.subjectId === sub.id && g.mfd != null);
                return { label: sub.code || sub.name.substring(0, 6), average: sg.length ? sg.reduce((a, g) => a + g.mfd, 0) / sg.length : 0, max: 20 };
            }).filter(s => s.average > 0);
            SGECharts.subjectPerformance('chart-subjects', subjectData);

            const classData = classes.map(cls => {
                const classSections = sections.filter(s => s.classId === cls.id);
                const count = students.filter(st => classSections.some(s => s.id === st.sectionId)).length;
                return { label: cls.name, count, capacity: classSections.length * 40 };
            }).filter(c => c.count > 0);
            SGECharts.studentsPerSection('chart-classes', classData);

            SGECharts.create('chart-attendance', 'doughnut', {
                labels: ['Presentes', 'Faltas', 'Justificadas', 'Atrasos'],
                datasets: [{
                    data: [
                        presentCount,
                        absentCount,
                        attendance.filter(a => a.status === 'justified').length,
                        attendance.filter(a => a.status === 'late').length
                    ],
                    backgroundColor: ['#16A34A', '#DC2626', '#D97706', '#2563EB'],
                    borderWidth: 0
                }]
            }, { cutout: '60%' });
        }, 100);

        return html;
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render };
})();
window.SGEStatistics = SGEStatistics;