// ============================================
// SGE-NG - GESTÃO DE FUNCIONÁRIOS
// Professores, Administrativos, Direção
// ============================================

const SGEStaff = (() => {
    'use strict';

    const STAFF_TYPES = [
        { value: 'professor', label: 'Professor' },
        { value: 'director', label: 'Diretor' },
        { value: 'subdirector', label: 'Subdiretor' },
        { value: 'coordenador', label: 'Coordenador' },
        { value: 'secretario', label: 'Secretário' },
        { value: 'administrativo', label: 'Administrativo' },
        { value: 'tecnico', label: 'Técnico' },
        { value: 'auxiliar', label: 'Auxiliar' },
        { value: 'seguranca', label: 'Segurança' },
        { value: 'outro', label: 'Outro' }
    ];

    const ROLE_MAP = {
        director: 'director',
        subdirector: 'subdirector',
        coordenador: 'coordenador',
        secretario: 'secretario',
        professor: 'professor',
        administrativo: 'funcionario',
        tecnico: 'funcionario',
        auxiliar: 'funcionario',
        seguranca: 'funcionario',
        outro: 'funcionario'
    };

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const staff = await SGEDb.query('staff', { schoolId }, { orderBy: ['name', 'asc'] });
        const active = staff.filter(s => s.status === 'active');
        const teachers = active.filter(s => s.staffType === 'professor');

        let html = SGEComponents.pageHeader('Funcionários', `${active.length} ativo(s) · ${teachers.length} professor(es)`, [
            { label: '+ Novo Funcionário', type: 'primary', onClick: 'SGEStaff.openCreateModal()' },
            { label: '↓ Exportar', type: 'success', onClick: 'SGEStaff.exportExcel()' }
        ]);

        if (staff.length === 0) {
            html += SGEComponents.emptyState('Nenhum funcionário cadastrado.',
                `<button class="btn btn-primary btn-sm" onclick="SGEStaff.openCreateModal()">+ Cadastrar</button>`);
            return html;
        }

        html += SGEComponents.renderTable({
            columns: [
                { key: 'photo', label: '', width: '50px',
                    render: (v, row) => SGEComponents.avatar(row.name || row.fullName, v, 'sm') },
                { key: 'name', label: 'Nome Completo', sortable: true,
                    render: (v) => `<span class="font-semibold">${_esc(v)}</span>` },
                { key: 'staffType', label: 'Cargo', sortable: true,
                    render: (v) => {
                        const t = STAFF_TYPES.find(st => st.value === v);
                        return SGEComponents.badge(t?.label || v, v === 'professor' ? 'info' : 'neutral');
                    }
                },
                { key: 'email', label: 'Email', sortable: true },
                { key: 'phone', label: 'Telefone' },
                { key: 'isAdminTeacher', label: 'Leciona?', width: '70px',
                    render: (v) => v ? SGEComponents.badge('Sim', 'success') : '<span class="text-gray-400">Não</span>' },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) }
            ],
            data: staff,
            actions: [
                { label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGEStaff.openEditModal(row.id) },
                { label: 'Ficha PDF', color: 'success',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
                    onClick: (row) => SGEStaff.downloadFicha(row.id) },
                { label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGEStaff.deleteStaff(row.id),
                    condition: (row) => row.staffType !== 'director' }
            ],
            searchPlaceholder: 'Pesquisar funcionário...'
        });

        return html;
    }

    async function openCreateModal() {
        const schoolId = SGEAuth.getUserSchoolId();

        SGEComponents.openFormModal({
            title: 'Novo Funcionário',
            size: 'lg',
            fields: [
                { name: 'name', label: 'Nome Completo', type: 'text', required: true, grid: 'full' },
                { name: 'staffType', label: 'Cargo', type: 'select', required: true, options: STAFF_TYPES },
                { name: 'gender', label: 'Gênero', type: 'radio', required: true,
                    options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }] },
                { name: 'birthDate', label: 'Data de Nascimento', type: 'date' },
                { name: 'documentNumber', label: 'BI Nº', type: 'text' },
                { name: 'email', label: 'Email', type: 'email', required: true,
                    help: 'Será usado para login no sistema' },
                { name: 'phone', label: 'Telefone', type: 'text', placeholder: '+244 9XX XXX XXX' },
                { name: 'address', label: 'Morada', type: 'text', grid: 'full' },
                { name: 'qualification', label: 'Habilitações Literárias', type: 'text', placeholder: 'Ex: Licenciatura em Matemática' },
                { name: 'hireDate', label: 'Data de Admissão', type: 'date' },
                { name: 'isAdminTeacher', label: 'Administrativo que leciona?', type: 'toggle',
                    help: 'Ative se este funcionário administrativo também dá aulas' },
                { name: 'createLogin', label: 'Criar conta de acesso?', type: 'toggle', toggleLabel: 'Sim' }
            ],
            onSubmit: async (data) => {
                const staffData = {
                    schoolId, ...data,
                    role: ROLE_MAP[data.staffType] || 'funcionario',
                    status: 'active',
                    createdAt: SGEUtils.nowISO()
                };

                // Criar conta de login se solicitado
                if (data.createLogin) {
                    const tempPassword = 'sge' + Math.random().toString(36).substring(2, 8);
                    const result = await SGEAuth.createUser({
                        fullName: data.name,
                        email: data.email,
                        role: ROLE_MAP[data.staffType] || 'funcionario',
                        schoolId
                    }, tempPassword);

                    if (result.success) {
                        staffData.userId = result.user.id;
                        SGENotifications.info(`Conta criada. Password temporária: ${tempPassword}`, 10000);
                    } else {
                        SGENotifications.warning('Funcionário criado mas falha na conta: ' + result.error);
                    }
                }

                await SGEDb.putEncrypted('staff', staffData, ['phone', 'documentNumber']);
                SGENotifications.success('Funcionário cadastrado!');
                SGERouter.navigate('/staff');
            }
        });
    }

    async function openEditModal(id) {
        const staffMember = await SGEDb.getDecrypted('staff', id);
        if (!staffMember) return SGENotifications.error('Funcionário não encontrado.');

        SGEComponents.openFormModal({
            title: 'Editar Funcionário',
            size: 'lg',
            fields: [
                { name: 'name', label: 'Nome Completo', type: 'text', required: true, grid: 'full' },
                { name: 'staffType', label: 'Cargo', type: 'select', required: true, options: STAFF_TYPES },
                { name: 'gender', label: 'Gênero', type: 'radio', required: true,
                    options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }] },
                { name: 'birthDate', label: 'Data de Nascimento', type: 'date' },
                { name: 'documentNumber', label: 'BI Nº', type: 'text' },
                { name: 'email', label: 'Email', type: 'email', required: true },
                { name: 'phone', label: 'Telefone', type: 'text' },
                { name: 'address', label: 'Morada', type: 'text', grid: 'full' },
                { name: 'qualification', label: 'Habilitações', type: 'text' },
                { name: 'hireDate', label: 'Data de Admissão', type: 'date' },
                { name: 'isAdminTeacher', label: 'Leciona?', type: 'toggle' }
            ],
            data: staffMember,
            onSubmit: async (data) => {
                Object.assign(staffMember, data);
                staffMember.role = ROLE_MAP[data.staffType] || 'funcionario';
                staffMember.updatedAt = SGEUtils.nowISO();
                await SGEDb.putEncrypted('staff', staffMember, ['phone', 'documentNumber']);
                SGENotifications.success('Funcionário atualizado!');
                SGERouter.navigate('/staff');
            }
        });
    }

    async function deleteStaff(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Funcionário', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('staff', id);
        SGENotifications.success('Funcionário eliminado.');
        SGERouter.navigate('/staff');
    }

    async function exportExcel() {
        const schoolId = SGEAuth.getUserSchoolId();
        const staff = await SGEDb.query('staff', { schoolId });
        if (!staff.length) return SGENotifications.warning('Sem dados.');
        const data = staff.map(s => ({
            'Nome': s.name, 'Cargo': s.staffType, 'Email': s.email,
            'Telefone': s.phone, 'Estado': s.status, 'Admissão': s.hireDate ? SGEUtils.formatDate(s.hireDate) : ''
        }));
        SGEUtils.exportToExcel(data, 'funcionarios', 'Funcionários');
        SGENotifications.success('Excel descarregado!');
    }

    async function downloadFicha(id) {
        const s = await SGEDb.getDecrypted('staff', id);
        if (!s) return;
        try {
            const { jsPDF } = window.jspdf || jspdf;
            const doc = new jsPDF();
            const school = await SGEDb.get('schools', SGEAuth.getUserSchoolId());
            doc.setFontSize(14);
            doc.text(school?.name || 'SGE-NG', 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text('FICHA DO FUNCIONÁRIO', 105, 28, { align: 'center' });
            doc.line(20, 32, 190, 32);
            doc.setFontSize(9);
            let y = 40;
            [`Nome: ${s.name}`, `Cargo: ${s.staffType}`, `Email: ${s.email || '---'}`,
             `Telefone: ${s.phone || '---'}`, `BI: ${s.documentNumber || '---'}`,
             `Habilitações: ${s.qualification || '---'}`,
             `Admissão: ${s.hireDate ? SGEUtils.formatDate(s.hireDate) : '---'}`
            ].forEach(line => { doc.text(line, 20, y); y += 7; });
            if (s.photo?.startsWith('data:')) { try { doc.addImage(s.photo, 'JPEG', 150, 36, 35, 40); } catch {} }
            doc.save(`ficha_${s.name}.pdf`);
        } catch { SGENotifications.error('Erro ao gerar PDF.'); }
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, deleteStaff, exportExcel, downloadFicha };
})();
window.SGEStaff = SGEStaff;