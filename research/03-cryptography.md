# 03. Cryptographic Primitives & Key Management Architecture

## 1. Golden Rule of Applied Cryptography
> **"Never roll your own crypto."** (Bruce Schneier)
> All cryptographic operations in FrankDiary strictly employ standardized, battle-tested, and mathematically proven primitives implemented via audited, peer-reviewed libraries.

---

## 2. Key Derivation Function (KDF): Password to Encryption Key

### Password Hashing vs. Key Derivation: The Critical Distinction
* **Password Hashing (Server-Side Storage):** Used to verify a user's password on a login server without storing the plaintext. Output is a static hash string (e.g., bcrypt `$2b$...`).
* **Key Derivation (KDF - Client-Side Cryptography):** Stretches a low-entropy human password into a uniformly distributed, cryptographically strong 256-bit (32-byte) binary pseudorandom key capable of encrypting data. It requires high memory consumption to resist GPU/ASIC brute-force attacks.

### Comparison of Key Derivation Functions

| Primitive | Memory Hardness | GPU / ASIC Resistance | Side-Channel Resistance | Industry Standard Status | FrankDiary Selection |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **PBKDF2-HMAC-SHA256** | Zero (CPU only) | **Very Poor** (GPUs crack billions/sec) | Good | NIST SP 800-132 (Legacy) | ❌ Rejected for primary KDF |
| **scrypt** | High | Moderate | Susceptible to cache timing | RFC 7914 | ⚠️ Acceptable secondary fallback |
| **Argon2id** | **Very High** (Configurable RAM) | **Maximum** (Hard on ASICs & GPUs) | **Immune** (Blends Argon2d & Argon2i) | Winner of Password Hashing Competition (RFC 9106) | ✅ **PRIMARY STANDARD** |

### FrankDiary Argon2id Benchmark Parameters (RFC 9106)
To balance mobile device battery life with world-class resistance against offline dictionary attacks:
* **Algorithm:** `Argon2id` (v1.3)
* **Memory Cost ($m$):** 64 MB (`65536` KiB) on Web/Mobile (128 MB on Desktop)
* **Time Cost / Iterations ($t$):** 3 passes
* **Parallelism ($p$):** 4 threads (clamped to 1 on single-threaded Web Workers)
* **Salt:** 128-bit (16-byte) cryptographically secure random salt generated via `crypto.getRandomValues()` unique to each user vault.
* **Output Length:** 256 bits (32 bytes).

---

## 3. Authenticated Encryption with Associated Data (AEAD)

Plain symmetric encryption (like AES-CBC) is dangerously vulnerable to bit-flipping, padding oracle attacks, and tampering. FrankDiary exclusively utilizes **AEAD (Authenticated Encryption with Associated Data)**.

### Comparison: AES-256-GCM vs. ChaCha20-Poly1305 vs. XChaCha20-Poly1305

| Cipher Suite | Key Size | Nonce / IV Size | Hardware Acceleration | Nonce-Collision Risk | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AES-256-GCM** | 256 bits | 96 bits (12 bytes) | Dedicated AES-NI instructions (Ultra fast on Intel/Apple M-series) | **HIGH RISK** if $> 2^{32}$ random nonces generated with the same key. | Built-in native WebCrypto API in modern browsers. |
| **ChaCha20-Poly1305** | 256 bits | 96 bits (12 bytes) | Fast in software on ARM mobile devices without AES-NI | Same 96-bit collision risk if keys are reused for massive message counts. | Mobile devices without hardware AES acceleration. |
| **XChaCha20-Poly1305** | 256 bits | **192 bits (24 bytes)** | Software fast (libsodium) | **ZERO RISK** of collision even with purely random nonces. | **Recommended for Export Files & Local Blob Store.** |

### Selected Encryption Primitives
1. **Web Environment (In-Browser / PWA):** 
   * **AES-256-GCM** via the browser's native **WebCrypto API** (`crypto.subtle.encrypt`). It runs in native C++ browser core code with zero JavaScript overhead and automatic AES-NI hardware acceleration.
   * Nonce generation: Each encryption operation generates a fresh 96-bit random nonce (`crypto.getRandomValues(new Uint8Array(12))`).
2. **Mobile & Desktop Environments (Kotlin / Swift / Rust / Libsodium):**
   * **XChaCha20-Poly1305** (via Libsodium / `@noble/ciphers`). The 192-bit nonce completely eliminates nonce reuse hazards across millions of diary edits and multi-device synchronizations.

---

## 4. Key Hierarchy & Envelope Encryption

Directly encrypting every individual diary entry with a key derived from the user's password is a catastrophic design error: if the user ever changes their password, every single record in the database would have to be decrypted and re-encrypted.

FrankDiary implements **Envelope Encryption**:

```mermaid
graph TD
    subgraph Master Secrets
        Password[User Master Passphrase]
        Salt[Random Vault Salt - 16 bytes]
        BIP39[24-Word Recovery Phrase]
    end

    Password + Salt -->|Argon2id| MasterKey[Master Key - MK 256-bit]
    BIP39 -->|HKDF-SHA256| RecoveryKey[Recovery Key - RK 256-bit]

    subgraph Key Encryption Keys
        MasterKey -->|HKDF Expand| KEK[Key Encryption Key - KEK]
        MasterKey -->|HKDF Expand| AuthKey[Auth Key - AK]
    end

    subgraph Data Encryption
        DEK[Data Encryption Key - DEK 256-bit Random]
        KEK -->|AES-256-GCM Encrypt| WrappedDEK1[Encrypted DEK by Password]
        RecoveryKey -->|AES-256-GCM Encrypt| WrappedDEK2[Encrypted DEK by Recovery Phrase]
    end

    subgraph Content Storage
        DEK -->|AEAD Encrypt| Entry1[Encrypted Diary Entry 1]
        DEK -->|AEAD Encrypt| Entry2[Encrypted Diary Entry 2]
        DEK -->|AEAD Encrypt| Media[Encrypted Image / Audio Attachment]
    end
```

### Advantages of the Envelope Architecture:
1. **Instantaneous Password Changes ($O(1)$ Time):** Changing the password only requires deriving a new KEK with Argon2id and re-encrypting the single 32-byte DEK (`WrappedDEK1`). 50,000 diary entries remain untouched!
2. **Dual Recovery Path:** The DEK is also stored wrapped by the Recovery Key (`WrappedDEK2`). If the user forgets their password, the 24-word phrase can unwrap the DEK directly.
3. **Cryptographic Key Separation:** The `MasterKey` is never used directly for encryption. HKDF (RFC 5869) cleanly derives distinct purpose-specific keys:
   * $K_{enc} = \text{HKDF-Expand}(MK, \text{"frankdiary-storage-v1"}, 32)$
   * $K_{auth} = \text{HKDF-Expand}(MK, \text{"frankdiary-cloud-auth-v1"}, 32)$

---

## 5. Nonce / IV Generation Protocol

In AEAD ciphers (AES-GCM or ChaCha20), **never reuse a nonce with the same key**. A single nonce reuse completely destroys the integrity of Poly1305 or allows recovery of the GCM authentication subkey, leading to full plaintext recovery.

### The FrankDiary Nonce Standard:
1. **Source of Entropy:** Exclusively OS-level cryptographically secure pseudo-random number generators:
   * Web: `window.crypto.getRandomValues()`
   * Android: `java.security.SecureRandom` (backed by `/dev/urandom`)
   * iOS: `SecRandomCopyBytes`
2. **Payload Structure:** The nonce is **never secret**. It is prefixed directly to the ciphertext payload:
   $$\text{Stored Blob} = \text{Salt (16B)} \parallel \text{Nonce (12B or 24B)} \parallel \text{Ciphertext} \parallel \text{Auth Tag (16B)}$$

---

## 6. Secure Key Storage on Client Endpoints

| Platform | Hardware Security Mechanism | Implementation in FrankDiary |
| :--- | :--- | :--- |
| **Android** | Android Keystore / StrongBox Keymaster | Wrap Master Key with an asymmetric key pair stored inside the hardware-backed Trusted Execution Environment (TEE) / Secure Element (SE), unlocked only via `BiometricPrompt`. |
| **iOS / macOS** | Secure Enclave / Keychain Services | Store wrapped key in Keychain with `kSecAccessControlBiometryAny` and `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. |
| **Web / PWA** | WebCrypto Non-Extractable Keys + IndexedDB | Master key is imported with `extractable: false`. In memory, key handles cannot be read by JavaScript `console.log` or DOM scripts. On logout or after 5 minutes of inactivity, IndexedDB session keys are deleted. |

---

## 7. Password Transmission Invariant

> **THE MASTER PASSWORD IS NEVER TRANSMITTED TO ANY SERVER UNDER ANY CIRCUMSTANCES.**

When a user logs into Mode 3 (Cloud Sync):
1. The user types their password on device.
2. The client derives the `MasterKey` locally via Argon2id.
3. The client derives an independent authentication token via HKDF:
   $$\text{AuthToken} = \text{HMAC-SHA256}(MasterKey, \text{"frankdiary-server-login"})$$
4. Only $\text{AuthToken}$ is sent to the server over TLS 1.3.
5. The server hashes this token with its own Argon2id instance before matching.
6. The server **cannot compute backward** from $\text{AuthToken}$ to find the `MasterKey` or the original password.

---

## 8. Mature, Audited Open-Source Libraries

FrankDiary relies solely on libraries that have completed formal external third-party security audits:
1. **WebCrypto API (W3C Standard):** Native browser engine implementation (Chromium BoringSSL, Firefox NSS, WebKit Apple CryptoKit).
2. **Libsodium (RFC 7693 / 7539 / 8439):** Written by Frank Denis; audited by Cure53 and Private Internet Access.
3. **@noble/ciphers & @noble/hashes:** Authored by Paul Miller; formal independent audit completed by Cure53. Zero external dependencies, pure audited TypeScript.
4. **SQLCipher (Zetetic LLC):** Widely audited standard for full SQLite database encryption at rest.
