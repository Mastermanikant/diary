/**
 * FrankDiary Zero-Knowledge Cloud Relay (ZK-Relay)
 * Cloudflare Pages Edge Function: /api/sync
 * Database: mmcentral-db (D1 SQLite)
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse({ success: false, error: 'DATABASE_BINDING_MISSING' }, 500);
    }

    const url = new URL(request.url);
    const vaultId = url.searchParams.get('vault_id');
    const sinceParam = url.searchParams.get('since') || '0';
    const sinceTimestamp = parseInt(sinceParam, 10) || 0;

    if (!vaultId) {
      return jsonResponse({ success: false, error: 'VAULT_ID_REQUIRED' }, 400);
    }

    // Verify vault registration
    const vault = await db
      .prepare('SELECT vault_id FROM frankdiary_vaults WHERE vault_id = ?')
      .bind(vaultId)
      .first();

    if (!vault) {
      return jsonResponse({ success: false, error: 'VAULT_NOT_FOUND' }, 404);
    }

    // Fetch entries updated strictly after `sinceTimestamp`
    const { results } = await db
      .prepare(
        `SELECT entry_id as id, vault_category, date, time, device_name, 
                encrypted_nonce, encrypted_data, preview_title, preview_mood, 
                preview_is_favorite, updated_at, is_deleted 
         FROM frankdiary_entries 
         WHERE vault_id = ? AND updated_at > ? 
         ORDER BY updated_at ASC LIMIT 500`
      )
      .bind(vaultId, sinceTimestamp)
      .all();

    return jsonResponse({
      success: true,
      entries: results || [],
      server_time: Date.now(),
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse({ success: false, error: 'DATABASE_BINDING_MISSING' }, 500);
    }

    const body = await request.json();
    const { vault_id, device_name, salt_base64, verifier_blob, entries, action } = body;

    if (!vault_id) {
      return jsonResponse({ success: false, error: 'VAULT_ID_REQUIRED' }, 400);
    }

    const now = Date.now();

    // 1. Vault registration / heartbeat
    if (salt_base64 && verifier_blob) {
      await db
        .prepare(
          `INSERT INTO frankdiary_vaults (vault_id, salt_base64, verifier_blob, device_name, updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(vault_id) DO UPDATE SET
             device_name = excluded.device_name,
             updated_at = excluded.updated_at`
        )
        .bind(vault_id, salt_base64, verifier_blob, device_name || 'Device', now, now)
        .run();
    } else {
      const existing = await db
        .prepare('SELECT vault_id FROM frankdiary_vaults WHERE vault_id = ?')
        .bind(vault_id)
        .first();

      if (!existing) {
        return jsonResponse({ success: false, error: 'VAULT_NOT_INITIALIZED' }, 400);
      }
    }

    if (action === 'register_only') {
      return jsonResponse({ success: true, message: 'VAULT_REGISTERED', server_time: now });
    }

    // 2. Process Entry Delta Pushes (Time-Based Last-Write-Wins)
    let processedCount = 0;
    if (Array.isArray(entries) && entries.length > 0) {
      const statements = [];

      for (const entry of entries) {
        if (!entry.id) continue;

        const entryId = entry.id;
        const vaultCat = entry.vault_category || 'personal';
        const entryDate = entry.date || new Date().toISOString().split('T')[0];
        const entryTime = entry.time || '12:00';
        const devName = entry.device_name || device_name || 'Personal Device';
        const nonce = entry.encrypted_nonce || entry.encrypted_data?.nonce || '';
        const ciphertext = entry.encrypted_ciphertext || entry.encrypted_data?.ciphertext || (typeof entry.encrypted_data === 'string' ? entry.encrypted_data : '');
        const previewTitle = entry.preview_title || '';
        const previewMood = entry.preview_mood || 'happy';
        const isFav = entry.preview_is_favorite ? 1 : 0;
        const updatedAt = entry.updated_at || now;
        const isDeleted = entry.is_deleted ? 1 : 0;

        statements.push(
          db
            .prepare(
              `INSERT INTO frankdiary_entries (
                 entry_id, vault_id, vault_category, date, time, device_name, 
                 encrypted_nonce, encrypted_data, preview_title, preview_mood, 
                 preview_is_favorite, updated_at, is_deleted
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(vault_id, entry_id) DO UPDATE SET
                 vault_category = excluded.vault_category,
                 date = excluded.date,
                 time = excluded.time,
                 device_name = excluded.device_name,
                 encrypted_nonce = excluded.encrypted_nonce,
                 encrypted_data = excluded.encrypted_data,
                 preview_title = excluded.preview_title,
                 preview_mood = excluded.preview_mood,
                 preview_is_favorite = excluded.preview_is_favorite,
                 updated_at = excluded.updated_at,
                 is_deleted = excluded.is_deleted
               WHERE excluded.updated_at >= frankdiary_entries.updated_at`
            )
            .bind(
              entryId,
              vault_id,
              vaultCat,
              entryDate,
              entryTime,
              devName,
              nonce,
              ciphertext,
              previewTitle,
              previewMood,
              isFav,
              updatedAt,
              isDeleted
            )
        );
      }

      if (statements.length > 0) {
        await db.batch(statements);
        processedCount = statements.length;
      }
    }

    return jsonResponse({
      success: true,
      synced_count: processedCount,
      server_time: now,
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
