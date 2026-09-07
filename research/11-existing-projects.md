# 11. Analysis of Existing Projects & Open-Source Ecosystem Foundations

## 1. "Does Something Similar Already Exist?" — The Three-Mode Gap

The user specifically asks:
> *"Does a product already exist that simultaneously provides: (1) Fully offline diary without accounts, (2) Encrypted portable export/import files, and (3) Optional E2EE cloud synchronization?"*

### Market Gap Analysis:
* **Standard Notes:** Requires creating an account even to use the local app effectively. Exporting is complex; cloud sync is tightly coupled; price is steep ($90/year).
* **Obsidian:** Excellent offline markdown files, but no native single-file authenticated encrypted container (`.fbe`). Official E2EE sync requires a paid subscription ($48–$96/year), and the core client is proprietary closed-source.
* **Notesnook:** Excellent E2EE and open source, but designed primarily as an Evernote/Notion replacement (notebooks, nested notes, code blocks). It lacks dedicated daily diary workflows (calendar-based date journaling, mood logging, daily prompt reflections, photo memories).
* **Apple Journal:** Locked strictly to iOS; no export feature; no Windows or Android support; zero user key ownership.
* **Joplin:** E2EE is not enabled by default; sync setup with WebDAV/Nextcloud is technical and brittle for mainstream users.

### The FrankDiary Unique Differentiation:
> **FrankDiary bridges this exact void:** A dedicated, beautiful daily journal that opens immediately into a 100% offline, account-free vault, allows single-click `.fbe` encrypted backup downloads, and offers a frictionless, affordable (\$2.99/mo) zero-knowledge edge sync when multi-device access is desired.

---

## 2. Evaluation of Open-Source Libraries & Reusable Foundations

Rather than re-inventing complex distributed synchronization and cryptographic primitives, FrankDiary can stand on the shoulders of mature, audited open-source building blocks:

### 1. Cryptography Primitives
| Project | License | Maintainer / Origin | Audit History | Suitability for FrankDiary |
| :--- | :--- | :--- | :--- | :--- |
| **W3C WebCrypto API** | W3C Standard | Native Browser Engines | Audited by Google, Mozilla, Apple | **Essential (Zero-Bundle Web Base)** |
| **@noble/ciphers & @noble/hashes** | MIT | Paul Miller (paulmillr) | Audited by Cure53 (2022) | **Primary TS Crypto Dependency** (Pure TypeScript, zero dependencies, supports Argon2, ChaCha20, Salsa20, Poly1305). |
| **Libsodium (libsodium.js)** | ISC | Frank Denis (jedisct1) | Audited by Cure53 & Private Internet Access | **Gold Standard Native Wrapper** |
| **SQLCipher** | BSD 3-Clause | Zetetic LLC | Audited by multiple defense & banking bodies | **Primary Native Mobile DB Engine** |

### 2. Local-First Databases & Sync Engines
| Project | License | Maintainer / Origin | GitHub Activity | Suitability for FrankDiary |
| :--- | :--- | :--- | :--- | :--- |
| **official sqlite3-wasm (OPFS)** | Public Domain | SQLite Development Team | Extremely active, integrated in browser standards | **Primary Web Local Storage Engine** |
| **Yjs** | MIT | Kevin Jahns | Active (Millions of weekly downloads) | **High Suitability for Rich Text CRDT Sync** |
| **Automerge** | MIT | Martin Kleppmann & Ink & Switch | Active (Rust core + JS bindings) | Excellent for distributed JSON tree merges |
| **RxDB** | Commercial / Core Apache 2.0 | Daniel Meyer | Very active | Complex licensing for premium plugins (avoid) |
| **WatermelonDB** | MIT | Nozbe | Active | Optimized for React Native SQLite sync |

### 3. Encrypted File Format Foundations
| Project | License | Maintainer | Key Features | Suitability |
| :--- | :--- | :--- | :--- | :--- |
| **age (FiloSottile/age)** | BSD 3-Clause | Filippo Valsorda (ex-Go crypto lead) | Modern, minimalist file encryption tool using X25519 & ChaCha20-Poly1305 | **Ideal reference specification for `.fbe` format design.** |
| **Pagecrypt** | MIT | Maximillian Schiller | HTML file client-side encryption | Good UX inspiration for standalone offline exports. |

---

## 3. Dependency vs. Fork Strategy

1. **Do NOT Fork Entire Monorepos:** Forking massive projects like Standard Notes or Notesnook creates an unsustainable maintenance burden of merging upstream changes.
2. **Modular Architecture via Audited Dependencies:**
   * Use `@noble/hashes` and `@noble/ciphers` (MIT license) as direct npm dependencies.
   * Use official `sqlite-wasm` via CDN / bundle for OPFS.
   * Write a clean, modular TypeScript sync client (~1,500 lines) implementing the FrankDiary protocol over Cloudflare D1/R2.
3. **Legal Reuse Verification:**
   * MIT, ISC, and BSD-3-Clause licenses allow commercial distribution, closed-source or open-source integration, with no copyleft contamination.
   * Avoid AGPLv3 dependencies in proprietary modules if a dual-licensing commercial strategy is pursued.
