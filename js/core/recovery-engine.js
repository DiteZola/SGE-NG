// ============================================
// SGE-NG - MOTOR DE AUTO-RECUPERAÇÃO
// ============================================

const SGERecovery = (() => {
    'use strict';

    let _initialized = false, _watchdogInterval = null, _healthHistory = [], _recoveryInProgress = false;
    let _autoSnapshotInterval = null, _baseline = {}, _notificationCallbacks = [];

    const CONFIG = {
        watchdogIntervalMs: 120000, maxHealthHistory: 100,
        criticalStores: ['system_config','users','schools','students','staff','grades','computed_grades','enrollments'],
        autoSnapshotIntervalMs: 3600000, maxAutoSnapshots: 24,
        thresholds: { maxDeletePercent: 30, maxSuddenGrowth: 500, minRecords: { users: 1, system_config: 1 } }
    };

    function startAutoSnapshots() {
        if (_autoSnapshotInterval) return;
        _createAutoSnapshots('initial');
        _autoSnapshotInterval = setInterval(() => _createAutoSnapshots('scheduled'), CONFIG.autoSnapshotIntervalMs);
    }
    function stopAutoSnapshots() { if (_autoSnapshotInterval) { clearInterval(_autoSnapshotInterval); _autoSnapshotInterval = null; } }

    async function _createAutoSnapshots(reason) {
        try {
            for (const s of CONFIG.criticalStores) await SGEDb.createSnapshot(s, `auto_${reason}`);
            const all = await SGEDb.getAll('snapshots');
            const auto = all.filter(s => s.reason?.startsWith('auto_')).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            const byStore = {};
            auto.forEach(s => { if (!byStore[s.type]) byStore[s.type] = []; byStore[s.type].push(s); });
            for (const snaps of Object.values(byStore)) {
                if (snaps.length > CONFIG.maxAutoSnapshots)
                    for (const s of snaps.slice(CONFIG.maxAutoSnapshots)) await SGEDb.remove('snapshots', s.id, false);
            }
        } catch (e) { console.error('[Recovery] Snapshot error:', e); }
    }

    function startWatchdog() {
        if (_watchdogInterval) return;
        _captureBaseline();
        _watchdogInterval = setInterval(() => _healthCheck(), CONFIG.watchdogIntervalMs);
    }
    function stopWatchdog() { if (_watchdogInterval) { clearInterval(_watchdogInterval); _watchdogInterval = null; } }

    async function _captureBaseline() {
        const b = {};
        for (const s of CONFIG.criticalStores) b[s] = await SGEDb.count(s);
        b._timestamp = Date.now(); _baseline = b;
    }

    async function _healthCheck() {
        const h = { timestamp: SGEUtils.nowISO(), status: 'healthy', checks: [], anomalies: [] };
        try {
            for (const s of CONFIG.criticalStores) {
                const cur = await SGEDb.count(s), base = _baseline[s] || 0;
                const min = CONFIG.thresholds.minRecords[s];
                if (min && cur < min) h.anomalies.push({ type: 'critical_data_missing', store: s, severity: 'critical' });
                if (base > 5) {
                    const delPct = ((base - cur) / base) * 100;
                    if (delPct > CONFIG.thresholds.maxDeletePercent) h.anomalies.push({ type: 'mass_deletion', store: s, severity: 'critical' });
                }
            }
            if (!SGEDb.isReady()) h.anomalies.push({ type: 'db_unavailable', severity: 'critical' });
            if (h.anomalies.length) {
                h.status = h.anomalies.some(a => a.severity === 'critical') ? 'critical' : 'warning';
                await _handleAnomalies(h.anomalies);
            }
            _healthHistory.push(h);
            if (_healthHistory.length > CONFIG.maxHealthHistory) _healthHistory = _healthHistory.slice(-CONFIG.maxHealthHistory);
            if (h.status === 'healthy') await _captureBaseline();
        } catch (e) { h.status = 'error'; }
        return h;
    }

    async function _handleAnomalies(anomalies) {
        for (const a of anomalies) _notifyAdmin('anomaly_detected', a);
        const critical = anomalies.filter(a => a.severity === 'critical');
        if (critical.length && !_recoveryInProgress) {
            for (const a of critical) {
                if (a.type === 'mass_deletion' || a.type === 'critical_data_missing') await autoRecover(a.store, a.type);
            }
        }
        await SGEDb.addAuditLog({ action: 'anomaly_detected', module: 'recovery', description: `${anomalies.length} anomalias`, details: anomalies });
    }

    async function autoRecover(storeName, reason) {
        if (_recoveryInProgress) return false;
        _recoveryInProgress = true;
        try {
            const snaps = (await SGEDb.listSnapshots(storeName)).filter(s => s.data?.length > 0).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            if (!snaps.length) return await _recoverFromCloud(storeName, reason);
            const best = snaps[0];
            await SGEDb.createSnapshot(storeName, `pre-recovery-${reason}`);
            const ok = await SGEDb.restoreSnapshot(best.id);
            if (ok) {
                await _captureBaseline();
                _notifyAdmin('auto_recovery_success', { store: storeName, reason, records: best.data.length });
                await SGEDb.addAuditLog({ action: 'auto_recovery', module: 'recovery', description: `${storeName} recuperado`, details: { store: storeName, reason } });
            }
            return ok;
        } catch (e) { _notifyAdmin('recovery_error', { store: storeName, error: e.message }); return false; }
        finally { _recoveryInProgress = false; }
    }

    async function _recoverFromCloud(storeName, reason) {
        if (!SGEFirebase.isOnline()) { _notifyAdmin('recovery_failed', { store: storeName }); return false; }
        try {
            const uid = localStorage.getItem('sge_session_user');
            if (!uid) return false;
            const u = await SGEDb.get('users', uid);
            if (!u?.schoolId) return false;
            const items = await SGEDb.fetchFromCloud(`schools/${u.schoolId}/${storeName}`, storeName);
            if (items.length) { _notifyAdmin('cloud_recovery_success', { store: storeName, records: items.length }); await _captureBaseline(); return true; }
            return false;
        } catch { return false; }
    }

    async function manualRecover(snapshotId) {
        _recoveryInProgress = true;
        try {
            const snap = await SGEDb.get('snapshots', snapshotId);
            if (!snap) return false;
            await SGEDb.createSnapshot(snap.type, 'pre-manual-recovery');
            const ok = await SGEDb.restoreSnapshot(snapshotId);
            if (ok) { await _captureBaseline(); await SGEDb.addAuditLog({ action: 'manual_recovery', module: 'recovery', description: `Restauração de ${snap.type}` }); }
            return ok;
        } catch { return false; } finally { _recoveryInProgress = false; }
    }

    async function createRecoveryPoint(desc = 'manual') {
        const ids = [];
        for (const s of CONFIG.criticalStores) { try { ids.push(await SGEDb.createSnapshot(s, `recovery_${desc}`)); } catch {} }
        await SGEDb.addAuditLog({ action: 'recovery_point', module: 'recovery', description: desc });
        return ids;
    }

    function _notifyAdmin(type, details) {
        SGEDb.put('notifications', {
            id: SGEUtils.generateUUID(), userId: 'admin_geral', type: `recovery_${type}`,
            title: type, message: JSON.stringify(details), data: details, read: false, date: SGEUtils.nowISO()
        }, true).catch(() => {});
        _notificationCallbacks.forEach(cb => { try { cb({ type, details, timestamp: SGEUtils.nowISO() }); } catch {} });
    }

    function onRecoveryNotification(cb) { if (typeof cb === 'function') _notificationCallbacks.push(cb); }

    async function getHealthReport() {
        return { timestamp: SGEUtils.nowISO(), health: await _healthCheck(), integrity: await SGESecurity.checkIntegrity(), sync: SGESync.getStatus(), baseline: {..._baseline} };
    }

    async function getRecoveryPoints() {
        const all = await SGEDb.getAll('snapshots'), byStore = {};
        all.forEach(s => { if (!byStore[s.type]) byStore[s.type] = []; byStore[s.type].push({ id: s.id, timestamp: s.timestamp, reason: s.reason, records: s.count || s.data?.length || 0 }); });
        for (const k of Object.keys(byStore)) byStore[k].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        return byStore;
    }

    async function initialize() {
        if (_initialized) return true;
        await _captureBaseline(); startAutoSnapshots(); startWatchdog(); _initialized = true; return true;
    }
    function shutdown() { stopWatchdog(); stopAutoSnapshots(); _initialized = false; }

    return { initialize, shutdown, startAutoSnapshots, stopAutoSnapshots, createRecoveryPoint, startWatchdog, stopWatchdog, autoRecover, manualRecover, getRecoveryPoints, getHealthReport, onRecoveryNotification };
})();
window.SGERecovery = SGERecovery;