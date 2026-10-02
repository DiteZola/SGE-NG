// ============================================
// SGE-NG - MOTOR DE SINCRONIZAÇÃO OFFLINE/ONLINE
// ============================================

const SGESync = (() => {
    'use strict';

    let _isSyncing = false, _syncInterval = null, _listeners = [], _lastSyncTime = null;
    let _syncStats = { pending: 0, synced: 0, errors: 0, lastSync: null };

    const STORE_TO_FIRESTORE = {
        system_config:'system_config', users:'users', schools:'schools',
        provinces:'provinces', municipalities:'municipalities',
        school_years:'school_years', terms:'terms', education_levels:'education_levels',
        courses:'courses', classes:'classes', shifts:'shifts', sections:'sections',
        subjects:'subjects', assignments:'assignments', coordinations:'coordinations',
        students:'students', enrollments:'enrollments', student_history:'student_history',
        staff:'staff', assessment_types:'assessment_types', assessment_formulas:'assessment_formulas',
        assessments:'assessments', grades:'grades', grade_corrections:'grade_corrections',
        computed_grades:'computed_grades', behavior_grades:'behavior_grades',
        attendance_students:'attendance_students', attendance_staff:'attendance_staff',
        jury_commissions:'jury_commissions', jury_members:'jury_members', jury_results:'jury_results',
        documents_queue:'documents_queue', financial_config:'financial_config',
        payments:'payments', cashflow:'cashflow', messages:'messages',
        notifications:'notifications', library_files:'library_files',
        patrimony:'patrimony', events:'events', grade_config:'grade_config', audit_logs:'audit_logs'
    };
    const GLOBAL_STORES = ['system_config','users','schools','provinces','municipalities'];
    const NO_SYNC = ['sync_queue','sessions','snapshots'];

    function _resolvePath(localStore, docId, data) {
        const fc = STORE_TO_FIRESTORE[localStore];
        if (!fc) return null;
        if (GLOBAL_STORES.includes(localStore)) return `${fc}/${docId}`;
        const sid = data?.schoolId;
        return sid ? `schools/${sid}/${fc}/${docId}` : `${fc}/${docId}`;
    }

    async function pushToCloud() {
        if (_isSyncing || !SGEFirebase.isOnline()) return { sent: 0, errors: 0 };
        _isSyncing = true; _notify('syncing');
        let sent = 0, errors = 0;
        try {
            const pending = await SGEDb.getSyncQueue();
            if (!pending.length) { _isSyncing = false; _notify('idle'); return { sent: 0, errors: 0 }; }
            for (const item of pending) {
                try {
                    await SGEDb.updateSyncStatus(item.id, 'syncing');
                    const path = _resolvePath(item.collection, item.docId, item.data);
                    if (!path) { await SGEDb.updateSyncStatus(item.id, 'error', 'No path'); errors++; continue; }
                    let ok = false;
                    if (item.operation === 'put' && item.data) ok = await SGEDb.writeToCloud(path, item.data);
                    else if (item.operation === 'delete') ok = await SGEDb.deleteFromCloud(path);
                    if (ok) { await SGEDb.updateSyncStatus(item.id, 'synced'); sent++; }
                    else throw new Error('Write failed');
                } catch (e) {
                    await SGEDb.updateSyncStatus(item.id, 'error', e.message); errors++;
                    const u = await SGEDb.get('sync_queue', item.id);
                    if (u && u.retries >= 5) await SGEDb.updateSyncStatus(item.id, 'failed', 'Max retries');
                }
            }
            await SGEDb.clearSyncedItems();
            _syncStats.synced += sent; _syncStats.errors += errors;
            _syncStats.lastSync = SGEUtils.nowISO(); _lastSyncTime = Date.now();
        } catch (e) { console.error('[Sync] Push error:', e); }
        finally { _isSyncing = false; await _updatePending(); _notify(_syncStats.pending > 0 ? 'pending' : 'idle'); }
        return { sent, errors };
    }

    async function pullFromCloud(schoolId, stores = null) {
        if (!SGEFirebase.isOnline()) return { pulled: 0 };
        let total = 0;
        for (const ls of (stores || Object.keys(STORE_TO_FIRESTORE))) {
            if (NO_SYNC.includes(ls)) continue;
            const fc = STORE_TO_FIRESTORE[ls]; if (!fc) continue;
            try {
                const path = GLOBAL_STORES.includes(ls) ? fc : `schools/${schoolId}/${fc}`;
                const items = await SGEDb.fetchFromCloud(path, ls);
                total += items.length;
            } catch (e) { console.error(`[Sync] Pull error ${ls}:`, e.message); }
        }
        return { pulled: total };
    }

    async function fullSync(schoolId) {
        _notify('syncing');
        const push = await pushToCloud();
        const pull = await pullFromCloud(schoolId);
        const result = { pushed: push.sent, pushErrors: push.errors, pulled: pull.pulled, timestamp: SGEUtils.nowISO() };
        _lastSyncTime = Date.now(); _syncStats.lastSync = result.timestamp; _notify('idle');
        return result;
    }

    function startAutoSync(intervalMs = 30000) {
        if (_syncInterval) clearInterval(_syncInterval);
        _syncInterval = setInterval(async () => {
            if (SGEFirebase.isOnline() && !_isSyncing) {
                const p = await SGEDb.getSyncQueue();
                if (p.length > 0) await pushToCloud();
            }
        }, intervalMs);
        SGEFirebase.onConnectionChange(async (online) => {
            if (online && !_isSyncing) setTimeout(async () => await pushToCloud(), 2000);
        });
    }

    function stopAutoSync() { if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; } }

    const _unsubs = [];
    function listenToCollection(firestorePath, localStore, onChange = null) {
        if (!SGEFirebase.isInitialized()) return () => {};
        try {
            const unsub = SGEFirebase.getDB().collection(firestorePath).onSnapshot(async (snap) => {
                for (const change of snap.docChanges()) {
                    const data = { id: change.doc.id, ...change.doc.data() };
                    Object.keys(data).forEach(k => { if (data[k]?.toDate) data[k] = data[k].toDate().toISOString(); });
                    if (change.type === 'added' || change.type === 'modified') {
                        const local = await SGEDb.get(localStore, data.id);
                        if (!local || !local._localModified) { data._localModified = false; await SGEDb.put(localStore, data, false); }
                    } else if (change.type === 'removed') { await SGEDb.remove(localStore, data.id, false); }
                }
                if (onChange) onChange(snap);
            }, (err) => console.error(`[Sync] Listener error ${firestorePath}:`, err));
            _unsubs.push(unsub); return unsub;
        } catch { return () => {}; }
    }

    function stopAllListeners() { _unsubs.forEach(u => { try { u(); } catch {} }); _unsubs.length = 0; }

    function resolveConflict(local, cloud) {
        if (!local) return cloud; if (!cloud) return local;
        const lt = new Date(local.updatedAt||0).getTime(), ct = new Date(cloud.updatedAt||0).getTime();
        return ct > lt ? { ...cloud, _conflictResolved: true } : { ...local, _conflictResolved: true };
    }

    async function _updatePending() { try { _syncStats.pending = (await SGEDb.getSyncQueue()).length; } catch { _syncStats.pending = 0; } }
    function onSyncStateChange(cb) { if (typeof cb === 'function') _listeners.push(cb); }
    function _notify(s) { _listeners.forEach(l => { try { l(s, {..._syncStats}); } catch {} }); }
    function getStatus() { return { isSyncing: _isSyncing, isOnline: SGEFirebase.isOnline(), lastSync: _lastSyncTime, stats: {..._syncStats} }; }
    async function initialize() { await _updatePending(); return true; }

    return { initialize, pushToCloud, pullFromCloud, fullSync, startAutoSync, stopAutoSync, listenToCollection, stopAllListeners, resolveConflict, onSyncStateChange, getStatus };
})();
window.SGESync = SGESync;