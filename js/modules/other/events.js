// ============================================
// SGE-NG - EVENTOS E CALENDÁRIO ESCOLAR
// Reuniões, exames, feriados e atividades
// ============================================

const SGEEvents = (() => {
    'use strict';

    const EVENT_TYPES = [
        { value: 'exam', label: 'Exame / Prova', icon: '📝', color: 'danger' },
        { value: 'meeting', label: 'Reunião', icon: '🤝', color: 'primary' },
        { value: 'holiday', label: 'Feriado', icon: '🎉', color: 'success' },
        { value: 'activity', label: 'Atividade Extracurricular', icon: '⚽', color: 'warning' },
        { value: 'deadline', label: 'Prazo Limite', icon: '⏰', color: 'danger' },
        { value: 'ceremony', label: 'Cerimónia', icon: '🎓', color: 'purple' },
        { value: 'other', label: 'Outro', icon: '📌', color: 'neutral' }
    ];

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const events = await SGEDb.query('events', { schoolId }, { orderBy: ['date', 'asc'] });
        const today = new Date().toISOString().split('T')[0];
        const upcoming = events.filter(e => e.date >= today);
        const past = events.filter(e => e.date < today);

        let html = SGEComponents.pageHeader('Eventos', 'Calendário escolar', [
            { label: '+ Novo Evento', type: 'primary', onClick: 'SGEEvents.openCreateModal()' }
        ]);

        // Próximos eventos
        html += `<h3 class="text-lg font-bold text-gray-900 mb-3">📅 Próximos Eventos (${upcoming.length})</h3>`;

        if (upcoming.length === 0) {
            html += SGEComponents.emptyState('Nenhum evento programado.');
        } else {
            html += `<div class="space-y-3 mb-8">`;
            for (const event of upcoming.slice(0, 10)) {
                const typeInfo = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[6];
                const eventDate = new Date(event.date);
                const dayName = eventDate.toLocaleDateString('pt-AO', { weekday: 'long' });
                const isToday = event.date === today;

                html += `
                    <div class="sge-card flex items-start gap-4 ${isToday ? 'border-l-4 border-l-primary-500 bg-primary-50' : ''}">
                        <div class="text-center flex-shrink-0 w-16">
                            <p class="text-2xl font-bold text-gray-900">${eventDate.getDate()}</p>
                            <p class="text-xs text-gray-500 uppercase">${eventDate.toLocaleDateString('pt-AO', { month: 'short' })}</p>
                            <p class="text-xs text-gray-400 capitalize">${dayName}</p>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-lg">${typeInfo.icon}</span>
                                <h4 class="font-bold text-gray-900">${_esc(event.title)}</h4>
                                ${isToday ? SGEComponents.badge('HOJE', 'info') : ''}
                                ${SGEComponents.badge(typeInfo.label, typeInfo.color)}
                            </div>
                            <p class="text-sm text-gray-600">${_esc(event.description || '')}</p>
                            ${event.time ? `<p class="text-xs text-gray-400 mt-1">🕐 ${event.time}</p>` : ''}
                            ${event.location ? `<p class="text-xs text-gray-400">📍 ${_esc(event.location)}</p>` : ''}
                        </div>
                        <div class="flex gap-1 flex-shrink-0">
                            <button class="btn btn-sm btn-secondary" onclick="SGEEvents.openEditModal('${event.id}')">Editar</button>
                            <button class="btn btn-sm btn-danger-outline" onclick="SGEEvents.deleteEvent('${event.id}')">✕</button>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Eventos passados
        if (past.length > 0) {
            html += `<h3 class="text-lg font-bold text-gray-900 mb-3">✅ Eventos Passados (${past.length})</h3>`;
            html += `<div class="space-y-2 opacity-60">`;
            for (const event of past.slice(-5).reverse()) {
                const typeInfo = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[6];
                html += `
                    <div class="sge-card flex items-center gap-3 py-2">
                        <span>${typeInfo.icon}</span>
                        <span class="text-sm text-gray-500">${SGEUtils.formatDate(event.date)}</span>
                        <span class="text-sm font-medium text-gray-700">${_esc(event.title)}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }

        return html;
    }

    function openCreateModal() {
        SGEComponents.openFormModal({
            title: 'Novo Evento',
            fields: [
                { name: 'title', label: 'Título do Evento', type: 'text', required: true, grid: 'full', placeholder: 'Ex: Exame Final de Matemática' },
                { name: 'type', label: 'Tipo', type: 'select', required: true, options: EVENT_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` })) },
                { name: 'date', label: 'Data', type: 'date', required: true },
                { name: 'time', label: 'Hora', type: 'text', placeholder: 'Ex: 08:00 - 10:00' },
                { name: 'location', label: 'Local', type: 'text', placeholder: 'Ex: Sala 101, Bloco A' },
                { name: 'description', label: 'Descrição', type: 'textarea', grid: 'full', rows: 3 }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('events', {
                    schoolId: SGEAuth.getUserSchoolId(),
                    ...data,
                    createdBy: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Evento criado!');
                SGERouter.navigate('/events');
            }
        });
    }

    async function openEditModal(id) {
        const event = await SGEDb.get('events', id);
        if (!event) return;

        SGEComponents.openFormModal({
            title: 'Editar Evento',
            fields: [
                { name: 'title', label: 'Título', type: 'text', required: true, grid: 'full' },
                { name: 'type', label: 'Tipo', type: 'select', required: true, options: EVENT_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` })) },
                { name: 'date', label: 'Data', type: 'date', required: true },
                { name: 'time', label: 'Hora', type: 'text' },
                { name: 'location', label: 'Local', type: 'text' },
                { name: 'description', label: 'Descrição', type: 'textarea', grid: 'full', rows: 3 }
            ],
            data: event,
            onSubmit: async (data) => {
                Object.assign(event, data);
                await SGEDb.put('events', event);
                SGENotifications.success('Evento atualizado!');
                SGERouter.navigate('/events');
            }
        });
    }

    async function deleteEvent(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Evento', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;
        await SGEDb.remove('events', id);
        SGENotifications.success('Evento eliminado.');
        SGERouter.navigate('/events');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openCreateModal, openEditModal, deleteEvent };
})();
window.SGEEvents = SGEEvents;