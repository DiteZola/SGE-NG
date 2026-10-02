// ============================================
// SGE-NG - GRÁFICOS (Chart.js)
// Configuração e geração de gráficos
// para dashboards e relatórios
// ============================================

const SGECharts = (() => {
    'use strict';

    // Instâncias de gráficos ativas (para destruir antes de recriar)
    const _instances = new Map();

    // Paleta de cores do sistema
    const COLORS = {
        blue: '#2563EB',
        green: '#16A34A',
        red: '#DC2626',
        yellow: '#D97706',
        purple: '#7C3AED',
        cyan: '#0891B2',
        pink: '#DB2777',
        orange: '#EA580C',
        gray: '#6B7280'
    };

    // Gradiente verde → amarelo → vermelho (para desempenho)
    const GRADE_GRADIENT = ['#DC2626', '#EA580C', '#D97706', '#84CC16', '#16A34A', '#15803D'];

    // Configuração global do Chart.js
    const DEFAULT_OPTIONS = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 16,
                    usePointStyle: true,
                    pointStyleWidth: 10,
                    font: { size: 12, family: 'Inter, sans-serif' }
                }
            },
            tooltip: {
                backgroundColor: '#1F2937',
                titleFont: { size: 13, family: 'Inter, sans-serif' },
                bodyFont: { size: 12, family: 'Inter, sans-serif' },
                padding: 12,
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6B7280' }
            },
            y: {
                grid: { color: '#F3F4F6' },
                ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6B7280' },
                beginAtZero: true
            }
        }
    };

    // ============================================
    // CRIAÇÃO DE GRÁFICOS
    // ============================================

    /**
     * Cria ou atualiza um gráfico
     * @param {string} canvasId - ID do elemento <canvas>
     * @param {string} type - 'bar'|'line'|'pie'|'doughnut'|'radar'|'polarArea'
     * @param {object} data - Dados do Chart.js
     * @param {object} [customOptions] - Opções adicionais
     * @returns {Chart|null}
     */
    function create(canvasId, type, data, customOptions = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[Charts] Canvas '${canvasId}' não encontrado`);
            return null;
        }

        // Verificar se Chart.js está carregado
        if (typeof Chart === 'undefined') {
            console.error('[Charts] Chart.js não está carregado');
            canvas.parentElement.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Gráficos indisponíveis</p>';
            return null;
        }

        // Destruir instância anterior se existir
        destroy(canvasId);

        const ctx = canvas.getContext('2d');
        const options = _mergeDeep({}, DEFAULT_OPTIONS, customOptions);

        // Ajustes por tipo
        if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
            delete options.scales;
        }

        try {
            const chart = new Chart(ctx, { type, data, options });
            _instances.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`[Charts] Erro ao criar gráfico '${canvasId}':`, error);
            return null;
        }
    }

    /**
     * Destrói um gráfico
     */
    function destroy(canvasId) {
        const chart = _instances.get(canvasId);
        if (chart) {
            chart.destroy();
            _instances.delete(canvasId);
        }
    }

    /**
     * Destrói todos os gráficos
     */
    function destroyAll() {
        _instances.forEach((chart, id) => {
            chart.destroy();
        });
        _instances.clear();
    }

    // ============================================
    // GRÁFICOS PRÉ-CONFIGURADOS
    // ============================================

    /**
     * Gráfico de barras: Desempenho por disciplina
     * @param {string} canvasId
     * @param {Array<{label, average, max}>} subjects
     */
    function subjectPerformance(canvasId, subjects) {
        const labels = subjects.map(s => s.label);
        const averages = subjects.map(s => s.average);
        const colors = averages.map(avg => {
            if (avg >= 14) return COLORS.green;
            if (avg >= 10) return COLORS.yellow;
            return COLORS.red;
        });

        return create(canvasId, 'bar', {
            labels,
            datasets: [{
                label: 'Média',
                data: averages,
                backgroundColor: colors.map(c => c + '33'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 32
            }]
        }, {
            scales: {
                y: { max: 20, ticks: { stepSize: 5 } }
            },
            plugins: {
                legend: { display: false }
            }
        });
    }

    /**
     * Gráfico de doughnut: Distribuição de aprovações
     * @param {string} canvasId
     * @param {object} data - { approved, failed, pending }
     */
    function approvalDistribution(canvasId, data) {
        return create(canvasId, 'doughnut', {
            labels: ['Aprovados', 'Reprovados', 'Pendentes'],
            datasets: [{
                data: [data.approved || 0, data.failed || 0, data.pending || 0],
                backgroundColor: [COLORS.green, COLORS.red, COLORS.yellow],
                borderWidth: 0,
                hoverOffset: 8
            }]
        }, {
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom' }
            }
        });
    }

    /**
     * Gráfico de linha: Evolução de notas ao longo dos trimestres
     * @param {string} canvasId
     * @param {Array<{label, values}>} datasets - [{label: 'Matemática', values: [12, 14, 16]}]
     */
    function gradeEvolution(canvasId, datasets) {
        const chartDatasets = datasets.map((ds, i) => {
            const colors = [COLORS.blue, COLORS.green, COLORS.red, COLORS.purple, COLORS.orange, COLORS.cyan];
            const color = colors[i % colors.length];
            return {
                label: ds.label,
                data: ds.values,
                borderColor: color,
                backgroundColor: color + '22',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2
            };
        });

        return create(canvasId, 'line', {
            labels: ['1º Trimestre', '2º Trimestre', '3º Trimestre'],
            datasets: chartDatasets
        });
    }

    /**
     * Gráfico de barras horizontais: Assiduidade dos professores
     * @param {string} canvasId
     * @param {Array<{name, present, absent}>} teachers
     */
    function teacherAttendance(canvasId, teachers) {
        const labels = teachers.map(t => t.name);

        return create(canvasId, 'bar', {
            labels,
            datasets: [
                {
                    label: 'Presenças',
                    data: teachers.map(t => t.present),
                    backgroundColor: COLORS.green + '88',
                    borderColor: COLORS.green,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Faltas',
                    data: teachers.map(t => t.absent),
                    backgroundColor: COLORS.red + '88',
                    borderColor: COLORS.red,
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        }, {
            indexAxis: 'y',
            scales: {
                x: { stacked: true, grid: { color: '#F3F4F6' } },
                y: { stacked: true, grid: { display: false } }
            }
        });
    }

    /**
     * Gráfico de barras: Alunos por turma/classe
     * @param {string} canvasId
     * @param {Array<{label, count, capacity}>} sections
     */
    function studentsPerSection(canvasId, sections) {
        return create(canvasId, 'bar', {
            labels: sections.map(s => s.label),
            datasets: [
                {
                    label: 'Alunos',
                    data: sections.map(s => s.count),
                    backgroundColor: COLORS.blue + '66',
                    borderColor: COLORS.blue,
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: 'Capacidade',
                    data: sections.map(s => s.capacity),
                    backgroundColor: COLORS.gray + '22',
                    borderColor: COLORS.gray,
                    borderWidth: 1,
                    borderDash: [5, 5],
                    borderRadius: 6
                }
            ]
        });
    }

    /**
     * Gráfico de radar: Avaliação de competências
     * @param {string} canvasId
     * @param {Array<string>} labels
     * @param {Array<number>} values (0-20)
     */
    function competencyRadar(canvasId, labels, values) {
        return create(canvasId, 'radar', {
            labels,
            datasets: [{
                label: 'Desempenho',
                data: values,
                backgroundColor: COLORS.blue + '33',
                borderColor: COLORS.blue,
                borderWidth: 2,
                pointBackgroundColor: COLORS.blue,
                pointRadius: 4
            }]
        }, {
            scales: {
                r: {
                    min: 0,
                    max: 20,
                    ticks: { stepSize: 5, font: { size: 10 } },
                    grid: { color: '#E5E7EB' },
                    pointLabels: { font: { size: 11 } }
                }
            }
        });
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    function _mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    _mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        return _mergeDeep(target, ...sources);
    }

    function isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        create, destroy, destroyAll,
        subjectPerformance,
        approvalDistribution,
        gradeEvolution,
        teacherAttendance,
        studentsPerSection,
        competencyRadar,
        COLORS
    };
})();

window.SGECharts = SGECharts;