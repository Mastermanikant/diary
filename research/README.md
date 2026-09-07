# FrankDiary Research Suite: Offline-First, Zero-Knowledge E2EE Personal Vault

**Working Domains:** `diary.frankbase.com` / `od.frankbase.com` / `ood.frankbase.com`  
**Founder:** Master Manikant Yadav  
**Organization:** FrankBase Ecosystem  
**Research Date:** September 2026  
**Status:** Comprehensive Pre-Engineering Feasibility & Threat Modeling Complete  

---

## 1. Executive Summary

This research repository contains an exhaustive, academically grounded, and mathematically qualified investigation into building a **world-class, offline-first, end-to-end encrypted personal diary and sensitive data storage system**.

The system fundamentally rejects traditional cloud surveillance models and key-escrow backdoors in favor of a mathematically verifiable zero-knowledge architecture where:
> **“Your data belongs to you. The server stores ciphertext, not readable personal information.”**

---

## 2. Research Deliverables Index (25 Comprehensive Documents)

```
research/
│
├── 01-product-overview.md              # Vision, core principles, three modes, and domain strategy
├── 02-threat-model.md                  # Formal STRIDE analysis, threat actors A-I, 10 qualification answers
├── 03-cryptography.md                  # Argon2id KDF, AEAD (AES-GCM / XChaCha20), envelope keys, WebCrypto
├── 04-security-architecture.md         # Zero-knowledge blueprint, RAM zeroization, server visibility matrix
├── 05-offline-architecture.md          # Local-first paradigm, SQLite WASM with OPFS, MiniSearch client FTS
├── 06-encrypted-export-import.md       # .fbe container spec, tampering checks, unencrypted Markdown export
├── 07-e2ee-cloud-sync.md               # Blind cloud relay, Lamport clocks, conflict copies, QR key linking
├── 08-metadata-privacy.md              # Traffic analysis defense, bucket quantization padding, blind tokens
├── 09-password-recovery.md             # 5 recovery cases, BIP-39 recovery phrases, O(1) envelope re-wrapping
├── 10-competitor-research.md           # 15-competitor comparison matrix, pricing teardowns, Skiff case study
├── 11-existing-projects.md             # Market gap analysis, Yjs/Automerge, libsodium, licensing audit
├── 12-technology-stack.md              # React 18, Vite, Tailwind, Tauri, SQLite OPFS, Cloudflare Workers/D1/R2
├── 13-cloud-infrastructure.md          # VPS vs AWS vs Cloudflare Edge, E2EE computational cost advantage
├── 14-cost-analysis.md                 # Real Cloudflare benchmarks, costs from MVP ($0.80) to 1M users ($645)
├── 15-development-estimate.md          # 18-module complexity breakdown, 19-week roadmap, AI vs human review
├── 16-security-audit.md                # Audit scopes, firm comparisons (Cure53, Trail of Bits, CERT-In), costs
├── 17-india-legal-compliance.md        # DPDP Act 2023, Section 2(t) ciphertext status, CERT-In 6-hour rules
├── 18-international-compliance.md      # EU GDPR, UK GDPR, CCPA/CPRA statutory breach safe harbor
├── 19-privacy-policy-requirements.md   # Transparent disclosures, zero-knowledge statements, legal contacts
├── 20-business-model.md                # 4-tier pricing model, Dodo Payments, LTV/CAC, 81.4% net margins
├── 21-market-analysis.md               # Market convergence, TAM/SAM/SOM ($5.2B TAM), 3 user personas
├── 22-roi-analysis.md                  # 3-year conservative, moderate, and aggressive financial models
├── 23-open-source-strategy.md          # Dual licensing (MIT + AGPLv3 + BSL), clone defense, reproducible builds
├── 24-mvp-roadmap.md                  # Lean MVP definition, deferred features, 8-phase milestone roadmap
├── 25-risk-register.md                 # 10-risk matrix, forgotten password defense, browser storage eviction
└── README.md                           # Master navigation index and executive decision summary
```

---

## 3. Core Architectural Highlights

| Dimension | Architectural Choice | Key Guarantee |
| :--- | :--- | :--- |
| **Key Derivation (KDF)** | **Argon2id** ($m=64\text{MB}, t=3, p=4$) | Maximum resistance against GPU/ASIC offline dictionary attacks. |
| **Authenticated Encryption** | **AES-256-GCM** (WebCrypto) / **XChaCha20-Poly1305** | Native hardware acceleration + immunity against nonce collisions. |
| **Envelope Encryption** | Master Key $\rightarrow$ KEK $\rightarrow$ Wrapped DEK | Instantaneous password updates in $< 300\text{ms}$ with zero re-encryption. |
| **Local Web Storage** | **Official SQLite WASM with OPFS** | True ACID transactions, private sandboxing, high disk quotas. |
| **Cloud Infrastructure** | **Cloudflare Workers + D1 + R2** | \$0 egress fees, global edge compute, $< 5\text{ms}$ cold starts, \$645/mo at 1M users. |
| **Data Portability** | **`.fbe` Binary Container + Plaintext Markdown ZIP** | Zero vendor lock-in; files remain readable in 20 years independently. |
| **Legal Compliance** | **DPDP Act 2023 & GDPR Art 34 Safe Harbor** | Leaked ciphertext does not trigger breach panic notices because data is unintelligible. |

---

## 4. The Decision: Should We Build This Product?

### **VERDICT: YES, ABSOLUTELY (PROCEED TO PHASE 1)**

FrankDiary addresses a profound emotional and technical need in personal computing: a dedicated private sanctuary where users can express their deepest thoughts without fear of cloud breaches, data harvesting, or company obsolescence. 

Because client-side zero-knowledge encryption offloads all heavy computation to user devices, **the business possesses an unprecedented 99.5% gross infrastructure margin**, making it an exceptionally resilient, high-profit addition to the FrankBase ecosystem.
