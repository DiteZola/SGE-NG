// ============================================
// SGE-NG - PAGAMENTOS E RECIBOS
// Registo de pagamentos, emissão de recibos
// e impressão térmica Bluetooth
// ============================================

const SGEPayments = (() => {
    'use strict';

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const [payments, students, configs, years] = await Promise.all([
            SGEDb.query('payments', { schoolId }, { orderBy: ['date', 'desc'] }),
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('financial_config', { schoolId, status: 'active' }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        const activeYear = years[0];
        const yearPayments = activeYear ? payments.filter(p => p.schoolYearId === activeYear.id) : payments;
        const totalReceived = yearPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const totalPending = yearPayments.filter(p => p.status === 'pending').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

        // CÓDIGO CORRIGIDO
let html = SGEComponents.pageHeader('Pagamentos', '...', [
    { label: '+ Novo Pagamento', type: 'primary', onClick: 'SGEPayments.openPaymentModal()' }
]);

// Adicionar botão Bluetooth separadamente após o header
html += `<div class="mb-4">${SGEPrintEngine.renderBluetoothButton()}</div>`;
        // Resumo
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                ${SGEComponents.renderStatCard({ title: 'Total Recebido', value: SGEUtils.formatCurrency(totalReceived), color: 'green', icon: '💰' })}
                ${SGEComponents.renderStatCard({ title: 'Total Pendente', value: SGEUtils.formatCurrency(totalPending), color: 'yellow', icon: '⏳' })}
                ${SGEComponents.renderStatCard({ title: 'Pagamentos', value: yearPayments.length, color: 'blue', icon: '📋' })}
            </div>
        `;

        // Tabela de pagamentos
        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s; });

        const tableData = yearPayments.map(p => ({
            ...p,
            studentName: studentMap[p.studentId]?.name || '---',
            enrollmentNumber: studentMap[p.studentId]?.enrollmentNumber || '---'
        }));

        html += SGEComponents.renderTable({
            columns: [
                { key: 'receiptNumber', label: 'Recibo Nº', sortable: true,
                    render: (v) => `<span class="font-mono text-xs">${_esc(v || '---')}</span>` },
                { key: 'date', label: 'Data', sortable: true,
                    render: (v) => SGEUtils.formatDate(v) },
                { key: 'studentName', label: 'Aluno', sortable: true,
                    render: (v) => `<span class="font-medium">${_esc(v)}</span>` },
                { key: 'description', label: 'Descrição', sortable: true },
                { key: 'amount', label: 'Valor', sortable: true,
                    render: (v) => `<span class="font-bold text-success-700">${SGEUtils.formatCurrency(v)}</span>` },
                { key: 'method', label: 'Método',
                    render: (v) => {
                        const methods = { cash: 'Dinheiro', transfer: 'Transferência', multicaixa: 'Multicaixa', other: 'Outro' };
                        return methods[v] || v || '---';
                    }
                },
                { key: 'status', label: 'Estado', render: (v) => SGEComponents.statusBadge(v === 'paid' ? 'ativo' : 'pending') }
            ],
            data: tableData,
            actions: [
                { label: 'Recibo', color: 'success',
                    icon: '🧾',
                    onClick: (row) => SGEPayments.printReceipt(row.id) },
                { label: 'Anular', color: 'danger',
                    icon: '✕',
                    onClick: (row) => SGEPayments.voidPayment(row.id),
                    condition: (row) => row.status === 'paid' }
            ],
            searchPlaceholder: 'Pesquisar por aluno, recibo...'
        });

        return html;
    }

    async function openPaymentModal() {
        const schoolId = SGEAuth.getUserSchoolId();
        const [students, configs, years] = await Promise.all([
            SGEDb.query('students', { schoolId, status: 'active' }, { orderBy: ['name', 'asc'] }),
            SGEDb.query('financial_config', { schoolId, status: 'active' }),
            SGEDb.query('school_years', { schoolId, status: 'active' })
        ]);

        if (!years.length) return SGENotifications.warning('Crie um ano letivo ativo.');

        const studentOpts = students.map(s => ({ value: s.id, label: `${s.name} (${s.enrollmentNumber || ''})` }));
        const feeOpts = configs.map(c => ({ value: c.id, label: `${c.description} - ${SGEUtils.formatCurrency(c.amount)}` }));

        SGEComponents.openFormModal({
            title: 'Registar Pagamento',
            size: 'md',
            fields: [
                { name: 'studentId', label: 'Aluno', type: 'select', required: true, options: studentOpts },
                { name: 'feeConfigId', label: 'Tipo de Pagamento', type: 'select', required: true, options: feeOpts,
                    help: 'Seleciona a taxa para preencher o valor automaticamente' },
                { name: 'amount', label: 'Valor Pago (Kz)', type: 'number', required: true, min: 0, step: 100 },
                { name: 'method', label: 'Método de Pagamento', type: 'select', required: true,
                    options: [
                        { value: 'cash', label: 'Dinheiro' },
                        { value: 'multicaixa', label: 'Multicaixa Express' },
                        { value: 'transfer', label: 'Transferência Bancária' },
                        { value: 'other', label: 'Outro' }
                    ]
                },
                { name: 'date', label: 'Data', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] },
                { name: 'notes', label: 'Observações', type: 'textarea', grid: 'full' }
            ],
            onSubmit: async (data) => {
                // Gerar número de recibo
                const count = await SGEDb.count('payments', { schoolId });
                const receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

                const feeConfig = configs.find(c => c.id === data.feeConfigId);

                const payment = {
                    schoolId,
                    schoolYearId: years[0].id,
                    receiptNumber,
                    studentId: data.studentId,
                    feeConfigId: data.feeConfigId,
                    description: feeConfig?.description || 'Pagamento',
                    amount: data.amount,
                    method: data.method,
                    date: data.date,
                    notes: data.notes || null,
                    status: 'paid',
                    receivedBy: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                };

                await SGEDb.put('payments', payment);

                // Registar no fluxo de caixa
                await SGEDb.put('cashflow', {
                    schoolId, schoolYearId: years[0].id,
                    type: 'income',
                    category: feeConfig?.feeType || 'outro',
                    description: `Pagamento: ${payment.description} - ${receiptNumber}`,
                    amount: data.amount,
                    date: data.date,
                    referenceId: payment.id,
                    createdAt: SGEUtils.nowISO()
                });

                SGENotifications.success(`Pagamento registado! Recibo ${receiptNumber}`);

                // Perguntar se quer imprimir recibo
                const print = await SGEComponents.confirm({
                    title: 'Imprimir Recibo?',
                    message: 'Deseja imprimir o recibo na impressora térmica?',
                    type: 'info',
                    confirmText: 'Sim, Imprimir',
                    cancelText: 'Não'
                });

                if (print) {
                    await SGEPayments.printReceipt(payment.id);
                }

                SGERouter.navigate('/financial/payments');
            }
        });
    }

    async function printReceipt(paymentId) {
        const payment = await SGEDb.get('payments', paymentId);
        if (!payment) return SGENotifications.error('Pagamento não encontrado.');

        const [student, school] = await Promise.all([
            SGEDb.get('students', payment.studentId),
            SGEDb.get('schools', SGEAuth.getUserSchoolId())
        ]);

        const receiptData = {
            schoolName: school?.name || 'SGE-NG',
            schoolAddress: school?.address || '',
            schoolPhone: school?.phone || '',
            receiptNumber: payment.receiptNumber,
            date: SGEUtils.formatDate(payment.date, true),
            studentName: student?.name || '---',
            enrollmentNumber: student?.enrollmentNumber || '---',
            items: [{ description: payment.description, amount: payment.amount }],
            total: payment.amount,
            paidBy: student?.guardianName || '---'
        };

        if (SGEPrintEngine.isBluetoothConnected()) {
            await SGEPrintEngine.printReceipt(receiptData);
        } else {
            // Fallback: gerar recibo em HTML e imprimir A4
            SGENotifications.info('Conecte a impressora Bluetooth para recibos térmicos. A imprimir em A4...');
            _printReceiptA4(receiptData);
        }
    }

    function _printReceiptA4(data) {
        const printArea = document.createElement('div');
        printArea.id = 'receipt-temp-print';
        printArea.style.cssText = 'padding:20px; max-width:400px; margin:auto; font-family:monospace; font-size:12px;';
        printArea.innerHTML = `
            <div style="text-align:center">
                <h3>${data.schoolName}</h3>
                <p>${data.schoolAddress}</p>
                <p>Tel: ${data.schoolPhone}</p>
                <hr>
                <h4>RECIBO DE PAGAMENTO</h4>
                <p>Nº: ${data.receiptNumber} | Data: ${data.date}</p>
                <hr>
                <p>Aluno: ${data.studentName}</p>
                <p>Matrícula: ${data.enrollmentNumber}</p>
                <hr>
                ${data.items.map(i => `<p>${i.description}: <strong>${SGEUtils.formatCurrency(i.amount)}</strong></p>`).join('')}
                <hr>
                <p style="font-size:16px; font-weight:bold">TOTAL: ${SGEUtils.formatCurrency(data.total)}</p>
                <hr>
                <p>Pago por: ${data.paidBy}</p>
                <br><br>
                <p style="text-align:center">Obrigado!</p>
            </div>
        `;
        document.body.appendChild(printArea);
        SGEPrintEngine.printA4('receipt-temp-print');
        setTimeout(() => printArea.remove(), 2000);
    }

    async function voidPayment(id) {
        const ok = await SGEComponents.confirm({
            title: 'Anular Pagamento',
            message: 'Tem a certeza que deseja anular este pagamento?',
            type: 'danger'
        });
        if (!ok) return;

        const payment = await SGEDb.get('payments', id);
        if (payment) {
            payment.status = 'voided';
            payment.voidedAt = SGEUtils.nowISO();
            payment.voidedBy = SGEAuth.getUserId();
            await SGEDb.put('payments', payment);

            await SGEDb.addAuditLog({
                userId: SGEAuth.getUserId(), userName: SGEAuth.getUserName(),
                action: 'void_payment', module: 'financial',
                description: `Pagamento ${payment.receiptNumber} anulado`,
                details: { paymentId: id, amount: payment.amount }
            });
        }

        SGENotifications.success('Pagamento anulado.');
        SGERouter.navigate('/financial/payments');
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openPaymentModal, printReceipt, voidPayment };
})();
window.SGEPayments = SGEPayments;