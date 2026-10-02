// ============================================
// SGE-NG - SERVIÇO DE AUTENTICAÇÃO
// Login, Logout, Gestão de Utilizadores
// e Controlo de Sessão Completo
// ============================================

const SGEAuth = (() => {
    'use strict';

    let _currentUser = null;
    let _firebaseUser = null;
    let _authStateListeners = [];
    let _initialized = false;

    // ============================================
    // GETTERS DE ESTADO
    // ============================================

    function getCurrentUser() { return _currentUser; }
    function getFirebaseUser() { return _firebaseUser; }
    function isLoggedIn() { return _currentUser !== null && _firebaseUser !== null; }
    function getUserRole() { return _currentUser?.role || null; }
    function getUserSchoolId() { return _currentUser?.schoolId || null; }
    function getUserId() { return _currentUser?.id || null; }
    function getUserName() { return _currentUser?.fullName || _currentUser?.email || '---'; }

    // ============================================
    // LOGIN
    // ============================================

    async function login(email, password) {
        try {
            // 1. Verificar bloqueio
            if (SGESecurity.isAccountLocked(email)) {
                const rem = SGESecurity.getLockoutRemaining(email);
                return { success: false, error: `Conta bloqueada. Tente em ${rem} minuto(s).` };
            }

            // 2. Rate limit
            if (!SGESecurity.checkRateLimit()) {
                return { success: false, error: 'Muitas tentativas. Aguarde um momento.' };
            }

            // 3. Sanitizar
            const cleanEmail = SGESecurity.sanitizeInput(email).toLowerCase().trim();
            if (!SGEUtils.isValidEmail(cleanEmail)) {
                return { success: false, error: 'Email inválido.' };
            }
            if (!password || password.length < 6) {
                return { success: false, error: 'Palavra-passe deve ter pelo menos 6 caracteres.' };
            }

            // 4. Firebase Auth
            try {
                const cred = await SGEFirebase.signIn(cleanEmail, password);
                _firebaseUser = cred.user;
            } catch (fbError) {
                SGESecurity.recordLoginAttempt(cleanEmail, false);
                const errors = {
                    'auth/user-not-found': 'Utilizador não encontrado.',
                    'auth/wrong-password': 'Palavra-passe incorreta.',
                    'auth/invalid-email': 'Email inválido.',
                    'auth/user-disabled': 'Conta desativada. Contacte o administrador.',
                    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
                    'auth/network-request-failed': 'Sem ligação à internet.'
                };
                return { success: false, error: errors[fbError.code] || 'Credenciais inválidas.' };
            }

            // 5. Buscar dados do utilizador
            let userData = await _findUserByEmail(cleanEmail);

            if (!userData && SGEFirebase.isOnline()) {
                try {
                    const snap = await SGEFirebase.getDB()
                        .collection('users')
                        .where('email', '==', cleanEmail)
                        .limit(1).get();
                    if (!snap.empty) {
                        const doc = snap.docs[0];
                        userData = { id: doc.id, ...doc.data() };
                        await SGEDb.put('users', userData, false);
                    }
                } catch (e) {
                    console.warn('[Auth] Erro ao buscar do Firestore:', e.message);
                }
            }

            if (!userData) {
                await SGEFirebase.signOut();
                _firebaseUser = null;
                return { success: false, error: 'Perfil não encontrado. Contacte o administrador.' };
            }

            // 6. Verificar estado
            if (userData.status === 'suspended' || userData.status === 'inactive') {
                await SGEFirebase.signOut();
                _firebaseUser = null;
                return { success: false, error: 'Conta suspensa ou inativa. Contacte a direção.' };
            }

            // 7. Sucesso
            SGESecurity.recordLoginAttempt(cleanEmail, true);
            _currentUser = userData;

            // 8. Sessão segura
            await SGESecurity.createSession(userData);

            // 9. Criptografia
            await SGECrypto.initialize(password);

            // 10. Log de auditoria
            await SGEDb.addAuditLog({
                userId: userData.id,
                userName: userData.fullName || cleanEmail,
                schoolId: userData.schoolId,
                action: 'login',
                module: 'auth',
                description: `Login: ${cleanEmail}`
            });

            // 11. Atualizar último login
            userData.lastLogin = SGEUtils.nowISO();
            await SGEDb.put('users', userData, false);

            _notifyAuthChange('login', userData);
            console.log(`[Auth] Login: ${userData.fullName || cleanEmail} (${userData.role})`);

            return { success: true, user: userData };

        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            return { success: false, error: 'Erro inesperado. Tente novamente.' };
        }
    }

    // ============================================
    // LOGOUT
    // ============================================

    async function logout() {
        try {
            const userName = _currentUser?.fullName || 'Desconhecido';
            const userId = _currentUser?.id;

            if (userId) {
                await SGEDb.addAuditLog({
                    userId, userName,
                    schoolId: _currentUser?.schoolId,
                    action: 'logout', module: 'auth',
                    description: `Logout: ${userName}`
                });
            }

            await SGESecurity.destroySession();
            SGECrypto.clearSession();
            SGESync.stopAutoSync();
            SGESync.stopAllListeners();
            SGESecurity.stopMonitoring();
            SGERecovery.shutdown();

            try { await SGEFirebase.signOut(); } catch {}

            _currentUser = null;
            _firebaseUser = null;

            _notifyAuthChange('logout', null);
            console.log('[Auth] Logout concluído');
        } catch (error) {
            console.error('[Auth] Erro no logout:', error);
            _currentUser = null;
            _firebaseUser = null;
            localStorage.removeItem('sge_active_session');
            localStorage.removeItem('sge_session_user');
        }
    }

    // ============================================
    // RESTAURAR SESSÃO (Após refresh)
    // ============================================

    async function restoreSession() {
        try {
            const sessionId = localStorage.getItem('sge_active_session');
            const userId = localStorage.getItem('sge_session_user');

            if (!sessionId || !userId) return { restored: false };

            // Verificar Firebase Auth
            const fbUser = SGEFirebase.currentUser();
            if (!fbUser) {
                localStorage.removeItem('sge_active_session');
                localStorage.removeItem('sge_session_user');
                return { restored: false };
            }

            _firebaseUser = fbUser;

            // Validar sessão
            const session = await SGESecurity.validateSession();
            if (!session) return { restored: false };

            // Buscar dados
            let userData = await SGEDb.get('users', userId);

            if (!userData && SGEFirebase.isOnline()) {
                try {
                    const doc = await SGEFirebase.getDB().collection('users').doc(userId).get();
                    if (doc.exists) {
                        userData = { id: doc.id, ...doc.data() };
                        await SGEDb.put('users', userData, false);
                    }
                } catch {}
            }

            if (!userData) {
                await logout();
                return { restored: false };
            }

            _currentUser = userData;
            await SGECrypto.initialize();
            _notifyAuthChange('restored', userData);

            console.log(`[Auth] Sessão restaurada: ${userData.fullName || userData.email}`);
            return { restored: true, user: userData };

        } catch (error) {
            console.error('[Auth] Erro ao restaurar sessão:', error);
            return { restored: false };
        }
    }

    // ============================================
    // CRIAR UTILIZADOR
    // ============================================

    async function createUser(userData, password) {
        try {
            const currentRole = getUserRole();
            if (!currentRole || !SGESecurity.hasPermission(currentRole, 'users', 'create')) {
                return { success: false, error: 'Sem permissão para criar utilizadores.' };
            }

            const validation = SGESecurity.validateFormData(userData);
            if (!validation.safe) return { success: false, error: validation.threats.join('; ') };

            const clean = validation.data;
            const email = clean.email?.toLowerCase().trim();

            if (!SGEUtils.isValidEmail(email)) return { success: false, error: 'Email inválido.' };
            if (!password || password.length < 6) return { success: false, error: 'Password deve ter pelo menos 6 caracteres.' };

            const existing = await _findUserByEmail(email);
            if (existing) return { success: false, error: 'Email já registado.' };

            // Criar no Firebase
            let fbUser;
            try {
                const cred = await SGEFirebase.createUser(email, password);
                fbUser = cred.user;
            } catch (fbError) {
                const errors = {
                    'auth/email-already-in-use': 'Email já registado.',
                    'auth/weak-password': 'Password demasiado fraca.'
                };
                return { success: false, error: errors[fbError.code] || 'Erro ao criar conta.' };
            }

            const newUser = {
                id: fbUser.uid,
                email: email,
                fullName: clean.fullName || clean.name || '',
                role: clean.role || 'funcionario',
                schoolId: clean.schoolId || getUserSchoolId(),
                status: 'active',
                phone: clean.phone || null,
                photo: clean.photo || null,
                createdAt: SGEUtils.nowISO(),
                createdBy: _currentUser?.id || 'system',
                lastLogin: null
            };

            await SGEDb.put('users', newUser);

            await SGEDb.addAuditLog({
                userId: _currentUser?.id,
                userName: _currentUser?.fullName,
                schoolId: newUser.schoolId,
                action: 'create_user', module: 'users',
                description: `Novo utilizador: ${newUser.fullName} (${newUser.role})`,
                details: { newUserId: newUser.id, email, role: newUser.role }
            });

            // Voltar ao admin (Firebase mudou para o novo user)
           // CÓDIGO CORRIGIDO (substituir o bloco try/catch no final de createUser)
// Voltar ao admin (Firebase mudou para o novo user)
try {
    await SGEFirebase.signOut();
    // O admin terá de fazer login novamente - isto é limitação do Firebase Auth
    // quando se cria users no client-side
    _currentUser = null;
    _firebaseUser = null;
    console.warn('[Auth] Sessão do admin encerrada após criar utilizador. Faça login novamente.');
} catch {}

return { success: true, user: newUser, warning: 'Faça login novamente com a sua conta de admin.' };

            return { success: true, user: newUser };

        } catch (error) {
            console.error('[Auth] Erro ao criar utilizador:', error);
            return { success: false, error: 'Erro inesperado.' };
        }
    }

    // ============================================
    // ALTERAR PASSWORD
    // ============================================

    async function changePassword(currentPassword, newPassword) {
        try {
            if (!isLoggedIn()) return { success: false, error: 'Não autenticado.' };
            if (!newPassword || newPassword.length < 6) return { success: false, error: 'Nova password deve ter pelo menos 6 caracteres.' };
            if (currentPassword === newPassword) return { success: false, error: 'A nova password deve ser diferente.' };

            try { await SGEFirebase.reauthenticate(currentPassword); }
            catch { return { success: false, error: 'Password atual incorreta.' }; }

            await SGEFirebase.updatePassword(newPassword);
            await SGECrypto.initialize(newPassword);

            await SGEDb.addAuditLog({
                userId: _currentUser.id, userName: _currentUser.fullName,
                action: 'change_password', module: 'auth', description: 'Password alterada'
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: 'Erro ao alterar password.' };
        }
    }

    // ============================================
    // ATUALIZAR PERFIL
    // ============================================

    async function updateProfile(updates) {
        try {
            if (!isLoggedIn()) return { success: false, error: 'Não autenticado.' };

            const validation = SGESecurity.validateFormData(updates);
            if (!validation.safe) return { success: false, error: validation.threats.join('; ') };

            const clean = validation.data;
            const allowedFields = ['fullName', 'phone', 'photo'];
            const filtered = {};
            allowedFields.forEach(f => { if (clean[f] !== undefined) filtered[f] = clean[f]; });

            Object.assign(_currentUser, filtered);
            _currentUser.updatedAt = SGEUtils.nowISO();
            await SGEDb.put('users', _currentUser);

            // Notificar diretor da alteração
            await SGEDb.put('notifications', {
                id: SGEUtils.generateUUID(),
                userId: 'director',
                type: 'profile_update',
                title: 'Perfil Atualizado',
                message: `${_currentUser.fullName} atualizou o seu perfil.`,
                data: { changedFields: Object.keys(filtered) },
                read: false,
                date: SGEUtils.nowISO()
            }, true);

            await SGEDb.addAuditLog({
                userId: _currentUser.id, userName: _currentUser.fullName,
                action: 'update_profile', module: 'auth',
                description: 'Perfil atualizado',
                details: { fields: Object.keys(filtered) }
            });

            _notifyAuthChange('updated', _currentUser);
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Erro ao atualizar perfil.' };
        }
    }

    // ============================================
    // SUSPENDER / ATIVAR UTILIZADOR
    // ============================================

    async function setUserStatus(userId, status) {
        try {
            const currentRole = getUserRole();
            if (!SGESecurity.hasPermission(currentRole, 'users', 'update')) {
                return { success: false, error: 'Sem permissão.' };
            }

            const user = await SGEDb.get('users', userId);
            if (!user) return { success: false, error: 'Utilizador não encontrado.' };

            // Não pode suspender alguém com papel superior
            if (!SGESecurity.isRoleHigherOrEqual(currentRole, user.role)) {
                return { success: false, error: 'Não pode alterar utilizadores com papel superior.' };
            }

            user.status = status;
            user.updatedAt = SGEUtils.nowISO();
            await SGEDb.put('users', user);

            await SGEDb.addAuditLog({
                userId: _currentUser?.id, userName: _currentUser?.fullName,
                action: status === 'suspended' ? 'suspend_user' : 'activate_user',
                module: 'users',
                description: `Utilizador ${user.fullName} ${status === 'suspended' ? 'suspenso' : 'ativado'}`,
                details: { targetUserId: userId, status }
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: 'Erro ao alterar estado.' };
        }
    }

    // ============================================
    // LISTAR UTILIZADORES
    // ============================================

    async function listUsers(filters = {}) {
        const queryFilters = { ...filters };
        const currentRole = getUserRole();
        const schoolId = getUserSchoolId();

        // Filtrar por escola (exceto admin geral)
        if (currentRole !== 'admin_geral' && schoolId) {
            queryFilters.schoolId = schoolId;
        }

        return SGEDb.query('users', queryFilters, { orderBy: ['fullName', 'asc'] });
    }

    // ============================================
    // UTILITÁRIOS INTERNOS
    // ============================================

    async function _findUserByEmail(email) {
        const users = await SGEDb.getByIndex('users', 'email', email);
        return users.length > 0 ? users[0] : null;
    }

    function _notifyAuthChange(event, user) {
        _authStateListeners.forEach(cb => {
            try { cb(event, user); } catch (e) { console.error('[Auth] Listener error:', e); }
        });
    }

    /**
     * Regista listener para mudanças de autenticação
     * @param {Function} callback - Recebe (event, user)
     *   event: 'login', 'logout', 'restored', 'updated'
     */
    function onAuthChange(callback) {
        if (typeof callback === 'function') _authStateListeners.push(callback);
    }

    function removeAuthListener(callback) {
        _authStateListeners = _authStateListeners.filter(cb => cb !== callback);
    }

    // ============================================
    // VERIFICAÇÃO DE PERMISSÃO RÁPIDA
    // ============================================

    function can(module, action) {
        const role = getUserRole();
        if (!role) return false;
        return SGESecurity.hasPermission(role, module, action);
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================

    async function initialize() {
        if (_initialized) return true;

        // Escutar mudanças do Firebase Auth
        SGEFirebase.onAuthStateChanged(async (fbUser) => {
            _firebaseUser = fbUser;
            if (!fbUser && _currentUser) {
                _currentUser = null;
                _notifyAuthChange('logout', null);
            }
        });

        _initialized = true;
        console.log('[Auth] Serviço de autenticação inicializado');
        return true;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        initialize,
        // Estado
        getCurrentUser, getFirebaseUser, isLoggedIn, getUserRole,
        getUserSchoolId, getUserId, getUserName,
        // Auth
        login, logout, restoreSession,
        // Gestão
        createUser, changePassword, updateProfile, setUserStatus, listUsers,
        // Permissões
        can,
        // Listeners
        onAuthChange, removeAuthListener
    };
})();

window.SGEAuth = SGEAuth;