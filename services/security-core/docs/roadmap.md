# Roadmap and release gates

The initial integration work listed below is now prepared in local source: named MFA administration, revocable sessions, shared support limits, bounded upstream calls, account/trading bridges and safe access-decision logging. See [integration status](integration-status.md). The next steps are staging/production evidence and explicit deployment approval; nothing in this roadmap authorizes publishing or creating accounts.

## First integration: close the actual admin gaps

1. Keep this review release separate and resolve the preferred name. Review APP-01 through APP-05 with Noah.
2. Prepare staging identities for named administrators using maintained MFA. Map current identity and session-specific MFA evidence into KORVNT; verify disabled/expired users, copied/revoked cookies, password changes, recovery and privilege removal.
3. Reuse the shared atomic limiter for admin login and support/email abuse limits. Add edge-level request limits and provider spend monitoring. Test two independent runtime instances, outage behavior and distributed account attacks.
4. Add explicit abort deadlines, fixed HTTPS origins, redirect rejection and bounded/idempotent recovery to support database/mail calls.
5. Integrate attributable safe audit events for admin authentication, revocation, denials and ticket mutations. Test a durable sink, restricted retention and a real operational notification destination.

No production route, schema, DNS, account or worker change is performed by this package. Local review is authorized; live integration and deployment remain a separate approval.

## Release evidence

- Inventory every deployed endpoint, locale and direct Function URL; mark which control owns it. Reject unknown/private routes by default.
- Add authorization tests against the real staged repositories: user A versus user B, role removal, stale MFA, revoked copied session, missing resources, and concurrent ownership changes.
- Confirm shared rate-limit atomicity across instances and trusted client-IP provenance. Prove no fallback to per-instance memory when storage fails.
- Verify all response paths carry intended CSP/cache/cookie headers. Exercise signup, email/recovery, billing/OAuth and private content without broadening CSP or weakening existing guards.
- Complete a current advisory/secret scan and review package/build provenance. No new package requires installation for this review release.
- Verify report routing and actual triage ownership. The draft tool is not a monitored mailbox or submission service.
- Test alert delivery and an isolated backup restore including required encryption keys; record observed recovery times and any data loss.
- Approve cost/spend caps, human monitoring coverage, rollback plan and maintenance ownership.

## Later product work

After Nortivo's own integration is evidenced, consider scoped security source reviews, application hardening and maintenance plans for client-owned systems under an agreed scope. Build reusable provider adapters and explicit per-service assurance reports. Evaluate independent assessment before stronger public claims. A 24/7 SOC, endpoint antivirus, enterprise DDoS network and regulatory certification are not part of this first release.

## Badge decision

The current mark remains “Nortivo KORVNT — In development.” To activate “Secured by KORVNT,” record the deployed commit, exact applications/routes covered, controls, last review, unresolved limits and named owner. Link the badge to that factual scope page. Noah approves public integration after the staged evidence is reviewed. The badge must never imply blanket security or unverified independent certification.
