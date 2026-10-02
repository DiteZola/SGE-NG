// ============================================
// SGE-NG - GESTÃO DE CLASSES
// Níveis de ensino e classes
// ============================================

const SGEClasses = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const levels = await SGEDb.query('education_levels', { schoolId }, { orderBy: ['order', 'asc'] });
        const classes = await SGEDb.query('classes', { schoolId }, { orderBy: ['order', 'asc'] });

        let html = SGEComponents.pageHeader('Classes', 'Gestão dos níveis de ensino e classes', [
            { label: '+ Novo Nível', type: 'primary', onClick: 'SGEClasses.openLevelModal()' },
            { label: '+ Nova Classe', type: 'success', onClick: 'SGEClasses.openClassModal()' }
        ]);

        if (levels.length === 0) {
            html += SGEComponents.emptyState('Nenhum nível de ensino cadastrado.',
                `<button class="btn btn-primary btn-sm" onclick="SGEClasses.openLevelModal()">+ Criar Nível</button>`
            );
            return html;
        }

        // Agrupar classes por nível
        for (const level of levels) {
            const levelClasses = classes.filter(c => c.levelId === level.id);

            html += `
                <div class="sge-card mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                                ${level.code?.substring(0, 2).toUpperCase() || 'N'}
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-900">${_esc(level.name)}</h3>
                                <p class="text-xs text-gray-500">${levelClasses.length} classe(s)</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${SGEComponents.statusBadge(level.status)}
                            <button class="btn btn-sm btn-secondary" onclick="SGEClasses.editLevel('${level.id}')">Editar</button>
                        </div>
                    </div>

                    ${levelClasses.length > 0 ? `
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            ${levelClasses.map(cls => `
                                <div class="p-3 border-2 rounded-lg text-center hover:border-primary-400 transition-colors
                                    ${cls.isFinal ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                                    <p class="font-bold text-gray-900 text-sm">${_esc(cls.name)}</p>
                                    ${cls.isFinal ? '<span class="text-xs text-yellow-600 font-medium">Classe Final</span>' : ''}
                                    <div class="flex items-center justify-center gap-1 mt-2">
                                        <button class="text-xs text-primary-600 hover:underline" onclick="SGEClasses.editClass('${cls.id}')">Editar</button>
                                        <button class="text-xs text-danger-600 hover:underline" onclick="SGEClasses.deleteClass('${cls.id}')">Eliminar</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p class="text-sm text-gray-400 text-center py-4">Nenhuma classe neste nível.
                            <button class="text-primary-600 hover:underline" onclick="SGEClasses.openClassModal('${level.id}')">Adicionar</button>
                        </p>
                    `}
                </div>
            `;
        }

        return html;
    }

    function openLevelModal(id = null) {
        SGEDb.query('education_levels', { schoolId: SGEAuth.getUserSchoolId() }).then(levels => {
            const existing = id ? levels.find(l => l.id === id) : null;

            SGEComponents.openFormModal({
                title: id ? 'Editar Nível de Ensino' : 'Novo Nível de Ensino',
                fields: [
                    { name: 'name', label: 'Nome do Nível', type: 'text', required: true, placeholder: 'Ex: Ensino Primário', grid: 'full' },
                    { name: 'code', label: 'Código', type: 'text', required: true, placeholder: 'Ex: primario' },
                    { name: 'order', label: 'Ordem', type: 'number', required: true, min: 0, defaultValue: levels.length }
                ],
                data: existing || {},
                onSubmit: async (data) => {
                    if (existing) {
                        Object.assign(existing, data);
                        await SGEDb.put('education_levels', existing);
                    } else {
                        await SGEDb.put('education_levels', {
                            schoolId: SGEAuth.getUserSchoolId(),
                            ...data, status: 'active', createdAt: SGEUtils.nowISO()
                        });
                    }
                    SGENotifications.success('Nível guardado!');
                    SGERouter.navigate('/academic/classes');
                }
            });
        });
    }

    function editLevel(id) { openLevelModal(id); }

    function openClassModal(levelId = null) {
        SGEDb.query('education_levels', { schoolId: SGEAuth.getUserSchoolId() }).then(levels => {
            const levelOptions = levels.map(l => ({ value: l.id, label: l.name }));

            SGEComponents.openFormModal({
                title: 'Nova Classe',
                fields: [
                    { name: 'levelId', label: 'Nível de Ensino', type: 'select', required: true, options: levelOptions, defaultValue: levelId || '' },
                    { name: 'name', label: 'Nome da Classe', type: 'text', required: true, placeholder: 'Ex: 7ª Classe' },
                    { name: 'number', label: 'Número', type: 'number', required: true, min: 0, placeholder: 'Ex: 7' },
                    { name: 'order', label: 'Ordem', type: 'number', min: 0, defaultValue: 0 },
                    { name: 'isFinal', label: 'Classe Final?', type: 'toggle', toggleLabel: 'Sim (6ª, 9ª, 12ª, 13ª)' }
                ],
                onSubmit: async (data) => {
                    await SGEDb.put('classes', {
                        schoolId: SGEAuth.getUserSchoolId(),
                        ...data, courseId: null,
                        status: 'active', createdAt: SGEUtils.nowISO()
                    });
                    SGENotifications.success('Classe criada!');
                    SGERouter.navigate('/academic/classes');
                }
            });
        });
    }

    async function editClass(id) {
        const cls = await SGEDb.get('classes', id);
        if (!cls) return;
        const levels = await SGEDb.query('education_levels', { schoolId: SGEAuth.getUserSchoolId() });
        const levelOptions = levels.map(l => ({ value: l.id, label: l.name }));

        SGEComponents.openFormModal({
            title: 'Editar Classe',
            fields: [
                { name: 'levelId', label: 'Nível', type: 'select', required: true, options: levelOptions },
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'number', label: 'Número', type: 'number', required: true, min: 0 },
                { name: 'order', label: 'Ordem', type: 'number', min: 0 },
                { name: 'isFinal', label: 'Classe Final?', type: 'toggle' }
            ],
            data: cls,
            onSubmit: async (data) => {
                Object.assign(cls, data);
                await SGEDb.put('classes', cls);
                SGENotifications.success('Classe atualizada!');
                SGERouter.navigate('/academic/classes');
            }
        });
    }

    async function deleteClass(id) {
        const confirmed = await SGEComponents.confirm({
            title: 'Eliminar Classe',
            message: 'Tem a certeza? Esta ação não pode ser desfeita.',
            type: 'danger'
        });
        if (!confirmed) return;
        await SGEDb.remove('classes', id);
        SGENotifications.success('Classe eliminada.');
        SGERouter.navigate('/academic/classes');
    }

    function _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    return { render, openLevelModal, editLevel, openClassModal, editClass, deleteClass };
})();

window.SGEClasses = SGEClasses;