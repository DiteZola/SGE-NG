// ============================================
// SGE-NG - GESTÃO DE TURNOS
// ============================================

const SGEShifts = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const shifts = await SGEDb.query('shifts', { schoolId }, { orderBy: ['order', 'asc'] });

        let html = SGEComponents.pageHeader('Turnos', 'Horários de funcionamento da escola', [
            { label: '+ Novo Turno', type: 'primary', onClick: 'SGEShifts.openCreateModal()' }
        ]);

        if (shifts.length === 0) {
            html += SGEComponents.emptyState('Nenhum turno cadastrado.',
                `<button class="btn btn-primary btn-sm" onclick="SGEShifts.openCreateModal()">+ Criar Turno</button>`);
            return html;
        }

        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">`;
        for (const shift of shifts) {
            const sections = await SGEDb.query('sections', { schoolId, shiftId: shift.id });
            const icons = { manha: '🌅', tarde: '☀️', noite: '🌙' };
            const icon = icons[shift.code] || '🕐';

            html += `
                <div class="sge-card">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${icon}</span>
                            <div>
                                <h3 class="font-bold text-gray-900">${_esc(shift.name)}</h3>
                                <p class="text-sm text-gray-500">${shift.startTime || '--:--'} - ${shift.endTime || '--:--'}</p>
                            </div>
                        </div>
                        ${SGEComponents.statusBadge(shift.status)}
                    </div>
                    <p class="text-sm text-gray-600 mb-3">${sections.length} turma(s) neste turno</p>
                    <div class="flex gap-2 pt-3 border-t border-gray-100">
                        <button class="btn btn-sm btn-secondary" onclick="SGEShifts.openEditModal('${shift.id}')">Editar</button>
                        <button class="btn btn-sm btn-danger-outline" onclick="SGEShifts.deleteShift('${shift.id}')">Eliminar</button>
                    </div>
                </div>`;
        }
        html += `</div>`;
        return html;
    }

    function openCreateModal() {
        SGEComponents.openFormModal({
            title: 'Novo Turno',
            fields: [
                { name: 'name', label: 'Nome do Turno', type: 'text', required: true, placeholder: 'Ex: Manhã' },
                { name: 'code', label: 'Código', type: 'text', required: true, placeholder: 'Ex: manha' },
                { name: 'startTime', label: 'Hora de Início', type: 'text', required: true, placeholder: '07:00' },
                { name: 'endTime', label: 'Hora de Fim', type: 'text', required: true, placeholder: '12:30' },
                { name: 'order', label: 'Ordem', type: 'number', min: 1, defaultValue: 1 }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('shifts', {
                    schoolId: SGEAuth.getUserSchoolId(),
                    ...data, status: 'active', createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Turno criado!');
                SGERouter.navigate('/academic/shifts');
            }
        });
    }

    async function openEditModal(id) {
        const shift = await SGEDb.get('shifts', id);
        if (!shift) return;
        SGEComponents.openFormModal({
            title: 'Editar Turno',
            fields: [
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'code', label: 'Código', type: 'text', required: true },
                { name: 'startTime', label: 'Hora de Início', type: 'text', required: true },
                { name: 'endTime', label: 'Hora de Fim', type: 'text', required: true },
                { name: 'order', label: 'Ordem', type: 'number', min: 1 }
            ],
            data: shift,
            onSubmit: async (data) => {
                Object.assign(shift, data);
                await SGEDb.put('shifts', shift);
                SGENotifications.success('Turno atualizado!');
                SGERouter.navigate('/academic/shifts');
            }
        });
    }

    async function deleteShift(id) {
        const sections = await SGEDb.query('sections', { shiftId: id });
        if (sections.length > 0) return SGENotifications.warning(`Não pode eliminar: ${sections.length} turma(s) neste turno.`);
        const ok = await SGEComponents.confirm({ title: 'Eliminar Turno', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('shifts', id);
        SGENotifications.success('Turno eliminado.');
        SGERouter.navigate('/academic/shifts');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, deleteShift };
})();
window.SGEShifts = SGEShifts;