// ============================================
// SGE-NG - MOTOR DE SEGURANÇA E MONITORAMENTO
// ============================================

const SGESecurity = (() => {
    'use strict';

    let _initialized = false, _monitoringActive = false, _securityEvents = [], _alertCallbacks = [], _monitorInterval = null;
    const _loginAttempts = new Map(), _requestLog = [];

    const CONFIG = {
        maxLoginAttempts: 5, loginLockoutMinutes: 15, sessionTimeoutMinutes: 480,
        maxRequestsPerMinute: 120, integrityCheckIntervalMs: 60000, maxEventsLog: 1000,
        suspiciousPatterns: ['script','javascript:','onerror','onload','<iframe','<object','<embed','eval(','document.cookie','window.location','DROP TABLE','DELETE FROM','UNION SELECT','--','OR 1=1']
    };

    const ROLE_HIERARCHY = { admin_geral:100, director:80, subdirector:70, coordenador:60, secretario:50, professor:40, funcionario:30, encarregado:10, aluno:5 };

    const PERMISSIONS = {
        admin_geral: { all: ['*'] },
        director: { dashboard:['read'], academic:['*'], students:['*'], staff:['*'], grades:['read','approve','export'], transcripts:['*'], attendance:['*'], jury:['*'], documents:['*'], financial:['*'], statistics:['read','export'], reports:['*'], patrimony:['*'], messages:['*'], events:['*'], library:['*'], settings:['read','update'], backup:['create','restore'], audit_logs:['read'], users:['create','read','update'] },
        subdirector: { dashboard:['read'], academic:['read','update'], students:['read','update'], staff:['read'], grades:['read','approve'], transcripts:['read','create'], attendance:['*'], jury:['read','update'], documents:['read','create'], statistics:['read'], reports:['read','create'], messages:['*'], events:['read','create'], library:['*'] },
        coordenador: { dashboard:['read'], students:['read'], grades:['read'], transcripts:['read'], attendance:['read','create'], documents:['read'], messages:['*'], library:['read','upload'] },
        secretario: { dashboard:['read'], students:['*'], staff:['read','create','update'], documents:['*'], financial:['*'], messages:['read','create'] },
        professor: { dashboard:['read'], students:['read'], grades:['read','create','update'], attendance:['read','create'], transcripts:['read'], documents:['read'], messages:['read','create'], library:['read','upload'] },
        funcionario: { dashboard:['read'], messages:['read','create'] }
    };

    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        if (!input) return '';
        let s = input.replace(/<[^>]*>/g, '');
        const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;','`':'&#96;'};
        return s.replace(/[&<>"'\/`]/g, c => m[c]||c).trim();
    }

    function sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const s = {};
        for (const [k,v] of Object.entries(obj)) {
            if (typeof v === 'string') s[k] = sanitizeInput(v);
            else if (typeof v === 'object' && v !== null && !Array.isArray(v)) s[k] = sanitizeObject(v);
            else if (Array.isArray(v)) s[k] = v.map(i => typeof i === 'string' ? sanitizeInput(i) : typeof i === 'object' ? sanitizeObject(i) : i);
            else s[k] = v;
        }
        return s;
    }

    function containsSuspiciousContent(input) {
        if (typeof input !== 'string') return false;
        const l = input.toLowerCase();
        return CONFIG.suspiciousPatterns.some(p => l.includes(p.toLowerCase()));
    }

    function validateFormData(formData) {
        const threats = [], safe = {};
        for (const [k,v] of Object.entries(formData)) {
            if (typeof v === 'string') {
                if (containsSuspiciousContent(v)) { threats.push(`Campo "${k}" suspeito`); _logEvent('suspicious_input', { field: k }); }
                safe[k] = sanitizeInput(v);
            } else safe[k] = v;
        }
        return { safe: !threats.length, data: safe, threats };
    }

    function recordLoginAttempt(email, success) {
        const key = email.toLowerCase(), now = Date.now();
        if (!_loginAttempts.has(key)) _loginAttempts.set(key, []);
        const a = _loginAttempts.get(key); a.push({ time: now, success });
        const cutoff = now - CONFIG.loginLockoutMinutes * 60000;
        _loginAttempts.set(key, a.filter(x => x.time > cutoff));
        if (success) _loginAttempts.set(key, []);
        else if (_loginAttempts.get(key).filter(x => !x.success).length >= CONFIG.maxLoginAttempts) {
            _logEvent('account_lockout', { email: key });
            _notifyAlert('danger', `Conta ${key} bloqueada`);
        }
    }

    function isAccountLocked(email) {
        const a = _loginAttempts.get(email.toLowerCase()) || [];
        const cutoff = Date.now() - CONFIG.loginLockoutMinutes * 60000;
        return a.filter(x => x.time > cutoff && !x.success).length >= CONFIG.maxLoginAttempts;
    }

    function getLockoutRemaining(email) {
        const a = _loginAttempts.get(email.toLowerCase()) || [];
        if (!a.length) return 0;
        const last = Math.max(...a.map(x => x.time));
        const rem = last + CONFIG.loginLockoutMinutes * 60000 - Date.now();
        return rem > 0 ? Math.ceil(rem / 60000) : 0;
    }

    function checkRateLimit() {
        const now = Date.now();
        while (_requestLog.length && _requestLog[0] < now - 60000) _requestLog.shift();
        _requestLog.push(now);
        if (_requestLog.length > CONFIG.maxRequestsPerMinute) { _logEvent('rate_limit', {}); return false; }
        return true;
    }

    async function createSession(userData) {
        const session = {
            id: SGEUtils.generateUUID(), userId: userData.id, email: userData.email,
            role: userData.role, schoolId: userData.schoolId || null,
            createdAt: SGEUtils.nowISO(),
            expiresAt: new Date(Date.now() + CONFIG.sessionTimeoutMinutes * 60000).toISOString(),
            lastActivity: SGEUtils.nowISO()
        };
        await SGEDb.put('sessions', session, false);
        localStorage.setItem('sge_active_session', session.id);
        localStorage.setItem('sge_session_user', userData.id);
        _logEvent('session_created', { userId: userData.id });
        return session;
    }

    async function validateSession() {
        const sid = localStorage.getItem('sge_active_session');
        if (!sid) return null;
        const s = await SGEDb.get('sessions', sid);
        if (!s) { localStorage.removeItem('sge_active_session'); return null; }
        if (new Date(s.expiresAt) < new Date()) { await destroySession(sid); return null; }
        s.lastActivity = SGEUtils.nowISO();
        return s;
    }

    async function destroySession(sid = null) {
        const id = sid || localStorage.getItem('sge_active_session');
        if (id) await SGEDb.remove('sessions', id, false);
        localStorage.removeItem('sge_active_session');
        localStorage.removeItem('sge_session_user');
    }

    function hasPermission(role, module, action) {
        if (!role || !module || !action) return false;
        if (role === 'admin_geral') return true;
        const p = PERMISSIONS[role]; if (!p) return false;
        if (p.all?.includes('*')) return true;
        const mp = p[module]; if (!mp) return false;
        return mp.includes('*') || mp.includes(action);
    }

    function isRoleHigherOrEqual(a, b) { return (ROLE_HIERARCHY[a]||0) >= (ROLE_HIERARCHY[b]||0); }
    function getAccessibleModules(role) {
        if (role === 'admin_geral') return Object.keys(PERMISSIONS.director);
        return Object.keys(PERMISSIONS[role] || {});
    }

    async function checkIntegrity() {
        const r = { timestamp: SGEUtils.nowISO(), status: 'ok', checks: [], warnings: [], errors: [] };
        try {
            const dbOk = SGEDb.isReady();
            r.checks.push({ name: 'IndexedDB', status: dbOk?'ok':'error' });
            if (!dbOk) r.errors.push('IndexedDB inacessível');
            const pending = await SGEDb.getSyncQueue();
            if (pending.length > 50) { r.warnings.push(`${pending.length} itens pendentes`); r.checks.push({ name: 'Sync', status: 'warning' }); }
            r.checks.push({ name: 'Firebase', status: SGEFirebase.isOnline()?'ok':'warning' });
            r.checks.push({ name: 'Crypto', status: SGECrypto.isReady()?'ok':'warning' });
            if (r.errors.length) r.status = 'error';
            else if (r.warnings.length) r.status = 'warning';
        } catch (e) { r.status = 'error'; r.errors.push(e.message); }
        return r;
    }

    function startMonitoring() {
        if (_monitoringActive) return;
        _monitorInterval = setInterval(async () => {
            const r = await checkIntegrity();
            if (r.status === 'error') { _notifyAlert('danger', 'Problema de integridade'); _logEvent('integrity_error', r); }
        }, CONFIG.integrityCheckIntervalMs);
        _monitoringActive = true;
    }
    function stopMonitoring() { if (_monitorInterval) { clearInterval(_monitorInterval); _monitorInterval = null; } _monitoringActive = false; }

    function _logEvent(type, details = {}) {
        _securityEvents.push({ id: SGEUtils.generateUUID(), type, details, timestamp: SGEUtils.nowISO() });
        if (_securityEvents.length > CONFIG.maxEventsLog) _securityEvents = _securityEvents.slice(-CONFIG.maxEventsLog);
        SGEDb.addAuditLog({ action: `security_${type}`, module: 'security', description: type, details }).catch(() => {});
    }
    function _notifyAlert(level, msg) { _alertCallbacks.forEach(cb => { try { cb(level, msg); } catch {} }); }
    function onSecurityAlert(cb) { if (typeof cb === 'function') _alertCallbacks.push(cb); }
    function getSecurityEvents() { return [..._securityEvents]; }

    function setupClientProtection() {
        document.addEventListener('dragover', e => e.preventDefault(), false);
        document.addEventListener('drop', e => e.preventDefault(), false);
    }

    function initialize() { setupClientProtection(); _initialized = true; return true; }

    return {
        initialize, sanitizeInput, sanitizeObject, containsSuspiciousContent, validateFormData,
        recordLoginAttempt, isAccountLocked, getLockoutRemaining, checkRateLimit,
        createSession, validateSession, destroySession,
        hasPermission, isRoleHigherOrEqual, getAccessibleModules, ROLE_HIERARCHY, PERMISSIONS,
        checkIntegrity, startMonitoring, stopMonitoring, onSecurityAlert, getSecurityEvents
    };
})();
window.SGESecurity = SGESecurity;