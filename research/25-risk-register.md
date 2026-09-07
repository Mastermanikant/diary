# 25. Comprehensive Enterprise Risk Register & Mitigation Matrix

## 1. Risk Assessment Methodology

Risks are quantified on a standard **$5 \times 5$ Risk Matrix**:
$$\text{Risk Score} = \text{Likelihood (1–5)} \times \text{Impact (1–5)}$$

* **High Risk (Score 15–25):** Critical priority; requires structural architectural mitigation before production.
* **Medium Risk (Score 8–14):** Moderate priority; requires standard monitoring and automated safeguards.
* **Low Risk (Score 1–7):** Routine operational risk; managed through documentation and baseline hygiene.

---

## 2. Complete Risk Register

| Risk ID | Category | Risk Description | Likelihood (1-5) | Impact (1-5) | Score (1-25) | Mitigation Strategy | Contingency / Fallback Plan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **R-01** | **User / Support** | **Forgotten Passphrase & Lost Recovery Sheet:** User loses both master password and 24-word phrase, then demands recovery. | **5** | **4** | **20 (HIGH)** | Multi-step setup wizard forcing user to confirm writing down the 24-word phrase; explicit warnings that data is unrecoverable without keys. | Friendly account wipe flow; clear FAQ explaining mathematical impossibility of backdoors. |
| **R-02** | **Technical** | **Browser Storage Eviction (Safari ITP / OPFS):** Safari or Chrome automatically clears OPFS/IndexedDB storage if device runs low on disk. | **4** | **4** | **16 (HIGH)** | Request `navigator.storage.persist()` on first launch; display prominent reminders to download `.fbe` backups weekly. | Cloud Sync (Mode 3) provides automatic remote replica; local `.fbe` file restores everything. |
| **R-03** | **Security** | **Malicious npm Supply-Chain Injection:** A compromised third-party npm package injects keylogging script into web bundle. | **3** | **5** | **15 (HIGH)** | Extreme zero-dependency policy; lockfile hash freezing; Socket.dev / Dependabot automated CI scanning; strict CSP. | Subresource Integrity (SRI) hashes; instant emergency rollback via GitHub Actions. |
| **R-04** | **Business** | **Low Conversion ("Free Tier is Too Good"):** Users find the free offline diary so satisfactory that only a small percentage upgrades to paid sync. | **4** | **3** | **12 (MED)** | Keep offline mode genuinely generous to maintain brand trust; make multi-device sync and automated cloud backup the compelling Pro hook. | Introduce Lifetime Vault Pass (\$49.99) and Desktop Pro features. |
| **R-05** | **Performance**| **Argon2id CPU Throttling on Budget Mobile:** Running 64MB Argon2id freezes budget Android phones for 4+ seconds during vault unlock. | **3** | **3** | **9 (MED)** | Offload Argon2id computation to a background Web Worker so the main UI thread never stutters; provide visual loading spinner. | Allow user to select standard mobile security parameters ($m=32\text{MB}, t=2$) if benchmark fails. |
| **R-06** | **Legal** | **Law Enforcement Plaintext Demand:** Government agency serves warrant demanding user diary entries under criminal investigation. | **2** | **4** | **8 (MED)** | Zero-Knowledge architecture: FrankBase does not possess decryption keys. Public transparency report detailing all received requests. | Comply lawfully by handing over only what exists: ciphertext blobs and account metadata. Plaintext is physically impossible to produce. |
| **R-07** | **Security** | **Physical Shoulder Surfing / Unlocked Device:** User leaves phone unlocked on a café table; unauthorized party reads active journal. | **4** | **2** | **8 (MED)** | Aggressive 5-minute inactivity lock; instant privacy shield on window blur (`visibilitychange`); biometric unlock. | Panic Button / Quick Lock shortcut (Esc / Double-tap header) instantly zeroizes memory. |
| **R-08** | **Infrastructure**| **Cloudflare Service Disruption:** Major Cloudflare edge outage interrupts sync for multi-device users. | **2** | **3** | **6 (LOW)** | Offline-first architecture ensures 100% local editing continues uninterrupted; writes queue locally in IndexedDB/OPFS. | Sync resumes automatically and transparently once Cloudflare connectivity is restored. |
| **R-09** | **Compliance**| **DPDP Act 2023 Rule Changes in India:** Indian Data Protection Board introduces unforeseen reporting mandates or rules. | **2** | **3** | **6 (LOW)** | Modular legal architecture; appointment of official Grievance Officer (`legal@frankbase.com`); regular legal counsel review. | Update privacy policy and consent flows within 30 days of official gazette notification. |
| **R-10** | **Business** | **Competitor Price War / Free Sync Offering:** A large competitor offers free cloud sync by subsidizing it with ad tracking or VC funds. | **3** | **2** | **6 (LOW)** | Emphasize ethical anti-surveillance guarantee, open-source verification, and true zero-knowledge encryption that free ad-supported apps cannot provide. | Highlight the cautionary tale of Skiff being shut down after offering unsustainable free tiers. |

---

## 3. High-Priority Mitigation Action Plan

1. **The "Forgotten Password" Defense (R-01):** The #1 operational threat to consumer zero-knowledge apps is user frustration over lost passwords. The onboarding UX must emphasize personal key responsibility through interactive seed confirmation before the vault is activated.
2. **The "Storage Eviction" Defense (R-02):** The browser PWA must aggressively check `navigator.storage.persisted()` and prompt the user to grant persistent storage permission.
3. **The "Supply Chain" Defense (R-03):** Minimize external dependencies to fewer than 10 audited packages in the production bundle.
