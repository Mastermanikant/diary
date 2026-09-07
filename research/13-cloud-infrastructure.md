# 13. Cloud Infrastructure Evaluation & E2EE Cost Advantages

## 1. Cloud Architecture Options Comparison

| Infrastructure Model | Monthly Cost (Baseline) | Global Scalability | Zero-Knowledge Privacy Alignment | Maintenance Overhead | Engineering Complexity | FrankDiary Decision |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Traditional VPS (Hetzner / DO)** | \$5 – \$20 / mo | Poor (Single region, manual scaling, load balancers required) | High (Full OS control) | **Very High** (OS patching, SSH keys, backups, firewall configs) | Medium | ⚠️ Good for self-hosters; poor for global SaaS |
| **Managed Cloud (AWS / GCP)** | \$50 – \$300 / mo | Infinite | Moderate (Proprietary hypervisors, complex IAM) | Low to Medium | **High** (Massive AWS bill shock, complex VPCs) | ❌ High egress fees (\$0.09/GB) kill media sync margins |
| **BaaS (Supabase / Firebase)** | \$25 – \$100 / mo | Good | Poor (Firebase defaults to cleartext; Supabase postgres requires complex RLS) | Low | Low | ❌ Unnecessary compute overhead |
| **Serverless Edge (Cloudflare)** | **\$5 / mo (Workers Paid)** | **Instant Global** (330+ edge PoPs) | **Maximum** (Stateless V8 isolates, encrypted storage in D1/R2) | **Near Zero** (Managed edge) | **Low to Medium** | ✅ **PRIMARY ARCHITECTURE** |

---

## 2. The Cryptographic Asymmetry: Why E2EE Drastically Lowers Server Costs

In conventional web platforms (Notion, Evernote, Day One, Google Keep), the server performs heavy computational workloads:
1. **Server-Side Full-Text Indexing:** Parsing millions of words, generating linguistic stems, updating Elasticsearch/PostgreSQL inverted indexes ($O(N)$ CPU consumption).
2. **Server-Side Media Processing:** Generating thumbnail previews, running facial recognition or OCR, resizing JPEGs on cloud CPUs.
3. **Complex Relational Queries:** Running multi-table SQL joins, permissions parsing, and team collaboration graph calculations.

### The FrankDiary E2EE Superpower:
```
CONVENTIONAL SAAS:
[Plaintext Ingest] --> [Elasticsearch (Heavy CPU/RAM)] --> [OCR/AI (Heavy GPU)] --> [DB]
                                                                                
FRANKDIARY E2EE:
[Encrypted Blob Ingest] ---------------------------------------------------------> [D1 / R2 Storage]
(Zero CPU Parsing - Blind Storage Relay - Sub-5ms Execution Time)
```

In FrankDiary:
* **The server does ZERO computational parsing.** It receives an opaque binary payload, validates an authentication header in ~2ms, and stores the blob in D1/R2.
* **Client Silicons Bear the Compute Load:** Key derivation (Argon2id), encryption/decryption, full-text search indexing (MiniSearch), image compression (WebP canvas), and conflict resolution run on the **user's smartphone and laptop CPUs**.
* **Result:** A single \$5/month Cloudflare Workers subscription can easily handle millions of sync operations that would cost \$500/month on AWS EC2/RDS.

---

## 3. Recommended Cloudflare Edge Blueprint

1. **Routing & CDN:** Cloudflare DNS + Edge SSL (TLS 1.3, Strict HSTS, Encrypted Client Hello - ECH).
2. **Compute Layer:** Cloudflare Worker (`/api/v1/sync`) written in TypeScript with Hono.js:
   * Execution time: 1ms to 5ms per request.
   * Cold start: 0ms (V8 Isolate technology).
3. **Database Layer:** **Cloudflare D1**:
   * Global edge read replication with primary write consensus.
   * Schema:
     * `users`: `user_id` (UUID), `auth_hash`, `created_at`.
     * `vaults`: `vault_id`, `user_id`, `salt`, `wrapped_dek`, `schema_version`.
     * `sync_events`: `event_id`, `vault_id`, `device_id`, `lamport_clock`, `operation`, `ciphertext`, `auth_tag`, `server_timestamp`.
4. **Blob Storage:** **Cloudflare R2**:
   * Encrypted photo and audio attachments.
   * **Zero egress charges:** Download bandwidth is 100% free regardless of how many gigabytes users synchronize across multiple devices.
