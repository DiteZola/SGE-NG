// ============================================
// SGE-NG - CONFIGURAÇÃO E INICIALIZAÇÃO FIREBASE
// Gerencia a conexão com Firebase e a 
// persistência offline do Firestore
// ============================================

const SGEFirebase = (() => {
    'use strict';

    // ============================================
    // CONFIGURAÇÃO DO FIREBASE
    // ============================================
    const firebaseConfig = {
        apiKey: "AIzaSyC_c7wygc3GgSiWsZgNSZvrh7xnxajK8Do",
        authDomain: "sge4-8b772.firebaseapp.com",
        projectId: "sge4-8b772",
        storageBucket: "sge4-8b772.firebasestorage.app",
        messagingSenderId: "311536152950",
        appId: "1:311536152950:web:c9d1600e9dad04921b4a57"
    };

    // Referências dos serviços Firebase
    let _app = null;
    let _auth = null;
    let _db = null;
    let _storage = null;
    let _initialized = false;
    let _offlinePersistenceEnabled = false;

    // Estado de conexão
    let _isOnline = navigator.onLine;
    let _connectionListeners = [];

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    /**
     * Inicializa o Firebase e ativa persistência offline
     * @returns {Promise<boolean>}
     */
    async function initialize() {
        if (_initialized) return true;

        try {
            // Verificar se Firebase SDK está carregado
            if (typeof firebase === 'undefined') {
                console.error('[Firebase] SDK não carregado. Verificar conexão CDN.');
                return false;
            }

            // Inicializar Firebase App
            _app = firebase.initializeApp(firebaseConfig);
            console.log('[Firebase] App inicializada');

            // Inicializar Auth
            _auth = firebase.auth();
            _auth.languageCode = 'pt';
            // Persistência de sessão local (sobrevive a refresh e fecho do browser)
            await _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('[Firebase] Auth configurado com persistência LOCAL');

            // Inicializar Firestore
            _db = firebase.firestore();
            
            // Ativar persistência offline do Firestore
            try {
                await _db.enablePersistence({ synchronizeTabs: true });
                _offlinePersistenceEnabled = true;
                console.log('[Firebase] Persistência offline do Firestore ATIVADA');
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    // Múltiplos tabs abertos - persistência limitada
                    console.warn('[Firebase] Persistência offline limitada (múltiplos tabs)');
                    _offlinePersistenceEnabled = true; // Ainda funciona no tab principal
                } else if (err.code === 'unimplemented') {
                    console.warn('[Firebase] Browser não suporta persistência offline');
                    _offlinePersistenceEnabled = false;
                }
            }

            // Configurar timeout e cache do Firestore
            _db.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
                merge: true
            });

            // Inicializar Storage
            _storage = firebase.storage();
            console.log('[Firebase] Storage configurado');

            // Monitorar estado de conexão
            _setupConnectionMonitor();

            _initialized = true;
            console.log('[Firebase] Inicialização completa');
            return true;

        } catch (error) {
            console.error('[Firebase] Erro na inicialização:', error);
            // Mesmo com erro, permitir modo offline
            _initialized = true;
            return false;
        }
    }

    // ============================================
    // MONITOR DE CONEXÃO
    // ============================================
    
    function _setupConnectionMonitor() {
        // Eventos nativos do browser
        window.addEventListener('online', () => {
            _isOnline = true;
            console.log('[Firebase] Conexão restabelecida');
            _notifyConnectionChange(true);
        });

        window.addEventListener('offline', () => {
            _isOnline = false;
            console.log('[Firebase] Sem conexão');
            _notifyConnectionChange(false);
        });

        // Monitor do Firestore
        if (_db) {
            _db.enableNetwork().catch(() => {});
        }
    }

    function _notifyConnectionChange(online) {
        _connectionListeners.forEach(listener => {
            try {
                listener(online);
            } catch (e) {
                console.error('[Firebase] Erro no listener de conexão:', e);
            }
        });
    }

    /**
     * Regista um listener para mudanças de conexão
     * @param {Function} callback - Recebe (boolean) true=online, false=offline
     */
    function onConnectionChange(callback) {
        if (typeof callback === 'function') {
            _connectionListeners.push(callback);
        }
    }

    // ============================================
    // GETTERS DOS SERVIÇOS
    // ============================================
    
    function getApp() { return _app; }
    function getAuth() { return _auth; }
    function getDB() { return _db; }
    function getStorage() { return _storage; }
    function isOnline() { return _isOnline; }
    function isInitialized() { return _initialized; }
    function hasOfflinePersistence() { return _offlinePersistenceEnabled; }

    // ============================================
    // HELPERS FIRESTORE
    // ============================================
    
    /**
     * Timestamp do servidor Firestore
     */
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Incremento atómico
     */
    function increment(n = 1) {
        return firebase.firestore.FieldValue.increment(n);
    }

    /**
     * Array union (adicionar ao array sem duplicar)
     */
    function arrayUnion(...elements) {
        return firebase.firestore.FieldValue.arrayUnion(...elements);
    }

    /**
     * Array remove
     */
    function arrayRemove(...elements) {
        return firebase.firestore.FieldValue.arrayRemove(...elements);
    }

    /**
     * Delete field
     */
    function deleteField() {
        return firebase.firestore.FieldValue.delete();
    }

    /**
     * Executar batch write (até 500 operações)
     * @returns {firebase.firestore.WriteBatch}
     */
    function batch() {
        return _db.batch();
    }

    /**
     * Executar transação
     * @param {Function} updateFn
     * @returns {Promise}
     */
    function runTransaction(updateFn) {
        return _db.runTransaction(updateFn);
    }

    /**
     * Referência de coleção
     * @param {string} path
     * @returns {firebase.firestore.CollectionReference}
     */
    function collection(path) {
        return _db.collection(path);
    }

    /**
     * Referência de documento
     * @param {string} path
     * @returns {firebase.firestore.DocumentReference}
     */
    function doc(path) {
        return _db.doc(path);
    }

    // ============================================
    // HELPERS STORAGE
    // ============================================
    
    /**
     * Upload de ficheiro para Firebase Storage
     * @param {File|Blob|string} file - Ficheiro ou base64
     * @param {string} path - Caminho no storage
     * @param {Function} [onProgress] - Callback de progresso
     * @returns {Promise<string>} URL de download
     */
    async function uploadFile(file, path, onProgress = null) {
        if (!_storage) throw new Error('Storage não inicializado');
        
        const ref = _storage.ref(path);
        let uploadTask;

        if (typeof file === 'string' && file.startsWith('data:')) {
            // Base64
            uploadTask = ref.putString(file, 'data_url');
        } else {
            uploadTask = ref.put(file);
        }

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => reject(error),
                async () => {
                    const url = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve(url);
                }
            );
        });
    }

    /**
     * Eliminar ficheiro do Storage
     * @param {string} path
     */
    async function deleteFile(path) {
        if (!_storage) throw new Error('Storage não inicializado');
        try {
            await _storage.ref(path).delete();
        } catch (error) {
            if (error.code !== 'storage/object-not-found') throw error;
        }
    }

    // ============================================
    // HELPERS AUTH
    // ============================================
    
    /**
     * Obter utilizador atual
     * @returns {firebase.User|null}
     */
    function currentUser() {
        return _auth ? _auth.currentUser : null;
    }

    /**
     * Observar mudanças de autenticação
     * @param {Function} callback
     * @returns {Function} Unsubscribe
     */
    function onAuthStateChanged(callback) {
        if (!_auth) return () => {};
        return _auth.onAuthStateChanged(callback);
    }

    /**
     * Login com email e password
     * @param {string} email
     * @param {string} password
     * @returns {Promise<firebase.auth.UserCredential>}
     */
    async function signIn(email, password) {
        if (!_auth) throw new Error('Auth não inicializado');
        return _auth.signInWithEmailAndPassword(email, password);
    }

    /**
     * Criar utilizador com email e password
     * @param {string} email
     * @param {string} password
     * @returns {Promise<firebase.auth.UserCredential>}
     */
    async function createUser(email, password) {
        if (!_auth) throw new Error('Auth não inicializado');
        return _auth.createUserWithEmailAndPassword(email, password);
    }

    /**
     * Logout
     */
    async function signOut() {
        if (!_auth) return;
        return _auth.signOut();
    }

    /**
     * Alterar password do utilizador atual
     */
    async function updatePassword(newPassword) {
        const user = currentUser();
        if (!user) throw new Error('Nenhum utilizador autenticado');
        return user.updatePassword(newPassword);
    }

    /**
     * Re-autenticar utilizador (necessário antes de operações sensíveis)
     */
    async function reauthenticate(password) {
        const user = currentUser();
        if (!user) throw new Error('Nenhum utilizador autenticado');
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        return user.reauthenticateWithCredential(credential);
    }

    // ============================================
    // FORÇAR MODO OFFLINE/ONLINE
    // ============================================
    
    async function goOffline() {
        if (_db) await _db.disableNetwork();
        _isOnline = false;
        _notifyConnectionChange(false);
    }

    async function goOnline() {
        if (_db) await _db.enableNetwork();
        _isOnline = navigator.onLine;
        _notifyConnectionChange(_isOnline);
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        // Inicialização
        initialize,
        isInitialized,
        isOnline,
        hasOfflinePersistence,
        onConnectionChange,
        
        // Serviços
        getApp,
        getAuth,
        getDB,
        getStorage,
        
        // Firestore helpers
        serverTimestamp,
        increment,
        arrayUnion,
        arrayRemove,
        deleteField,
        batch,
        runTransaction,
        collection,
        doc,
        
        // Storage
        uploadFile,
        deleteFile,
        
        // Auth
        currentUser,
        onAuthStateChanged,
        signIn,
        createUser,
        signOut,
        updatePassword,
        reauthenticate,
        
        // Controlo de conexão
        goOffline,
        goOnline
    };
})();

window.SGEFirebase = SGEFirebase;