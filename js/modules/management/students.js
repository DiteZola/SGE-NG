// ============================================
// SGE-NG - GESTÃO DE ESTUDANTES E MATRÍCULAS
// Módulo completo de cadastro, edição,
// consulta e histórico de alunos
// ============================================

const SGEStudents = (() => {
    'use strict';

    // ============================================
    // RENDERIZAÇÃO PRINCIPAL (LISTA)
    // ============================================

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [students, classes, sections, shifts, years] = await Promise.all([
            SGEDb.query('students', { schoolId }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('shifts', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = years[0];

        let html = SGEComponents.pageHeader(
            'Estudantes',
            `${students.filter(s => s.status === 'active').length} aluno(s) ativo(s)`,
            [
                { label: '+ Novo Aluno', type: 'primary', onClick: 'SGEStudents.openCreateModal()' },
                { label: '↓ Exportar Excel', type: 'success', onClick: 'SGEStudents.exportExcel()' }
            ]
        );

        // Filtros rápidos
        html += `
            <div class="flex flex-wrap gap-2 mb-4">
                <button class="btn btn-sm btn-primary" onclick="SGEStudents._filterStatus('all')">Todos (${students.length})</button>
                <button class="btn btn-sm btn-success-outline" onclick="SGEStudents._filterStatus('active')">Ativos (${students.filter(s=>s.status==='active').length})</button>
                <button class="btn btn-sm btn-danger-outline" onclick="SGEStudents._filterStatus('desistente')">Desistentes (${students.filter(s=>s.status==='desistente').length})</button>
                <button class="btn btn-sm btn-secondary" onclick="SGEStudents._filterStatus('transferido')">Transferidos (${students.filter(s=>s.status==='transferido').length})</button>
            </div>
        `;

        if (students.length === 0) {
            html += SGEComponents.emptyState('Nenhum aluno cadastrado.',
                `<button class="btn btn-primary btn-sm" onclick="SGEStudents.openCreateModal()">+ Matricular Primeiro Aluno</button>`);
            return html;
        }

        // Enriquecer dados para a tabela
        const tableData = students.map(s => {
            const section = sections.find(sec => sec.id === s.sectionId);
            const cls = section ? classes.find(c => c.id === section.classId) : null;
            const shift = section ? shifts.find(sh => sh.id === section.shiftId) : null;
            return {
                ...s,
                className: cls?.name || '---',
                sectionName: section ? `${cls?.name || ''} ${section.name}` : '---',
                shiftName: shift?.name || '---',
                age: s.birthDate ? SGEUtils.calculateAge(s.birthDate) : '---'
            };
        });

        html += SGEComponents.renderTable({
            columns: [
                { key: 'photo', label: '', width: '50px',
                    render: (v, row) => SGEComponents.avatar(row.name, v, 'sm') },
                { key: 'name', label: 'Nome Completo', sortable: true,
                    render: (v, row) => `<a href="#" data-route="/students/${row.id}" class="font-medium text-primary-600 hover:underline">${_esc(v)}</a>` },
                { key: 'enrollmentNumber', label: 'Nº Matrícula', sortable: true,
                    render: (v) => `<span class="font-mono text-xs">${_esc(v || '---')}</span>` },
                { key: 'className', label: 'Classe', sortable: true },
                { key: 'sectionName', label: 'Turma' },
                { key: 'gender', label: 'Gênero', width: '60px',
                    render: (v) => v === 'M' ? '♂ M' : v === 'F' ? '♀ F' : '---' },
                { key: 'age', label: 'Idade', width: '60px' },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) }
            ],
            data: tableData,
            actions: [
                { label: 'Ver', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
                    onClick: (row) => SGERouter.navigate(`/students/${row.id}`) },
                { label: 'Editar', color: 'success',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGEStudents.openEditModal(row.id) },
                { label: 'Estado', color: 'warning',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`,
                    onClick: (row) => SGEStudents.changeStatus(row.id) }
            ],
            searchPlaceholder: 'Pesquisar por nome, matrícula...'
        });

        return html;
    }

    // ============================================
    // FICHA DO ALUNO (DETALHE)
    // ============================================

    async function renderDetail(studentId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const student = await SGEDb.get('students', studentId);
        if (!student) return SGEComponents.alert('Aluno não encontrado.', 'error');

        const [classes, sections, shifts, enrollments] = await Promise.all([
            SGEDb.query('classes', { schoolId }),
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('shifts', { schoolId }),
            SGEDb.query('enrollments', { studentId }, { orderBy: ['createdAt', 'desc'] })
        ]);

        const section = sections.find(s => s.id === student.sectionId);
        const cls = section ? classes.find(c => c.id === section.classId) : null;
        const shift = section ? shifts.find(s => s.id === section.shiftId) : null;

        const genderLabel = SGEUtils.genderText(student.gender, 'Masculino', 'Feminino');
        const genderArticle = SGEUtils.genderText(student.gender, 'O Aluno', 'A Aluna');

        let html = `
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-sm btn-secondary" onclick="SGERouter.navigate('/students')">← Voltar</button>
                <h2 class="text-xl font-bold text-gray-900">Ficha do Aluno</h2>
                ${SGEComponents.statusBadge(student.status)}
            </div>
        `;

        // Cabeçalho da ficha
        html += `
            <div class="sge-card mb-6">
                <div class="flex flex-col sm:flex-row items-start gap-6">
                    <div class="flex-shrink-0">
                        ${SGEComponents.avatar(student.name, student.photo, 'xl')}
                    </div>
                    <div class="flex-1">
                        <h3 class="text-2xl font-bold text-gray-900">${_esc(student.name)}</h3>
                        <p class="text-gray-500 text-sm mt-1">${genderArticle} · ${genderLabel} · ${student.birthDate ? SGEUtils.calculateAge(student.birthDate) + ' anos' : '---'}</p>
                        <div class="flex flex-wrap gap-4 mt-3 text-sm">
                            <span class="text-gray-600"><strong>Matrícula:</strong> ${_esc(student.enrollmentNumber || '---')}</span>
                            <span class="text-gray-600"><strong>Processo:</strong> ${_esc(student.processNumber || '---')}</span>
                            <span class="text-gray-600"><strong>Classe:</strong> ${_esc(cls?.name || '---')}</span>
                            <span class="text-gray-600"><strong>Turma:</strong> ${_esc(section?.name || '---')} (${_esc(shift?.name || '---')})</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-primary" onclick="SGEStudents.openEditModal('${student.id}')">Editar</button>
                        <button class="btn btn-sm btn-success" onclick="SGEStudents.downloadFicha('${student.id}')">↓ PDF</button>
                    </div>
                </div>
            </div>
        `;

        // Dados pessoais
        html += SGEComponents.infoCard('Dados Pessoais', [
            { label: 'Nome Completo', value: student.name },
            { label: 'Data de Nascimento', value: student.birthDate ? SGEUtils.formatDate(student.birthDate) : '---' },
            { label: 'Gênero', value: genderLabel },
            { label: 'Naturalidade', value: student.naturalidade || '---' },
            { label: 'Província', value: student.province || '---' },
            { label: 'Município', value: student.municipality || '---' },
            { label: 'BI / Cédula', value: student.documentNumber || '---' },
            { label: 'Nº de Processo', value: student.processNumber || '---' }
        ]);

        html += `<div class="mt-4"></div>`;

        // Encarregado de Educação
        html += SGEComponents.infoCard('Encarregado de Educação', [
            { label: 'Nome', value: student.guardianName || '---' },
            { label: 'Parentesco', value: student.guardianRelation || '---' },
            { label: 'Telefone', value: student.guardianPhone || '---' },
            { label: 'Email', value: student.guardianEmail || '---' },
            { label: 'Morada', value: student.guardianAddress || '---' }
        ]);

        // Histórico de matrículas
        if (enrollments.length > 0) {
            html += `<div class="sge-card mt-4">
                <h3 class="text-sm font-semibold text-gray-900 mb-3">Histórico de Matrículas</h3>
                <table class="sge-table sge-table-compact">
                    <thead><tr><th>Ano Letivo</th><th>Classe</th><th>Turma</th><th>Estado</th><th>Data</th></tr></thead>
                    <tbody>
                        ${enrollments.map(e => {
                            const sec = sections.find(s => s.id === e.sectionId);
                            const cl = sec ? classes.find(c => c.id === sec.classId) : null;
                            return `<tr>
                                <td>${_esc(e.schoolYearId?.substring(0, 9) || '---')}</td>
                                <td>${_esc(cl?.name || '---')}</td>
                                <td>${_esc(sec?.name || '---')}</td>
                                <td>${SGEComponents.statusBadge(e.status)}</td>
                                <td>${SGEUtils.formatDate(e.createdAt)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        return html;
    }

    // ============================================
    // FORMULÁRIO DE CADASTRO / EDIÇÃO
    // ============================================

    function _getStudentFields(existingData = null) {
        return [
            // Dados Pessoais
            { name: 'name', label: 'Nome Completo', type: 'text', required: true, grid: 'full' },
            { name: 'gender', label: 'Gênero', type: 'radio', required: true,
                options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }] },
            { name: 'birthDate', label: 'Data de Nascimento', type: 'date', required: true },
            { name: 'naturalidade', label: 'Naturalidade', type: 'text', placeholder: 'Ex: Luanda' },
            { name: 'province', label: 'Província', type: 'select',
                options: [{ value: '', label: '-- Selecionar --' }, ...SGEUtils.getProvinces().map(p => ({ value: p.name, label: p.name }))] },
            { name: 'municipality', label: 'Município', type: 'text' },
            { name: 'documentNumber', label: 'BI / Cédula Nº', type: 'text' },

            // Dados Académicos
            { name: 'sectionId', label: 'Turma', type: 'select', required: true, options: [] }, // Preenchido dinamicamente

            // Encarregado
            { name: 'guardianName', label: 'Nome do Encarregado', type: 'text', required: true, grid: 'full' },
            { name: 'guardianRelation', label: 'Parentesco', type: 'select',
                options: ['Pai', 'Mãe', 'Tio(a)', 'Avô(ó)', 'Irmão(ã)', 'Tutor', 'Outro'] },
            { name: 'guardianPhone', label: 'Telefone do Encarregado', type: 'text', required: true, placeholder: '+244 9XX XXX XXX' },
            { name: 'guardianEmail', label: 'Email do Encarregado', type: 'email' },
            { name: 'guardianAddress', label: 'Morada do Encarregado', type: 'text', grid: 'full' }
        ];
    }

    async function openCreateModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [sections, classes, shifts, years] = await Promise.all([
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo primeiro.');

        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return { value: s.id, label: `${cls?.name || ''} - ${s.name} (${shift?.name || ''})` };
        });

        const fields = _getStudentFields();
        const sectionField = fields.find(f => f.name === 'sectionId');
        if (sectionField) sectionField.options = sectionOpts;

        SGEComponents.openFormModal({
            title: 'Matricular Novo Aluno',
            size: 'lg',
            fields,
            onSubmit: async (data) => {
                // Gerar número de matrícula
                const format = await SGEDb.getConfig('enrollment_format') || 'MAT-{ANO}-{SEQ:5}';
                const count = await SGEDb.count('students', { schoolId });
                const enrollmentNumber = SGEUtils.generateFormattedCode(count + 1, format, { year: new Date().getFullYear() });

                // Gerar número de processo
                const procFormat = await SGEDb.getConfig('process_format') || 'PROC-{ANO}-{SEQ:5}';
                const processNumber = SGEUtils.generateFormattedCode(count + 1, procFormat, { year: new Date().getFullYear() });

                const studentData = {
                    schoolId,
                    ...data,
                    enrollmentNumber,
                    processNumber,
                    status: 'active',
                    schoolYearId: years[0].id,
                    createdAt: SGEUtils.nowISO()
                };

                // Encriptar dados sensíveis
                const result = await SGEDb.putEncrypted('students', studentData, ['guardianPhone', 'documentNumber']);

                // Criar matrícula
                await SGEDb.put('enrollments', {
                    studentId: result.id, schoolId,
                    schoolYearId: years[0].id,
                    classId: sections.find(s => s.id === data.sectionId)?.classId,
                    sectionId: data.sectionId,
                    status: 'active',
                    createdAt: SGEUtils.nowISO()
                });

                SGENotifications.success(`Aluno matriculado! Nº ${enrollmentNumber}`);
                SGERouter.navigate('/students');
            }
        });
    }

    async function openEditModal(id) {
        const student = await SGEDb.getDecrypted('students', id);
        if (!student) return SGENotifications.error('Aluno não encontrado.');

        const schoolId = SGEAuth.getUserSchoolId();
        const [sections, classes, shifts] = await Promise.all([
            SGEDb.query('sections', { schoolId }),
            SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] }),
            SGEDb.query('shifts', { schoolId })
        ]);

        const sectionOpts = sections.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const shift = shifts.find(sh => sh.id === s.shiftId);
            return { value: s.id, label: `${cls?.name || ''} - ${s.name} (${shift?.name || ''})` };
        });

        const fields = _getStudentFields(student);
        const sectionField = fields.find(f => f.name === 'sectionId');
        if (sectionField) sectionField.options = sectionOpts;

        SGEComponents.openFormModal({
            title: 'Editar Aluno',
            size: 'lg',
            fields,
            data: student,
            onSubmit: async (data) => {
                Object.assign(student, data);
                student.updatedAt = SGEUtils.nowISO();
                await SGEDb.putEncrypted('students', student, ['guardianPhone', 'documentNumber']);
                SGENotifications.success('Dados do aluno atualizados!');
                SGERouter.navigate(`/students/${id}`);
            }
        });
    }

    // ============================================
    // ALTERAÇÃO DE ESTADO
    // ============================================

    async function changeStatus(id) {
        const student = await SGEDb.get('students', id);
        if (!student) return;

        const options = [
            { value: 'active', label: 'Ativo' },
            { value: 'desistente', label: 'Desistente' },
            { value: 'transferido', label: 'Transferido' }
        ];

        SGEComponents.openFormModal({
            title: 'Alterar Estado do Aluno',
            fields: [
                { name: 'status', label: 'Novo Estado', type: 'select', required: true, options }
            ],
            data: { status: student.status },
            onSubmit: async (data) => {
                const oldStatus = student.status;
                student.status = data.status;
                student.updatedAt = SGEUtils.nowISO();
                await SGEDb.put('students', student);

                await SGEDb.addAuditLog({
                    userId: SGEAuth.getUserId(),
                    userName: SGEAuth.getUserName(),
                    schoolId: student.schoolId,
                    action: 'change_student_status',
                    module: 'students',
                    description: `${student.name}: ${oldStatus} → ${data.status}`,
                    details: { studentId: id, oldStatus, newStatus: data.status }
                });

                SGENotifications.success(`Estado alterado para "${data.status}".`);
                SGERouter.navigate('/students');
            }
        });
    }

    // ============================================
    // EXPORTAÇÃO
    // ============================================

    async function exportExcel() {
        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { schoolId }, { orderBy: ['name', 'asc'] });
        if (!students.length) return SGENotifications.warning('Nenhum aluno para exportar.');

        const data = students.map(s => ({
            'Nº Matrícula': s.enrollmentNumber || '',
            'Nome Completo': s.name || '',
            'Gênero': s.gender || '',
            'Data Nascimento': s.birthDate ? SGEUtils.formatDate(s.birthDate) : '',
            'Idade': s.birthDate ? SGEUtils.calculateAge(s.birthDate) : '',
            'Estado': s.status || '',
            'Encarregado': s.guardianName || '',
            'Telefone Enc.': s.guardianPhone || ''
        }));

        SGEUtils.exportToExcel(data, 'alunos_' + new Date().getFullYear(), 'Alunos');
        SGENotifications.success('Ficheiro Excel descarregado!');
    }

    // ============================================
    // DOWNLOAD FICHA PDF
    // ============================================

    async function downloadFicha(id) {
        const student = await SGEDb.getDecrypted('students', id);
        if (!student) return SGENotifications.error('Aluno não encontrado.');

        if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') {
            return SGENotifications.warning('Gerador de PDF não disponível.');
        }

        try {
            const { jsPDF } = window.jspdf || jspdf;
            const doc = new jsPDF();

            // Cabeçalho
            const school = await SGEDb.get('schools', SGEAuth.getUserSchoolId());
            doc.setFontSize(14);
            doc.text(school?.name || 'SGE-NG', 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text('FICHA INDIVIDUAL DO ALUNO', 105, 28, { align: 'center' });
            doc.line(20, 32, 190, 32);

            // Dados
            doc.setFontSize(9);
            let y = 40;
            const lines = [
                `Nome: ${student.name}`,
                `Nº Matrícula: ${student.enrollmentNumber || '---'}    Nº Processo: ${student.processNumber || '---'}`,
                `Data Nascimento: ${student.birthDate ? SGEUtils.formatDate(student.birthDate) : '---'}    Gênero: ${SGEUtils.genderText(student.gender, 'Masculino', 'Feminino')}`,
                `Naturalidade: ${student.naturalidade || '---'}    Província: ${student.province || '---'}`,
                `BI/Cédula: ${student.documentNumber || '---'}`,
                '',
                `Encarregado: ${student.guardianName || '---'}    Parentesco: ${student.guardianRelation || '---'}`,
                `Telefone: ${student.guardianPhone || '---'}    Email: ${student.guardianEmail || '---'}`,
                `Morada: ${student.guardianAddress || '---'}`
            ];

            lines.forEach(line => {
                doc.text(line, 20, y);
                y += 7;
            });

            // Foto (se existir)
            if (student.photo && student.photo.startsWith('data:')) {
                try {
                    doc.addImage(student.photo, 'JPEG', 150, 36, 35, 40);
                } catch {}
            }

            doc.save(`ficha_${student.enrollmentNumber || student.name}.pdf`);
            SGENotifications.success('Ficha descarregada!');
        } catch (error) {
            console.error('[Students] Erro PDF:', error);
            SGENotifications.error('Erro ao gerar PDF.');
        }
    }

    // ============================================
    // FILTRO RÁPIDO
    // ============================================

    function _filterStatus(status) {
        // Implementação simples: re-render com filtro
        // A tabela já tem pesquisa integrada
        SGENotifications.info(`Filtro: ${status === 'all' ? 'Todos' : status}`);
    }

    // ============================================
    // UTILITÁRIO
    // ============================================

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        render, renderDetail,
        openCreateModal, openEditModal,
        changeStatus, exportExcel, downloadFicha,
        _filterStatus
    };
})();
window.SGEStudents = SGEStudents;