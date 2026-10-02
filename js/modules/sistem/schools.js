// ============================================
// SGE-NG - GESTÃO MULTIESCOLA
// Exclusivo do Administrador Geral
// Cadastrar, suspender, excluir escolas
// ============================================

const SGESchools = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        if (user?.role !== 'admin_geral') {
            return SGEComponents.alert('Acesso restrito ao Administrador Geral.', 'error');
        }

        const schools = await SGEDb.query('schools', {}, { orderBy: ['name', 'asc'] });
        const users = await SGEDb.query('users', {});

        let html = SGEComponents.pageHeader('Gestão de Escolas', `${schools.length} escola(s) cadastrada(s)`, [
            { label: '+ Nova Escola', type: 'primary', onClick: 'SGESchools.openCreateModal()' }
        ]);

        if (schools.length === 0) {
            html += SGEComponents.emptyState('Nenhuma escola cadastrada.');
            return html;
        }

        html += SGEComponents.renderTable({
            columns: [
                { key: 'name', label: 'Escola', sortable: true,
                    render: (v) => `<span class="font-bold">${_esc(v)}</span>` },
                { key: 'province', label: 'Província', sortable: true },
                { key: 'municipality', label: 'Município' },
                { key: 'director', label: 'Diretor',
                    render: (v) => _esc(v || '---') },
                { key: 'phone', label: 'Telefone' },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) },
                { key: 'id', label: 'Utilizadores',
                    render: (v) => {
                        const count = users.filter(u => u.schoolId === v).length;
                        return SGEComponents.badge(`${count} users`, 'info');
                    }
                }
            ],
            data: schools,
            actions: [
                { label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGESchools.openEditModal(row.id) },
                { label: row => row.status === 'active' ? 'Suspender' : 'Ativar',
                    color: row => row.status === 'active' ? 'warning' : 'success',
                    icon: '⏸️',
                    onClick: (row) => SGESchools.toggleStatus(row.id) },
                { label: 'Eliminar', color: 'danger',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
                    onClick: (row) => SGESchools.deleteSchool(row.id) }
            ],
            searchPlaceholder: 'Pesquisar escola...'
        });

        return html;
    }

    async function openCreateModal() {
        const provinces = SGEUtils.getProvinces();

        SGEComponents.openFormModal({
            title: 'Nova Escola',
            size: 'lg',
            fields: [
                { name: 'name', label: 'Nome Oficial', type: 'text', required: true, grid: 'full' },
                { name: 'nif', label: 'NIF', type: 'text' },
                { name: 'decree', label: 'Decreto de Criação', type: 'text' },
                { name: 'address', label: 'Endereço', type: 'text', required: true, grid: 'full' },
                { name: 'province', label: 'Província', type: 'select', required: true,
                    options: provinces.map(p => ({ value: p.code, label: p.name })) },
                { name: 'municipality', label: 'Município', type: 'text' },
                { name: 'phone', label: 'Telefone', type: 'text' },
                { name: 'email', label: 'Email', type: 'email' },
                { name: 'director', label: 'Diretor Geral', type: 'text', required: true },
                { name: 'subdirector', label: 'Subdiretor Pedagógico', type: 'text' }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('schools', {
                    ...data, status: 'active',
                    logo: null, createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Escola cadastrada!');
                SGERouter.navigate('/system/schools');
            }
        });
    }

    async function openEditModal(id) {
        const school = await SGEDb.get('schools', id);
        if (!school) return;
        const provinces = SGEUtils.getProvinces();

        SGEComponents.openFormModal({
            title: 'Editar Escola',
            size: 'lg',
            fields: [
                { name: 'name', label: 'Nome', type: 'text', required: true, grid: 'full' },
                { name: 'nif', label: 'NIF', type: 'text' },
                { name: 'decree', label: 'Decreto', type: 'text' },
                { name: 'address', label: 'Endereço', type: 'text', required: true, grid: 'full' },
                { name: 'province', label: 'Província', type: 'select', required: true,
                    options: provinces.map(p => ({ value: p.code, label: p.name })) },
                { name: 'municipality', label: 'Município', type: 'text' },
                { name: 'phone', label: 'Telefone', type: 'text' },
                { name: 'email', label: 'Email', type: 'email' },
                { name: 'director', label: 'Diretor', type: 'text', required: true },
                { name: 'subdirector', label: 'Subdiretor', type: 'text' }
            ],
            data: school,
            onSubmit: async (data) => {
                Object.assign(school, data);
                await SGEDb.put('schools', school);
                SGENotifications.success('Escola atualizada!');
                SGERouter.navigate('/system/schools');
            }
        });
    }

    async function toggleStatus(id) {
        const school = await SGEDb.get('schools', id);
        if (!school) return;

        const newStatus = school.status === 'active' ? 'suspended' : 'active';
        const action = newStatus === 'suspended' ? 'suspender' : 'ativar';

        const ok = await SGEComponents.confirm({
            title: `${action === 'suspender' ? 'Suspender' : 'Ativar'} Escola`,
            message: `Tem a certeza que deseja ${action} "${school.name}"?`,
            type: newStatus === 'suspended' ? 'warning' : 'info'
        });
        if (!ok) return;

        school.status = newStatus;
        await SGEDb.put('schools', school);

        await SGEDb.addAuditLog({
            userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
            action: `${action}_school`, module: 'schools',
            description: `Escola ${school.name} ${newStatus === 'suspended' ? 'suspensa' : 'ativada'}`,
            details: { schoolId: id, status: newStatus }
        });

        SGENotifications.success(`Escola ${newStatus === 'suspended' ? 'suspensa' : 'ativada'}.`);
        SGERouter.navigate('/system/schools');
    }

    async function deleteSchool(id) {
        const school = await SGEDb.get('schools', id);
        if (!school) return;

        const users = await SGEDb.query('users', { schoolId: id });
        if (users.length > 0) {
            return SGENotifications.warning(`Não pode eliminar: ${users.length} utilizador(es) associado(s).`);
        }

        const ok = await SGEComponents.confirm({
            title: 'Eliminar Escola',
            message: `ELIMINAR "${school.name}" PERMANENTEMENTE? Esta ação não pode ser desfeita.`,
            type: 'danger',
            confirmText: 'Sim, Eliminar'
        });
        if (!ok) return;

        await SGEDb.remove('schools', id);
        SGENotifications.success('Escola eliminada permanentemente.');
        SGERouter.navigate('/system/schools');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, toggleStatus, deleteSchool };
})();
window.SGESchools = SGESchools;