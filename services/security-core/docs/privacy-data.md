# Privacy and data protection

Nortivo KORVNT local integration work, 18 November 2026. No production data was exported, re-encrypted, deleted or migrated. No account, secret-manager, hosting or database setting was changed. This document describes technical scope and operating responsibilities; it does not establish regulatory compliance.

## Data and responsibility boundaries

| Data | Current source behavior | Nortivo responsibility | External dependency / remaining work |
| --- | --- | --- | --- |
| Account passwords | Salted Node scrypt digests; raw password is used during authentication, not stored as the password record | Enforce bounded inputs, current authentication policy, secure recovery and session revocation | Hosting transport/runtime and database access/configuration must be verified separately |
| Product session and recovery credentials | Random raw bearer token in the browser/email flow; server stores its hash and expiry | Issue, validate, expire and revoke current sessions; never log raw credentials or token-bearing URLs | User devices/mailboxes hold bearer credentials; provider account controls remain outside this module |
| MFA secrets | Existing `mfa.mjs` seals TOTP secrets with AES-256-GCM bound to owner identity; recovery codes are hashed | Protect encryption roots, require appropriate step-up and preserve recovery/replay rules | Existing format remains unchanged; key custody/recovery and rotation need separate evidence |
| Broker access tokens | Existing `broker.mjs` seals OAuth token data using AES-256-GCM bound to owner, connection and mode | Keep provider tokens server-only, enforce owner/session/consent and live-trading gates, revoke at the provider when needed | Broker authorization and provider state remain authoritative; existing ciphertext was not migrated |
| Portfolios, transactions and account settings | Server-side owner checks and service-role database operations; not all fields have application-level encryption | Prevent cross-account reads/writes; minimize exports and metadata; retain transaction/idempotency rules | Database encryption at rest, backup security and production policy are provider/configuration dependencies, not proven here |
| Support identity and messages | Support Function to database; ticket confirmations/replies also pass through email provider and configured mailbox | Verify ticket proof/admin permission; limit message access; avoid content in security logs | Delivery and mailbox access are external boundaries; no automatic customer-message encryption migration was performed |
| Billing identifiers | Stripe-hosted checkout/portal, signed webhook processing, customer/subscription identifiers retained by Nortivo | Verify owner/mode/signature and minimize stored payment metadata | Stripe handles payment input; Nortivo does not gain protection merely by showing a security badge |
| Security events | Core logger uses a strict field allowlist and HMAC pseudonyms for actor/client IDs | Restrict access, define justified retention, exclude bodies/cookies/credentials, investigate events | Pseudonyms remain linkable data; durable sink, retention enforcement and notification delivery require operational verification |

## Combined review data path

The KORVNT standalone service has a separate guest identity and cookie, dedicated server function, four independent `korvnt_*` namespaces and separate `KORVNT_VAULT_KEYS` ring. Its encrypted context includes the daughter-company purpose. A Nortivo record predating this boundary stays in its original `workflow_*` namespace with its original record/owner/purpose. The server recognizes the company from the configured function and trusted host, and ignores customer-provided company claims. The parent-company operator site uses a distinct KORVNT inbox endpoint and additional current UUID grant as well as named MFA. Guest session expiry and logout end that browser credential. A retained reference and private proof may still reveal the enquiry status and follow-ups. Document the lifecycle of the tracking proof when deleting a case. The five-service intake has no evidence uploads. [Workflow data and roles](../../../docs/WORKFLOWS.md)

The workflow repository in `netlify/conversations/model.mjs` seals new transcript entries, message indexes, request briefs and idempotency receipts before sending a version-checked write to the product store. Each envelope binds its namespace, immutable database owner and record key. The handler authenticates the caller, applies the conversation's current subject/claim policy and returns only authorized fields. The database can still see namespace, record key, storage owner, ciphertext length, version and indexing metadata. A claim can change the authorized subject while preserving the original cryptographic owner.

Configure `WORKFLOW_VAULT_KEYS` with a protected JSON map of key IDs to standard-base64 32-byte random keys. `WORKFLOW_VAULT_CURRENT` selects the key used for new writes. Missing keys or failed authentication of an envelope return a bounded error. Tracking credentials and customer text belong outside logs. The new workspace records follow-up state locally. Legacy ticket mail, portfolio rows and unrelated applications retain their existing data formats. Server-side decryption supports delivery to an authorized customer or operator.

For a reviewed rotation, provision a new key in the existing ring and choose its ID for new writes. Enumerate workflow namespaces using service-role access in the approved environment. Authenticate each existing envelope under its stored owner, key and namespace, then use the product transaction to compare and swap its version with the resealed envelope. Retry conflicts from a fresh read. Verify counts and a new-key-only read in an isolated restore. Retain earlier keys until every required backup and the approved rollback horizon have been accounted for. No rotation or production backfill ran in this review.

## Reusable data vault

`netlify/security-core/vault.mjs` supplies a separately tested application-data encryption primitive for the new workflow records and future field migrations. It uses Node's AES-256-GCM implementation, a fresh 96-bit random nonce for each seal, a 128-bit authentication tag and versioned envelopes. The exact purpose, owner and record identity are authenticated, along with the key ID and format version. Copying a ciphertext to another owner, record or purpose causes a generic failure.

The API accepts a server-only named key ring with a current key ID. Every key must be a canonical standard-base64 encoding of exactly 32 random bytes. The ciphertext envelope stores only a key ID, nonce, tag and ciphertext; it never contains the key. Use independently generated application keys from the approved secret manager. Keep key material out of browser bundles, database rows, audit metadata, source control and this documentation.

```javascript
import { createDataVault } from './netlify/security-core/vault.mjs';

// Inject these values from server-managed configuration; no usable key is shown here.
const vault = createDataVault({
  keys: serverKeyRing,
  currentKeyId: activeServerKeyId
});

// Obtain owner and record identity from the verified actor / authorized database row.
const scope = { purpose: 'private-note', ownerId: verifiedUser.id, recordId: storedRecord.id };
const envelope = vault.seal({ note: validatedNote }, scope);
const original = vault.open(envelope, scope);
```

The caller must enforce authorization before decryption and owner/version checks when persisting the envelope. Encryption is not an access policy. Avoid putting fields needed for database selection into plaintext merely for convenience without assessing the exposure. Prefer a narrow, explicit field migration to encrypting entire business records blindly.

`reseal(oldEnvelope, sameScope)` verifies and decrypts through a retained old key and creates a new envelope under the configured current key. It returns a value; it does not write to storage. During a reviewed rotation, retain the old key until every required record and retained backup is accounted for, persist with compare-and-swap/version checks, test the new key-only read path, and only then retire the old key according to the recovery plan. A failed rotation must not silently discard the old envelope.

This utility does not automatically encrypt existing customer rows, replace current MFA/broker formats, implement key-management infrastructure, provide end-to-end encryption or protect against an attacker who controls the running server and its keys. Adding application-level encryption to an existing field requires an explicit compatibility, search/indexing, backup and recovery migration. That production migration remains pending.

## Collection, export, deletion and retention

Collect only the identity, contact and financial records required for the stated product function. Do not include account passwords, raw bearer tokens, broker secrets, customer messages or unrestricted financial exports in general security events. Report drafts and test fixtures must use synthetic values. The preview report builder prepares a local draft and does not submit it.

The existing account service supports viewing/revoking sessions and records an account-deletion request. That request is explicitly `review_required` and states that records remain retained; it is not an immediate erasure operation. The current manual portfolio export is owner-scoped and returns the portfolio and summary without fetching fresh prices. Verify the complete export, billing/broker dependencies, required retention and backup lifecycle before fulfilling an account-data request. Do not promise deletion from immutable provider backups or retained business records without a verified process.

The operating guide's proposed security-log retention and recovery objectives are proposals until configured and tested. Record purpose, data class, system owner, access policy, retention decision and operational deletion/backup behavior before introducing a new protected dataset. Changes to customer-data use or sharing need a product/privacy decision; this vault does not manufacture consent or change the published privacy policy.

## Provider and release checks

No current provider security setting or production encryption-at-rest policy was inspected in this task. Verify hosting/database TLS, identity access, service-role key scope, protected logs, backup encryption, restore capability, secret rotation and provider access before stronger public claims. Restrict outbound providers and keep credentials server-side. Never interpret a “Secured by KORVNT” mark as proof that all data has application-level encryption or that providers are independent of Nortivo's responsibility.

`node services/security-core/scripts/privacy-check.mjs` checks the local publish tree for private/server directories, sensitive filenames, links and selected credential markers in textual website assets. It reports relative paths and finding classes only. Binary content, arbitrary credential formats, actual hosted files and provider database policies need separate review.

Relevant verification is in `tests/security-core-vault.test.mjs`: authenticated round trips, ciphertext/metadata tampering, cross-owner/purpose/record swaps, wrong keys, independent nonces, key rotation, strict configuration and bounded JSON. Production release remains pending owner approval and integration evidence.
