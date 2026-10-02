// ============================================
// SGE-NG - SERVIÇO DE BASE DE DADOS
// Camada unificada IndexedDB + Firestore
// Offline-First com criptografia integrada
// ============================================

const SGEDb = (() => {
    'use strict';

    const DB_NAME = 'sge-ng-database';
    const DB_VERSION = 1;

    const STORES = {
        system_config: { keyPath: 'id', indexes: [] },
        audit_logs: { keyPath: 'id', indexes: ['userId', 'action', 'timestamp', 'schoolId'] },
        sync_queue: { keyPath: 'id', indexes: ['collection', 'status', 'timestamp'] },
        snapshots: { keyPath: 'id', indexes: ['type', 'timestamp'] },
        users: { keyPath: 'id', indexes: ['email', 'role', 'schoolId', 'status'] },
        sessions: { keyPath: 'id', indexes: ['userId', 'expiresAt'] },
        schools: { keyPath: 'id', indexes: ['name', 'status', 'province'] },
        school_years: { keyPath: 'id', indexes: ['schoolId', 'year', 'status'] },
        terms: { keyPath: 'id', indexes: ['schoolYearId', 'schoolId', 'number', 'status'] },
        education_levels: { keyPath: 'id', indexes: ['schoolId', 'order'] },
        courses: { keyPath: 'id', indexes: ['schoolId', 'levelId', 'status'] },
        classes: { keyPath: 'id', indexes: ['schoolId', 'courseId', 'levelId', 'number', 'order'] },
        shifts: { keyPath: 'id', indexes: ['schoolId', 'order'] },
        sections: { keyPath: 'id', indexes: ['schoolId', 'classId', 'shiftId', 'schoolYearId'] },
        subjects: { keyPath: 'id', indexes: ['schoolId', 'classId', 'courseId', 'order'] },
        assignments: { keyPath: 'id', indexes: ['schoolId', 'teacherId', 'sectionId', 'subjectId', 'schoolYearId'] },
        coordinations: { keyPath: 'id', indexes: ['schoolId', 'teacherId', 'sectionId', 'schoolYearId'] },
        students: { keyPath: 'id', indexes: ['schoolId', 'enrollmentNumber', 'processNumber', 'name', 'status', 'classId', 'sectionId', 'schoolYearId', 'gender'] },
        enrollments: { keyPath: 'id', indexes: ['studentId', 'schoolId', 'schoolYearId', 'classId', 'sectionId', 'status'] },
        student_history: { keyPath: 'id', indexes: ['studentId', 'schoolId', 'schoolYearId', 'classId'] },
        staff: { keyPath: 'id', indexes: ['schoolId', 'userId', 'name', 'role', 'status', 'staffType'] },
        assessment_types: { keyPath: 'id', indexes: ['schoolId', 'levelId', 'classId', 'status'] },
        assessment_formulas: { keyPath: 'id', indexes: ['schoolId', 'levelId', 'classId', 'courseId', 'version'] },
        assessments: { keyPath: 'id', indexes: ['schoolId', 'sectionId', 'subjectId', 'teacherId', 'termId', 'typeId', 'schoolYearId'] },
        grades: { keyPath: 'id', indexes: ['studentId', 'assessmentId', 'subjectId', 'sectionId', 'termId', 'schoolYearId'] },
        grade_corrections: { keyPath: 'id', indexes: ['teacherId', 'studentId', 'status', 'schoolId'] },
        computed_grades: { keyPath: 'id', indexes: ['studentId', 'subjectId', 'sectionId', 'termId', 'schoolYearId'] },
        behavior_grades: { keyPath: 'id', indexes: ['studentId', 'sectionId', 'termId', 'schoolYearId'] },
        attendance_students: { keyPath: 'id', indexes: ['studentId', 'sectionId', 'date', 'schoolYearId'] },
        attendance_staff: { keyPath: 'id', indexes: ['staffId', 'schoolId', 'date'] },
        jury_commissions: { keyPath: 'id', indexes: ['schoolId', 'classId', 'schoolYearId', 'status'] },
        jury_members: { keyPath: 'id', indexes: ['commissionId', 'staffId', 'role'] },
        jury_results: { keyPath: 'id', indexes: ['commissionId', 'studentId'] },
        documents_queue: { keyPath: 'id', indexes: ['type', 'studentId', 'schoolId', 'status'] },
        financial_config: { keyPath: 'id', indexes: ['schoolId', 'type', 'schoolYearId'] },
        payments: { keyPath: 'id', indexes: ['studentId', 'schoolId', 'type', 'date', 'status', 'schoolYearId'] },
        cashflow: { keyPath: 'id', indexes: ['schoolId', 'type', 'category', 'date', 'schoolYearId'] },
        messages: { keyPath: 'id', indexes: ['schoolId', 'fromUserId', 'toUserId', 'type', 'date', 'read'] },
        notifications: { keyPath: 'id', indexes: ['userId', 'type', 'read', 'date'] },
        library_files: { keyPath: 'id', indexes: ['schoolId', 'uploadedBy', 'category'] },
        patrimony: { keyPath: 'id', indexes: ['schoolId', 'category', 'status'] },
        events: { keyPath: 'id', indexes: ['schoolId', 'date', 'type'] },
        provinces: { keyPath: 'id', indexes: ['code', 'name'] },
        municipalities: { keyPath: 'id', indexes: ['provinceId', 'name'] },
        grade_config: { keyPath: 'id', indexes: ['schoolId', 'type', 'status'] }
    };

    let _db = null;
    let _initialized = false;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                Object.entries(STORES).forEach(([storeName, config]) => {
                    let store;
                    if (!db.objectStoreNames.contains(storeName)) {
                        store = db.createObjectStore(storeName, { keyPath: config.keyPath });
                    } else {
                        store = event.target.transaction.objectStore(storeName);
                    }
                    config.indexes.forEach(indexName => {
                        if (!store.indexNames.contains(indexName)) {
                            store.createIndex(indexName, indexName, { unique: false });
                        }
                    });
                });
            };
            request.onsuccess = (event) => {
                _db = event.target.result;
                _initialized = true;
                _db.onclose = () => { _db = null; _initialized = false; openDatabase().catch(console.error); };
                _db.onversionchange = () => { _db.close(); _db = null; _initialized = false; };
                resolve(_db);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async function ensureDB() {
        if (!_db || !_initialized) await openDatabase();
        return _db;
    }

    async function put(storeName, data, addToSync = true) {
        const db = await ensureDB();
        if (!data.id) data.id = SGEUtils.generateUUID();
        if (!data.createdAt) data.createdAt = SGEUtils.nowISO();
        data.updatedAt = SGEUtils.nowISO();
        data._localModified = true;
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).put(data);
                tx.oncomplete = async () => {
                    if (addToSync && !['sync_queue','sessions','snapshots'].includes(storeName)) {
                        await _addToSyncQueue(storeName, data.id, 'put', data);
                    }
                    resolve(data);
                };
                tx.onerror = (e) => reject(e.target.error);
            } catch (error) { reject(error); }
        });
    }

    async function putBatch(storeName, items, addToSync = true) {
        const db = await ensureDB();
        const now = SGEUtils.nowISO();
        const processed = items.map(item => ({
            ...item, id: item.id || SGEUtils.generateUUID(),
            createdAt: item.createdAt || now, updatedAt: now, _localModified: true
        }));
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                processed.forEach(item => store.put(item));
                tx.oncomplete = async () => {
                    if (addToSync && !['sync_queue','sessions'].includes(storeName)) {
                        for (const item of processed) await _addToSyncQueue(storeName, item.id, 'put', item);
                    }
                    resolve(processed);
                };
                tx.onerror = (e) => reject(e.target.error);
            } catch (error) { reject(error); }
        });
    }

    async function get(storeName, id) {
        const db = await ensureDB();
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(storeName, 'readonly');
                const request = tx.objectStore(storeName).get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            } catch { resolve(null); }
        });
    }

    async function getAll(storeName) {
        const db = await ensureDB();
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(storeName, 'readonly');
                const request = tx.objectStore(storeName).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch { resolve([]); }
        });
    }

    async function getByIndex(storeName, indexName, value) {
        const db = await ensureDB();
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                if (!store.indexNames.contains(indexName)) {
                    const r = store.getAll();
                    r.onsuccess = () => resolve((r.result || []).filter(i => i[indexName] === value));
                    r.onerror = () => resolve([]);
                    return;
                }
                const request = store.index(indexName).getAll(value);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch { resolve([]); }
        });
    }

    async function query(storeName, filters = {}, options = {}) {
        let results = await getAll(storeName);
        const filterKeys = Object.keys(filters);
        if (filterKeys.length > 0) {
            results = results.filter(item => filterKeys.every(key => {
                const fv = filters[key];
                if (fv && typeof fv === 'object' && !Array.isArray(fv)) {
                    if ('$ne' in fv) return item[key] !== fv.$ne;
                    if ('$gt' in fv) return item[key] > fv.$gt;
                    if ('$gte' in fv) return item[key] >= fv.$gte;
                    if ('$lt' in fv) return item[key] < fv.$lt;
                    if ('$lte' in fv) return item[key] <= fv.$lte;
                    if ('$in' in fv) return fv.$in.includes(item[key]);
                    if ('$contains' in fv) return String(item[key]||'').toLowerCase().includes(String(fv.$contains).toLowerCase());
                }
                return item[key] === fv;
            }));
        }
        if (options.orderBy) {
            const [field, dir] = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy, 'asc'];
            results.sort((a, b) => {
                let va = a[field], vb = b[field];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return dir === 'desc' ? 1 : -1;
                if (va > vb) return dir === 'desc' ? -1 : 1;
                return 0;
            });
        }
        if (options.offset) results = results.slice(options.offset);
        if (options.limit) results = results.slice(0, options.limit);
        return results;
    }

    async function remove(storeName, id, addToSync = true) {
        const db = await ensureDB();
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(id);
                tx.oncomplete = async () => {
                    if (addToSync && !['sync_queue','sessions'].includes(storeName))
                        await _addToSyncQueue(storeName, id, 'delete', null);
                    resolve(true);
                };
                tx.onerror = (e) => reject(e.target.error);
            } catch (error) { reject(error); }
        });
    }

    async function clearStore(storeName) {
        const db = await ensureDB();
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            } catch (error) { reject(error); }
        });
    }

    async function count(storeName, filters = null) {
        if (filters && Object.keys(filters).length > 0) return (await query(storeName, filters)).length;
        const db = await ensureDB();
        return new Promise((resolve) => {
            try {
                const r = db.transaction(storeName, 'readonly').objectStore(storeName).count();
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => resolve(0);
            } catch { resolve(0); }
        });
    }

    async function _addToSyncQueue(collection, docId, operation, data) {
        try {
            const syncItem = {
                id: SGEUtils.generateUUID(), collection, docId, operation,
                data: data ? { ...data } : null, status: 'pending',
                timestamp: SGEUtils.nowISO(), retries: 0, lastError: null
            };
            if (syncItem.data) delete syncItem.data._localModified;
            const db = await ensureDB();
            return new Promise((resolve) => {
                const tx = db.transaction('sync_queue', 'readwrite');
                tx.objectStore('sync_queue').put(syncItem);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (error) { console.error('[DB] Sync queue error:', error); }
    }

    async function getSyncQueue() { return getByIndex('sync_queue', 'status', 'pending'); }

    async function updateSyncStatus(id, status, error = null) {
        const item = await get('sync_queue', id);
        if (item) {
            item.status = status;
            if (error) { item.lastError = error; item.retries = (item.retries||0) + 1; }
            if (status === 'synced') item.syncedAt = SGEUtils.nowISO();
            await put('sync_queue', item, false);
        }
    }

    async function clearSyncedItems() {
        const synced = await getByIndex('sync_queue', 'status', 'synced');
        for (const item of synced) await remove('sync_queue', item.id, false);
        return synced.length;
    }

    async function fetchFromCloud(firestorePath, localStore) {
        if (!SGEFirebase.isOnline() || !SGEFirebase.isInitialized()) return getAll(localStore);
        try {
            const snapshot = await SGEFirebase.getDB().collection(firestorePath).get();
            const items = [];
            snapshot.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                Object.keys(data).forEach(k => { if (data[k] && typeof data[k].toDate === 'function') data[k] = data[k].toDate().toISOString(); });
                items.push(data);
            });
            if (items.length > 0) await putBatch(localStore, items, false);
            return items;
        } catch (error) { return getAll(localStore); }
    }

    async function writeToCloud(firestorePath, data, merge = true) {
        if (!SGEFirebase.isOnline() || !SGEFirebase.isInitialized()) return false;
        try {
            const clean = { ...data }; delete clean._localModified;
            clean.updatedAt = SGEFirebase.serverTimestamp();
            await SGEFirebase.getDB().doc(firestorePath).set(clean, { merge });
            return true;
        } catch { return false; }
    }

    async function deleteFromCloud(firestorePath) {
        if (!SGEFirebase.isOnline() || !SGEFirebase.isInitialized()) return false;
        try { await SGEFirebase.getDB().doc(firestorePath).delete(); return true; } catch { return false; }
    }

    async function addAuditLog(logEntry) {
        const log = {
            id: SGEUtils.generateUUID(), userId: logEntry.userId || 'system',
            userName: logEntry.userName || 'Sistema', schoolId: logEntry.schoolId || null,
            action: logEntry.action, module: logEntry.module || 'system',
            description: logEntry.description || '', details: logEntry.details || null,
            ip: logEntry.ip || null, userAgent: navigator.userAgent,
            timestamp: SGEUtils.nowISO(), synced: false
        };
        await put('audit_logs', log, true);
        return log;
    }

    async function createSnapshot(storeName, reason = 'manual') {
        const data = await getAll(storeName);
        const snapshot = { id: SGEUtils.generateUUID(), type: storeName, reason, data, count: data.length, timestamp: SGEUtils.nowISO() };
        await put('snapshots', snapshot, false);
        return snapshot.id;
    }

    async function restoreSnapshot(snapshotId) {
        const snapshot = await get('snapshots', snapshotId);
        if (!snapshot || !snapshot.data) return false;
        await createSnapshot(snapshot.type, 'pre-restore-backup');
        await clearStore(snapshot.type);
        await putBatch(snapshot.type, snapshot.data, false);
        return true;
    }

    async function listSnapshots(storeName = null) {
        if (storeName) return getByIndex('snapshots', 'type', storeName);
        return getAll('snapshots');
    }

    async function exportAllData() {
        const exportData = { version: DB_VERSION, exportedAt: SGEUtils.nowISO(), stores: {} };
        for (const s of Object.keys(STORES)) {
            if (['sync_queue','sessions'].includes(s)) continue;
            exportData.stores[s] = await getAll(s);
        }
        return exportData;
    }

    async function importData(importData, merge = false) {
        if (!importData || !importData.stores) throw new Error('Formato inválido');
        let total = 0;
        for (const [storeName, items] of Object.entries(importData.stores)) {
            if (!STORES[storeName]) continue;
            if (!merge) await clearStore(storeName);
            if (Array.isArray(items) && items.length > 0) { await putBatch(storeName, items, false); total += items.length; }
        }
        return { success: true, imported: total };
    }

    async function getConfig(key) { const c = await get('system_config', key); return c ? c.value : null; }
    async function setConfig(key, value) { return put('system_config', { id: key, value, updatedAt: SGEUtils.nowISO() }, true); }

    async function putEncrypted(storeName, data, sensitiveFields = []) {
        if (SGECrypto.isReady() && sensitiveFields.length > 0) {
            const enc = { ...data };
            for (const f of sensitiveFields) {
                if (enc[f] !== undefined && enc[f] !== null) { enc[f] = await SGECrypto.encrypt(enc[f]); enc[`_enc_${f}`] = true; }
            }
            return put(storeName, enc);
        }
        return put(storeName, data);
    }

    async function getDecrypted(storeName, id) {
        const data = await get(storeName, id);
        if (!data || !SGECrypto.isReady()) return data;
        const dec = { ...data };
        for (const key of Object.keys(dec)) {
            if (key.startsWith('_enc_') && dec[key] === true) {
                const orig = key.replace('_enc_', '');
                try { dec[orig] = await SGECrypto.decrypt(dec[orig]); } catch {}
                delete dec[key];
            }
        }
        return dec;
    }

    async function initialize() {
        if (_initialized) return true;
        try { await openDatabase(); return true; } catch { return false; }
    }

    return {
        initialize, isReady: () => _initialized && _db !== null, getStoreNames: () => Object.keys(STORES),
        put, putBatch, get, getAll, getByIndex, query, remove, clearStore, count,
        putEncrypted, getDecrypted, getSyncQueue, updateSyncStatus, clearSyncedItems,
        fetchFromCloud, writeToCloud, deleteFromCloud, addAuditLog,
        createSnapshot, restoreSnapshot, listSnapshots, exportAllData, importData,
        getConfig, setConfig
    };
})();
window.SGEDb = SGEDb;