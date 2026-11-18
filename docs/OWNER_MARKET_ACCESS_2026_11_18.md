# Owner access and private market data

Prepared 18 November 2026 for the investment platform at `invest.nortivo.no`.

## Resulting behavior

- A verified, operator-provisioned owner account receives Terminal Pro features without a Nortivo subscription or fabricated payment period.
- Owner AI requests have no monthly Nortivo request/token allowance. Actual provider funding, per-request size bounds, metering, idempotency, authentication and technical request limits still apply.
- Other accounts retain their original subscriptions, quotas and permissions. Request bodies, email addresses, client storage and billing metadata cannot grant ownership.
- The owner's market search, quote, chart, portfolio and daily-research paths use the shared Nortivo Data implementation with Alpaca IEX. The browser receives dated results through the existing same-origin authenticated terminal endpoint; it receives no provider keys.
- The interface identifies the owner and the single-venue IEX source in English and Norwegian. Unknown stock-versus-ETF metadata is preserved as `stock_or_etf`, not guessed.
- These credentials do not enable order submission. Existing broker authorization, MFA, release, risk and execution gates remain separate.

## Private source scope

The free paper-account market feed has been verified for private owner use. It is not consolidated US pricing or volume, an NBBO service, a complete research database, or an authorization to redistribute data to paying/public users. Public/customer provider permissions remain closed until separately established. Cross-currency live valuations remain partial until an FX source is configured.

The staged integration received a real current NVDA IEX quote through the product adapter, 500 one-minute candles and 999 completed adjusted daily bars. Exact trade and receipt timestamps, listing MIC, adjustment basis and source coverage are retained. Backtests use the available source page and explicitly do not claim complete or survivorship-free coverage.

## Configuration and account provisioning

Direct protected environment values `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` take precedence. Alternatively, the protected production environment variable `PRODUCT_OWNER_MARKET_ENVELOPE` holds the compact JSON envelope produced by `sealRuntimeValue(value, env, 'owner-market-v1')`, where the private plaintext value has `keyId` and `secretKey`. The existing protected `PRODUCT_ENCRYPTION_KEY` is required to open it; a domain-separated HKDF key and AES-256-GCM keep market credentials separate from existing MFA encryption. Neither plaintext credentials nor credential-derived sealed modules are published in the source repository. The master and initial login material also remain private. The live environment overlay preserves subsequent security-policy changes rather than copying stale administrator settings.

The temporary bootstrap function reads only the protected production environment variable `PRODUCT_OWNER_BOOTSTRAP_ENVELOPE`, containing compact JSON from `sealRuntimeValue(configuration, env, 'owner-bootstrap-v1')`. Both envelope values have the shape `{version:1,purpose,salt,iv,ciphertext,tag}` and must be saved as protected runtime configuration, not public build/browser values. The two purposes are distinct; malformed JSON, a wrong purpose or a missing master fails closed. A partial explicit Alpaca key pair is never combined with an older envelope's other half.

The owner grant is persisted in the owner's server account record as `access`, including its operator provenance and timestamp. Normal login and any existing MFA remain required. A pre-existing verified account retains its password, MFA, billing and records; an unverified or incomplete pre-existing identity is not silently promoted.

If no matching identity exists, a new owner identity is created using the normal scrypt password hash and a cryptographically random initial password held only in private local delivery storage. A short-lived, fixed-identity, 256-bit-header-authorized provisioning endpoint atomically commits the identity/grant, permanent one-use receipt and audit. It accepts no client-selected role, email or password. Refresh an expired bootstrap authorization only before the first successful provisioning attempt, preserving its fixed identity and private token; do not use refresh to override or re-grant an already provisioned account. Remove the temporary endpoint and clear `PRODUCT_OWNER_BOOTSTRAP_ENVELOPE` after provisioning is verified; retain the permanent receipt and audit.

## Release boundary

The release snapshot starts from the published production commit and includes only this owner/data work. Concurrent unpublished security, support and administration changes in the shared working tree are preserved and excluded from this publication. The existing report, public company identity, pricing and customer records are retained.

Publication evidence and the actual owner-provisioning result are recorded after the hosted checks complete. Fixture tests do not prove a production account exists or that an external service is connected.
