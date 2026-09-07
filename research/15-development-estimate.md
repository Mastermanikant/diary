# 15. Engineering Complexity, Module Breakdown & AI vs. Human Verification Boundaries

## 1. Module-by-Module Development Complexity Matrix

| # | Module | Complexity | Dependencies | Major Risks | Est. Time (Weeks) | Required Expertise |
| :-: | :--- | :---: | :--- | :--- | :---: | :--- |
| **1** | **Product Design & UX** | Medium | Figma / Design tokens | Complex key setup scares non-technical users | 2 - 3 | Product Designer |
| **2** | **Cryptographic Core** | **Very High** | WebCrypto, @noble, Argon2 | Nonce reuse, side-channel timing, weak salts | 3 - 4 | Senior Cryptographer |
| **3** | **Local Encrypted Storage** | High | SQLite WASM, OPFS | Web Worker thread locks, quota drops in Safari | 3 - 4 | Systems / Web Engineer |
| **4** | **Blind Authentication** | Medium | HKDF, Hono.js, D1 | Token replay, enumeration | 1 - 2 | Backend Engineer |
| **5** | **Offline-First State Engine**| High | Zustand / Nanostores | UI latency, dirty write race conditions | 2 - 3 | Frontend Lead |
| **6** | **Portable Export/Import** | Medium | Streams API, Compression | Memory spikes on large video exports | 2 - 3 | Full-Stack Engineer |
| **7** | **Cloud Sync Protocol** | **Very High** | Cloudflare Workers, D1 | Desynchronization, network partition bugs | 4 - 5 | Distributed Systems Eng |
| **8** | **Conflict Resolution** | High | Lamport Clocks, Yjs | Accidental silent overwrites of user journals | 3 - 4 | Distributed Systems Eng |
| **9** | **Mobile App (Capacitor/KMP)**| High | Android Keystore, iOS Enclave | Background sync killed by OS battery managers | 3 - 4 | Mobile Engineer |
| **10**| **Web Application (React/Vite)**| Medium | React 18, Tailwind, TipTap | XSS injection into rich text editor DOM | 3 - 4 | Frontend Engineer |
| **11**| **Backend API (Workers/R2)** | Low to Medium | Cloudflare Workers, D1, R2 | Rate limiting bypass, DoS | 2 - 3 | Cloudflare Edge Eng |
| **12**| **Security Testing & Fuzzing** | High | Vitest, Wycheproof, LibFuzzer | Undetected corner-case cryptographic flaws | 2 - 3 | Security QA Engineer |
| **13**| **Penetration Testing** | **Very High** | Burp Suite, Frida, Ghidra | Zero-day token bypass, supply-chain vulns | 2 - 3 | External Pen Tester |
| **14**| **Documentation & Guides** | Low | Markdown, VitePress | Unclear 24-word recovery warning to users | 1 - 2 | Technical Writer |
| **15**| **Open Source & Reproducible**| Medium | GitHub Actions, Docker, SLSA | Non-deterministic timestamps break build hashes| 1 - 2 | DevOps / SecOps |
| **16**| **CI/CD & Code Signing** | Medium | Fastlane, Apple Developer, Play | Key leakage in CI secrets | 1 - 2 | Release Engineer |
| **17**| **Privacy-Preserving Telemetry**| Low | Cloudflare Analytics (No IP) | Inadvertent logging of user IDs | 1 - 1 | SRE / DevOps |
| **18**| **Legal Compliance (DPDP/GDPR)**| Medium | Legal terms, consent flows | Non-compliance with Section 8 DPDP Act 2023 | 2 - 3 | Privacy Counsel |
| **Total**| **Full Production Pipeline** | | | | **32 - 45 wks** | **Cross-Functional Team** |

---

## 2. AI-Generated Code Capabilities vs. Mandatory Human Security Review

In the era of autonomous AI coding assistants, it is vital to demarcate **what AI can safely build** versus **where experienced human cryptographers are non-negotiable**.

```mermaid
graph TD
    subgraph 🟢 AI Autonomous Capabilities
        A1[Frontend UI Layouts & Tailwind Styles]
        A2[SQLite Schemas & Local Migrations]
        A3[REST API Routes in Hono.js]
        A4[Export Parsers: JSON to Markdown / PDF]
        A5[Unit Tests & Standard Test Vectors]
    end

    subgraph 🔴 Mandatory Human Security Verification
        H1[Cryptographic Nonce & Memory Zeroization Audit]
        H2[Race Condition Review in Multi-Tab OPFS Locks]
        H3[Third-Party npm Dependency Supply-Chain Audit]
        H4[Android Keystore / iOS Keychain Hardware Binding]
        H5[Formal Threat Model & Penetration Testing]
    end
```

### What AI Agents Can Realistically Code (🟢 80% of Development):
* Modern React/Tailwind UI layouts, responsive Day/Night themes, and rich text editor toolbars.
* SQLite schemas, IndexedDB/OPFS abstraction layers, and local CRUD state pipelines.
* Standardized Cloudflare Workers routes, D1 database queries, and R2 file upload wrappers.
* Unit test suites asserting RFC test vectors for Argon2id and AES-GCM.
* Markdown and PDF generation for diary exports.

### What STRICTLY Requires Experienced Human Security Review (🔴 20% Non-Negotiable):
1. **Cryptographic Memory Management:** Verifying that key handles are genuinely non-extractable and that JavaScript garbage collection has not left plaintext byte slices in heap memory.
2. **Timing Attack & Side-Channel Analysis:** Ensuring password-derived token comparisons use constant-time operations (`crypto.subtle.timingSafeEqual`).
3. **Supply-Chain & Dependency Hardening:** Auditing package manifests, lockfiles, and transitive dependencies to prevent malicious code injection.
4. **Native Mobile Keystore Boundaries:** Confirming that `FLAG_SECURE` is properly respected across different OEM Android skins (Xiaomi MIUI, Samsung OneUI, OnePlus OxygenOS) and that biometrics cannot be bypassed via root hooks.
5. **Independent Formal Penetration Testing:** Human ethical hackers actively attempting to intercept API traffic, forge authentication tags, and reverse engineer compiled bundles.
