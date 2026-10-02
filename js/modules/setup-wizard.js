// ============================================
// SGE-NG - ASSISTENTE DE CONFIGURAÇÃO INICIAL
// Setup Wizard - Primeira execução do sistema
// Cria o Admin Geral e a primeira escola
// ============================================

const SGESetupWizard = (() => {
    'use strict';

    let _currentStep = 1;
    const _totalSteps = 4;
    let _formData = { admin: {}, school: {}, academic: {} };

    // ============================================
    // VERIFICAÇÃO: O SISTEMA JÁ FOI CONFIGURADO?
    // ============================================

    async function needsSetup() {
        try {
            const configured = await SGEDb.getConfig('system_initialized');
            if (configured === true) return false;
            const admins = await SGEDb.getByIndex('users', 'role', 'admin_geral');
            if (admins.length > 0) return false;
            return true;
        } catch {
            return true;
        }
    }

    // ============================================
    // RENDERIZAÇÃO PRINCIPAL
    // ============================================

    async function render() {
        const container = document.getElementById('setup-wizard-container');
        if (!container) return;

        const needs = await needsSetup();
        if (!needs) {
            SGEUtils.hide('#setup-screen');
            SGEUtils.show('#login-screen');
            return;
        }

        _currentStep = 1;
        _renderStep(container);
    }

    function _renderStep(container) {
        if (!container) container = document.getElementById('setup-wizard-container');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center mb-8">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
                    <svg class="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                </div>
                <h1 class="text-2xl font-bold text-gray-900">Configuração Inicial do SGE-NG</h1>
                <p class="text-gray-500 text-sm mt-1">Configure o sistema para começar a utilizar</p>
            </div>

            <div class="wizard-step-indicator mb-8">
                ${_renderStepIndicators()}
            </div>

            <div class="sge-card animate-fadeInUp" id="wizard-step-content">
                ${_getStepContent()}
            </div>

            <div class="flex items-center justify-between mt-6">
                <button id="wizard-prev-btn" class="btn btn-secondary ${_currentStep === 1 ? 'invisible' : ''}"
                    onclick="SGESetupWizard.prevStep()">
                    ← Anterior
                </button>
                <span class="text-sm text-gray-400">Passo ${_currentStep} de ${_totalSteps}</span>
                ${_currentStep < _totalSteps ? `
                    <button id="wizard-next-btn" class="btn btn-primary" onclick="SGESetupWizard.nextStep()">
                        Seguinte →
                    </button>
                ` : `
                    <button id="wizard-finish-btn" class="btn btn-success" onclick="SGESetupWizard.finish()">
                        ✓ Concluir Configuração
                    </button>
                `}
            </div>
        `;
    }

    function _renderStepIndicators() {
        const labels = ['Administrador', 'Escola', 'Académico', 'Confirmação'];
        let html = '';
        for (let i = 1; i <= _totalSteps; i++) {
            const state = i < _currentStep ? 'completed' : i === _currentStep ? 'active' : '';
            html += `<div class="wizard-step-dot ${state}" title="${labels[i-1]}">${i < _currentStep ? '✓' : i}</div>`;
            if (i < _totalSteps) {
                html += `<div class="wizard-step-line ${i < _currentStep ? 'completed' : ''}"></div>`;
            }
        }
        return html;
    }

    // ============================================
    // CONTEÚDO DE CADA PASSO
    // ============================================

    function _getStepContent() {
        switch (_currentStep) {
            case 1: return _stepAdmin();
            case 2: return _stepSchool();
            case 3: return _stepAcademic();
            case 4: return _stepConfirmation();
            default: return '';
        }
    }

    // ---- PASSO 1: ADMINISTRADOR GERAL ----
    function _stepAdmin() {
        const d = _formData.admin;
        return `
            <h2 class="text-lg font-bold text-gray-900 mb-1">Criar Administrador Geral</h2>
            <p class="text-sm text-gray-500 mb-6">O Administrador Geral tem acesso total ao sistema. Só pode existir um.</p>

            <div id="step1-error" class="hidden mb-4"></div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo <span class="text-danger-500">*</span>
                    </label>
                    <input type="text" id="admin-fullName" value="${_esc(d.fullName || '')}"
                        placeholder="Ex: João Manuel da Silva"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Email <span class="text-danger-500">*</span>
                    </label>
                    <input type="email" id="admin-email" value="${_esc(d.email || '')}"
                        placeholder="admin@escola.ao"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                    <p class="text-xs text-gray-400 mt-1">Será usado para fazer login</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input type="tel" id="admin-phone" value="${_esc(d.phone || '')}"
                        placeholder="+244 9XX XXX XXX"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Palavra-passe <span class="text-danger-500">*</span>
                    </label>
                    <input type="password" id="admin-password" placeholder="Mínimo 6 caracteres"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar Palavra-passe <span class="text-danger-500">*</span>
                    </label>
                    <input type="password" id="admin-password-confirm" placeholder="Repita a palavra-passe"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
            </div>

            <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p class="text-xs text-yellow-800">
                    <strong>⚠️ Importante:</strong> Guarde bem a sua palavra-passe. O Administrador Geral tem controlo total sobre todo o sistema.
                </p>
            </div>
        `;
    }

    // ---- PASSO 2: DADOS DA ESCOLA ----
    function _stepSchool() {
        const d = _formData.school;
        const provinces = SGEUtils.getProvinces();
        return `
            <h2 class="text-lg font-bold text-gray-900 mb-1">Dados da Escola</h2>
            <p class="text-sm text-gray-500 mb-6">Informe os dados da instituição de ensino principal.</p>

            <div id="step2-error" class="hidden mb-4"></div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Nome Oficial da Escola <span class="text-danger-500">*</span>
                    </label>
                    <input type="text" id="school-name" value="${_esc(d.name || '')}"
                        placeholder="Ex: Escola Secundária do Kilamba"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">NIF da Escola</label>
                    <input type="text" id="school-nif" value="${_esc(d.nif || '')}"
                        placeholder="Nº de Identificação Fiscal"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Decreto de Criação</label>
                    <input type="text" id="school-decree" value="${_esc(d.decree || '')}"
                        placeholder="Ex: Decreto nº XXX/XXXX"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Endereço Completo <span class="text-danger-500">*</span>
                    </label>
                    <input type="text" id="school-address" value="${_esc(d.address || '')}"
                        placeholder="Rua, Bairro, Município"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Província <span class="text-danger-500">*</span>
                    </label>
                    <select id="school-province"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors bg-white">
                        <option value="">-- Selecionar --</option>
                        ${provinces.map(p => `<option value="${p.code}" ${d.province === p.code ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Município</label>
                    <input type="text" id="school-municipality" value="${_esc(d.municipality || '')}"
                        placeholder="Município"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Telefone da Escola</label>
                    <input type="tel" id="school-phone" value="${_esc(d.phone || '')}"
                        placeholder="+244 2XX XXX XXX"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email da Escola</label>
                    <input type="email" id="school-email" value="${_esc(d.email || '')}"
                        placeholder="escola@email.ao"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Diretor Geral <span class="text-danger-500">*</span>
                    </label>
                    <input type="text" id="school-director" value="${_esc(d.director || '')}"
                        placeholder="Nome completo do Diretor"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Subdiretor Pedagógico</label>
                    <input type="text" id="school-subdirector" value="${_esc(d.subdirector || '')}"
                        placeholder="Nome completo do Subdiretor"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
            </div>
        `;
    }

    // ---- PASSO 3: CONFIGURAÇÃO ACADÉMICA ----
    function _stepAcademic() {
        const d = _formData.academic;
        const currentYear = new Date().getFullYear();
        return `
            <h2 class="text-lg font-bold text-gray-900 mb-1">Configuração Académica</h2>
            <p class="text-sm text-gray-500 mb-6">Defina o ano letivo e os níveis de ensino da escola.</p>

            <div id="step3-error" class="hidden mb-4"></div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Ano Letivo Atual <span class="text-danger-500">*</span>
                    </label>
                    <input type="text" id="academic-year" value="${_esc(d.year || currentYear + '/' + (currentYear + 1))}"
                        placeholder="Ex: 2025/2026"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Data de Início <span class="text-danger-500">*</span>
                    </label>
                    <input type="date" id="academic-start" value="${d.startDate || ''}"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Data de Fim</label>
                    <input type="date" id="academic-end" value="${d.endDate || ''}"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Formato Nº de Matrícula</label>
                    <input type="text" id="academic-enrollment-format" value="${_esc(d.enrollmentFormat || 'MAT-{ANO}-{SEQ:5}')}"
                        placeholder="MAT-{ANO}-{SEQ:5}"
                        class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors">
                    <p class="text-xs text-gray-400 mt-1">{ANO} = ano, {SEQ:N} = sequência com N dígitos</p>
                </div>
            </div>

            <div class="mt-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">
                    Níveis de Ensino <span class="text-danger-500">*</span>
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${_levelCheck('iniciacao', 'Iniciação', 'Classe de Iniciação (obrigatória para primárias)', d.levels)}
                    ${_levelCheck('primario', 'Ensino Primário', '1ª à 6ª Classe (notas 0-10)', d.levels)}
                    ${_levelCheck('ciclo1', 'Iº Ciclo', '7ª à 9ª Classe (notas 0-20)', d.levels)}
                    ${_levelCheck('ciclo2', 'IIº Ciclo', '10ª à 13ª Classe (notas 0-20)', d.levels)}
                </div>
            </div>

            <div class="mt-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">Turnos de Funcionamento</label>
                <div class="flex flex-wrap gap-3">
                    ${_shiftCheck('manha', 'Manhã', d.shifts)}
                    ${_shiftCheck('tarde', 'Tarde', d.shifts)}
                    ${_shiftCheck('noite', 'Noite', d.shifts)}
                </div>
            </div>
        `;
    }

    function _levelCheck(value, label, desc, levels) {
        const checked = levels?.includes(value);
        return `
            <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors
                ${checked ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
                onclick="this.classList.toggle('border-primary-500'); this.classList.toggle('bg-primary-50')">
                <input type="checkbox" name="academic-levels" value="${value}" ${checked ? 'checked' : ''}
                    class="w-4 h-4 text-primary-600 border-gray-300 rounded mt-0.5">
                <div>
                    <p class="text-sm font-medium text-gray-900">${label}</p>
                    <p class="text-xs text-gray-500">${desc}</p>
                </div>
            </label>`;
    }

    function _shiftCheck(value, label, shifts) {
        const checked = shifts?.includes(value);
        return `
            <label class="flex items-center gap-2 px-4 py-2 border-2 rounded-lg cursor-pointer transition-colors
                ${checked ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
                onclick="this.classList.toggle('border-primary-500'); this.classList.toggle('bg-primary-50')">
                <input type="checkbox" name="academic-shifts" value="${value}" ${checked ? 'checked' : ''}
                    class="w-4 h-4 text-primary-600 border-gray-300 rounded">
                <span class="text-sm font-medium text-gray-700">${label}</span>
            </label>`;
    }

    // ---- PASSO 4: CONFIRMAÇÃO ----
    function _stepConfirmation() {
        const a = _formData.admin;
        const s = _formData.school;
        const ac = _formData.academic;
        const levelNames = { iniciacao: 'Iniciação', primario: 'Primário', ciclo1: 'Iº Ciclo', ciclo2: 'IIº Ciclo' };
        const shiftNames = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
        const levels = (ac.levels || []).map(l => levelNames[l] || l).join(', ') || 'Nenhum';
        const shifts = (ac.shifts || []).map(s => shiftNames[s] || s).join(', ') || 'Nenhum';

        return `
            <h2 class="text-lg font-bold text-gray-900 mb-1">Confirmação</h2>
            <p class="text-sm text-gray-500 mb-6">Revise os dados antes de concluir.</p>

            <div id="step4-error" class="hidden mb-4"></div>

            <div class="sge-card mb-4 bg-gray-50">
                <h3 class="text-sm font-semibold text-gray-900 mb-3">👤 Administrador Geral</h3>
                <dl class="grid grid-cols-2 gap-2 text-sm">
                    <dt class="text-gray-500">Nome:</dt><dd class="font-medium">${_esc(a.fullName || '---')}</dd>
                    <dt class="text-gray-500">Email:</dt><dd class="font-medium">${_esc(a.email || '---')}</dd>
                    <dt class="text-gray-500">Telefone:</dt><dd class="font-medium">${_esc(a.phone || '---')}</dd>
                </dl>
            </div>

            <div class="sge-card mb-4 bg-gray-50">
                <h3 class="text-sm font-semibold text-gray-900 mb-3">🏫 Escola</h3>
                <dl class="grid grid-cols-2 gap-2 text-sm">
                    <dt class="text-gray-500">Nome:</dt><dd class="font-medium">${_esc(s.name || '---')}</dd>
                    <dt class="text-gray-500">Província:</dt><dd class="font-medium">${_esc(s.province || '---')}</dd>
                    <dt class="text-gray-500">Endereço:</dt><dd class="font-medium">${_esc(s.address || '---')}</dd>
                    <dt class="text-gray-500">Diretor:</dt><dd class="font-medium">${_esc(s.director || '---')}</dd>
                </dl>
            </div>

            <div class="sge-card bg-gray-50">
                <h3 class="text-sm font-semibold text-gray-900 mb-3">📚 Académico</h3>
                <dl class="grid grid-cols-2 gap-2 text-sm">
                    <dt class="text-gray-500">Ano Letivo:</dt><dd class="font-medium">${_esc(ac.year || '---')}</dd>
                    <dt class="text-gray-500">Níveis:</dt><dd class="font-medium">${levels}</dd>
                    <dt class="text-gray-500">Turnos:</dt><dd class="font-medium">${shifts}</dd>
                    <dt class="text-gray-500">Nº Matrícula:</dt><dd class="font-medium">${_esc(ac.enrollmentFormat || '---')}</dd>
                </dl>
            </div>

            <div class="mt-4 p-3 bg-success-50 border border-success-200 rounded-lg">
                <p class="text-xs text-success-800">
                    <strong>✓ Pronto!</strong> Clique em "Concluir Configuração" para criar o sistema.
                </p>
            </div>
        `;
    }

    // ============================================
    // NAVEGAÇÃO
    // ============================================

    async function nextStep() {
        const valid = await _validateAndCollect(_currentStep);
        if (!valid) return;
        if (_currentStep < _totalSteps) { _currentStep++; _renderStep(); }
    }

    function prevStep() {
        _collectCurrentStepData();
        if (_currentStep > 1) { _currentStep--; _renderStep(); }
    }

    // ============================================
    // VALIDAÇÃO
    // ============================================

    async function _validateAndCollect(step) {
        const errorEl = document.getElementById(`step${step}-error`);
        const errors = [];

        if (step === 1) {
            const fullName = document.getElementById('admin-fullName')?.value?.trim();
            const email = document.getElementById('admin-email')?.value?.trim();
            const phone = document.getElementById('admin-phone')?.value?.trim();
            const password = document.getElementById('admin-password')?.value;
            const confirm = document.getElementById('admin-password-confirm')?.value;

            if (!fullName) errors.push('Nome completo é obrigatório.');
            if (!email || !SGEUtils.isValidEmail(email)) errors.push('Email válido é obrigatório.');
            if (!password || password.length < 6) errors.push('Palavra-passe deve ter pelo menos 6 caracteres.');
            if (password !== confirm) errors.push('As palavras-passe não coincidem.');

            if (!errors.length) _formData.admin = { fullName, email, phone, password };

        } else if (step === 2) {
            const name = document.getElementById('school-name')?.value?.trim();
            const address = document.getElementById('school-address')?.value?.trim();
            const province = document.getElementById('school-province')?.value;
            const director = document.getElementById('school-director')?.value?.trim();

            if (!name) errors.push('Nome da escola é obrigatório.');
            if (!address) errors.push('Endereço é obrigatório.');
            if (!province) errors.push('Província é obrigatória.');
            if (!director) errors.push('Nome do Diretor é obrigatório.');

            if (!errors.length) {
                _formData.school = {
                    name, address, province, director,
                    nif: document.getElementById('school-nif')?.value?.trim() || '',
                    decree: document.getElementById('school-decree')?.value?.trim() || '',
                    municipality: document.getElementById('school-municipality')?.value?.trim() || '',
                    phone: document.getElementById('school-phone')?.value?.trim() || '',
                    email: document.getElementById('school-email')?.value?.trim() || '',
                    subdirector: document.getElementById('school-subdirector')?.value?.trim() || ''
                };
            }

        } else if (step === 3) {
            const year = document.getElementById('academic-year')?.value?.trim();
            const startDate = document.getElementById('academic-start')?.value;
            const levels = Array.from(document.querySelectorAll('input[name="academic-levels"]:checked')).map(cb => cb.value);
            const shifts = Array.from(document.querySelectorAll('input[name="academic-shifts"]:checked')).map(cb => cb.value);

            if (!year) errors.push('Ano letivo é obrigatório.');
            if (!startDate) errors.push('Data de início é obrigatória.');
            if (!levels.length) errors.push('Selecione pelo menos um nível de ensino.');

            if (!errors.length) {
                _formData.academic = {
                    year, startDate,
                    endDate: document.getElementById('academic-end')?.value || '',
                    enrollmentFormat: document.getElementById('academic-enrollment-format')?.value?.trim() || 'MAT-{ANO}-{SEQ:5}',
                    levels, shifts
                };
            }
        }

        if (errors.length && errorEl) {
            errorEl.innerHTML = SGEComponents.alert(errors.join('<br>'), 'error');
            errorEl.classList.remove('hidden');
            return false;
        }
        return true;
    }

    function _collectCurrentStepData() {
        try {
            if (_currentStep === 1) {
                _formData.admin.fullName = document.getElementById('admin-fullName')?.value?.trim() || '';
                _formData.admin.email = document.getElementById('admin-email')?.value?.trim() || '';
            } else if (_currentStep === 2) {
                _formData.school.name = document.getElementById('school-name')?.value?.trim() || '';
                _formData.school.province = document.getElementById('school-province')?.value || '';
            }
        } catch {}
    }

    // ============================================
    // CONCLUSÃO DO SETUP
    // ============================================

    async function finish() {
        const finishBtn = document.getElementById('wizard-finish-btn');
        const errorEl = document.getElementById('step4-error');

        if (finishBtn) {
            finishBtn.disabled = true;
            finishBtn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> A configurar...`;
        }

        try {
            const { admin, school, academic } = _formData;

            // 1. CRIAR ESCOLA
            const schoolId = SGEUtils.generateUUID();
            await SGEDb.put('schools', {
                id: schoolId, name: school.name, nif: school.nif || null,
                decree: school.decree || null, address: school.address,
                province: school.province, municipality: school.municipality || null,
                phone: school.phone || null, email: school.email || null,
                director: school.director, subdirector: school.subdirector || null,
                logo: null, status: 'active', createdAt: SGEUtils.nowISO()
            }, true);

            // 2. CRIAR ADMIN NO FIREBASE AUTH
            let adminUid;
            try {
                const cred = await SGEFirebase.createUser(admin.email, admin.password);
                adminUid = cred.user.uid;
            } catch (fbError) {
                if (fbError.code === 'auth/email-already-in-use') {
                    try {
                        const cred = await SGEFirebase.signIn(admin.email, admin.password);
                        adminUid = cred.user.uid;
                    } catch {
                        throw new Error('Email já registado com outra password. Use outro email.');
                    }
                } else {
                    throw new Error('Erro ao criar conta: ' + fbError.message);
                }
            }

            // 3. CRIAR ADMIN NA DB
            await SGEDb.put('users', {
                id: adminUid, email: admin.email.toLowerCase().trim(),
                fullName: admin.fullName, role: 'admin_geral',
                schoolId, status: 'active', phone: admin.phone || null,
                photo: null, createdAt: SGEUtils.nowISO(),
                createdBy: 'system', lastLogin: null
            }, true);

            // 4. ANO LETIVO
            const schoolYearId = SGEUtils.generateUUID();
            await SGEDb.put('school_years', {
                id: schoolYearId, schoolId, year: academic.year,
                startDate: academic.startDate, endDate: academic.endDate || null,
                status: 'active', createdAt: SGEUtils.nowISO()
            }, true);

            // 5. TRIMESTRES
            for (let t = 1; t <= 3; t++) {
                await SGEDb.put('terms', {
                    id: SGEUtils.generateUUID(), schoolId, schoolYearId,
                    number: t, name: t + 'º Trimestre',
                    status: t === 1 ? 'open' : 'closed',
                    startDate: null, endDate: null, createdAt: SGEUtils.nowISO()
                }, true);
            }

            // 6. NÍVEIS E CLASSES
            const levelOrder = { iniciacao: 0, primario: 1, ciclo1: 2, ciclo2: 3 };
            const levelNames = { iniciacao: 'Iniciação', primario: 'Ensino Primário', ciclo1: 'Iº Ciclo', ciclo2: 'IIº Ciclo' };
            const classRanges = {
                iniciacao: [{ num: 0, name: 'Iniciação' }],
                primario: [{ num: 1, name: '1ª Classe' }, { num: 2, name: '2ª Classe' }, { num: 3, name: '3ª Classe' }, { num: 4, name: '4ª Classe' }, { num: 5, name: '5ª Classe' }, { num: 6, name: '6ª Classe' }],
                ciclo1: [{ num: 7, name: '7ª Classe' }, { num: 8, name: '8ª Classe' }, { num: 9, name: '9ª Classe' }],
                ciclo2: [{ num: 10, name: '10ª Classe' }, { num: 11, name: '11ª Classe' }, { num: 12, name: '12ª Classe' }, { num: 13, name: '13ª Classe' }]
            };

            for (const level of (academic.levels || [])) {
                const levelId = SGEUtils.generateUUID();
                await SGEDb.put('education_levels', {
                    id: levelId, schoolId, code: level,
                    name: levelNames[level] || level,
                    order: levelOrder[level] || 0,
                    status: 'active', createdAt: SGEUtils.nowISO()
                }, true);

                for (const cls of (classRanges[level] || [])) {
                    await SGEDb.put('classes', {
                        id: SGEUtils.generateUUID(), schoolId, levelId,
                        courseId: null, number: cls.num, name: cls.name,
                        order: cls.num, isFinal: [6, 9, 12, 13].includes(cls.num),
                        status: 'active', createdAt: SGEUtils.nowISO()
                    }, true);
                }
            }

            // 7. TURNOS
            const shiftNames = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
            const shiftTimes = { manha: ['07:00', '12:30'], tarde: ['13:00', '18:00'], noite: ['18:00', '22:00'] };
            for (const shift of (academic.shifts.length ? academic.shifts : ['manha'])) {
                await SGEDb.put('shifts', {
                    id: SGEUtils.generateUUID(), schoolId, code: shift,
                    name: shiftNames[shift] || shift,
                    order: shift === 'manha' ? 1 : shift === 'tarde' ? 2 : 3,
                    startTime: shiftTimes[shift]?.[0] || '07:00',
                    endTime: shiftTimes[shift]?.[1] || '12:30',
                    status: 'active', createdAt: SGEUtils.nowISO()
                }, true);
            }

            // 8. CONFIGURAÇÕES DO SISTEMA
            await SGEDb.setConfig('system_initialized', true);
            await SGEDb.setConfig('system_version', '1.0.0');
            await SGEDb.setConfig('system_created_at', SGEUtils.nowISO());
            await SGEDb.setConfig('default_school_id', schoolId);
            await SGEDb.setConfig('enrollment_format', academic.enrollmentFormat || 'MAT-{ANO}-{SEQ:5}');
            await SGEDb.setConfig('process_format', 'PROC-{ANO}-{SEQ:5}');

            // 9. PROVÍNCIAS
            for (const prov of SGEUtils.getProvinces()) {
                await SGEDb.put('provinces', {
                    id: prov.code, code: prov.code, name: prov.name, createdAt: SGEUtils.nowISO()
                }, false);
            }

            // 10. TIPOS DE AVALIAÇÃO PADRÃO
            const defaultTypes = [
                { code: 'TPC', name: 'Trabalho de Casa', weight: 1, active: true },
                { code: 'TI', name: 'Trabalho Individual', weight: 1, active: true },
                { code: 'TG', name: 'Trabalho em Grupo', weight: 1, active: true },
                { code: 'TD', name: 'Teste Diagnóstico', weight: 1.5, active: true },
                { code: 'T1', name: '1º Teste', weight: 2, active: true },
                { code: 'T2', name: '2º Teste', weight: 2, active: true },
                { code: 'P', name: 'Prova', weight: 3, active: true },
                { code: 'PART', name: 'Participação', weight: 1, active: true },
                { code: 'SEM', name: 'Seminário', weight: 1.5, active: false },
                { code: 'PROJ', name: 'Projeto', weight: 2, active: false },
                { code: 'COMP', name: 'Comportamento', weight: 0, active: true }
            ];
            for (const type of defaultTypes) {
                await SGEDb.put('assessment_types', {
                    id: SGEUtils.generateUUID(), schoolId,
                    code: type.code, name: type.name, weight: type.weight,
                    levelId: null, classId: null,
                    status: type.active ? 'active' : 'inactive',
                    createdAt: SGEUtils.nowISO()
                }, true);
            }

            // 11. CONFIGURAÇÃO DE NOTAS (MAC, NPP, NPT, MFD)
            const gradeConfigs = [
                { type: 'MAC', name: 'Média de Avaliação Contínua', formula: 'SUM(notas)/COUNT(notas)', active: true, order: 1 },
                { type: 'NPP', name: 'Nota da Prova Parcial', formula: 'prova_parcial', active: false, order: 2 },
                { type: 'NPT', name: 'Nota da Prova Trimestral', formula: 'prova_trimestral', active: false, order: 3 },
                { type: 'MFD', name: 'Média Final da Disciplina', formula: '(MAC*0.6)+(NPP*0.2)+(NPT*0.2)', active: false, order: 4 }
            ];
            for (const gc of gradeConfigs) {
                await SGEDb.put('grade_config', {
                    id: SGEUtils.generateUUID(), schoolId,
                    type: gc.type, name: gc.name, description: gc.name,
                    formula: gc.formula, active: gc.active, order: gc.order,
                    createdAt: SGEUtils.nowISO()
                }, true);
            }

            // 12. CRIPTOGRAFIA
            await SGECrypto.initialize(admin.password);

            // 13. LOG
            await SGEDb.addAuditLog({
                userId: adminUid, userName: admin.fullName, schoolId,
                action: 'system_setup', module: 'system',
                description: 'Configuração inicial concluída',
                details: { schoolName: school.name, levels: academic.levels, year: academic.year }
            });

            // 14. SNAPSHOT INICIAL
            try { await SGERecovery.createRecoveryPoint('initial_setup'); } catch {}

            // 15. SINCRONIZAR
            if (SGEFirebase.isOnline()) {
                try { await SGESync.pushToCloud(); } catch {}
            }

            // SUCESSO - Fazer login
            try { await SGEFirebase.signOut(); } catch {}
            const loginResult = await SGEAuth.login(admin.email, admin.password);

            if (loginResult.success) {
                SGEUtils.hide('#setup-screen');
                // O app.js vai detetar a sessão e iniciar
                location.reload();
            } else {
                SGEUtils.hide('#setup-screen');
                SGEUtils.show('#login-screen');
            }

        } catch (error) {
            console.error('[Setup] Erro:', error);
            if (errorEl) {
                errorEl.innerHTML = SGEComponents.alert('Erro: ' + error.message, 'error');
                errorEl.classList.remove('hidden');
            }
            if (finishBtn) {
                finishBtn.disabled = false;
                finishBtn.innerHTML = '✓ Concluir Configuração';
            }
        }
    }

    // ============================================
    // UTILITÁRIO
    // ============================================

    function _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return { render, needsSetup, nextStep, prevStep, finish };
})();

window.SGESetupWizard = SGESetupWizard;