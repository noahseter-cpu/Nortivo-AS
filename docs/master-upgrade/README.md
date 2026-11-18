# Initial review — superseded

The completed approved-design/KORVNT.no revision is documented in [the current review](README_V2.md). The material below records the earlier 18 November baseline; its canonical-domain decisions and verification counts are historical.

This combined candidate is implemented in the isolated `codex/nortivo-master-local-review` worktree. It starts from published revision `40c8789616a9f23c1f2e769496c79f33e012af07` and reconciles the unpublished KORVNT, administration and workflow work. The original working directory and its concurrent changes remain intact. **Nothing has been pushed or published.**

## Open the local review

- [Company](http://nortivo.localhost:4490/en/) · [Norsk](http://nortivo.localhost:4490/nb/)
- [Nortivo Invest](http://invest.localhost:4490/en/) · [Norsk](http://invest.localhost:4490/nb/)
- [Terminal](http://invest.localhost:4490/en/terminal/) — normal account entry or explicitly read-only sample.
- [KORVNT Security](http://security.localhost:4490/en/) · [Norsk](http://security.localhost:4490/nb/)
- [Prepared alias preview](http://korvnt.localhost:4490/nb/#controls)
- [Protected local administration](http://nortivo.localhost:4490/en/admin/)

The loopback server uses separately generated synthetic identities, a persistent isolated SQLite database, private vault keys and local notification capture. Its providers are deliberately disconnected. Real API credentials, production databases and external email are not used. The private fixture credentials are stored under `.local/master-preview/fixtures-v1/credentials.private.json` in this worktree; never copy that file into source or publication output. These are review accounts, not the live administrator's credentials. Recovery codes are single-use; the remaining codes or the fixture authenticator can be used for normal local login.

If the server is stopped, run `node scripts/preview-master.mjs --fixtures --port 4490` from this worktree. Keep the private fixture directory to retain review history. The server listens only on loopback and refuses a production runtime. It does not impersonate provider availability. No legacy email ticket is sent in review; the company support page directs visitors to the functioning Invest conversation and identifies the disconnected email option.

## What changed

The company keeps investment research, guides, systems and its unchanged trading report prominent. Invest now has a separate bilingual public homepage, complete reference enlargement, actual plan catalog/readiness, service pages, a four-stage project workspace and persisted two-way support. Named administrators use verified accounts and current MFA to manage those conversations and requests. The exact supplied Nortivo symbol is integrated through company, Invest, account and terminal surfaces. The terminal's reference composition is retained.

The existing KORVNT subproject is connected to application handlers, private workflow records, authorization, rate limits, audit events and the tested vault. It has a dedicated bilingual site and prepared canonical/alias routing. The visible qualification remains In development. No name clearance, certification, continuous monitoring or universal data encryption is asserted.

## Review documents

1. [Step-by-step implementation plan](PLAN.md)
2. [Coverage and status by surface](COVERAGE.md)
3. [Actual browser observations and limitations](BROWSER_REVIEW.md)
4. [Operations, provider requirements, costs and maintenance](OPERATIONS.md)
5. [Preliminary name checks](NAMING.md)
6. [Unexecuted release gates and rollback](RELEASE_CHECKLIST.md)
7. [Current security verification evidence](../../services/security-core/evidence/integration-verification.json)
8. [Workflow implementation and prepared database migration](../WORKFLOWS.md)

The private review manifest at `.local/master-preview/evidence/candidate-files.json` records 293 candidate application/configuration files. It also confirms byte-identical supplied artwork/reference, unchanged report PDF and original structured report data (checkout line endings normalized for text), and the unchanged remote baseline. It contains file hashes, not credential values. It is evidence for this review, not a deploy command or authority to release.

Production activation requires separate approval after this combined review. The historical 49-file owner release is **not** this combined artifact and must not be used to publish it. No consumed owner-provisioning endpoint has been restored. Existing market licenses and missing provider, staffing, key-custody, retention, hosted-MFA and recovery requirements are documented rather than bypassed.
