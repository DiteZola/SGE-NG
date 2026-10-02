// ============================================
// SGE-NG - MOTOR DE CRIPTOGRAFIA AES-256
// Usa Web Crypto API nativa do navegador
// Protege dados sensíveis localmente antes
// da sincronização com o Firebase
// ============================================

const SGECrypto = (() => {
    'use strict';

    // Nome da chave no IndexedDB para persistência segura
    const KEY_STORE_NAME = 'sge-ng-crypto-keys';
    const MASTER_KEY_ID = 'master-encryption-key';
    const ALGORITHM = 'AES-GCM';
    const KEY_LENGTH = 256;
    const IV_LENGTH = 12; // bytes para AES-GCM
    const SALT_LENGTH = 16; // bytes para derivação
    
    // Cache em memória da chave (nunca exportada em texto)
    let _cachedKey = null;
    let _initialized = false;

    // ============================================
    // FUNÇÕES AUXILIARES DE CONVERSÃO
    // ============================================
    
    /**
     * Converte ArrayBuffer para string Base64
     */
    function bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Converte string Base64 para ArrayBuffer
     */
    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Converte string para ArrayBuffer (UTF-8)
     */
    function stringToBuffer(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Converte ArrayBuffer para string (UTF-8)
     */
    function bufferToString(buffer) {
        return new TextDecoder().decode(buffer);
    }

    /**
     * Gera bytes aleatórios seguros
     */
    function getRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    // ============================================
    // GESTÃO DE CHAVES
    // ============================================
    
    /**
     * Deriva uma chave AES-256 a partir de uma password e salt
     * Usa PBKDF2 com 100.000 iterações para resistência a força bruta
     * @param {string} password
     * @param {Uint8Array} salt
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(password, salt) {
        // Importar a password como material de chave
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            stringToBuffer(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        // Derivar chave AES-256 usando PBKDF2
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: ALGORITHM,
                length: KEY_LENGTH
            },
            false, // não exportável
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Gera uma chave AES-256 aleatória (para uso interno do sistema)
     * @returns {Promise<CryptoKey>}
     */
    async function generateKey() {
        return crypto.subtle.generateKey(
            {
                name: ALGORITHM,
                length: KEY_LENGTH
            },
            true, // exportável para backup
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Exporta chave para formato JWK (para backup seguro)
     * @param {CryptoKey} key
     * @returns {Promise<object>}
     */
    async function exportKey(key) {
        return crypto.subtle.exportKey('jwk', key);
    }

    /**
     * Importa chave do formato JWK
     * @param {object} jwk
     * @returns {Promise<CryptoKey>}
     */
    async function importKey(jwk) {
        return crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: ALGORITHM, length: KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // ============================================
    // PERSISTÊNCIA DA CHAVE MESTRA
    // ============================================
    
    /**
     * Guarda a chave mestra no IndexedDB (encriptada com password do admin)
     */
    async function storeMasterKey(key, adminPassword) {
        const salt = getRandomBytes(SALT_LENGTH);
        const wrappingKey = await deriveKey(adminPassword, salt);
        
        // Exportar a chave para raw
        const exportedKey = await crypto.subtle.exportKey('raw', key);
        
        // Encriptar a chave exportada com a chave derivada da password
        const iv = getRandomBytes(IV_LENGTH);
        const encryptedKey = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            wrappingKey,
            exportedKey
        );

        // Guardar no IndexedDB
        const keyData = {
            id: MASTER_KEY_ID,
            salt: bufferToBase64(salt),
            iv: bufferToBase64(iv),
            encryptedKey: bufferToBase64(encryptedKey),
            createdAt: new Date().toISOString()
        };

        await saveToKeyStore(keyData);
        _cachedKey = key;
        return true;
    }

    /**
     * Recupera e desencripta a chave mestra
     */
    async function loadMasterKey(adminPassword) {
        if (_cachedKey) return _cachedKey;
        
        const keyData = await getFromKeyStore(MASTER_KEY_ID);
        if (!keyData) return null;

        try {
            const salt = new Uint8Array(base64ToBuffer(keyData.salt));
            const iv = new Uint8Array(base64ToBuffer(keyData.iv));
            const encryptedKey = base64ToBuffer(keyData.encryptedKey);

            const wrappingKey = await deriveKey(adminPassword, salt);
            const rawKey = await crypto.subtle.decrypt(
                { name: ALGORITHM, iv: iv },
                wrappingKey,
                encryptedKey
            );

            _cachedKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: ALGORITHM, length: KEY_LENGTH },
                true,
                ['encrypt', 'decrypt']
            );

            return _cachedKey;
        } catch (error) {
            console.error('[Crypto] Falha ao carregar chave mestra:', error.message);
            return null;
        }
    }

    // ============================================
    // ENCRIPTAÇÃO E DESENCRIPTAÇÃO DE DADOS
    // ============================================
    
    /**
     * Encripta dados (string ou objeto) com AES-256-GCM
     * @param {any} data - Dados para encriptar
     * @param {CryptoKey} [key] - Chave (usa cached se não fornecida)
     * @returns {Promise<string>} String encriptada (base64)
     */
    async function encrypt(data, key = null) {
        const cryptoKey = key || _cachedKey;
        if (!cryptoKey) {
            throw new Error('Chave de encriptação não disponível. Inicialize o sistema primeiro.');
        }

        const plainText = typeof data === 'string' ? data : JSON.stringify(data);
        const iv = getRandomBytes(IV_LENGTH);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            cryptoKey,
            stringToBuffer(plainText)
        );

        // Formato: iv(base64):ciphertext(base64)
        return bufferToBase64(iv) + ':' + bufferToBase64(encrypted);
    }

    /**
     * Desencripta dados
     * @param {string} encryptedString - Formato iv:ciphertext em base64
     * @param {CryptoKey} [key]
     * @returns {Promise<any>} Dados originais (string ou objeto)
     */
    async function decrypt(encryptedString, key = null) {
        const cryptoKey = key || _cachedKey;
        if (!cryptoKey) {
            throw new Error('Chave de desencriptação não disponível.');
        }

        if (!encryptedString || typeof encryptedString !== 'string' || !encryptedString.includes(':')) {
            throw new Error('Formato de dados encriptados inválido.');
        }

        const [ivBase64, cipherBase64] = encryptedString.split(':');
        const iv = new Uint8Array(base64ToBuffer(ivBase64));
        const ciphertext = base64ToBuffer(cipherBase64);

        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            cryptoKey,
            ciphertext
        );

        const plainText = bufferToString(decrypted);

        // Tentar parsear como JSON
        try {
            return JSON.parse(plainText);
        } catch {
            return plainText;
        }
    }

    // ============================================
    // HASH SEGURO (Para passwords e verificação de integridade)
    // ============================================
    
    /**
     * Gera hash SHA-256 de um texto
     * @param {string} text
     * @returns {Promise<string>} Hash em hexadecimal
     */
    async function hash(text) {
        const buffer = await crypto.subtle.digest('SHA-256', stringToBuffer(text));
        const hashArray = Array.from(new Uint8Array(buffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Gera hash com salt para password
     * @param {string} password
     * @returns {Promise<{hash: string, salt: string}>}
     */
    async function hashPassword(password) {
        const salt = bufferToBase64(getRandomBytes(SALT_LENGTH));
        const combined = salt + ':' + password;
        const hashed = await hash(combined);
        return { hash: hashed, salt: salt };
    }

    /**
     * Verifica password contra hash salteado
     * @param {string} password
     * @param {string} storedHash
     * @param {string} storedSalt
     * @returns {Promise<boolean>}
     */
    async function verifyPassword(password, storedHash, storedSalt) {
        const combined = storedSalt + ':' + password;
        const hashed = await hash(combined);
        return hashed === storedHash;
    }

    // ============================================
    // INTEGRIDADE DE DADOS (HMAC)
    // ============================================
    
    /**
     * Gera checksum de integridade para um bloco de dados
     * @param {any} data
     * @returns {Promise<string>}
     */
    async function generateChecksum(data) {
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        return hash(text);
    }

    /**
     * Verifica integridade de dados contra checksum
     * @param {any} data
     * @param {string} checksum
     * @returns {Promise<boolean>}
     */
    async function verifyChecksum(data, checksum) {
        const currentChecksum = await generateChecksum(data);
        return currentChecksum === checksum;
    }

    // ============================================
    // KEY STORE (IndexedDB para chaves)
    // ============================================
    
    function openKeyStoreDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(KEY_STORE_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveToKeyStore(data) {
        const db = await openKeyStoreDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('keys', 'readwrite');
            tx.objectStore('keys').put(data);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function getFromKeyStore(id) {
        const db = await openKeyStoreDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('keys', 'readonly');
            const request = tx.objectStore('keys').get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function deleteFromKeyStore(id) {
        const db = await openKeyStoreDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('keys', 'readwrite');
            tx.objectStore('keys').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    /**
     * Inicializa o motor de criptografia
     * Na primeira execução, gera e armazena a chave mestra
     * @param {string} [adminPassword] - Password para proteger a chave
     * @returns {Promise<boolean>}
     */
    async function initialize(adminPassword) {
        if (_initialized && _cachedKey) return true;

        try {
            // Verificar se Web Crypto API está disponível
            if (!crypto || !crypto.subtle) {
                console.error('[Crypto] Web Crypto API não suportada neste navegador');
                return false;
            }

            if (adminPassword) {
                // Tentar carregar chave existente
                const existingKey = await loadMasterKey(adminPassword);
                if (existingKey) {
                    _cachedKey = existingKey;
                    _initialized = true;
                    console.log('[Crypto] Chave mestra carregada com sucesso');
                    return true;
                }

                // Se não existe, gerar nova
                const newKey = await generateKey();
                await storeMasterKey(newKey, adminPassword);
                _cachedKey = newKey;
                _initialized = true;
                console.log('[Crypto] Nova chave mestra gerada e armazenada');
                return true;
            }

            // Sem password - gerar chave temporária (para modo offline sem login)
            _cachedKey = await generateKey();
            _initialized = true;
            console.log('[Crypto] Chave temporária gerada (sessão)');
            return true;

        } catch (error) {
            console.error('[Crypto] Erro na inicialização:', error);
            return false;
        }
    }

    /**
     * Verifica se o motor está pronto
     */
    function isReady() {
        return _initialized && _cachedKey !== null;
    }

    /**
     * Limpa a chave da memória (ao fazer logout)
     */
    function clearSession() {
        _cachedKey = null;
        _initialized = false;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        initialize,
        isReady,
        clearSession,
        // Encriptação
        encrypt,
        decrypt,
        // Hash
        hash,
        hashPassword,
        verifyPassword,
        // Integridade
        generateChecksum,
        verifyChecksum,
        // Gestão de chaves (para backup)
        exportKey: async () => _cachedKey ? exportKey(_cachedKey) : null,
        importAndSetKey: async (jwk) => {
            _cachedKey = await importKey(jwk);
            _initialized = true;
        },
        // Utilitários
        getRandomBytes,
        bufferToBase64,
        base64ToBuffer
    };
})();

window.SGECrypto = SGECrypto;