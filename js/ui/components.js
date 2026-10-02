// ============================================
// SGE-NG - COMPONENTES DE INTERFACE REUTILIZÁVEIS
// Biblioteca de componentes HTML dinâmicos
// usados em todos os módulos do sistema
// ============================================

const SGEComponents = (() => {
    'use strict';

    // ============================================
    // 1. MODAIS
    // ============================================

    /**
     * Abre o modal genérico com conteúdo HTML
     * @param {object} options
     *   options.title: string - Título do modal
     *   options.content: string - HTML do corpo
     *   options.size: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'md')
     *   options.footer: string - HTML do rodapé (opcional)
     *   options.closeable: boolean (default: true)
     *   options.onClose: function - Callback ao fechar
     * @returns {object} { close: Function }
     */
    function openModal(options = {}) {
        const {
            title = '',
            content = '',
            size = 'md',
            footer = '',
            closeable = true,
            onClose = null
        } = options;

        const sizeClasses = {
            sm: 'max-w-sm',
            md: 'max-w-lg',
            lg: 'max-w-2xl',
            xl: 'max-w-4xl',
            full: 'max-w-6xl'
        };

        const modal = document.getElementById('generic-modal');
        const modalContent = document.getElementById('generic-modal-content');

        if (!modal || !modalContent) return { close: () => {} };

        modalContent.className = `bg-white rounded-xl shadow-xl ${sizeClasses[size] || sizeClasses.md} w-full max-h-[90vh] flex flex-col modal-content`;

        modalContent.innerHTML = `
            <!-- Cabeçalho -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <h2 class="text-lg font-bold text-gray-900">${title}</h2>
                ${closeable ? `
                    <button class="modal-close-btn p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                        <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
            <!-- Corpo -->
            <div class="flex-1 overflow-y-auto px-6 py-4">
                ${content}
            </div>
            <!-- Rodapé -->
            ${footer ? `
                <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                    ${footer}
                </div>
            ` : ''}
        `;

        modal.classList.remove('hidden');

        // Fechar modal
        const close = () => {
            modal.classList.add('hidden');
            modalContent.innerHTML = '';
            if (onClose) onClose();
        };

        // Eventos de fecho
        const closeBtn = modalContent.querySelector('.modal-close-btn');
        if (closeBtn) closeBtn.onclick = close;

        if (closeable) {
            modal.onclick = (e) => {
                if (e.target === modal) close();
            };
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    close();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        return { close, element: modalContent };
    }

    /**
     * Abre modal de confirmação
     * @param {object} options
     *   options.title: string
     *   options.message: string
     *   options.type: 'danger' | 'warning' | 'info' | 'success' (default: 'warning')
     *   options.confirmText: string (default: 'Confirmar')
     *   options.cancelText: string (default: 'Cancelar')
     * @returns {Promise<boolean>} true se confirmou, false se cancelou
     */
    function confirm(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirmar Ação',
                message = 'Tem a certeza que deseja continuar?',
                type = 'warning',
                confirmText = 'Confirmar',
                cancelText = 'Cancelar'
            } = options;

            const icons = {
                danger: `<div class="w-12 h-12 mx-auto rounded-full bg-danger-100 flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </div>`,
                warning: `<div class="w-12 h-12 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                </div>`,
                info: `<div class="w-12 h-12 mx-auto rounded-full bg-primary-100 flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>`,
                success: `<div class="w-12 h-12 mx-auto rounded-full bg-success-100 flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>`
            };

            const btnColors = {
                danger: 'bg-danger-600 hover:bg-danger-700',
                warning: 'bg-yellow-600 hover:bg-yellow-700',
                info: 'bg-primary-600 hover:bg-primary-700',
                success: 'bg-success-600 hover:bg-success-700'
            };

            const footer = `
                <button class="confirm-cancel-btn btn btn-secondary">${cancelText}</button>
                <button class="confirm-accept-btn btn ${btnColors[type]} text-white">${confirmText}</button>
            `;

            const content = `
                <div class="text-center">
                    ${icons[type] || icons.warning}
                    <h3 class="text-lg font-bold text-gray-900 mb-2">${title}</h3>
                    <p class="text-sm text-gray-600">${message}</p>
                </div>
            `;

            const { close } = openModal({ title: '', content, footer, size: 'sm' });

            // Substituir conteúdo para centralizar (sem header)
            const modalContent = document.getElementById('generic-modal-content');
            if (modalContent) {
                modalContent.querySelector('.border-b')?.remove();
            }

            // Eventos
            setTimeout(() => {
                const cancelBtn = document.querySelector('.confirm-cancel-btn');
                const acceptBtn = document.querySelector('.confirm-accept-btn');
                if (cancelBtn) cancelBtn.onclick = () => { close(); resolve(false); };
                if (acceptBtn) acceptBtn.onclick = () => { close(); resolve(true); };
            }, 50);
        });
    }

    /**
     * Abre modal de formulário dinâmico
     * @param {object} options
     *   options.title: string
     *   options.fields: Array<FieldConfig> - Configuração dos campos
     *   options.data: object - Dados para preencher (edição)
     *   options.onSubmit: function(formData) - Callback ao submeter
     *   options.submitText: string (default: 'Guardar')
     * @returns {object} { close: Function }
     */
    function openFormModal(options = {}) {
        const {
            title = 'Formulário',
            fields = [],
            data = {},
            onSubmit = null,
            submitText = 'Guardar',
            size = 'md'
        } = options;

        const formHtml = renderForm(fields, data);

        const footer = `
            <button class="form-cancel-btn btn btn-secondary">Cancelar</button>
            <button class="form-submit-btn btn btn-primary">${submitText}</button>
        `;

        const { close, element } = openModal({ title, content: formHtml, footer, size });

        setTimeout(() => {
            const cancelBtn = element?.querySelector('.form-cancel-btn');
            const submitBtn = element?.querySelector('.form-submit-btn');

            if (cancelBtn) cancelBtn.onclick = close;

            if (submitBtn) {
                submitBtn.onclick = () => {
                    const formData = _collectFormData(element, fields);
                    const validation = _validateFormData(formData, fields);

                    // Mostrar/limpar erros
                    element.querySelectorAll('.field-error').forEach(el => el.remove());
                    element.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

                    if (!validation.valid) {
                        validation.errors.forEach(err => {
                            const field = element.querySelector(`[name="${err.field}"]`);
                            if (field) {
                                field.classList.add('error');
                                const errorEl = document.createElement('p');
                                errorEl.className = 'field-error text-xs text-danger-600 mt-1';
                                errorEl.textContent = err.message;
                                field.parentNode.appendChild(errorEl);
                            }
                        });
                        return;
                    }

                    if (onSubmit) {
                        const result = onSubmit(formData);
                        if (result !== false) close();
                    } else {
                        close();
                    }
                };
            }
        }, 50);

        return { close };
    }

    // ============================================
    // 2. FORMULÁRIOS DINÂMICOS
    // ============================================

    /**
     * Renderiza um formulário completo a partir de configuração
     * @param {Array<FieldConfig>} fields
     * @param {object} data - Valores iniciais
     * @returns {string} HTML do formulário
     *
     * FieldConfig: {
     *   name: string,
     *   label: string,
     *   type: 'text'|'email'|'password'|'number'|'date'|'select'|'textarea'|'file'|'toggle'|'radio'|'hidden',
     *   required: boolean,
     *   placeholder: string,
     *   options: [{value, label}] (para select/radio),
     *   grid: 'full'|'half'|'third' (layout),
     *   accept: string (para file),
     *   maxFileSize: number (MB),
     *   help: string (texto de ajuda),
     *   disabled: boolean,
     *   min: number, max: number, step: number (para number)
     * }
     */
    function renderForm(fields, data = {}) {
        const gridClass = { full: 'col-span-2', half: 'col-span-1', third: 'col-span-1' };

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

        fields.forEach(field => {
            if (field.type === 'hidden') {
                html += `<input type="hidden" name="${field.name}" value="${data[field.name] || field.value || ''}">`;
                return;
            }

            const value = data[field.name] !== undefined ? data[field.name] : (field.defaultValue || '');
            const required = field.required ? 'required' : '';
            const disabled = field.disabled ? 'disabled' : '';
            const colSpan = gridClass[field.grid] || 'col-span-1';
            const fullWidth = field.grid === 'full' ? 'md:col-span-2' : '';

            html += `<div class="${fullWidth || colSpan}">`;
            html += `<label class="block text-sm font-medium text-gray-700 mb-1" for="field-${field.name}">`;
            html += `${field.label}`;
            if (field.required) html += ` <span class="text-danger-500">*</span>`;
            html += `</label>`;

            switch (field.type) {
                case 'text':
                case 'email':
                case 'password':
                    html += `<input type="${field.type}" id="field-${field.name}" name="${field.name}"
                        value="${_escapeHtml(String(value))}"
                        placeholder="${field.placeholder || ''}"
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 focus:ring-0 outline-none transition-colors">`;
                    break;

                case 'number':
                    html += `<input type="number" id="field-${field.name}" name="${field.name}"
                        value="${value}"
                        placeholder="${field.placeholder || ''}"
                        ${field.min !== undefined ? `min="${field.min}"` : ''}
                        ${field.max !== undefined ? `max="${field.max}"` : ''}
                        ${field.step !== undefined ? `step="${field.step}"` : ''}
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 focus:ring-0 outline-none transition-colors">`;
                    break;

                case 'date':
                    html += `<input type="date" id="field-${field.name}" name="${field.name}"
                        value="${value}"
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 focus:ring-0 outline-none transition-colors">`;
                    break;

                case 'select':
                    html += `<select id="field-${field.name}" name="${field.name}"
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 focus:ring-0 outline-none transition-colors bg-white">`;
                    html += `<option value="">${field.placeholder || '-- Selecionar --'}</option>`;
                    if (field.options) {
                        field.options.forEach(opt => {
                            const optVal = typeof opt === 'object' ? opt.value : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            const selected = String(value) === String(optVal) ? 'selected' : '';
                            html += `<option value="${_escapeHtml(String(optVal))}" ${selected}>${_escapeHtml(String(optLabel))}</option>`;
                        });
                    }
                    html += `</select>`;
                    break;

                case 'textarea':
                    html += `<textarea id="field-${field.name}" name="${field.name}"
                        rows="${field.rows || 3}"
                        placeholder="${field.placeholder || ''}"
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-primary-600 focus:ring-0 outline-none transition-colors resize-y">${_escapeHtml(String(value))}</textarea>`;
                    break;

                case 'file':
                    html += `<input type="file" id="field-${field.name}" name="${field.name}"
                        ${field.accept ? `accept="${field.accept}"` : ''}
                        ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">`;
                    if (value && typeof value === 'string' && value.startsWith('data:')) {
                        html += `<div class="mt-2"><img src="${value}" class="w-16 h-16 rounded-lg object-cover border"></div>`;
                    }
                    break;

                case 'toggle':
                    const checked = value === true || value === 'true' || value === '1' ? 'active' : '';
                    html += `<div class="flex items-center space-x-3 mt-1">
                        <div class="toggle-switch ${checked}" data-name="${field.name}" onclick="this.classList.toggle('active')"></div>
                        <span class="text-sm text-gray-600">${field.toggleLabel || (checked ? 'Ativo' : 'Inativo')}</span>
                        <input type="hidden" name="${field.name}" value="${checked ? 'true' : 'false'}">
                    </div>`;
                    break;

                case 'radio':
                    html += `<div class="flex flex-wrap gap-4 mt-1">`;
                    if (field.options) {
                        field.options.forEach(opt => {
                            const optVal = typeof opt === 'object' ? opt.value : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            const checkedRadio = String(value) === String(optVal) ? 'checked' : '';
                            html += `<label class="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="${field.name}" value="${_escapeHtml(String(optVal))}" ${checkedRadio} ${required}
                                    class="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500">
                                <span class="text-sm text-gray-700">${_escapeHtml(String(optLabel))}</span>
                            </label>`;
                        });
                    }
                    html += `</div>`;
                    break;

                default:
                    html += `<input type="text" id="field-${field.name}" name="${field.name}"
                        value="${_escapeHtml(String(value))}" ${required} ${disabled}
                        class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm">`;
            }

            if (field.help) {
                html += `<p class="text-xs text-gray-400 mt-1">${field.help}</p>`;
            }

            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    /**
     * Recolhe dados do formulário renderizado
     */
    function _collectFormData(container, fields) {
        const data = {};
        fields.forEach(field => {
            if (field.type === 'file') {
                const input = container.querySelector(`[name="${field.name}"]`);
                data[field.name] = input?.files?.[0] || null;
            } else if (field.type === 'toggle') {
                const toggle = container.querySelector(`.toggle-switch[data-name="${field.name}"]`);
                data[field.name] = toggle?.classList.contains('active') || false;
            } else {
                const input = container.querySelector(`[name="${field.name}"]`);
                if (input) {
                    if (input.type === 'number') {
                        data[field.name] = input.value !== '' ? parseFloat(input.value) : null;
                    } else if (input.type === 'checkbox') {
                        data[field.name] = input.checked;
                    } else {
                        data[field.name] = input.value;
                    }
                }
            }
        });
        return data;
    }

    /**
     * Valida dados do formulário contra as regras dos campos
     */
    function _validateFormData(data, fields) {
        const errors = [];
        fields.forEach(field => {
            const value = data[field.name];

            if (field.required && (value === null || value === undefined || value === '' || value === false)) {
                errors.push({ field: field.name, message: `${field.label} é obrigatório.` });
                return;
            }

            if (value !== null && value !== undefined && value !== '') {
                if (field.type === 'email' && !SGEUtils.isValidEmail(String(value))) {
                    errors.push({ field: field.name, message: 'Email inválido.' });
                }
                if (field.type === 'number') {
                    if (field.min !== undefined && value < field.min) {
                        errors.push({ field: field.name, message: `Valor mínimo: ${field.min}.` });
                    }
                    if (field.max !== undefined && value > field.max) {
                        errors.push({ field: field.name, message: `Valor máximo: ${field.max}.` });
                    }
                }
                if (field.type === 'file' && field.maxFileSize && value instanceof File) {
                    if (value.size > field.maxFileSize * 1024 * 1024) {
                        errors.push({ field: field.name, message: `Ficheiro excede ${field.maxFileSize} MB.` });
                    }
                }
                if (field.minLength && String(value).length < field.minLength) {
                    errors.push({ field: field.name, message: `Mínimo de ${field.minLength} caracteres.` });
                }
            }
        });
        return { valid: errors.length === 0, errors };
    }

    // ============================================
    // 3. TABELAS DINÂMICAS
    // ============================================

    /**
     * Renderiza uma tabela completa com pesquisa, paginação e ações
     * @param {object} options
     *   options.columns: [{key, label, width, sortable, render}]
     *   options.data: Array<object>
     *   options.actions: [{icon, label, onClick, color, condition}]
     *   options.searchable: boolean (default: true)
     *   options.searchPlaceholder: string
     *   options.pageSize: number (default: 15)
     *   options.emptyMessage: string
     *   options.onRowClick: function(row)
     *   options.id: string - ID único da tabela
     * @returns {string} HTML da tabela
     */
    function renderTable(options = {}) {
        const {
            columns = [],
            data = [],
            actions = [],
            searchable = true,
            searchPlaceholder = 'Pesquisar...',
            pageSize = 15,
            emptyMessage = 'Nenhum registo encontrado.',
            onRowClick = null,
            id = SGEUtils.generateShortId('tbl')
        } = options;

        // Guardar dados no window para paginação/pesquisa
        window[`_tableData_${id}`] = data;
        window[`_tableCols_${id}`] = columns;
        window[`_tableActions_${id}`] = actions;
        window[`_tablePage_${id}`] = 1;
        window[`_tablePageSize_${id}`] = pageSize;
        window[`_tableSearch_${id}`] = '';
        window[`_tableSort_${id}`] = { key: null, dir: 'asc' };
        window[`_tableRowClick_${id}`] = onRowClick;

        let html = `<div id="table-container-${id}" class="sge-card p-0 overflow-hidden">`;

        // Barra de pesquisa e contagem
        if (searchable || true) {
            html += `<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-gray-100">`;
            if (searchable) {
                html += `<div class="relative flex-1 max-w-md">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input type="text" id="table-search-${id}" placeholder="${searchPlaceholder}"
                        class="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-primary-600 outline-none transition-colors"
                        oninput="SGEComponents._filterTable('${id}')">
                </div>`;
            }
            html += `<div class="flex items-center gap-2">
                <span id="table-count-${id}" class="text-sm text-gray-500">${data.length} registo(s)</span>
            </div>`;
            html += `</div>`;
        }

        // Tabela
        html += `<div class="sge-table-responsive overflow-x-auto">`;
        html += `<table class="sge-table" id="table-${id}">`;

        // Cabeçalho
        html += `<thead><tr>`;
        columns.forEach(col => {
            const width = col.width ? `style="width:${col.width}"` : '';
            const sortIcon = col.sortable !== false ? `
                <button class="ml-1 text-gray-400 hover:text-gray-600" onclick="SGEComponents._sortTable('${id}','${col.key}')">
                    <svg class="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                </button>` : '';
            html += `<th ${width}>${col.label}${sortIcon}</th>`;
        });
        if (actions.length > 0) {
            html += `<th style="width:120px" class="text-center">Ações</th>`;
        }
        html += `</tr></thead>`;

        // Corpo (preenchido via JS)
        html += `<tbody id="table-body-${id}"></tbody>`;
        html += `</table></div>`;

        // Paginação
        html += `<div id="table-pagination-${id}" class="flex items-center justify-between px-4 py-3 border-t border-gray-100"></div>`;

        html += `</div>`;

        // Renderizar dados após o DOM ser inserido
        setTimeout(() => _renderTableBody(id), 10);

        return html;
    }

    /**
     * Renderiza o corpo da tabela com paginação e filtro
     */
    function _renderTableBody(tableId) {
        const data = window[`_tableData_${tableId}`] || [];
        const columns = window[`_tableCols_${tableId}`] || [];
        const actions = window[`_tableActions_${tableId}`] || [];
        const page = window[`_tablePage_${tableId}`] || 1;
        const pageSize = window[`_tablePageSize_${tableId}`] || 15;
        const search = (window[`_tableSearch_${tableId}`] || '').toLowerCase();
        const sort = window[`_tableSort_${tableId}`] || {};
        const rowClick = window[`_tableRowClick_${tableId}`];

        const tbody = document.getElementById(`table-body-${tableId}`);
        const countEl = document.getElementById(`table-count-${tableId}`);
        const pagEl = document.getElementById(`table-pagination-${tableId}`);

        if (!tbody) return;

        // Filtrar
        let filtered = data;
        if (search) {
            filtered = data.filter(row =>
                columns.some(col => {
                    const val = row[col.key];
                    return val !== null && val !== undefined && String(val).toLowerCase().includes(search);
                })
            );
        }

        // Ordenar
        if (sort.key) {
            filtered.sort((a, b) => {
                let va = a[sort.key], vb = b[sort.key];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return sort.dir === 'asc' ? -1 : 1;
                if (va > vb) return sort.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Paginar
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);

        // Atualizar contagem
        if (countEl) countEl.textContent = `${filtered.length} registo(s)`;

        // Renderizar linhas
        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length + (actions.length ? 1 : 0)}" class="text-center py-8 text-gray-400 text-sm">
                <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                Nenhum registo encontrado.
            </td></tr>`;
        } else {
            tbody.innerHTML = pageData.map((row, idx) => {
                const clickAttr = rowClick ? `onclick="window._tableRowClick_${tableId}?.(window._tableData_${tableId}[${start + idx}])" class="cursor-pointer hover:bg-primary-50"` : '';
                let tr = `<tr ${clickAttr}>`;
                columns.forEach(col => {
                    let cellValue = row[col.key];
                    if (col.render) {
                        cellValue = col.render(cellValue, row);
                    } else if (cellValue === null || cellValue === undefined) {
                        cellValue = '<span class="text-gray-400">---</span>';
                    } else {
                        cellValue = _escapeHtml(String(cellValue));
                    }
                    tr += `<td>${cellValue}</td>`;
                });
                if (actions.length > 0) {
                    tr += `<td class="text-center"><div class="flex items-center justify-center gap-1">`;
                    actions.forEach(action => {
                        if (action.condition && !action.condition(row)) return;
                        const colorClass = action.color === 'danger' ? 'text-danger-600 hover:bg-danger-50' :
                                          action.color === 'success' ? 'text-success-600 hover:bg-success-50' :
                                          'text-primary-600 hover:bg-primary-50';
                        tr += `<button class="p-1.5 rounded-md transition-colors ${colorClass}"
                            title="${action.label}"
                            onclick="event.stopPropagation(); SGEComponents._tableAction('${tableId}', ${start + idx}, '${action.label}')">
                            ${action.icon || action.label}
                        </button>`;
                    });
                    tr += `</div></td>`;
                }
                tr += `</tr>`;
                return tr;
            }).join('');
        }

        // Paginação
        if (pagEl && totalPages > 1) {
            let pagHtml = `<div class="text-sm text-gray-500">Página ${currentPage} de ${totalPages}</div>`;
            pagHtml += `<div class="flex items-center gap-1">`;
            pagHtml += `<button class="btn btn-sm btn-secondary" ${currentPage <= 1 ? 'disabled' : ''} onclick="SGEComponents._goToPage('${tableId}', ${currentPage - 1})">Anterior</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

            for (let i = startPage; i <= endPage; i++) {
                const active = i === currentPage ? 'btn-primary text-white' : 'btn-secondary';
                pagHtml += `<button class="btn btn-sm ${active}" onclick="SGEComponents._goToPage('${tableId}', ${i})">${i}</button>`;
            }

            pagHtml += `<button class="btn btn-sm btn-secondary" ${currentPage >= totalPages ? 'disabled' : ''} onclick="SGEComponents._goToPage('${tableId}', ${currentPage + 1})">Seguinte</button>`;
            pagHtml += `</div>`;
            pagEl.innerHTML = pagHtml;
        } else if (pagEl) {
            pagEl.innerHTML = '';
        }
    }

    function _filterTable(tableId) {
        const input = document.getElementById(`table-search-${tableId}`);
        window[`_tableSearch_${tableId}`] = input?.value || '';
        window[`_tablePage_${tableId}`] = 1;
        _renderTableBody(tableId);
    }

    function _sortTable(tableId, key) {
        const sort = window[`_tableSort_${tableId}`] || {};
        if (sort.key === key) {
            sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            sort.key = key;
            sort.dir = 'asc';
        }
        window[`_tableSort_${tableId}`] = sort;
        _renderTableBody(tableId);
    }

    function _goToPage(tableId, page) {
        window[`_tablePage_${tableId}`] = page;
        _renderTableBody(tableId);
    }

    function _tableAction(tableId, rowIndex, actionLabel) {
        const actions = window[`_tableActions_${tableId}`] || [];
        const data = window[`_tableData_${tableId}`] || [];
        const action = actions.find(a => a.label === actionLabel);
        if (action && action.onClick && data[rowIndex]) {
            action.onClick(data[rowIndex]);
        }
    }

    // ============================================
    // 4. CARDS DE ESTATÍSTICAS
    // ============================================

    /**
     * Renderiza um card de estatística para o dashboard
     * @param {object} options
     *   options.title: string
     *   options.value: string|number
     *   options.icon: string (SVG)
     *   options.color: 'blue'|'green'|'red'|'yellow'|'purple'
     *   options.change: string (ex: '+12%')
     *   options.changeType: 'up'|'down'|'neutral'
     * @returns {string} HTML
     */
    function renderStatCard(options = {}) {
        const {
            title = '---',
            value = '0',
            icon = '',
            color = 'blue',
            change = '',
            changeType = 'neutral'
        } = options;

        const colorMap = {
            blue: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'stat-card-blue' },
            green: { bg: 'bg-success-50', text: 'text-success-600', border: 'stat-card-green' },
            red: { bg: 'bg-danger-50', text: 'text-danger-600', border: 'stat-card-red' },
            yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'stat-card-yellow' },
            purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'stat-card-purple' }
        };

        const c = colorMap[color] || colorMap.blue;

        const changeHtml = change ? `
            <div class="flex items-center text-xs mt-1 ${changeType === 'up' ? 'text-success-600' : changeType === 'down' ? 'text-danger-600' : 'text-gray-500'}">
                ${changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : '→'} ${change}
            </div>
        ` : '';

        return `
            <div class="sge-card stat-card ${c.border}">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 font-medium">${title}</p>
                        <p class="text-2xl font-bold text-gray-900 mt-1">${value}</p>
                        ${changeHtml}
                    </div>
                    <div class="w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center ${c.text}">
                        ${icon}
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // 5. BADGES
    // ============================================

    /**
     * Renderiza uma badge/etiqueta
     * @param {string} text
     * @param {string} type - 'success'|'danger'|'warning'|'info'|'neutral'
     * @returns {string} HTML
     */
    function badge(text, type = 'neutral') {
        return `<span class="badge badge-${type}">${_escapeHtml(String(text))}</span>`;
    }

    /**
     * Badge de estado do aluno/funcionário
     */
    function statusBadge(status) {
        const map = {
            active: { label: 'Ativo', type: 'success' },
            ativo: { label: 'Ativo', type: 'success' },
            inactive: { label: 'Inativo', type: 'neutral' },
            inativo: { label: 'Inativo', type: 'neutral' },
            suspended: { label: 'Suspenso', type: 'danger' },
            suspenso: { label: 'Suspenso', type: 'danger' },
            desistente: { label: 'Desistente', type: 'danger' },
            transferido: { label: 'Transferido', type: 'warning' },
            aprovado: { label: 'Aprovado', type: 'success' },
            reprovado: { label: 'Reprovado', type: 'danger' },
            pending: { label: 'Pendente', type: 'warning' },
            aberto: { label: 'Aberto', type: 'success' },
            fechado: { label: 'Fechado', type: 'neutral' },
            open: { label: 'Aberto', type: 'success' },
            closed: { label: 'Fechado', type: 'neutral' }
        };
        const s = map[status?.toLowerCase()] || { label: status || '---', type: 'neutral' };
        return badge(s.label, s.type);
    }

    // ============================================
    // 6. ALERTAS INLINE
    // ============================================

    /**
     * Renderiza um alerta inline
     * @param {string} message
     * @param {string} type - 'success'|'error'|'warning'|'info'
     * @param {boolean} dismissible
     * @returns {string} HTML
     */
    function alert(message, type = 'info', dismissible = true) {
        const styles = {
            success: 'bg-success-50 border-success-200 text-success-800',
            error: 'bg-danger-50 border-danger-200 text-danger-800',
            warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            info: 'bg-primary-50 border-primary-200 text-primary-800'
        };
        const icons = {
            success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>',
            info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
        };

        const dismissBtn = dismissible ? `
            <button onclick="this.parentElement.remove()" class="ml-auto p-1 rounded-md hover:bg-black hover:bg-opacity-5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>` : '';

        return `
            <div class="flex items-start gap-3 p-4 border rounded-lg ${styles[type] || styles.info} animate-fadeIn">
                <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">${icons[type] || icons.info}</svg>
                <p class="text-sm flex-1">${message}</p>
                ${dismissBtn}
            </div>
        `;
    }

    // ============================================
    // 7. TABS
    // ============================================

    /**
     * Renderiza um sistema de tabs
     * @param {Array<{id, label, icon?, content}>} tabs
     * @param {string} activeTab - ID da tab ativa
     * @returns {string} HTML
     */
    function renderTabs(tabs, activeTab = null) {
        const active = activeTab || tabs[0]?.id;
        const tabGroupId = SGEUtils.generateShortId('tabs');

        let html = `<div id="${tabGroupId}">`;
        html += `<div class="sge-tabs mb-4">`;
        tabs.forEach(tab => {
            const isActive = tab.id === active;
            html += `<button class="sge-tab ${isActive ? 'active' : ''}"
                onclick="SGEComponents._switchTab('${tabGroupId}', '${tab.id}')">
                ${tab.icon || ''} ${tab.label}
            </button>`;
        });
        html += `</div>`;

        tabs.forEach(tab => {
            const isActive = tab.id === active;
            html += `<div class="tab-content-${tabGroupId} ${isActive ? '' : 'hidden'}" data-tab="${tab.id}">
                ${tab.content || ''}
            </div>`;
        });

        html += `</div>`;
        return html;
    }

    function _switchTab(groupId, tabId) {
        const container = document.getElementById(groupId);
        if (!container) return;

        container.querySelectorAll('.sge-tab').forEach(btn => btn.classList.remove('active'));
        container.querySelectorAll(`[class*="tab-content-"]`).forEach(el => el.classList.add('hidden'));

        const activeBtn = container.querySelector(`.sge-tab[onclick*="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const activeContent = container.querySelector(`[data-tab="${tabId}"]`);
        if (activeContent) activeContent.classList.remove('hidden');
    }

    // ============================================
    // 8. LOADING / SKELETON
    // ============================================

    function loadingSpinner(text = 'A carregar...') {
        return `
            <div class="flex items-center justify-center py-12">
                <div class="text-center">
                    <div class="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-sm text-gray-500">${text}</p>
                </div>
            </div>
        `;
    }

    function skeletonRows(count = 5, cols = 4) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += '<tr>';
            for (let j = 0; j < cols; j++) {
                const w = j === 0 ? 'w-32' : j === cols - 1 ? 'w-16' : 'w-24';
                html += `<td><div class="skeleton h-4 ${w}"></div></td>`;
            }
            html += '</tr>';
        }
        return html;
    }

    // ============================================
    // 9. EMPTY STATE
    // ============================================

    function emptyState(message = 'Nenhum dado disponível.', actionHtml = '') {
        return `
            <div class="empty-state">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p class="text-sm font-medium">${message}</p>
                ${actionHtml ? `<div class="mt-4">${actionHtml}</div>` : ''}
            </div>
        `;
    }

    // ============================================
    // 10. UPLOAD DE FICHEIRO COM PREVIEW
    // ============================================

    function renderFileUpload(options = {}) {
        const {
            name = 'file',
            label = 'Ficheiro',
            accept = 'image/*',
            maxSize = 15,
            preview = null,
            required = false
        } = options;

        return `
            <div class="file-upload-area" id="upload-${name}">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    ${label} ${required ? '<span class="text-danger-500">*</span>' : ''}
                </label>
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                     onclick="document.getElementById('file-${name}').click()">
                    ${preview ? `
                        <img src="${preview}" class="w-20 h-20 rounded-lg object-cover mx-auto mb-2 border">
                        <p class="text-xs text-gray-500">Clique para alterar</p>
                    ` : `
                        <svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <p class="text-sm text-gray-500">Clique ou arraste para enviar</p>
                    `}
                    <p class="text-xs text-gray-400 mt-1">Máx. ${maxSize} MB</p>
                </div>
                <input type="file" id="file-${name}" name="${name}" accept="${accept}" class="hidden"
                    onchange="SGEComponents._previewFile(this, '${name}', ${maxSize})">
            </div>
        `;
    }

    function _previewFile(input, name, maxSize) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > maxSize * 1024 * 1024) {
            SGENotifications?.show(`Ficheiro excede ${maxSize} MB`, 'error');
            input.value = '';
            return;
        }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const area = document.getElementById(`upload-${name}`);
                const img = area?.querySelector('img');
                if (img) img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    // ============================================
    // 11. DROPDOWN MENU
    // ============================================

    function renderDropdown(items, triggerHtml = '⋮') {
        const id = SGEUtils.generateShortId('dd');
        let html = `<div class="relative inline-block" id="${id}">`;
        html += `<button class="p-1.5 rounded-md hover:bg-gray-100 transition-colors" onclick="SGEComponents._toggleDropdown('${id}')">${triggerHtml}</button>`;
        html += `<div class="dropdown-menu hidden" id="${id}-menu">`;
        items.forEach(item => {
            if (item.divider) {
                html += `<div class="dropdown-divider"></div>`;
            } else {
                const color = item.color === 'danger' ? 'text-danger-600 hover:bg-danger-50' : 'text-gray-700 hover:bg-gray-50';
                html += `<div class="dropdown-item ${color}" onclick="SGEComponents._closeDropdown('${id}'); ${item.onClick || ''}">
                    ${item.icon || ''} ${item.label}
                </div>`;
            }
        });
        html += `</div></div>`;
        return html;
    }

    function _toggleDropdown(id) {
        const menu = document.getElementById(`${id}-menu`);
        if (menu) menu.classList.toggle('hidden');

        // Fechar ao clicar fora
        const close = (e) => {
            const dd = document.getElementById(id);
            if (dd && !dd.contains(e.target)) {
                menu?.classList.add('hidden');
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    }

    function _closeDropdown(id) {
        const menu = document.getElementById(`${id}-menu`);
        if (menu) menu.classList.add('hidden');
    }

    // ============================================
    // 12. PROGRESS BAR
    // ============================================

    function progressBar(percent, color = 'blue', label = '') {
        const colors = {
            blue: 'bg-primary-600', green: 'bg-success-600',
            red: 'bg-danger-600', yellow: 'bg-yellow-500'
        };
        const p = Math.max(0, Math.min(100, percent));
        return `
            <div>
                ${label ? `<div class="flex justify-between text-xs text-gray-500 mb-1"><span>${label}</span><span>${p}%</span></div>` : ''}
                <div class="progress-bar">
                    <div class="progress-bar-fill ${colors[color] || colors.blue}" style="width: ${p}%"></div>
                </div>
            </div>
        `;
    }

    // ============================================
    // 13. AVATAR
    // ============================================

    function avatar(name, photo = null, size = 'md') {
        const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' };
        const s = sizes[size] || sizes.md;
        const initials = SGEUtils.getInitials(name);

        if (photo) {
            return `<img src="${photo}" alt="${_escapeHtml(name)}" class="${s} rounded-full object-cover border-2 border-gray-200">`;
        }
        return `<div class="${s} rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">${initials}</div>`;
    }

    // ============================================
    // 14. HEADER DE PÁGINA
    // ============================================

    function pageHeader(title, subtitle = '', actions = []) {
        let actionsHtml = '';
        if (actions.length > 0) {
            actionsHtml = `<div class="flex items-center gap-2 flex-wrap">`;
            actions.forEach(a => {
                const btnClass = a.type === 'primary' ? 'btn-primary' :
                                 a.type === 'success' ? 'btn-success' :
                                 a.type === 'danger' ? 'btn-danger' : 'btn-secondary';
                actionsHtml += `<button class="btn ${btnClass} btn-sm" onclick="${a.onClick || ''}">
                    ${a.icon || ''} ${a.label}
                </button>`;
            });
            actionsHtml += `</div>`;
        }

        return `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">${title}</h2>
                    ${subtitle ? `<p class="text-sm text-gray-500 mt-1">${subtitle}</p>` : ''}
                </div>
                ${actionsHtml}
            </div>
        `;
    }

    // ============================================
    // 15. CARD DE INFORMAÇÃO (Ficha)
    // ============================================

    function infoCard(title, items) {
        let html = `<div class="sge-card">`;
        html += `<h3 class="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">${title}</h3>`;
        html += `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
        items.forEach(item => {
            html += `<div>
                <dt class="text-xs text-gray-500 font-medium">${item.label}</dt>
                <dd class="text-sm text-gray-900 mt-0.5">${item.value || '<span class="text-gray-400">---</span>'}</dd>
            </div>`;
        });
        html += `</dl></div>`;
        return html;
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    function _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        // Modais
        openModal,
        confirm,
        openFormModal,
        // Formulários
        renderForm,
        // Tabelas
        renderTable,
        _filterTable,
        _sortTable,
        _goToPage,
        _tableAction,
        // Cards
        renderStatCard,
        infoCard,
        pageHeader,
        // Badges
        badge,
        statusBadge,
        // Alertas
        alert,
        // Tabs
        renderTabs,
        _switchTab,
        // Loading
        loadingSpinner,
        skeletonRows,
        emptyState,
        // Upload
        renderFileUpload,
        _previewFile,
        // Dropdown
        renderDropdown,
        _toggleDropdown,
        _closeDropdown,
        // Progress
        progressBar,
        // Avatar
        avatar
    };
})();

window.SGEComponents = SGEComponents;