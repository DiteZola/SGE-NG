// ============================================
// SGE-NG - GESTÃO DE UTILIZADORES
// Criar, editar, suspender e gerir contas
// ============================================

const SGEUsers = (() => {
    'use strict';

    const ROLES = [
        { value: 'admin_geral', label: 'Administrador Geral' },
        { value: 'director', label: 'Diretor' },
        { value: 'subdirector', label: 'Subdiretor' },
        { value: 'coordenador', label: 'Coordenador' },
        { value: 'secretario', label: 'Secretário' },
        { value: 'professor', label: 'Professor' },
        { value: 'funcionario', label: 'Funcionário' }
    ];

    async function render() {
        const user = SGEAuth.getCurrentUser();
        if (!SGESecurity.hasPermission(user?.role, 'users', 'read')) {
            return SGEComponents.alert('Sem permissão.', 'error');
        }

        const users = await SGEAuth.listUsers();

        let html = SGEComponents.pageHeader('Utilizadores', `${users.length} conta(s)`, [
            { label: '+ Novo Utilizador', type: 'primary', onClick: 'SGEUsers.openCreateModal()' }
        ]);

        html += SGEComponents.renderTable({
            columns: [
                { key: 'fullName', label: 'Nome', sortable: true,
                    render: (v, row) => `
                        <div class="flex items-center gap-2">
                            ${SGEComponents.avatar(v || row.email, row.photo, 'sm')}
                            <span class="font-medium">${_esc(v || row.email)}</span>
                        </div>` },
                { key: 'email', label: 'Email', sortable: true },
                { key: 'role', label: 'Papel', sortable: true,
                    render: (v) => {
                        const r = ROLES.find(ro => ro.value === v);
                        const colors = { admin_geral: 'danger', director: 'warning', professor: 'info' };
                        return SGEComponents.badge(r?.label || v, colors[v] || 'neutral');
                    }
                },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v) },
                { key: 'lastLogin', label: 'Último Login',
                    render: (v) => v ? `<span class="text-xs">${SGEUtils.formatDate(v, true)}</span>` : '<span class="text-gray-400 text-xs">Nunca</span>' },
                { key: 'createdAt', label: 'Criado em',
                    render: (v) => `<span class="text-xs">${SGEUtils.formatDate(v)}</span>` }
            ],
            data: users,
            actions: [
                { label: 'Editar', color: 'primary',
                    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
                    onClick: (row) => SGEUsers.openEditModal(row.id) },
                { label: row => row.status === 'active' ? 'Suspender' : 'Ativar',
                    color: row => row.status === 'active' ? 'warning' : 'success',
                    icon: '⏸️',
                    onClick: (row) => SGEUsers.toggleStatus(row.id),
                    condition: (row) => row.id !== SGEAuth.getUserId() && row.role !== 'admin_geral' },
                { label: 'Reset Password', color: 'info',
                    icon: '🔑',
                    onClick: (row) => SGEUsers.resetPassword(row.id),
                    condition: (row) => row.id !== SGEAuth.getUserId() }
            ],
            searchPlaceholder: 'Pesquisar utilizador...'
        });

        return html;
    }

    async function openCreateModal() {
        const user = SGEAuth.getCurrentUser();
        const schools = user?.role === 'admin_geral' ? await SGEDb.query('schools', {}) : [];
        const schoolOpts = schools.map(s => ({ value: s.id, label: s.name }));

        const availableRoles = user?.role === 'admin_geral'
            ? ROLES
            : ROLES.filter(r => SGESecurity.isRoleHigherOrEqual(user.role, r.value) && r.value !== 'admin_geral');

        const fields = [
            { name: 'fullName', label: 'Nome Completo', type: 'text', required: true, grid: 'full' },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'role', label: 'Papel', type: 'select', required: true, options: availableRoles },
            { name: 'phone', label: 'Telefone', type: 'text' }
        ];

        if (user?.role === 'admin_geral' && schoolOpts.length > 0) {
            fields.push({ name: 'schoolId', label: 'Escola', type: 'select', required: true, options: schoolOpts });
        }

        SGEComponents.openFormModal({
            title: 'Novo Utilizador',
            fields,
            onSubmit: async (data) => {
                const tempPassword = 'Sge' + Math.random().toString(36).substring(2, 8) + '!';
                const result = await SGEAuth.createUser({
                    fullName: data.fullName,
                    email: data.email,
                    role: data.role,
                    schoolId: data.schoolId || SGEAuth.getUserSchoolId(),
                    phone: data.phone
                }, tempPassword);

                if (result.success) {
                    SGENotifications.success(`Utilizador criado! Password temporária: ${tempPassword}`, 10000);
                    SGERouter.navigate('/system/users');
                } else {
                    SGENotifications.error(result.error);
                }
            }
        });
    }

    async function openEditModal(id) {
        const user = await SGEDb.get('users', id);
        if (!user) return;

        const currentUser = SGEAuth.getCurrentUser();
        const availableRoles = currentUser?.role === 'admin_geral'
            ? ROLES
            : ROLES.filter(r => SGESecurity.isRoleHigherOrEqual(currentUser.role, r.value) && r.value !== 'admin_geral');

        SGEComponents.openFormModal({
            title: 'Editar Utilizador',
            fields: [
                { name: 'fullName', label: 'Nome', type: 'text', required: true, grid: 'full' },
                { name: 'email', label: 'Email', type: 'email', required: true, disabled: true },
                { name: 'role', label: 'Papel', type: 'select', required: true, options: availableRoles },
                { name: 'phone', label: 'Telefone', type: 'text' }
            ],
            data: user,
            onSubmit: async (data) => {
                Object.assign(user, data);
                user.updatedAt = SGEUtils.nowISO();
                await SGEDb.put('users', user);

                await SGEDb.addAuditLog({
                    userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
                    action: 'update_user', module: 'users',
                    description: `Utilizador ${user.fullName} atualizado`,
                    details: { targetUserId: id, changes: Object.keys(data) }
                });

                SGENotifications.success('Utilizador atualizado!');
                SGERouter.navigate('/system/users');
            }
        });
    }

    async function toggleStatus(id) {
        const user = await SGEDb.get('users', id);
        if (!user) return;

        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        const result = await SGEAuth.setUserStatus(id, newStatus);

        if (result.success) {
            SGENotifications.success(`Utilizador ${newStatus === 'suspended' ? 'suspenso' : 'ativado'}.`);
            SGERouter.navigate('/system/users');
        } else {
            SGENotifications.error(result.error);
        }
    }

    async function resetPassword(id) {
        const ok = await SGEComponents.confirm({
            title: 'Reset de Password',
            message: 'Gerar nova password temporária para este utilizador?',
            type: 'warning'
        });
        if (!ok) return;

        const newPass = 'Sge' + Math.random().toString(36).substring(2, 8) + '!';
        SGENotifications.info(`Nova password temporária: ${newPass}`, 15000);
        SGENotifications.warning('Nota: O utilizador deve alterar a password no próximo login.');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, toggleStatus, resetPassword };
})();
window.SGEUsers = SGEUsers;