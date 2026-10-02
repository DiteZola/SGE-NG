// ============================================
// SGE-NG - MOTOR DE IMPRESSÃO
// Suporte para impressoras A4 e térmicas
// Bluetooth (58mm / 80mm) tipo POS
// ============================================

const SGEPrintEngine = (() => {
    'use strict';

    // Estado da conexão Bluetooth
    let _bluetoothDevice = null;
    let _bluetoothCharacteristic = null;
    let _isConnected = false;

    // Configurações de impressora
    const PRINTER_CONFIGS = {
        '58mm': { width: 32, charsPerLine: 32, paperWidth: '58mm' },
        '80mm': { width: 48, charsPerLine: 48, paperWidth: '80mm' }
    };

    // ============================================
    // IMPRESSÃO A4 (Browser nativo)
    // ============================================

    /**
     * Imprime um elemento HTML usando a impressora padrão do sistema
     * @param {string} elementId - ID do elemento a imprimir
     * @param {object} options - Opções de impressão
     */
    function printA4(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            SGENotifications?.error('Elemento de impressão não encontrado.');
            return false;
        }

        // Criar iframe de impressão
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Impressão SGE-NG</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #000; padding: 2mm; text-align: center; font-size: 9pt; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .signature-line { border-top: 1px solid #000; width: 40mm; margin: 10mm auto 2mm; }
                    .page-break { page-break-before: always; }
                    img { max-width: 100%; }
                    ${options.customCSS || ''}
                </style>
            </head>
            <body>${element.innerHTML}</body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Remover iframe após impressão
        setTimeout(() => document.body.removeChild(iframe), 1000);
        return true;
    }

    // ============================================
    // CONEXÃO BLUETOOTH (Web Bluetooth API)
    // ============================================

    /**
     * Conecta a uma impressora térmica Bluetooth
     * @param {string} printerType - '58mm' ou '80mm'
     * @returns {Promise<boolean>}
     */
    async function connectBluetooth(printerType = '58mm') {
        if (!navigator.bluetooth) {
            SGENotifications?.error('O seu navegador não suporta Bluetooth. Use Chrome.');
            return false;
        }

        try {
            SGENotifications?.info('A procurar impressora Bluetooth...');

            _bluetoothDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            if (!_bluetoothDevice) return false;

            SGENotifications?.info(`Conectando a ${_bluetoothDevice.name || 'impressora'}...`);

            const server = await _bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            _bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            _isConnected = true;
            _bluetoothDevice.addEventListener('gattserverdisconnected', () => {
                _isConnected = false;
                _bluetoothDevice = null;
                _bluetoothCharacteristic = null;
                SGENotifications?.warning('Impressora Bluetooth desconectada.');
            });

            SGENotifications?.success(`Conectado a ${_bluetoothDevice.name || 'impressora'}!`);
            return true;

        } catch (error) {
            console.error('[Print] Erro Bluetooth:', error);
            if (error.name !== 'NotFoundError') {
                SGENotifications?.error(`Erro ao conectar: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Desconecta da impressora Bluetooth
     */
    function disconnectBluetooth() {
        if (_bluetoothDevice && _bluetoothDevice.gatt.connected) {
            _bluetoothDevice.gatt.disconnect();
        }
        _isConnected = false;
        _bluetoothDevice = null;
        _bluetoothCharacteristic = null;
    }

    function isBluetoothConnected() { return _isConnected; }

    // ============================================
    // IMPRESSÃO TÉRMICA (Comandos ESC/POS)
    // ============================================

    /**
     * Envia dados para a impressora térmica
     * @param {Uint8Array} data
     * @returns {Promise<boolean>}
     */
    async function _sendToPrinter(data) {
        if (!_isConnected || !_bluetoothCharacteristic) {
            SGENotifications?.error('Impressora não conectada.');
            return false;
        }

        try {
            // Dividir em chunks de 512 bytes (limite BLE)
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await _bluetoothCharacteristic.writeValue(chunk);
                // Pequeno delay entre chunks
                await new Promise(r => setTimeout(r, 50));
            }
            return true;
        } catch (error) {
            console.error('[Print] Erro ao enviar:', error);
            SGENotifications?.error('Erro ao imprimir.');
            return false;
        }
    }

    /**
     * Comandos ESC/POS básicos
     */
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;

    const ESCPOS = {
        init: () => new Uint8Array([ESC, 0x40]),
        boldOn: () => new Uint8Array([ESC, 0x45, 0x01]),
        boldOff: () => new Uint8Array([ESC, 0x45, 0x00]),
        alignLeft: () => new Uint8Array([ESC, 0x61, 0x00]),
        alignCenter: () => new Uint8Array([ESC, 0x61, 0x01]),
        alignRight: () => new Uint8Array([ESC, 0x61, 0x02]),
        sizeNormal: () => new Uint8Array([GS, 0x21, 0x00]),
        sizeDouble: () => new Uint8Array([GS, 0x21, 0x11]),
        sizeDoubleWidth: () => new Uint8Array([GS, 0x21, 0x10]),
        sizeDoubleHeight: () => new Uint8Array([GS, 0x21, 0x01]),
        underlineOn: () => new Uint8Array([ESC, 0x2D, 0x01]),
        underlineOff: () => new Uint8Array([ESC, 0x2D, 0x00]),
        feed: (lines = 1) => new Uint8Array([ESC, 0x64, lines]),
        cut: () => new Uint8Array([GS, 0x56, 0x00]),
        partialCut: () => new Uint8Array([GS, 0x56, 0x01]),
        lineFeed: () => new Uint8Array([LF])
    };

    /**
     * Converte texto para bytes (Latin-1 / CP437)
     */
    function _textToBytes(text) {
        const encoder = new TextEncoder();
        return encoder.encode(text);
    }

    /**
     * Concatena múltiplos Uint8Arrays
     */
    function _concatArrays(...arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }

    /**
     * Centraliza texto na largura da impressora
     */
    function _centerText(text, width = 32) {
        if (text.length >= width) return text.substring(0, width);
        const padding = Math.floor((width - text.length) / 2);
        return ' '.repeat(padding) + text;
    }

    /**
     * Alinha texto à esquerda e direita na mesma linha
     */
    function _leftRightText(left, right, width = 32) {
        const totalLen = left.length + right.length;
        if (totalLen >= width) return left.substring(0, width);
        const spaces = ' '.repeat(width - totalLen);
        return left + spaces + right;
    }

    /**
     * Linha separadora
     */
    function _separator(width = 32, char = '-') {
        return char.repeat(width);
    }

    // ============================================
    // RECIBO TÉRMICO - PAGAMENTO
    // ============================================

    /**
     * Imprime recibo de pagamento em impressora térmica
     * @param {object} receiptData
     *   receiptData.schoolName, receiptData.schoolAddress, receiptData.schoolPhone
     *   receiptData.receiptNumber, receiptData.date
     *   receiptData.studentName, receiptData.enrollmentNumber
     *   receiptData.items: [{description, amount}]
     *   receiptData.total
     *   receiptData.paidBy
     * @param {string} printerType - '58mm' ou '80mm'
     * @returns {Promise<boolean>}
     */
    async function printReceipt(receiptData, printerType = '58mm') {
        if (!_isConnected) {
            const connected = await connectBluetooth(printerType);
            if (!connected) return false;
        }

        const config = PRINTER_CONFIGS[printerType] || PRINTER_CONFIGS['58mm'];
        const w = config.charsPerLine;
        const d = receiptData;

        try {
            let data = _concatArrays(
                ESCPOS.init(),
                ESCPOS.alignCenter(),
                ESCPOS.boldOn(),
                ESCPOS.sizeDoubleWidth(),
                _textToBytes(d.schoolName || 'SGE-NG'),
                _textToBytes('\n'),
                ESCPOS.sizeNormal(),
                ESCPOS.boldOff(),
                _textToBytes(d.schoolAddress || ''),
                _textToBytes('\n'),
                _textToBytes(`Tel: ${d.schoolPhone || '---'}`),
                _textToBytes('\n'),
                _textToBytes('\n'),

                ESCPOS.boldOn(),
                _textToBytes(_centerText('RECIBO DE PAGAMENTO', w)),
                _textToBytes('\n'),
                ESCPOS.boldOff(),
                _textToBytes(_separator(w, '=')),
                _textToBytes('\n'),

                _textToBytes(_leftRightText(`Nº: ${d.receiptNumber || '---'}`, `Data: ${d.date || '---'}`, w)),
                _textToBytes('\n'),
                _textToBytes(_separator(w)),
                _textToBytes('\n'),

                _textToBytes(`Aluno: ${d.studentName || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Matrícula: ${d.enrollmentNumber || '---'}`),
                _textToBytes('\n'),
                _textToBytes(_separator(w)),
                _textToBytes('\n'),

                ESCPOS.boldOn(),
                _textToBytes(_leftRightText('Descrição', 'Valor', w)),
                _textToBytes('\n'),
                ESCPOS.boldOff(),
                _textToBytes(_separator(w, '-')),
                _textToBytes('\n')
            );

            // Itens
            if (d.items && d.items.length > 0) {
                for (const item of d.items) {
                    const desc = item.description || '---';
                    const amount = SGEUtils?.formatCurrency(item.amount) || `${item.amount} Kz`;
                    data = _concatArrays(data,
                        _textToBytes(_leftRightText(desc.substring(0, w - 14), amount, w)),
                        _textToBytes('\n')
                    );
                }
            }

            data = _concatArrays(data,
                _textToBytes(_separator(w, '=')),
                _textToBytes('\n'),
                ESCPOS.boldOn(),
                ESCPOS.sizeDoubleWidth(),
                _textToBytes(_leftRightText('TOTAL:', SGEUtils?.formatCurrency(d.total) || `${d.total} Kz`, w)),
                _textToBytes('\n'),
                ESCPOS.sizeNormal(),
                ESCPOS.boldOff(),
                _textToBytes(_separator(w, '=')),
                _textToBytes('\n'),
                _textToBytes('\n'),

                _textToBytes(`Pago por: ${d.paidBy || '---'}`),
                _textToBytes('\n'),
                _textToBytes('\n'),
                _textToBytes(_centerText('Obrigado pela preferência!', w)),
                _textToBytes('\n'),
                _textToBytes(_centerText('SGE-NG - Sistema de Gestão Escolar', w)),
                _textToBytes('\n'),
                _textToBytes('\n'),

                ESCPOS.feed(3),
                ESCPOS.partialCut()
            );

            const success = await _sendToPrinter(data);
            if (success) SGENotifications?.success('Recibo impresso!');
            return success;

        } catch (error) {
            console.error('[Print] Erro ao imprimir recibo:', error);
            SGENotifications?.error('Erro ao imprimir recibo.');
            return false;
        }
    }

    // ============================================
    // RECIBO TÉRMICO - CONFIRMAÇÃO DE MATRÍCULA
    // ============================================

    /**
     * Imprime confirmação de matrícula
     * @param {object} data
     * @param {string} printerType
     * @returns {Promise<boolean>}
     */
    async function printEnrollmentReceipt(data, printerType = '58mm') {
        if (!_isConnected) {
            const connected = await connectBluetooth(printerType);
            if (!connected) return false;
        }

        const config = PRINTER_CONFIGS[printerType] || PRINTER_CONFIGS['58mm'];
        const w = config.charsPerLine;

        try {
            const printData = _concatArrays(
                ESCPOS.init(),
                ESCPOS.alignCenter(),
                ESCPOS.boldOn(),
                ESCPOS.sizeDoubleWidth(),
                _textToBytes(data.schoolName || 'SGE-NG'),
                _textToBytes('\n'),
                ESCPOS.sizeNormal(),
                ESCPOS.boldOff(),
                _textToBytes('\n'),
                ESCPOS.boldOn(),
                _textToBytes(_centerText('CONFIRMAÇÃO DE MATRÍCULA', w)),
                _textToBytes('\n'),
                ESCPOS.boldOff(),
                _textToBytes(_separator(w, '=')),
                _textToBytes('\n'),
                _textToBytes(`Aluno: ${data.studentName || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Matrícula: ${data.enrollmentNumber || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Processo: ${data.processNumber || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Classe: ${data.className || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Turma: ${data.sectionName || '---'}`),
                _textToBytes('\n'),
                _textToBytes(`Ano Letivo: ${data.schoolYear || '---'}`),
                _textToBytes('\n'),
                _textToBytes(_separator(w, '=')),
                _textToBytes('\n'),
                _textToBytes(`Data: ${data.date || SGEUtils?.formatDate(new Date()) || '---'}`),
                _textToBytes('\n'),
                _textToBytes('\n'),
                _textToBytes(_centerText('Documento válido como', w)),
                _textToBytes('\n'),
                _textToBytes(_centerText('comprovativo de matrícula', w)),
                _textToBytes('\n'),
                _textToBytes('\n'),
                ESCPOS.feed(3),
                ESCPOS.partialCut()
            );

            const success = await _sendToPrinter(printData);
            if (success) SGENotifications?.success('Confirmação impressa!');
            return success;

        } catch (error) {
            console.error('[Print] Erro:', error);
            return false;
        }
    }

    // ============================================
    // UI DE CONEXÃO
    // ============================================

    /**
     * Renderiza botão de conexão Bluetooth
     * @returns {string} HTML
     */
    function renderBluetoothButton() {
        if (!navigator.bluetooth) {
            return `<button class="btn btn-sm btn-secondary" disabled title="Bluetooth não suportado">
                🖨️ Bluetooth (Indisponível)
            </button>`;
        }

        return `
            <button class="btn btn-sm ${_isConnected ? 'btn-success' : 'btn-primary'}"
                onclick="SGEPrintEngine.toggleBluetooth()">
                🖨️ ${_isConnected ? 'Desconectar' : 'Conectar'} Impressora
            </button>
        `;
    }

    async function toggleBluetooth() {
        if (_isConnected) {
            disconnectBluetooth();
            SGENotifications?.info('Impressora desconectada.');
        } else {
            await connectBluetooth();
        }
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        printA4,
        connectBluetooth,
        disconnectBluetooth,
        isBluetoothConnected,
        printReceipt,
        printEnrollmentReceipt,
        renderBluetoothButton,
        toggleBluetooth,
        PRINTER_CONFIGS
    };
})();
window.SGEPrintEngine = SGEPrintEngine;