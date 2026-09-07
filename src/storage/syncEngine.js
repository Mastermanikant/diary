/**
 * FrankDiary Time-Based Zero-Knowledge Sync Engine
 * Handles automatic, conflict-free, background delta-synchronization
 */

import { 
  getPendingSyncEntries, 
  markEntriesAsSynced, 
  batchUpsertRemoteEntries,
  saveVaultConfig,
  getVaultConfig 
} from './localVault';
import { bufferToBase64 } from '../crypto/vaultCrypto';

/**
 * Derive a deterministic Vault ID for cloud relay routing without leaking key
 */
export async function deriveSyncVaultId(syncSecret) {
  const enc = new TextEncoder();
  const data = enc.encode('FRANKDIARY_SYNC_ROUTING_SALT_V1:' + syncSecret.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer).replace(/[+/=]/g, '').substring(0, 32);
}

/**
 * Execute a complete delta sync cycle (Push Pending -> Pull Latest)
 */
export async function executeSyncCycle({ config, onSyncProgress }) {
  if (!config || !config.cloud_sync_enabled) {
    return { success: false, reason: 'SYNC_NOT_ENABLED' };
  }

  if (!navigator.onLine) {
    return { success: false, reason: 'OFFLINE' };
  }

  const syncSecret = config.sync_secret || config.device_signature || 'DEFAULT_VAULT';
  const vaultId = await deriveSyncVaultId(syncSecret);
  const deviceName = config.device_name || 'My Device';
  const lastSyncedAt = config.last_synced_at || 0;

  try {
    if (onSyncProgress) onSyncProgress({ status: 'syncing', message: 'क्लाउड से जुड़ रहा है...' });

    // 1. PUSH PENDING LOCAL ENTRIES
    const pendingEntries = await getPendingSyncEntries();
    let pushedCount = 0;

    if (pendingEntries.length > 0) {
      if (onSyncProgress) onSyncProgress({ status: 'pushing', message: `${pendingEntries.length} पन्ने क्लाउड पर भेजे जा रहे हैं...` });

      const payload = {
        vault_id: vaultId,
        device_name: deviceName,
        action: 'push',
        salt_base64: config.salt || '',
        verifier_blob: config.verifier || '',
        entries: pendingEntries.map(e => ({
          id: e.id,
          vault_category: e.vault_category || 'personal',
          date: e.date,
          time: e.time,
          device_name: e.device_name || deviceName,
          encrypted_nonce: e.encrypted_data?.nonce || '',
          encrypted_data: e.encrypted_data?.ciphertext || '',
          preview_title: e.preview_title || '',
          preview_mood: e.preview_mood || 'happy',
          preview_is_favorite: e.preview_is_favorite ? 1 : 0,
          updated_at: e.updated_at || Date.now(),
          is_deleted: e.is_deleted ? 1 : 0
        }))
      };

      const pushRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!pushRes.ok) {
        throw new Error(`Push failed with HTTP ${pushRes.status}`);
      }

      const pushData = await pushRes.json();
      if (pushData.success) {
        await markEntriesAsSynced(pendingEntries.map(e => e.id));
        pushedCount = pendingEntries.length;
      }
    }

    // 2. PULL REMOTE DELTAS (Time-based: updated_at > lastSyncedAt)
    if (onSyncProgress) onSyncProgress({ status: 'pulling', message: 'नए पन्ने प्राप्त किए जा रहे हैं...' });

    const pullRes = await fetch(`/api/sync?vault_id=${encodeURIComponent(vaultId)}&since=${lastSyncedAt}`);
    let pulledCount = 0;
    let serverTime = Date.now();

    if (pullRes.ok) {
      const pullData = await pullRes.json();
      if (pullData.success && Array.isArray(pullData.entries) && pullData.entries.length > 0) {
        pulledCount = await batchUpsertRemoteEntries(pullData.entries);
      }
      if (pullData.server_time) {
        serverTime = pullData.server_time;
      }
    }

    // 3. UPDATE SYNC METADATA
    const updatedConfig = {
      ...config,
      last_synced_at: serverTime,
      last_sync_status: 'success',
      last_sync_time_str: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    await saveVaultConfig(updatedConfig);

    if (onSyncProgress) {
      onSyncProgress({ 
        status: 'synced', 
        message: 'क्लाउड सिंक पूर्ण', 
        pushedCount, 
        pulledCount, 
        timeStr: updatedConfig.last_sync_time_str 
      });
    }

    return { 
      success: true, 
      pushedCount, 
      pulledCount, 
      updatedConfig 
    };

  } catch (err) {
    console.warn('Sync cycle error:', err);
    if (onSyncProgress) onSyncProgress({ status: 'error', message: 'सिंक त्रुटि: ' + err.message });
    return { success: false, error: err.message };
  }
}
