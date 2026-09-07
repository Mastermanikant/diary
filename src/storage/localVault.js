/**
 * FrankDiary Local Vault Storage (IndexedDB Standard)
 * Zero-Knowledge, Offline-First Persistent Storage Layer
 */

const DB_NAME = 'FrankDiaryVault';
const DB_VERSION = 1;

let dbInstance = null;

export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Vault configuration & security credentials store
      if (!db.objectStoreNames.contains('vault_config')) {
        db.createObjectStore('vault_config', { keyPath: 'key' });
      }

      // Encrypted Diary Entries store
      if (!db.objectStoreNames.contains('entries')) {
        const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
        entryStore.createIndex('date', 'date', { unique: false });
        entryStore.createIndex('updated_at', 'updated_at', { unique: false });
        entryStore.createIndex('sync_status', 'sync_status', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// ==========================================
// VAULT CONFIG & SECURITY METADATA OPERATIONS
// ==========================================

export async function getVaultConfig() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_config', 'readonly');
    const store = tx.objectStore('vault_config');
    const request = store.get('main_config');

    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVaultConfig(configData) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_config', 'readwrite');
    const store = tx.objectStore('vault_config');
    const request = store.put({ key: 'main_config', data: configData });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// ENCRYPTED DIARY ENTRIES OPERATIONS
// ==========================================

export async function getAllEncryptedEntries() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const store = tx.objectStore('entries');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort chronologically descending (newest first)
      const list = request.result || [];
      list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.updated_at - a.updated_at));
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveEncryptedEntry(entryRecord) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.put(entryRecord);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteEncryptedEntry(entryId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.delete(entryId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllVaultData() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['vault_config', 'entries'], 'readwrite');
    tx.objectStore('vault_config').clear();
    tx.objectStore('entries').clear();

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// SYNC ENGINE STORAGE HELPERS
// ==========================================

export async function getPendingSyncEntries() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const store = tx.objectStore('entries');
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      const pending = all.filter(e => e.sync_status === 'pending');
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function markEntriesAsSynced(entryIds) {
  if (!entryIds || entryIds.length === 0) return true;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');

    for (const id of entryIds) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const updated = { ...getReq.result, sync_status: 'synced' };
          store.put(updated);
        }
      };
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function batchUpsertRemoteEntries(remoteEntries) {
  if (!remoteEntries || remoteEntries.length === 0) return 0;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    let updatedCount = 0;

    for (const remote of remoteEntries) {
      const getReq = store.get(remote.id);
      getReq.onsuccess = () => {
        const local = getReq.result;
        // Time-based Last-Write-Wins: update only if remote is newer or doesn't exist locally
        if (!local || (remote.updated_at && remote.updated_at > (local.updated_at || 0))) {
          if (remote.is_deleted) {
            store.delete(remote.id);
          } else {
            const entryToSave = {
              id: remote.id,
              vault_category: remote.vault_category || 'personal',
              date: remote.date,
              time: remote.time,
              created_at: remote.created_at || remote.updated_at,
              updated_at: remote.updated_at,
              device_name: remote.device_name,
              sync_status: 'synced',
              encrypted_data: typeof remote.encrypted_data === 'string' && remote.encrypted_nonce ? {
                nonce: remote.encrypted_nonce,
                ciphertext: remote.encrypted_data
              } : remote.encrypted_data,
              preview_title: remote.preview_title,
              preview_mood: remote.preview_mood,
              preview_is_favorite: !!remote.preview_is_favorite
            };
            store.put(entryToSave);
          }
          updatedCount++;
        }
      };
    }

    tx.oncomplete = () => resolve(updatedCount);
    tx.onerror = () => reject(tx.error);
  });
}

