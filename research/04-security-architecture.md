# 04. Comprehensive Security Architecture & Zero-Knowledge Blueprint

## 1. Zero-Knowledge Architectural Topology

The fundamental principle of FrankDiary's security architecture is **strict data isolation at the trust boundary**. The cloud server is treated as a hostile, potentially compromised untrusted storage relay.

```
+-------------------------------------------------------------------------+
|                          TRUSTED CLIENT ZONE                            |
|                                                                         |
|  +--------------------+        +--------------------+                   |
|  | Rich Text Editor   | <----> | State & Index      |                   |
|  | (Plaintext in RAM) |        | (MiniSearch / RAM) |                   |
|  +--------------------+        +--------------------+                   |
|            |                             ^                              |
|            v                             |                              |
|  +--------------------------------------------------+                   |
|  |        Cryptographic Pipeline (WebCrypto)        |                   |
|  |  * Argon2id Key Derivation                        |                   |
|  |  * AES-256-GCM / XChaCha20-Poly1305 Engine       |                   |
|  |  * Ephemeral RAM Zeroization                     |                   |
|  +--------------------------------------------------+                   |
|            |                             |                              |
|            v                             v                              |
|  +--------------------+        +--------------------+                   |
|  | Encrypted Storage  |        | Encrypted Sync     |                   |
|  | (OPFS / SQLite)    |        | Queue (Ciphertext) |                   |
|  +--------------------+        +--------------------+                   |
+------------------------------------------|------------------------------+
                                           |  HTTPS / TLS 1.3 (Ciphertext Only)
                                           v
+-------------------------------------------------------------------------+
|                         UNTRUSTED CLOUD ZONE                            |
|                                                                         |
|  +--------------------------------------------------+                   |
|  | Cloudflare Edge Worker API (Stateless)           |                   |
|  | * Authenticates User Token (HKDF-derived)        |                   |
|  | * Enforces Rate Limiting & Quotas                |                   |
|  +--------------------------------------------------+                   |
|            |                             |                              |
|            v                             v                              |
|  +--------------------+        +--------------------+                   |
|  | Cloudflare D1      |        | Cloudflare R2      |                   |
|  | (Encrypted Records |        | (Encrypted Media & |                   |
|  | & CRDT Event Log)  |        | Chunked Blobs)     |                   |
|  +--------------------+        +--------------------+                   |
+-------------------------------------------------------------------------+
```

---

## 2. Platform Client Security Implementations

### A. Web / Progressive Web App (PWA)
* **Sandboxed Execution:** Runs inside the browser sandbox with strict origin isolation.
* **Storage Layer:** Uses the **Origin Private File System (OPFS)** or **IndexedDB** for local persistence.
* **Non-Extractable CryptoKey:** Keys derived through `crypto.subtle.deriveKey` or imported with `extractable: false` are maintained inside the browser engine's internal C++ memory structure and cannot be read out by script inspection or prototype pollution.
* **Content Security Policy (CSP):**
  ```http
  Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https://api.frankbase.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self';
  ```
  This strict CSP blocks all third-party script injection, unauthorized external network calls, and clickjacking attacks.

### B. Android Native / Hybrid (Kotlin / Compose / Capacitor)
* **Hardware Backing:** Keys stored via **Android Keystore provider** (`AndroidKeyStore`).
* **StrongBox Keymaster:** On hardware supporting it (e.g. Google Pixel, Samsung Knox), keys are physically generated inside a separate tamper-resistant hardware chip.
* **Screenshot & Task Switcher Masking:** Enforce `FLAG_SECURE` in Android activities to block OS screenshots, screen recording apps, and window switcher thumbnails.
* **Biometric Authentication:** BiometricPrompt with `BIOMETRIC_STRONG` (Class 3 hardware biometric sensor) unlocking the Keystore key.

### C. iOS Native (Swift / SwiftUI)
* **Secure Enclave:** Private keys backed by Apple Secure Enclave coprocessor.
* **Keychain Item Attributes:** Configured with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, ensuring keychain items are unreadable when the device is locked and are excluded from unencrypted iCloud/iTunes backups.

---

## 3. In-Memory Key Lifecycle & RAM Zeroization

In modern garbage-collected runtimes (JavaScript / V8), clearing memory strings is challenging because strings are immutable and engine garbage collectors may copy bytes across heap regions.

### FrankDiary RAM Protection Protocol:
1. **TypedArrays for Secrets:** Passwords, master keys, and decrypted records are NEVER handled as native JavaScript strings. They are handled exclusively as `Uint8Array` byte buffers.
2. **Explicit Zeroization:** As soon as an encryption or decryption operation completes, the buffer is overwritten with zeros:
   ```javascript
   function zeroize(buffer) {
     if (buffer && buffer.fill) {
       buffer.fill(0);
     }
   }
   ```
3. **Session Inactivity Timer:** An idle timer running in the background locks the vault after 5 minutes of inactivity (customizable from 1 minute to 30 minutes). On lock:
   * All decrypted diary records in the UI state are cleared.
   * Key objects in memory are released and zeroized.
   * Search index cache in RAM is purged.
4. **App Backgrounding Trigger:** When the browser tab loses focus (`visibilitychange` event) or the mobile app goes to the background, the UI immediately renders an opaque privacy shield.

---

## 4. What the Server Sees vs. What the Server NEVER Sees

| Data Element | Plaintext Visible to Server? | Server Visibility State |
| :--- | :---: | :--- |
| **Diary Entry Content (Text, Markdown, HTML)** | ❌ **NEVER** | Random-looking Base64 / binary ciphertext. |
| **Entry Title & Headings** | ❌ **NEVER** | Encrypted inside the payload envelope. |
| **Tags, Categories, Folder Names** | ❌ **NEVER** | Encrypted inside the payload envelope. |
| **Mood, Rating, Weather, Location** | ❌ **NEVER** | Encrypted inside the payload envelope. |
| **Photos, Voice Notes, File Attachments** | ❌ **NEVER** | Pre-encrypted client-side with DEK before upload. |
| **User's Master Passphrase** | ❌ **NEVER** | Never sent to server; KDF runs 100% on device. |
| **Encryption Keys (MK, KEK, DEK)** | ❌ **NEVER** | Keys remain on device; server stores only encrypted wrapped key blob. |
| **Search Queries & Keywords** | ❌ **NEVER** | Search runs 100% locally on decrypted client data. |
| **User Account ID (UUIDv4)** | ✅ **YES** | Random UUID generated at registration. |
| **Encrypted Record ID (UUIDv4)** | ✅ **YES** | Used as database primary key for sync routing. |
| **Sync Version / Clock Counter** | ✅ **YES** | Monotonically increasing integer for conflict resolution. |
| **Encrypted Blob Size** | ✅ **YES** | Bytes stored (mitigated via padding, see Doc 08). |
| **Timestamp of Sync Request** | ✅ **YES** | HTTP server access log (mitigated via blind batching). |
| **Client IP Address** | ✅ **YES** | Cloudflare network layer (mitigated via Tor / VPN / Warp). |

---

## 5. Tampering Detection & AEAD Cryptographic Verification

FrankDiary utilizes authenticated encryption with associated data (AEAD). Every encrypted record incorporates an authentication tag:

$$\text{Authentication Tag} = \text{Poly1305 / GHASH}(K_{mac}, \text{Associated Data} \parallel \text{Ciphertext})$$

### Tampering Response Protocol:
1. **Header Integrity:** The Associated Data (AD) binds the `record_id`, `schema_version`, and `vault_id`.
2. **Instant Rejection:** If an attacker modifies even a single bit of the ciphertext, nonce, or associated data in the cloud database, decryption will throw a cryptographic verification failure:
   ```javascript
   // WebCrypto throws DOMException "OperationError" on authentication failure
   await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData }, key, ciphertext);
   ```
3. **Safety Isolation:** The application does not crash. It flags the entry with a **Cryptographic Tampering Warning** in the UI, isolates the damaged entry, and halts sync to protect local data integrity.

---

## 6. Future Sharing & Access Control Architecture (Optional Module)

While FrankDiary is primarily a single-user private sanctuary, users may eventually request selective entry sharing (e.g., sharing a memories note with a partner or therapist).

### Cryptographic Sharing Design:
1. **Asymmetric Key Pairs:** Every user generates an **X25519 (Diffie-Hellman)** key pair for key exchange and an **Ed25519** key pair for digital signatures.
2. **Public Key Registry:** Public keys are registered on the server.
3. **Entry-Level Sharing Protocol:**
   * Alice wants to share Entry $E$ with Bob.
   * Alice fetches Bob's public key $PK_{Bob}$ from the server.
   * Alice generates a fresh random symmetric **Entry Share Key ($K_s$)**.
   * Alice encrypts Entry $E$ with $K_s$.
   * Alice wraps $K_s$ for Bob using ECDH ($X25519(SK_{Alice}, PK_{Bob})$) and sends the wrapped key to Bob.
4. **Revocation Model:**
   * Alice revokes access by generating a new $K_s'$, re-encrypting the entry, and unwrapping it only for remaining authorized recipients.
   * Bob cannot decrypt subsequent updates to that entry.
