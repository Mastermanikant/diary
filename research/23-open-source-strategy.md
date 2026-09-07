# 23. Open-Source Strategy, Commercial Licensing & Reproducible Verification

## 1. The Strategic Imperative of Open-Source in Privacy Tech

In security software, **closed-source is an insurmountable barrier to adoption**. Discerning privacy advocates and technical users refuse to type their most intimate thoughts into a closed-source binary where undocumented telemetry, analytics SDKs, or backdoor escrow keys could be hidden.

```mermaid
graph TD
    subgraph 100% Open Source (GitHub Public)
        OS1[Cryptographic Engine & @noble Wrappers]
        OS2[.fbe Universal Backup Spec & Decryptor CLI]
        OS3[Client Apps: Web, Android, iOS, Desktop Tauri]
        OS4[Zero-Knowledge Sync Protocol Client]
    end

    subgraph Commercial / Hosted Ecosystem
        Host1[FrankBase Global Edge Relay: Cloudflare Workers]
        Host2[Managed Backups & Instant Push Notifications]
        Host3[Dodo Payments Merchant of Record & Billing]
    end

    OS3 -->|Pushes Ciphertext| Host1
```

---

## 2. Licensing Architecture & Dual-License Strategy

To balance absolute public trust with commercial viability and protection against predatory corporate cloning:

| Component | Recommended License | Strategic Rationale |
| :--- | :--- | :--- |
| **Cryptographic Core & `.fbe` Spec** | **MIT License** | Maximum universal adoption; allows third parties to build standalone decryptors so users never fear obsolescence. |
| **Client Applications (Web / Mobile / Desktop)** | **GNU AGPLv3 (or GPLv3)** | **Strong Copyleft:** Anyone can audit, modify, and self-host, but any competitor attempting to fork FrankDiary and distribute a proprietary derivative **must legally publish their entire source code**. |
| **Cloudflare Edge Sync Backend** | **Business Source License (BSL 1.1) / Proprietary Hosted** | Free for individuals to self-host for non-commercial personal use; prevents venture-backed competitors from taking the backend and selling it as a managed cloud service without paying FrankBase. Converts to Apache 2.0 after 4 years. |

---

## 3. Commercial Risks & Competitive Moats

### Risk 1: "Can a competitor clone our GitHub repo and launch tomorrow?"
* **The Reality:** Any developer can clone Bitwarden or Signal tomorrow. Yet Bitwarden and Signal dominate because **code is not the moat; trust, operational infrastructure, and brand equity are the moat**.
* **FrankDiary Moats:**
  1. **Canonical Domain & Brand Trust:** `diary.frankbase.com` and `od.frankbase.com` under Master Manikant Yadav's audited ecosystem.
  2. **Turnkey Zero-Config Cloud Sync:** Non-technical users will happily pay \$2.99/month rather than managing Docker containers, configuring Cloudflare Workers, and managing SQL databases themselves.
  3. **Official App Store & Play Store Verified Listings:** Sideloading cloned APKs carries malware warnings on modern Android/iOS.

### Risk 2: Supply-Chain Compromises & Malicious PRs
* **Mandatory Safeguards:**
  * Strict branch protection on `main`: Minimum 2 approving reviews from ecosystem maintainers.
  * Cryptographic Git Commit Signing: Enforced GPG / SSH commit signing via hardware security keys (Rule 7).
  * Isolated GitHub Actions CI/CD with pinned SHA hashes for all actions (`actions/checkout@v4.1.1` by commit hash).

---

## 4. Reproducible Builds & Cryptographic Verification

A common skepticism in web-based E2EE tools is:
> *"How do I know the JavaScript running in my browser or the APK on my phone was actually compiled from the clean open-source GitHub code?"*

### FrankDiary 4-Step Verification Protocol:
1. **Deterministic / Reproducible Docker Builds (SLSA Level 3):**
   * Compilation environments run inside standardized container images with pinned compiler toolchains (Node.js, Rust, Gradle).
   * Strips file timestamps and system paths so that anyone compiling the tagged commit achieves a **bit-for-bit identical binary SHA-256 hash**.
2. **Sigstore & GitHub OIDC Attestations:**
   * Every production release publishes a tamper-proof cryptographic attestation signed by GitHub's OIDC issuer.
3. **Subresource Integrity (SRI) on Web:**
   * All web JavaScript bundles load with explicit `integrity="sha384-..."` attributes.
4. **Standalone Decryptor CLI (The Ultimate Safety Net):**
   * FrankBase publishes a tiny, audited 200-line single-file Python/Rust CLI tool:
     ```bash
     frankdiary-decrypt --input backup.fbe --output my_diary.json
     ```
   * Users can verify that their `.fbe` file decrypts cleanly on an air-gapped machine using independent, third-party code.
