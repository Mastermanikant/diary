# 09. Password Management, Account Recovery & Key Rotation

## 1. The Zero-Knowledge Paradox: Security vs. Usability

In conventional SaaS applications (Google, Facebook, Notion), password recovery is trivial:
* The user clicks "Forgot Password".
* The server sends an email containing an unguessable reset link.
* The user enters a new password, and the server updates its database hash.

In a **Zero-Knowledge End-to-End Encrypted system**, this conventional workflow is **mathematically impossible without destroying the cryptographic guarantees**:
* The server does not possess the encryption keys.
* The server cannot decrypt the data to re-encrypt it with a new key.
* If a server can reset your password and restore your plaintext data without your old secret, **the server was holding the keys all along, and the system was never zero-knowledge.**

---

## 2. In-Depth Analysis of the Five Core Scenarios

```mermaid
graph TD
    Start{User Scenario}
    Start -->|Case 1: Password Remembered| Normal[Argon2id -> KEK -> Unwrap DEK -> Plaintext]
    Start -->|Case 2: Password Forgotten| CheckPhrase{Has 24-Word Recovery Phrase?}
    CheckPhrase -->|Yes| Recover[Derive Recovery Key -> Unwrap DEK -> Reset Password]
    CheckPhrase -->|No| Loss[Cryptographic Permanent Loss / Full Wipe]
    Start -->|Case 3: New Device Acquired| NewDev[Enter Password + Salt or QR Code Link]
    Start -->|Case 4: User Changes Password| ReKey[Re-wrap DEK with New KEK in O(1) Time]
    Start -->|Case 5: Zero-Company-Backdoor| Hardcore[100% Client-Held Keys, Zero Recovery Possible]
```

### Case 1: User Remembers Master Password
1. User inputs master passphrase into client application.
2. Client retrieves local/remote `vault_salt` (16 bytes).
3. Client runs Argon2id ($m=64\text{MB}, t=3, p=4$) to derive `MasterKey`.
4. Client expands `KEK` via HKDF.
5. Client decrypts `WrappedDEK` using AES-256-GCM.
6. Decrypted `DEK` is loaded into volatile RAM.
7. Diary records are decrypted on the fly as requested by the UI.

### Case 2: User Forgets Master Password
This is the most dangerous event in privacy-first software. FrankDiary provides two strict paths:

#### Path A: The User Has Their 24-Word BIP-39 Recovery Sheet
* During vault setup, the user is required to write down a cryptographically generated **24-word BIP-39 mnemonic phrase** (representing 256 bits of true entropy).
* The application derives a `RecoveryKey` from this mnemonic via PBKDF2-HMAC-SHA512 (2048 iterations) or HKDF.
* The application retrieves `WrappedDEK_Recovery` (which was encrypted with the `RecoveryKey` during vault creation).
* The `RecoveryKey` unwraps the `DEK`.
* The user is prompted to set a brand new master passphrase.
* The `DEK` is re-wrapped with the new passphrase-derived `KEK`.
* **Zero data loss occurs.**

#### Path B: The User Lost BOTH Master Password AND Recovery Sheet
* **MATHEMATICAL OUTCOME: PERMANENT, UNRECOVERABLE DATA LOSS.**
* Neither FrankBase developers, server engineers, nor law enforcement can decrypt the ciphertext.
* The only operational action available is **Account Purge / Factory Reset**, which wipes the ciphertext and creates a fresh empty vault.
* *Trade-off:* Complete immunity to unauthorized access vs. catastrophic penalty for personal negligence.

### Case 3: User Buys a New Device (Restoration Flow)
1. User installs FrankDiary on the new device.
2. User selects "Existing User Login".
3. User enters their account identifier and master passphrase.
4. The client fetches `vault_salt` and the encrypted blobs (`WrappedDEK` and entries) from Cloudflare D1/R2.
5. The new device runs Argon2id locally, unwraps the `DEK`, decrypts all entries, and populates the local SQLite/OPFS database.
6. Alternatively, the user can use the **Local QR Code Link** feature (Doc 07) to transfer keys directly from an active phone.

### Case 4: User Changes Master Password (Key Re-wrapping Protocol)
In primitive encryption designs, changing a password requires decrypting all 50,000 diary entries and re-encrypting them with a new key. This takes minutes, drains battery, and risks data corruption if interrupted mid-process.

**The FrankDiary $O(1)$ Solution:**
1. User enters Old Password and New Password.
2. Client unwraps the `DEK` in RAM using Old Password.
3. Client generates a new random `vault_salt_new`.
4. Client derives `KEK_new` from New Password and `vault_salt_new` via Argon2id.
5. Client encrypts the existing 32-byte `DEK` with `KEK_new`:
   $$\text{WrappedDEK}_{\text{new}} = \text{AES-GCM-Encrypt}(KEK_{\text{new}}, DEK)$$
6. Client writes $\text{WrappedDEK}_{\text{new}}$ and `vault_salt_new` to local storage and syncs it to the cloud.
7. **Execution Time: Less than 300 milliseconds.** The underlying encrypted entries remain 100% valid and untouched.

### Case 5: The "True Zero-Knowledge" Absolute Guarantee
Some commercial apps retain a hidden master key escrow or recovery certificate on their servers to help careless users recover accounts.
* **FrankDiary Policy:** FrankDiary categorically **rejects all key escrow mechanisms**.
* There is no backdoor, no administrative escrow, no company recovery key, and no secret mathematical shortcut.
* This absolute stance guarantees that even if FrankBase is served with a court order demanding user data, **it is physically and mathematically impossible for the company to comply.**

---

## 3. Advanced Recovery Evaluation: Shamir's Secret Sharing (SSS)

For high-net-worth individuals, journalists, or human-rights activists who fear losing a 24-word phrase:
* FrankDiary can optionally implement **Shamir's Secret Sharing (SLIP-0039)**:
  * The 256-bit Master Key is split into 3 or 5 independent mnemonic shares (e.g., 3-of-5 threshold).
  * The user can give Share 1 to their lawyer, Share 2 in a bank safety deposit box, Share 3 to their spouse, Share 4 in their home safe, and Share 5 in their digital vault.
  * Any 3 shares combined reconstruct the key; any 2 shares reveal mathematically zero information.
