# 🧭 FrankDiary: Project State & Context Handoff for New Session
## Instant Zero-Loss Resumption Anchor

> **Project Identity:** FrankDiary (`dairy.frankbase.com` / `frankdiary.pages.dev`)  
> **Repository Location:** `D:\01_Websites_and_Content\MMY_Website_Project\Diary`  
> **GitHub Remote:** `https://github.com/Mastermanikant/diary.git`  
> **Live Production Edge:** `https://frankdiary.pages.dev`  
> **Central Command Database:** Cloudflare D1 `mmcentral-db` (`c5a92a6e-b2b8-4d83-a814-2ff2c300f52a`)  
> **Founder:** Master Manikant Yadav (मास्टर मणिकान्त यादव)  
> **Full Chat History Export:** `COMPLETE_CHAT_CONVERSATION_HISTORY_A_TO_Z.md` (323 KB, 26 User Turns)

---

## 🔒 1. Core Cryptographic Invariants & Rules

1. **100% Zero-Knowledge Client-Side Encryption:**
   - WebCrypto API (AES-256-GCM + PBKDF2-120,000 iterations).
   - Plaintext NEVER leaves the user's browser/phone.
   - The server stores only blind encrypted ciphertext (`encrypted_data`, `encrypted_nonce`).
2. **Rule 14 Adherence (100% Truth & Transparency):**
   - Zero fabricated reviews, fake countdowns, or artificial pain points.
   - Any architectural hypothesis from AI must be labeled `[एआई द्वारा सुझाव / AI Proposal]`.
3. **Plausible Deniability Invariant:**
   - Entering Primary PIN opens Secret/Personal Vault.
   - Entering Family/Decoy PIN opens Decoy/Family Vault.
   - Single input box on lock screen. ZERO dropdown, ZERO counters, ZERO hints of hidden vaults.
4. **Natural Diary Principle:**
   - What you write on paper cannot be erased into nothingness.
   - Edits preserve original words/sentences in the background with footnote superscript badges `word^[N]`.

---

## ✅ 2. What is 100% Implemented & Deployed (Current Live State)

| Feature | Implementation File | Status |
| :--- | :--- | :--- |
| **Offline-First Storage** | `src/storage/localVault.js` (IndexedDB) | 🟢 100% Live |
| **WebCrypto E2EE Engine** | `src/crypto/vaultCrypto.js` (AES-256-GCM) | 🟢 100% Live |
| **Time-Based Single-User ZK Sync** | `functions/api/sync.js` + `src/storage/syncEngine.js` | 🟢 100% Live |
| **Dual-Mode Data Download** | `src/components/BackupModal.jsx` (.fbe + .json/.md) | 🟢 100% Live |
| **Read-Only Protected Freeze Mode** | `src/components/DiaryEditor.jsx` (Anti-Palm Touch) | 🟢 100% Live |
| **Sensitive Page Shield** | `src/components/EntryList.jsx` (`blur(7px)` filter) | 🟢 100% Live |
| **Plausible Deniability Decoy Vault**| `src/components/LockScreen.jsx` & `SettingsModal.jsx` | 🟢 100% Live |
| **Cursive Handwriting Typography** | `Kalam` & `Caveat` Google Fonts + Editor Toggle | 🟢 100% Live |
| **4 Multi-Vault Notebooks** | Personal, Work, Confidential, Health & Reflections | 🟢 100% Live |
| **Dynamic Tag Chips Filter** | `src/components/EntryList.jsx` (Client-side RAM filter) | 🟢 100% Live |

---

## ⏳ 3. Next Immediate Phase Priorities (To Code Upon Resumption)

1. **Natural Diary Footnote Revision Tracker (`word^[N]` / `image^[5]`):**
   - Word/sentence-level modification tracker.
   - Appends superscript badge `^[N]` on the modified word/phrase with a gentle soft highlight.
   - **Smart Floating Popover:** Clicking `^[N]` or the word reveals:
     - v1 (Original word/phrase + timestamp)
     - v2 (First edit + timestamp)
     - v3 (Current word/phrase)
     - "Restore to Original" button.
2. **Multi-Profile & Unlimited Untraceable Diaries Architecture:**
   - Profile selection / Device profiles (User A, Family Member, Child/Shared).
   - Under any profile, allow creating *unlimited independent encrypted diaries*, each with its own secret key/verifier.
   - Single PIN entry evaluates against candidate verifiers locally in constant time.
   - Optional "खुली साझा डायरी (Unencrypted / Shared)" choice.
3. **Local Autosave (IndexedDB 1.5s Debounce)** + Manual Sync trigger.

---

## 📁 4. Project Directory Map

```
D:\01_Websites_and_Content\MMY_Website_Project\Diary\
├── COMPLETE_CHAT_CONVERSATION_HISTORY_A_TO_Z.md   (Complete full conversation export)
├── PROJECT_STATE_FOR_NEW_THREAD.md               (This master resumption anchor)
├── project_map.json                              (Local metadata & build status)
├── wrangler.toml                                 (Cloudflare Pages & D1 binding)
├── functions/
│   ├── api/sync.js                               (Cloudflare Pages ZK sync API)
│   └── schema.sql                                (D1 database schema)
├── research/
│   ├── user_research/                            (Comprehensive market & pain research)
│   │   ├── 00_MASTER_DIARY_USER_RESEARCH_AND_PAIN_POINTS_COMPENDIUM.md
│   │   ├── 05_multi_password_deniability_and_real_world_pains_database.md
│   │   └── 06_current_apps_vs_frankdiary_pros_cons_painpoints_matrix.md
├── src/
│   ├── App.jsx                                   (Main router & state controller)
│   ├── crypto/
│   │   ├── vaultCrypto.js                        (WebCrypto AES-256-GCM + PBKDF2)
│   │   └── frankpassSdk.js                       (Deterministic SDK)
│   ├── storage/
│   │   ├── localVault.js                         (IndexedDB persistent storage)
│   │   └── syncEngine.js                         (Single-user LWW sync engine)
│   ├── components/
│   │   ├── LockScreen.jsx                        (ZK single-input lock & verifier)
│   │   ├── DiaryEditor.jsx                       (Cursive writing canvas & freeze lock)
│   │   ├── EntryList.jsx                         (Shielded timeline & tag filters)
│   │   ├── SettingsModal.jsx                     (Decoy setup & preferences)
│   │   ├── BackupModal.jsx                       (Dual-mode export & restore)
│   │   └── SyncModal.jsx                         (Cloud sync control)
│   └── styles/
│       └── theme.css                             (Day/Night WCAG 2.1 AA styles)
```

---

## 💬 5. How to Prompt in the New Chat Thread

Simply paste this prompt in your new chat session:
```
"हम FrankDiary प्रोजेक्ट पर काम कर रहे हैं। 
कृपया D:\01_Websites_and_Content\MMY_Website_Project\Diary\PROJECT_STATE_FOR_NEW_THREAD.md को पढ़कर तुरंत प्रोजेक्ट का कॉन्टेक्स्ट लोड करें और हमारे तय प्लान के अनुसार Natural Diary Footnote Revision Tracker (word^[N]) और Multi-Profile Unlimited Hidden Diaries की कोडिंग शुरू करें।"
```
