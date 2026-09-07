# 🧩 FrankDiary Modular Architecture: Offline, Online, Hybrid & Zero-Knowledge AI Isolation

**Document ID:** ARCH-FD-MODULAR-004  
**Author:** Master Manikant Yadav (FrankBase Ecosystem)  
**Date:** September 2026  
**Guiding Manifesto:** *"The best diary is not the one with the most features. The best diary is the one that bends completely to the user's needs—allowing them to choose 100% Offline, 100% Cloud, or a Hybrid blend, with or without AI, with zero server compromise."*

---

## 1. The 3 Architectural Deployment Modes

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE 3 CORE MODULAR MODES                               │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│   MODE A: PURE OFFLINE   │    MODE B: PURE CLOUD       │     MODE C: HYBRID BLEND      │
│      (AIR-GAPPED)        │         RELAY               │       (DEFAULT & BEST)        │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ • Zero network packets   │ • Thin client               │ • Offline-first IndexedDB     │
│ • Single-file HTML/PWA   │ • Instant multi-device sync │ • On-demand background sync   │
│ • Data stays 100% on disk│ • Zero local storage burden │ • Works on airplane or tunnel │
│ • Target: Paranoiacs,    │ • Target: Active switchers, │ • Auto-pushes when online     │
│   Lawyers, Dissidents    │   Multi-device writers      │ • Best of both worlds         │
└──────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

### Mode A: 100% Pure Offline Air-Gapped Edition
* **Target Audience:** Journalists, whistleblowers, lawyers, defense personnel, and extreme privacy advocates.
* **Mechanism:**
  - Can be downloaded as a single standalone HTML bundle (`FrankDiary_Offline.html`) or installed PWA with network disabled.
  - The Service Worker blocks all outbound HTTP/WebSocket requests.
  - All encryption keys and ciphertext exist strictly in the user's browser IndexedDB / LocalStorage / OPFS (Origin Private File System).
  - **Guarantee:** Even if the user is connected to public Wi-Fi, not a single byte of telemetry or data leaves their machine.

### Mode B: Pure Cloud Relay Edition
* **Target Audience:** Users with low-storage devices or public/shared Chromebooks who want instant access from any browser without leaving residual traces on the local computer.
* **Mechanism:**
  - Entries are decrypted in browser RAM upon passphrase entry.
  - On closing the tab, local RAM is immediately zeroized (`zeroize(buffer)`), leaving no unencrypted history on the physical disk.
  - Encrypted blobs reside on Cloudflare D1 edge.

### Mode C: Hybrid Autonomous Blend (Our Flagship Paradigm)
* **Target Audience:** 95% of daily journalers.
* **Mechanism:**
  - Instant 0ms write latency to local IndexedDB.
  - If device has internet, background worker silently pushes delta ciphertext to Cloudflare D1.
  - If device is on an airplane, writing continues seamlessly. Upon landing, delta updates automatically sync in the background.

---

## 2. The AI Architecture Dilemma: Without AI vs. With AI

The journaling community on Reddit universally hates forced AI intrusions because current apps (Day One, Reflectly) send private journal text to OpenAI or Google Gemini cloud servers, reading users' confessions.

**FrankDiary's Philosophy:**
1. **Default State:** 100% Pure & AI-Free.
2. **Future State:** Strict Zero-Knowledge AI Isolation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                 ZERO-KNOWLEDGE AI ISOLATION MODEL                     │
└────────────────────────────────────────────────────────────────────────┘

  [Local Encrypted Diary DB]
               │
               ▼ User explicitly asks: "Summarize my mood in August"
  [Client-Side WebCrypto RAM]
               │
               ├─► Decrypts ONLY relevant entries into ephemeral RAM
               │   (Never touches physical disk unencrypted)
               │
               ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                    TWO ZERO-KNOWLEDGE PATHWAYS                     │
  ├─────────────────────────────────┬──────────────────────────────────┤
  │   PATHWAY 1: LOCAL IN-BROWSER   │   PATHWAY 2: USER'S OWN LLM      │
  │        WEB-LLM (WEBGPU)         │         (BYOK - E2EE)            │
  ├─────────────────────────────────┼──────────────────────────────────┤
  │ • Phi-3 / Gemma-2B running in   │ • Direct HTTPS to OpenAI/Anthropic│
  │   browser memory via WebGPU.    │   using USER'S private API key.  │
  │ • ZERO network requests!        │ • BYPASSES FrankBase servers.    │
  │ • 100% offline intelligence.    │ • Developer / Owner sees 0 data. │
  └─────────────────────────────────┴──────────────────────────────────┘
```

### Key Security Invariants of the Future AI Engine:
1. **Zero Developer / Owner Access:** Neither Master Manikant Yadav nor any FrankBase engineer can ever view, intercept, or train models on user entries.
2. **Ephemeral RAM Projection:** AI context is generated on-the-fly in device RAM and wiped immediately after response.
3. **No Passive Ambient Scraping:** The AI never scans the diary in the background. It only runs when the user explicitly triggers an action (e.g. `[✨ Generate Monthly Reflection]`).
