// ============================================
// SGE-NG - UTILITÁRIOS GERAIS
// Funções auxiliares reutilizáveis em todo o sistema
// ============================================

const SGEUtils = (() => {
    'use strict';

    // ============================================
    // GERAÇÃO DE IDs ÚNICOS
    // ============================================
    
    /**
     * Gera um UUID v4 completo
     * @returns {string} UUID no formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
     */
    function generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f) | (c === 'x' ? 0 : 0x40);
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    /**
     * Gera um ID curto (12 caracteres alfanuméricos)
     * @param {string} prefix - Prefixo opcional (ex: 'ALU', 'PROF')
     * @returns {string}
     */
    function generateShortId(prefix = '') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const arr = crypto.getRandomValues(new Uint8Array(12));
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars[arr[i] % chars.length];
        }
        return prefix ? `${prefix}-${id}` : id;
    }

    /**
     * Gera um código numérico sequencial formatado
     * @param {number} number - Número sequencial
     * @param {string} format - Formato (ex: 'MAT-{ANO}-{SEQ:6}')
     * @param {object} data - Dados para substituição
     * @returns {string}
     */
    function generateFormattedCode(number, format, data = {}) {
        let code = format;
        const year = data.year || new Date().getFullYear();
        
        code = code.replace('{ANO}', year);
        code = code.replace('{YEAR}', year);
        
        const seqMatch = code.match(/\{SEQ:(\d+)\}/);
        if (seqMatch) {
            const digits = parseInt(seqMatch[1]);
            code = code.replace(seqMatch[0], String(number).padStart(digits, '0'));
        } else {
            code = code.replace('{SEQ}', String(number));
        }
        
        // Substituições extras
        Object.keys(data).forEach(key => {
            code = code.replace(`{${key.toUpperCase()}}`, data[key]);
        });
        
        return code;
    }

    // ============================================
    // FORMATAÇÃO DE DATAS
    // ============================================
    
    /**
     * Formata data para o padrão angolano (DD/MM/AAAA)
     * @param {Date|string|number} date
     * @param {boolean} includeTime - Incluir hora
     * @returns {string}
     */
    function formatDate(date, includeTime = false) {
        if (!date) return '---';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '---';
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        if (includeTime) {
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }
        
        return `${day}/${month}/${year}`;
    }

    /**
     * Formata data por extenso em português
     * @param {Date|string} date
     * @returns {string} Ex: "15 de Janeiro de 2025"
     */
    function formatDateExtended(date) {
        if (!date) return '---';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '---';
        
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    }

    /**
     * Calcula a idade a partir da data de nascimento
     * @param {Date|string} birthDate
     * @returns {number}
     */
    function calculateAge(birthDate) {
        if (!birthDate) return 0;
        const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    /**
     * Retorna timestamp ISO atual
     * @returns {string}
     */
    function nowISO() {
        return new Date().toISOString();
    }

    // ============================================
    // FORMATAÇÃO DE TEXTO E NOMES
    // ============================================
    
    /**
     * Capitaliza a primeira letra de cada palavra
     * @param {string} str
     * @returns {string}
     */
    function capitalize(str) {
        if (!str) return '';
        const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com'];
        return str.toLowerCase().split(' ').map((word, index) => {
            if (index > 0 && prepositions.includes(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    /**
     * Retorna as iniciais de um nome (máx 2 letras)
     * @param {string} name
     * @returns {string}
     */
    // CÓDIGO CORRIGIDO
function getInitials(name) {
    if (!name || typeof name !== 'string') return '--'; // 
        if (!name || typeof name !== 'string') return '--';
        const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) return '--';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    /**
     * Gênero e concordância - Ajusta texto conforme o sexo
     * @param {string} gender - 'M' ou 'F'
     * @param {string} masculine - Texto para masculino
     * @param {string} feminine - Texto para feminino
     * @returns {string}
     */
    function genderText(gender, masculine, feminine) {
        return (gender && gender.toUpperCase() === 'F') ? feminine : masculine;
    }

    /**
     * Exemplos de uso de genderText para documentos oficiais:
     * genderText(aluno.gender, 'O Aluno', 'A Aluna')
     * genderText(aluno.gender, 'Aprovado', 'Aprovada')
     * genderText(aluno.gender, 'Matriculado', 'Matriculada')
     * genderText(aluno.gender, 'o mesmo', 'a mesma')
     */

    // ============================================
    // VALIDAÇÕES
    // ============================================
    
    /**
     * Valida email
     * @param {string} email
     * @returns {boolean}
     */
    function isValidEmail(email) {
        if (!email) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }

    /**
     * Valida NIF angolano (formato básico)
     * @param {string} nif
     * @returns {boolean}
     */
    function isValidNIF(nif) {
        if (!nif) return false;
        const cleaned = nif.replace(/\D/g, '');
        return cleaned.length >= 9 && cleaned.length <= 14;
    }

    /**
     * Valida número de telefone angolano
     * @param {string} phone
     * @returns {boolean}
     */
    function isValidPhone(phone) {
        if (!phone) return false;
        const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
        // Formato Angola: +244 9XX XXX XXX ou 9XX XXX XXX
        return /^(\+244)?9\d{8}$/.test(cleaned);
    }

    /**
     * Valida se uma nota está dentro da escala permitida
     * @param {number} grade - Nota
     * @param {string} level - Nível: 'iniciacao', 'primario', 'ciclo1', 'ciclo2'
     * @returns {boolean}
     */
    function isValidGrade(grade, level) {
        if (grade === null || grade === undefined || isNaN(grade)) return false;
        const num = parseFloat(grade);
        switch (level) {
            case 'iniciacao':
                return false; // Iniciação usa qualitativo, não numérico
            case 'primario':
                return num >= 0 && num <= 10;
            case 'ciclo1':
            case 'ciclo2':
                return num >= 0 && num <= 20;
            default:
                return num >= 0 && num <= 20;
        }
    }

    /**
     * Valida se o formulário tem campos obrigatórios preenchidos
     * @param {HTMLFormElement} form
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validateForm(form) {
        const errors = [];
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            // Remover estado anterior
            field.classList.remove('error', 'success');
            
            const value = field.value ? field.value.trim() : '';
            const label = field.closest('div')?.querySelector('label')?.textContent || field.name || field.id;
            
            if (!value) {
                errors.push(`O campo "${label}" é obrigatório.`);
                field.classList.add('error');
            } else {
                // Validações específicas por tipo
                if (field.type === 'email' && !isValidEmail(value)) {
                    errors.push(`O email "${value}" não é válido.`);
                    field.classList.add('error');
                } else {
                    field.classList.add('success');
                }
            }
        });

        return { valid: errors.length === 0, errors };
    }

    // ============================================
    // CONVERSÕES DE NOTAS E QUALIFICAÇÕES
    // ============================================
    
    /**
     * Converte nota numérica de comportamento (0-20) para qualitativa
     * @param {number} grade
     * @returns {string}
     */
    function behaviorToQualitative(grade) {
        if (grade === null || grade === undefined) return '---';
        const num = parseFloat(grade);
        if (num >= 18) return 'Muito Bom';
        if (num >= 14) return 'Bom';
        if (num >= 10) return 'Suficiente';
        if (num >= 5) return 'Medíocre';
        return 'Mau';
    }

    /**
     * Escala qualitativa para Iniciação
     * @param {string} value - 'MB', 'B', 'S', 'I'
     * @returns {string} Descrição completa
     */
    function qualitativeLabel(value) {
        const map = {
            'MB': 'Muito Bom',
            'B': 'Bom',
            'S': 'Suficiente',
            'I': 'Insuficiente'
        };
        return map[value] || value || '---';
    }

    /**
     * Retorna a classe CSS para colorir a nota
     * @param {number} grade
     * @param {number} maxGrade - Máximo (10 ou 20)
     * @returns {string} Classe CSS
     */
    function gradeColorClass(grade, maxGrade = 20) {
        if (grade === null || grade === undefined) return '';
        const num = parseFloat(grade);
        const percent = (num / maxGrade) * 100;
        
        if (percent >= 85) return 'grade-excellent';
        if (percent >= 65) return 'grade-good';
        if (percent >= 50) return 'grade-sufficient';
        return 'grade-insufficient';
    }

    /**
     * Determina o nível de ensino baseado na classe
     * @param {string|number} classNum - Número da classe (0 para iniciação)
     * @returns {string} 'iniciacao', 'primario', 'ciclo1', 'ciclo2'
     */
    function getEducationLevel(classNum) {
        const num = parseInt(classNum);
        if (num === 0) return 'iniciacao';
        if (num >= 1 && num <= 6) return 'primario';
        if (num >= 7 && num <= 9) return 'ciclo1';
        if (num >= 10 && num <= 13) return 'ciclo2';
        return 'primario';
    }

    /**
     * Retorna a escala de notas por nível
     * @param {string} level
     * @returns {{ min: number, max: number, type: string }}
     */
    function getGradeScale(level) {
        switch (level) {
            case 'iniciacao':
                return { min: 0, max: 0, type: 'qualitative', options: ['MB', 'B', 'S', 'I'] };
            case 'primario':
                return { min: 0, max: 10, type: 'numeric' };
            case 'ciclo1':
            case 'ciclo2':
                return { min: 0, max: 20, type: 'numeric' };
            default:
                return { min: 0, max: 20, type: 'numeric' };
        }
    }

    /**
     * Verifica se é classe final
     * @param {number|string} classNum
     * @returns {boolean}
     */
    function isFinalClass(classNum) {
        return [6, 9, 12, 13].includes(parseInt(classNum));
    }

    // ============================================
    // FORMATAÇÃO DE VALORES
    // ============================================
    
    /**
     * Formata valor monetário em Kwanza (Kz)
     * @param {number} value
     * @returns {string}
     */
    function formatCurrency(value) {
        if (value === null || value === undefined) return '0,00 Kz';
        return new Intl.NumberFormat('pt-AO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value) + ' Kz';
    }

    /**
     * Formata número com separadores de milhar
     * @param {number} value
     * @returns {string}
     */
    function formatNumber(value) {
        if (value === null || value === undefined) return '0';
        return new Intl.NumberFormat('pt-AO').format(value);
    }

    /**
     * Formata tamanho de ficheiro
     * @param {number} bytes
     * @returns {string}
     */
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ============================================
    // MANIPULAÇÃO DE DOM
    // ============================================
    
    /**
     * Atalho para querySelector
     */
    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    /**
     * Atalho para querySelectorAll
     */
    function $$(selector, parent = document) {
        return [...parent.querySelectorAll(selector)];
    }

    /**
     * Cria um elemento HTML com atributos e filhos
     * @param {string} tag
     * @param {object} attrs
     * @param  {...(string|HTMLElement)} children
     * @returns {HTMLElement}
     */
    function createElement(tag, attrs = {}, ...children) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, val]) => {
            if (key === 'className') el.className = val;
            else if (key === 'innerHTML') el.innerHTML = val;
            else if (key === 'textContent') el.textContent = val;
            else if (key.startsWith('on') && typeof val === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), val);
            }
            else if (key === 'style' && typeof val === 'object') {
                Object.assign(el.style, val);
            }
            else if (key === 'dataset' && typeof val === 'object') {
                Object.entries(val).forEach(([k, v]) => el.dataset[k] = v);
            }
            else el.setAttribute(key, val);
        });
        children.forEach(child => {
            if (typeof child === 'string') el.appendChild(document.createTextNode(child));
            else if (child instanceof HTMLElement) el.appendChild(child);
        });
        return el;
    }

    /**
     * Mostra/esconde elemento
     */
    function show(el) {
        if (typeof el === 'string') el = $(el);
        if (el) el.classList.remove('hidden');
    }

    function hide(el) {
        if (typeof el === 'string') el = $(el);
        if (el) el.classList.add('hidden');
    }

    function toggle(el) {
        if (typeof el === 'string') el = $(el);
        if (el) el.classList.toggle('hidden');
    }

    // ============================================
    // DEBOUNCE E THROTTLE
    // ============================================
    
    /**
     * Debounce - Atrasa execução até parar de chamar
     * @param {Function} fn
     * @param {number} delay - ms
     * @returns {Function}
     */
    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttle - Limita execução a uma vez por intervalo
     * @param {Function} fn
     * @param {number} limit - ms
     * @returns {Function}
     */
    function throttle(fn, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ============================================
    // DEEP CLONE E COMPARAÇÃO
    // ============================================
    
    /**
     * Deep clone de um objeto (sem referências)
     * @param {any} obj
     * @returns {any}
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        try {
            return structuredClone(obj);
        } catch {
            return JSON.parse(JSON.stringify(obj));
        }
    }

    /**
     * Compara dois objetos superficialmente
     */
    function shallowEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => a[key] === b[key]);
    }

    // ============================================
    // PROVÍNCIAS E MUNICÍPIOS DE ANGOLA
    // (Lista base - pode ser ampliada via configurações)
    // ============================================
    
    const ANGOLA_PROVINCES = [
        { code: 'BGO', name: 'Bengo' },
        { code: 'BGU', name: 'Benguela' },
        { code: 'BIE', name: 'Bié' },
        { code: 'CAB', name: 'Cabinda' },
        { code: 'CCU', name: 'Cuando Cubango' },
        { code: 'CNO', name: 'Cuanza Norte' },
        { code: 'CSU', name: 'Cuanza Sul' },
        { code: 'CNN', name: 'Cunene' },
        { code: 'HUA', name: 'Huambo' },
        { code: 'HLA', name: 'Huíla' },
        { code: 'LDA', name: 'Luanda' },
        { code: 'LNO', name: 'Lunda Norte' },
        { code: 'LSU', name: 'Lunda Sul' },
        { code: 'MAL', name: 'Malanje' },
        { code: 'MOX', name: 'Moxico' },
        { code: 'NAM', name: 'Namibe' },
        { code: 'UIG', name: 'Uíge' },
        { code: 'ZAI', name: 'Zaire' }
    ];

    /**
     * Retorna lista de províncias
     */
    function getProvinces() {
        return [...ANGOLA_PROVINCES];
    }

    // ============================================
    // EXPORTAÇÃO
    // ============================================
    
    /**
     * Converte dados para Excel (.xlsx) e faz download
     * @param {Array<object>} data - Array de objetos
     * @param {string} filename - Nome do ficheiro
     * @param {string} sheetName - Nome da folha
     */
    function exportToExcel(data, filename = 'dados', sheetName = 'Dados') {
        if (!window.XLSX) {
            console.error('SheetJS (XLSX) não está carregado');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    /**
     * Converte imagem para Base64 para uso em documentos
     * @param {File} file
     * @returns {Promise<string>}
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('Nenhum ficheiro fornecido'));
            if (file.size > 15 * 1024 * 1024) {
                return reject(new Error('Ficheiro excede 15 MB'));
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Comprime imagem para reduzir tamanho antes do upload
     * @param {string} base64 - Imagem em base64
     * @param {number} maxWidth - Largura máxima em pixels
     * @param {number} quality - Qualidade JPEG (0 a 1)
     * @returns {Promise<string>}
     */
    function compressImage(base64, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        // IDs
        generateUUID,
        generateShortId,
        generateFormattedCode,
        // Datas
        formatDate,
        formatDateExtended,
        calculateAge,
        nowISO,
        // Texto
        capitalize,
        getInitials,
        genderText,
        // Validação
        isValidEmail,
        isValidNIF,
        isValidPhone,
        isValidGrade,
        validateForm,
        // Notas
        behaviorToQualitative,
        qualitativeLabel,
        gradeColorClass,
        getEducationLevel,
        getGradeScale,
        isFinalClass,
        // Formatação
        formatCurrency,
        formatNumber,
        formatFileSize,
        // DOM
        $,
        $$,
        createElement,
        show,
        hide,
        toggle,
        // Funções
        debounce,
        throttle,
        deepClone,
        shallowEqual,
        // Angola
        getProvinces,
        ANGOLA_PROVINCES,
        // Exportação
        exportToExcel,
        fileToBase64,
        compressImage
    };
})();

// Disponibilizar globalmente
window.SGEUtils = SGEUtils;