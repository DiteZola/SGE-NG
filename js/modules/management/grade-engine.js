// ============================================
// SGE-NG - MOTOR DE CÁLCULO DINÂMICO DE NOTAS
// Engine que calcula MAC, NPP, NPT e MFD
// com fórmulas configuráveis pela Direção
// ============================================

const SGEGradeEngine = (() => {
    'use strict';

    // Cache de fórmulas e configurações
    let _formulaCache = {};
    let _configCache = {};

    // ============================================
    // PARSER DE FÓRMULAS
    // Motor interpretador de expressões matemáticas
    // ============================================

    /**
     * Avalia uma fórmula matemática com variáveis
     * Suporta: +, -, *, /, (), SUM(), COUNT(), AVG(), MIN(), MAX(), IF()
     * @param {string} formula - Ex: "(MAC*0.6)+(NPP*0.2)+(NPT*0.2)"
     * @param {object} variables - Ex: { MAC: 14.5, NPP: 12, NPT: 16 }
     * @returns {number|null}
     */
    function evaluateFormula(formula, variables = {}) {
        if (!formula) return null;

        try {
            let expr = formula;

            // Substituir variáveis por valores
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                expr = expr.replace(regex, value !== null && value !== undefined ? value : 0);
            }

            // Funções agregadas
            expr = expr.replace(/SUM\(([^)]+)\)/gi, (_, args) => {
                const nums = args.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                return nums.reduce((a, b) => a + b, 0);
            });

            expr = expr.replace(/COUNT\(([^)]+)\)/gi, (_, args) => {
                const nums = args.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                return nums.length;
            });

            expr = expr.replace(/AVG\(([^)]+)\)/gi, (_, args) => {
                const nums = args.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            });

            expr = expr.replace(/MIN\(([^)]+)\)/gi, (_, args) => {
                const nums = args.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                return nums.length ? Math.min(...nums) : 0;
            });

            expr = expr.replace(/MAX\(([^)]+)\)/gi, (_, args) => {
                const nums = args.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                return nums.length ? Math.max(...nums) : 0;
            });

            // IF(condição, valor_se_true, valor_se_false)
            expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, t, f) => {
                try { return eval(cond) ? parseFloat(t) : parseFloat(f); } catch { return 0; }
            });

            // Remover "notas" e "COUNT(notas)" residuais (para fórmulas tipo SUM/COUNT)
            expr = expr.replace(/\bnotas\b/g, '0');

            // Avaliar expressão matemática segura
            // Apenas permitir caracteres matemáticos seguros
            if (/^[\d\s\+\-\*\/\.\(\),]+$/.test(expr)) {
                const result = Function('"use strict"; return (' + expr + ')')();
                return isNaN(result) || !isFinite(result) ? null : Math.round(result * 100) / 100;
            }

            return null;
        } catch (error) {
            console.error('[GradeEngine] Erro na fórmula:', formula, error);
            return null;
        }
    }

    // ============================================
    // CÁLCULO DA MAC (Média de Avaliação Contínua)
    // ============================================

    /**
     * Calcula a MAC de um aluno para uma disciplina e trimestre
     * @param {string} studentId
     * @param {string} subjectId
     * @param {string} sectionId
     * @param {string} termId
     * @returns {Promise<number|null>}
     */
    async function calculateMAC(studentId, subjectId, sectionId, termId) {
        const schoolId = SGEAuth.getUserSchoolId();

        // 1. Buscar configurações ativas
        const gradeConfigs = await SGEDb.query('grade_config', { schoolId, active: true });
        const macConfig = gradeConfigs.find(g => g.type === 'MAC');

        if (!macConfig || !macConfig.active) return null;

        // 2. Buscar avaliações da turma/disciplina/trimestre
        const assessments = await SGEDb.query('assessments', { sectionId, subjectId, termId });
        if (assessments.length === 0) return null;

        // 3. Buscar notas do aluno para estas avaliações
        const grades = await SGEDb.query('grades', { studentId, subjectId, termId });
        const studentGrades = grades.filter(g =>
            assessments.some(a => a.id === g.assessmentId) && g.value !== '' && g.value !== null
        );

        if (studentGrades.length === 0) return null;

        // 4. Obter tipos e pesos
        const types = await SGEDb.query('assessment_types', { schoolId });
        const typeMap = {};
        types.forEach(t => { typeMap[t.id] = t; });

        // 5. Calcular conforme fórmula
        const formula = macConfig.formula || 'SUM(notas)/COUNT(notas)';

        if (formula.includes('SUM(notas)') && formula.includes('COUNT(notas)')) {
            // Média aritmética simples
            const values = studentGrades.map(g => parseFloat(g.value)).filter(v => !isNaN(v));
            if (values.length === 0) return null;
            return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
        }

        if (formula.includes('PESO') || formula.includes('peso')) {
            // Média ponderada por tipo
            let weightedSum = 0;
            let totalWeight = 0;

            for (const grade of studentGrades) {
                const assessment = assessments.find(a => a.id === grade.assessmentId);
                if (!assessment) continue;

                const type = typeMap[assessment.typeId];
                const weight = type?.weight || 1;
                const value = parseFloat(grade.value);

                if (!isNaN(value)) {
                    weightedSum += value * weight;
                    totalWeight += weight;
                }
            }

            return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;
        }

        // Fórmula customizada
        const values = studentGrades.map(g => parseFloat(g.value)).filter(v => !isNaN(v));
        const variables = {
            notas: values.join(','),
            SUM: values.reduce((a, b) => a + b, 0),
            COUNT: values.length,
            AVG: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            MIN: values.length ? Math.min(...values) : 0,
            MAX: values.length ? Math.max(...values) : 0
        };

        return evaluateFormula(formula, variables);
    }

    // ============================================
    // CÁLCULO DA MFD (Média Final da Disciplina)
    // ============================================

    /**
     * Calcula a MFD a partir de MAC, NPP e NPT
     * @param {string} studentId
     * @param {string} subjectId
     * @param {string} sectionId
     * @param {string} termId
     * @returns {Promise<object>} { mac, npp, npt, mfd }
     */
    async function calculateMFD(studentId, subjectId, sectionId, termId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const gradeConfigs = await SGEDb.query('grade_config', { schoolId, active: true });

        const result = { mac: null, npp: null, npt: null, mfd: null };

        // MAC
        const macConfig = gradeConfigs.find(g => g.type === 'MAC');
        if (macConfig?.active) {
            result.mac = await calculateMAC(studentId, subjectId, sectionId, termId);
        }

        // NPP (Nota da Prova Parcial)
        const nppConfig = gradeConfigs.find(g => g.type === 'NPP');
        if (nppConfig?.active) {
            const nppAssessment = await SGEDb.query('assessments', {
                sectionId, subjectId, termId
            });
            const nppType = await SGEDb.query('assessment_types', { schoolId, code: 'P' });
            if (nppType.length > 0) {
                const prova = nppAssessment.find(a => a.typeId === nppType[0].id);
                if (prova) {
                    const grade = await SGEDb.query('grades', { studentId, assessmentId: prova.id });
                    result.npp = grade[0] ? parseFloat(grade[0].value) : null;
                }
            }
        }

        // NPT (Nota da Prova Trimestral)
        const nptConfig = gradeConfigs.find(g => g.type === 'NPT');
        if (nptConfig?.active) {
            // Similar ao NPP mas com tipo diferente
            result.npt = result.npp; // Simplificado - pode ser configurado
        }

        // MFD
        const mfdConfig = gradeConfigs.find(g => g.type === 'MFD');
        if (mfdConfig?.active && result.mac !== null) {
            result.mfd = evaluateFormula(mfdConfig.formula, {
                MAC: result.mac,
                NPP: result.npp || result.mac,
                NPT: result.npt || result.mac
            });
        } else {
            result.mfd = result.mac;
        }

        return result;
    }

    // ============================================
    // RECALCULAR TODA UMA TURMA
    // ============================================

    /**
     * Recalcula as notas computadas de todos os alunos de uma turma/disciplina
     * @param {string} sectionId
     * @param {string} subjectId
     * @param {string} termId
     * @returns {Promise<number>} Número de alunos recalculados
     */
    async function recalculateSection(sectionId, subjectId, termId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const students = await SGEDb.query('students', { schoolId, sectionId, status: 'active' });
        const years = await SGEDb.query('school_years', { schoolId, status: 'active' });
        const schoolYearId = years[0]?.id;

        let count = 0;

        for (const student of students) {
            const computed = await calculateMFD(student.id, subjectId, sectionId, termId);

            // Guardar ou atualizar nota computada
            const existing = await SGEDb.query('computed_grades', {
                studentId: student.id, subjectId, sectionId, termId
            });

            const computedData = {
                studentId: student.id, subjectId, sectionId, termId, schoolYearId,
                mac: computed.mac,
                npp: computed.npp,
                npt: computed.npt,
                mfd: computed.mfd,
                status: _determineStatus(computed.mfd, sectionId),
                recalculatedAt: SGEUtils.nowISO(),
                createdAt: SGEUtils.nowISO()
            };

            if (existing.length > 0) {
                computedData.id = existing[0].id;
                computedData.createdAt = existing[0].createdAt;
            }

            await SGEDb.put('computed_grades', computedData);

            // Atualizar MAC na interface se visível
            const macEl = document.getElementById(`mac-${student.id}`);
            if (macEl && computed.mac !== null) {
                macEl.textContent = computed.mac.toFixed(1);
                macEl.className = `text-center bg-primary-50 font-bold text-sm ${SGEUtils.gradeColorClass(computed.mac, 20)}`;
            }

            count++;
        }

        console.log(`[GradeEngine] ${count} aluno(s) recalculado(s) para ${sectionId}/${subjectId}/${termId}`);
        return count;
    }

    // ============================================
    // DETERMINAR ESTADO (Aprovado/Reprovado)
    // ============================================

    function _determineStatus(mfd, sectionId) {
        if (mfd === null || mfd === undefined) return 'pending';
        // Simplificado: >= 10 aprova (para escala 0-20)
        // Para escala 0-10: >= 5
        // A regra real depende da configuração da escola
        return mfd >= 10 ? 'approved' : 'failed';
    }

    // ============================================
    // VALIDAÇÃO DE ESTRUTURA DE NOTAS
    // ============================================

    /**
     * Valida se a estrutura de notas atende aos critérios da Direção
     * @param {string} sectionId
     * @param {string} subjectId
     * @param {string} termId
     * @returns {Promise<{valid: boolean, issues: string[]}>}
     */
    async function validateStructure(sectionId, subjectId, termId) {
        const schoolId = SGEAuth.getUserSchoolId();
        const issues = [];

        const assessments = await SGEDb.query('assessments', { sectionId, subjectId, termId });
        const types = await SGEDb.query('assessment_types', { schoolId, status: 'active' });

        // Verificar número mínimo de avaliações
        if (assessments.length < 2) {
            issues.push(`Mínimo de 2 avaliações por trimestre (atual: ${assessments.length})`);
        }

        // Verificar se tem pelo menos uma prova/teste
        const hasTest = assessments.some(a => {
            const type = types.find(t => t.id === a.typeId);
            return type?.code === 'T1' || type?.code === 'T2' || type?.code === 'P';
        });
        if (!hasTest) {
            issues.push('É necessário pelo menos um Teste ou Prova');
        }

        return { valid: issues.length === 0, issues };
    }

    // ============================================
    // RECALCULAR TUDO (Após mudança de fórmula)
    // ============================================

    /**
     * Recalcula todas as notas de uma escola
     * Usado quando a Direção altera fórmulas de cálculo
     * @param {string} schoolId
     * @param {string} termId
     * @returns {Promise<{recalculated: number}>}
     */
    async function recalculateAll(schoolId, termId) {
        const assignments = await SGEDb.query('assignments', { schoolId, schoolYearId: (await SGEDb.query('school_years', { schoolId, status: 'active' }))[0]?.id });
        const unique = new Map();
        assignments.forEach(a => {
            const key = `${a.sectionId}-${a.subjectId}`;
            if (!unique.has(key)) unique.set(key, { sectionId: a.sectionId, subjectId: a.subjectId });
        });

        let total = 0;
        for (const { sectionId, subjectId } of unique.values()) {
            total += await recalculateSection(sectionId, subjectId, termId);
        }

        return { recalculated: total };
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        evaluateFormula,
        calculateMAC,
        calculateMFD,
        recalculateSection,
        recalculateAll,
        validateStructure
    };
})();
window.SGEGradeEngine = SGEGradeEngine;