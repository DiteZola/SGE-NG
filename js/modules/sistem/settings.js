// ============================================
// SGE-NG - CONFIGURAÇÕES GERAIS
// Definições do sistema, escola, notas,
// documentos e parâmetros globais
// ============================================

const SGESettings = (() => {
    'use strict';

    async function render() {
        const user = SGEAuth.getCurrentUser();
        const schoolId = user?.schoolId;
        const isDirector = ['admin_geral', 'director'].includes(user?.role);

        if (!isDirector) return SGEComponents.alert('Acesso restrito à Direção.', 'error');

        const school = schoolId ? await SGEDb.get('schools', schoolId) : null;
        const gradeConfigs = schoolId ? await SGEDb.query('grade_config', { schoolId }) : [];
        const assessmentTypes = schoolId ? await SGEDb.query('assessment_types', { schoolId }) : [];

        let html = SGEComponents.pageHeader('Configurações', 'Definições gerais do sistema');

        // Tab 1: Dados da Escola
        const tabSchool = `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-4">🏫 Dados da Escola</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome da Escola</label>
                        <input type="text" id="set-school-name" value="${_esc(school?.name || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">NIF</label>
                        <input type="text" id="set-school-nif" value="${_esc(school?.nif || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                        <input type="text" id="set-school-address" value="${_esc(school?.address || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                        <input type="text" id="set-school-phone" value="${_esc(school?.phone || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" id="set-school-email" value="${_esc(school?.email || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Diretor Geral</label>
                        <input type="text" id="set-school-director" value="${_esc(school?.director || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Subdiretor Pedagógico</label>
                        <input type="text" id="set-school-subdirector" value="${_esc(school?.subdirector || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Decreto de Criação</label>
                        <input type="text" id="set-school-decree" value="${_esc(school?.decree || '')}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Logótipo da Escola</label>
                        <input type="file" id="set-school-logo" accept="image/*"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">
                        ${school?.logo ? `<img src="${school.logo}" class="w-16 h-16 mt-2 rounded-lg border">` : ''}
                    </div>
                </div>
                <button class="btn btn-primary mt-4" onclick="SGESettings.saveSchool()">💾 Guardar Dados da Escola</button>
            </div>
        `;

        // Tab 2: Configuração de Notas
        let tabGrades = `
            <div class="sge-card mb-4">
                <h3 class="font-bold text-gray-900 mb-4">📝 Tipos de Nota (MAC, NPP, NPT, MFD)</h3>
                <p class="text-sm text-gray-500 mb-4">Ative ou desative cada tipo de nota. As notas desativadas não entram nos cálculos.</p>
                <table class="sge-table sge-table-compact">
                    <thead><tr><th>Tipo</th><th>Nome</th><th>Fórmula</th><th>Estado</th><th>Ações</th></tr></thead>
                    <tbody>
                        ${gradeConfigs.map(gc => `
                            <tr>
                                <td><code class="font-bold text-primary-600">${gc.type}</code></td>
                                <td>${_esc(gc.name)}</td>
                                <td><code class="text-xs bg-gray-100 px-2 py-1 rounded">${_esc(gc.formula)}</code></td>
                                <td>
                                    <div class="toggle-switch ${gc.active ? 'active' : ''}"
                                        onclick="SGESettings.toggleGradeConfig('${gc.id}', this)"></div>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="SGESettings.editGradeConfig('${gc.id}')">Editar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-4">📋 Tipos de Avaliação</h3>
                <p class="text-sm text-gray-500 mb-4">Configure os tipos de avaliação disponíveis para os professores.</p>
                <table class="sge-table sge-table-compact">
                    <thead><tr><th>Código</th><th>Nome</th><th>Peso</th><th>Estado</th><th>Ações</th></tr></thead>
                    <tbody>
                        ${assessmentTypes.map(at => `
                            <tr>
                                <td><code class="font-bold">${_esc(at.code)}</code></td>
                                <td>${_esc(at.name)}</td>
                                <td class="text-center">${at.weight}</td>
                                <td>
                                    <div class="toggle-switch ${at.status === 'active' ? 'active' : ''}"
                                        onclick="SGESettings.toggleAssessmentType('${at.id}', this)"></div>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="SGESettings.editAssessmentType('${at.id}')">Editar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="btn btn-sm btn-primary mt-3" onclick="SGESettings.addAssessmentType()">+ Novo Tipo</button>
            </div>
        `;

        // Tab 3: Documentos e Impressão
        const passesPerPage = await SGEDb.getConfig('passes_per_page') || '8';
        const reportCardsPerPage = await SGEDb.getConfig('report_cards_per_page') || '4';
        const enrollmentFormat = await SGEDb.getConfig('enrollment_format') || 'MAT-{ANO}-{SEQ:5}';
        const processFormat = await SGEDb.getConfig('process_format') || 'PROC-{ANO}-{SEQ:5}';
        const passColor = await SGEDb.getConfig('pass_color') || '#2563EB';

        const tabDocs = `
            <div class="sge-card mb-4">
                <h3 class="font-bold text-gray-900 mb-4">📄 Configuração de Documentos</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Boletins por Página A4</label>
                        <select id="set-rc-per-page" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="2" ${reportCardsPerPage === '2' ? 'selected' : ''}>2</option>
                            <option value="4" ${reportCardsPerPage === '4' ? 'selected' : ''}>4</option>
                            <option value="6" ${reportCardsPerPage === '6' ? 'selected' : ''}>6</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Passes por Página A4</label>
                        <select id="set-pass-per-page" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white">
                            <option value="6" ${passesPerPage === '6' ? 'selected' : ''}>6</option>
                            <option value="8" ${passesPerPage === '8' ? 'selected' : ''}>8</option>
                            <option value="10" ${passesPerPage === '10' ? 'selected' : ''}>10</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Cor dos Passes</label>
                        <input type="color" id="set-pass-color" value="${passColor}"
                            class="w-full h-10 border-2 border-gray-300 rounded-lg cursor-pointer">
                    </div>
                </div>
            </div>

            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-4">🔢 Formatos de Numeração</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Formato Nº de Matrícula</label>
                        <input type="text" id="set-enrollment-format" value="${_esc(enrollmentFormat)}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-mono">
                        <p class="text-xs text-gray-400 mt-1">{ANO} = ano atual, {SEQ:N} = sequência com N dígitos</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Formato Nº de Processo</label>
                        <input type="text" id="set-process-format" value="${_esc(processFormat)}"
                            class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-mono">
                    </div>
                </div>
                <button class="btn btn-primary mt-4" onclick="SGESettings.saveDocSettings()">💾 Guardar Configurações</button>
            </div>
        `;

        // Tab 4: Províncias e Municípios
        const tabGeo = `
            <div class="sge-card">
                <h3 class="font-bold text-gray-900 mb-4">🗺️ Províncias e Municípios</h3>
                <p class="text-sm text-gray-500 mb-4">As 18 províncias de Angola estão pré-configuradas. Pode adicionar municípios personalizados.</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    ${SGEUtils.getProvinces().map(p => `
                        <div class="p-2 bg-gray-50 rounded-lg text-center text-sm font-medium text-gray-700">
                            ${p.name}
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4">
                    <button class="btn btn-sm btn-primary" onclick="SGESettings.addMunicipality()">+ Adicionar Município</button>
                </div>
            </div>
        `;

        html += SGEComponents.renderTabs([
            { id: 'school', label: '🏫 Escola', content: tabSchool },
            { id: 'grades', label: '📝 Notas', content: tabGrades },
            { id: 'docs', label: '📄 Documentos', content: tabDocs },
            { id: 'geo', label: '🗺️ Geografia', content: tabGeo }
        ]);

        return html;
    }

    async function saveSchool() {
        const schoolId = SGEAuth.getUserSchoolId();
        const school = await SGEDb.get('schools', schoolId);
        if (!school) return SGENotifications.error('Escola não encontrada.');

        school.name = document.getElementById('set-school-name')?.value?.trim() || school.name;
        school.nif = document.getElementById('set-school-nif')?.value?.trim() || school.nif;
        school.address = document.getElementById('set-school-address')?.value?.trim() || school.address;
        school.phone = document.getElementById('set-school-phone')?.value?.trim() || school.phone;
        school.email = document.getElementById('set-school-email')?.value?.trim() || school.email;
        school.director = document.getElementById('set-school-director')?.value?.trim() || school.director;
        school.subdirector = document.getElementById('set-school-subdirector')?.value?.trim() || school.subdirector;
        school.decree = document.getElementById('set-school-decree')?.value?.trim() || school.decree;

        // Logótipo
        const logoInput = document.getElementById('set-school-logo');
        if (logoInput?.files?.[0]) {
            try {
                const base64 = await SGEUtils.fileToBase64(logoInput.files[0]);
                const compressed = await SGEUtils.compressImage(base64, 200, 0.8);
                school.logo = compressed;
            } catch (e) {
                SGENotifications.warning('Erro ao processar logótipo.');
            }
        }

        await SGEDb.put('schools', school);

        await SGEDb.addAuditLog({
            userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
            schoolId, action: 'update_school_settings', module: 'settings',
            description: 'Dados da escola atualizados'
        });

        SGENotifications.success('Dados da escola guardados!');
    }

    async function toggleGradeConfig(id, el) {
        const config = await SGEDb.get('grade_config', id);
        if (!config) return;
        config.active = !config.active;
        await SGEDb.put('grade_config', config);
        el.classList.toggle('active');
        SGENotifications.info(`${config.type} ${config.active ? 'ativado' : 'desativado'}.`);
    }

    async function editGradeConfig(id) {
        const config = await SGEDb.get('grade_config', id);
        if (!config) return;

        SGEComponents.openFormModal({
            title: `Editar ${config.type}`,
            fields: [
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'formula', label: 'Fórmula de Cálculo', type: 'text', required: true, grid: 'full',
                    help: 'Variáveis: MAC, NPP, NPT, SUM(), COUNT(), AVG(). Ex: (MAC*0.6)+(NPP*0.2)+(NPT*0.2)' },
                { name: 'description', label: 'Descrição', type: 'textarea', grid: 'full' }
            ],
            data: config,
            onSubmit: async (data) => {
                Object.assign(config, data);
                await SGEDb.put('grade_config', config);
                SGENotifications.success(`${config.type} atualizado!`);
                SGERouter.navigate('/system/settings');
            }
        });
    }

    async function toggleAssessmentType(id, el) {
        const type = await SGEDb.get('assessment_types', id);
        if (!type) return;
        type.status = type.status === 'active' ? 'inactive' : 'active';
        await SGEDb.put('assessment_types', type);
        el.classList.toggle('active');
        SGENotifications.info(`${type.name} ${type.status === 'active' ? 'ativado' : 'desativado'}.`);
    }

    async function editAssessmentType(id) {
        const type = await SGEDb.get('assessment_types', id);
        if (!type) return;

        SGEComponents.openFormModal({
            title: 'Editar Tipo de Avaliação',
            fields: [
                { name: 'code', label: 'Código', type: 'text', required: true },
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'weight', label: 'Peso', type: 'number', min: 0, max: 10, step: 0.5 }
            ],
            data: type,
            onSubmit: async (data) => {
                Object.assign(type, data);
                await SGEDb.put('assessment_types', type);
                SGENotifications.success('Tipo atualizado!');
                SGERouter.navigate('/system/settings');
            }
        });
    }

    function addAssessmentType() {
        SGEComponents.openFormModal({
            title: 'Novo Tipo de Avaliação',
            fields: [
                { name: 'code', label: 'Código', type: 'text', required: true, placeholder: 'Ex: T3' },
                { name: 'name', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: 3º Teste' },
                { name: 'weight', label: 'Peso', type: 'number', min: 0, max: 10, step: 0.5, defaultValue: 1 }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('assessment_types', {
                    schoolId: SGEAuth.getUserSchoolId(),
                    ...data, levelId: null, classId: null,
                    status: 'active', createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Tipo criado!');
                SGERouter.navigate('/system/settings');
            }
        });
    }

    async function saveDocSettings() {
        await SGEDb.setConfig('report_cards_per_page', document.getElementById('set-rc-per-page')?.value || '4');
        await SGEDb.setConfig('passes_per_page', document.getElementById('set-pass-per-page')?.value || '8');
        await SGEDb.setConfig('pass_color', document.getElementById('set-pass-color')?.value || '#2563EB');
        await SGEDb.setConfig('enrollment_format', document.getElementById('set-enrollment-format')?.value || 'MAT-{ANO}-{SEQ:5}');
        await SGEDb.setConfig('process_format', document.getElementById('set-process-format')?.value || 'PROC-{ANO}-{SEQ:5}');
        SGENotifications.success('Configurações de documentos guardadas!');
    }

    function addMunicipality() {
        const provinces = SGEUtils.getProvinces();
        SGEComponents.openFormModal({
            title: 'Adicionar Município',
            fields: [
                { name: 'provinceId', label: 'Província', type: 'select', required: true,
                    options: provinces.map(p => ({ value: p.code, label: p.name })) },
                { name: 'name', label: 'Nome do Município', type: 'text', required: true }
            ],
            onSubmit: async (data) => {
                await SGEDb.put('municipalities', {
                    ...data, createdAt: SGEUtils.nowISO()
                });
                SGENotifications.success('Município adicionado!');
            }
        });
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, saveSchool, toggleGradeConfig, editGradeConfig, toggleAssessmentType, editAssessmentType, addAssessmentType, saveDocSettings, addMunicipality };
})();
window.SGESettings = SGESettings;