# 🔄 FrankDiary Online Sync Architecture & Technical Blueprint (Phase 2)

**Document ID:** ARCH-FD-SYNC-002  
**Ecosystem:** FrankBase Ecosystem (`dairy.frankbase.com` / `od.frankbase.com`)  
**Lead Architect:** Master Manikant Yadav  
**Status:** Unified Architecture (Phase 1 Code is 100% Pre-Wired for this Phase 2 Sync Engine)

---

## 1. Executive Summary: The Zero-Knowledge Cloud Relay (ZK-Relay)

Most commercial diary apps that offer "cloud sync" make a fatal security compromise: they give the server the decryption keys or store plaintext entries in cloud databases. When their servers are hacked, subpoenaed, or inspected by internal employees, the user's private diary is exposed.

**FrankDiary's Online Sync Engine operates on a strict Zero-Knowledge Relay (ZK-Relay) paradigm:**

```
┌────────────────────────────────────────────────────────┐
│                   USER DEVICE (CLIENT)                 │
│                                                        │
│  [Master Passphrase] ──► PBKDF2 / Argon2id             │
│                                │                       │
│                   ┌────────────┴────────────┐          │
│                   ▼                         ▼          │
│            [Encryption Key]           [Auth Token]     │
│                   │                         │          │
│  [Plain Diary]    │                         │          │
│         │         │                         │          │
│         ▼         ▼                         │          │
│    [AES-256-GCM Ciphertext]                 │          │
│            │                                │          │
└────────────┼────────────────────────────────┼──────────┘
             │                                │
             ▼ HTTPS POST (JSON)              ▼ HTTPS POST
    ┌──────────────────────────────────────────────┐
    │     CLOUDFLARE WORKERS EDGE API (HONO.JS)    │
    │                                              │
    │  • Validates Auth Token against bcrypt hash  │
    │  • CANNOT decrypt ciphertext (No Key!)       │
    │  • Assigns Monotonic Lamport Version         │
    │  • Stores Encrypted Blob in Cloudflare D1    │
    └──────────────────────┬───────────────────────┘
                           ▼
             ┌───────────────────────────┐
             │    CLOUDFLARE D1 (SQL)    │
             │   Stores 100% Ciphertext  │
             └───────────────────────────┘
```

---

## 2. Cryptographic Authentication: Why the Server Never Knows the Password

1. **Client Derivation:**
   * User enters `MasterPassphrase` (e.g. `Mani#Secure99!`).
   * WebCrypto derives a 256-bit `MasterKey` in device RAM.
   * From `MasterKey`, the client derives two completely isolated keys via HKDF:
     $$\text{EncryptionKey} = \text{HKDF-Expand}(\text{MasterKey}, \text{"FRANKDIARY_ENCRYPTION_KEY_V1"}, 32)$$
     $$\text{AuthToken} = \text{HKDF-Expand}(\text{MasterKey}, \text{"FRANKDIARY_SERVER_AUTH_TOKEN_V1"}, 32)$$
2. **Server Transmission:**
   * The client sends **only** `AuthToken` to Cloudflare Workers API.
   * `EncryptionKey` NEVER leaves local device memory.
3. **Server Verification:**
   * Cloudflare Worker hashes `AuthToken` using Argon2id/Bcrypt and verifies against the user record in Cloudflare D1.
   * **Result:** Even if the Cloudflare D1 database and all API logs are completely leaked to the public, an attacker CANNOT read a single word of any diary entry!

---

## 3. Conflict-Free Sync Protocol (The "Never-Delete" Invariant)

To permanently solve Reddit's #1 complaint ("sync wiped my entries when switching devices"):

### A. Monotonic Server Versions
Every user vault has an integer `vault_version_counter` in Cloudflare D1. Every insert or update increments this counter monotonically:
$V_{new} = V_{current} + 1$.

### B. Delta-Sync Algorithm (Push & Pull)
1. **Client Pull Request:**
   Client sends:
   ```json
   {
     "last_synced_version": 142
   }
   ```
2. **Server Delta Response:**
   Server responds with only records where `server_version > 142`:
   ```json
   {
     "current_vault_version": 158,
     "updated_entries": [ ... ],
     "deleted_entry_ids": [ ... ]
   }
   ```
3. **Client Delta Decryption:**
   Client receives the encrypted blobs, decrypts them with `EncryptionKey` in RAM, and updates local IndexedDB.

### C. The Anti-Data-Loss Conflict Fork
If Entry `E1` is edited offline on Phone (`Device A`) and simultaneously edited on Laptop (`Device B`):
* Traditional apps silently overwrite one with the other (data loss!).
* **FrankDiary Engine detects version collision:**
  * It marks `Device A`'s edit as `E1`.
  * It forks `Device B`'s edit into a **Conflict Copy**: `E1_conflict_DeviceB_timestamp`.
  * Both entries are preserved side-by-side in the user's timeline.
  * The user sees a gentle badge: `"📌 कॉन्फ्लिक्ट कॉपी (लैपटॉप से 10:15 AM पर संपादित)"` with a 1-click "मर्ज करें (Merge)" button.
  * **Zero data loss guaranteed.**

---

## 4. Cloudflare D1 Database Schema DDL

```sql
-- Cloudflare D1 Database Schema for FrankDiary E2EE Cloud Sync
-- Database Name: frankdiary-d1

-- 1. User Vaults Table
CREATE TABLE IF NOT EXISTS vaults (
    vault_id TEXT PRIMARY KEY,               -- UUIDv4
    auth_hash TEXT NOT NULL,                  -- Argon2/Bcrypt hash of client-derived AuthToken
    salt_base64 TEXT NOT NULL,                -- 16-byte KDF salt
    verifier_blob TEXT NOT NULL,              -- Encrypted verification token
    vault_version INTEGER DEFAULT 0,          -- Monotonic Lamport clock
    device_count INTEGER DEFAULT 1,           -- Number of registered devices
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Encrypted Diary Entries Table
CREATE TABLE IF NOT EXISTS entries (
    entry_id TEXT NOT NULL,                  -- Client-generated UUID (e.g. entry_2026_09_07_xyz)
    vault_id TEXT NOT NULL,                  -- Foreign Key to vaults
    date TEXT NOT NULL,                      -- YYYY-MM-DD
    time TEXT NOT NULL,                      -- HH:MM
    device_name TEXT NOT NULL,               -- e.g. "Manikant iPhone 15", "Office PC"
    encrypted_nonce TEXT NOT NULL,           -- 12-byte Base64 AES-GCM IV
    encrypted_ciphertext TEXT NOT NULL,      -- Base64 AES-256-GCM ciphertext payload
    client_updated_at INTEGER NOT NULL,      -- Unix timestamp on client
    server_version INTEGER NOT NULL,         -- Monotonic sequence version for delta sync
    is_deleted INTEGER DEFAULT 0,            -- Soft deletion flag (1 = deleted)
    PRIMARY KEY (vault_id, entry_id),
    FOREIGN KEY (vault_id) REFERENCES vaults(vault_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_vault_version ON entries(vault_id, server_version);
CREATE INDEX IF NOT EXISTS idx_entries_vault_date ON entries(vault_id, date);

-- 3. Device Provenance & Audit Ledger Table
CREATE TABLE IF NOT EXISTS device_sessions (
    session_id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    user_agent TEXT,
    ip_country TEXT,                         -- Cloudflare cf.country header (e.g. "IN")
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(vault_id) ON DELETE CASCADE
);
```

---

## 5. Implementation Steps to Launch Phase 2 Sync

1. **Deploy D1 Database:**  
   `wrangler d1 create frankdiary-d1` and execute the schema above.
2. **Deploy Cloudflare Workers API:**  
   A lightweight Hono.js worker (`worker/index.ts`) handling:
   * `/api/v1/auth/register`
   * `/api/v1/auth/login`
   * `/api/v1/sync/pull`
   * `/api/v1/sync/push`
3. **Frontend Sync Hook (`useSync.js`):**  
   Runs in the background when the device is online:
   * Listens to `navigator.onLine` and `window.addEventListener('online')`.
   * Automatically pushes local changes flagged as `sync_status = 'pending'`.
   * Pulls remote changes and updates IndexedDB with 0 UI freeze.
