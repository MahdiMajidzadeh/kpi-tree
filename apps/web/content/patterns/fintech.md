---
archetype: fintech
title: Fintech
version: 1
---

# North Star candidates

- **Weekly transacting users** — `Users completing ≥1 money movement / week`. Habit-centric; the standard for payments/wallets.
- **Total payment volume (TPV)** — `Sum of transaction value`. Scale-centric; whale-sensitive.
- **Net revenue** — `Take rate × TPV + float/interest − losses`. Honest but very lagging.

# Canonical decomposition

- Net revenue = TPV × Blended take rate − Risk losses *(additive/multiplicative mix — keep explicit)*
  - TPV = Transacting users × Transactions per user × Average transaction value *(multiplicative)*
    - Transacting users = New activated + Retained transactors *(additive)*
      - New activated = Signups × KYC pass rate × First-transaction rate *(multiplicative)*
  - Risk losses = Fraud losses + Credit losses + Chargebacks *(additive)*
- Trust branch *(influence into retention)*: transaction success rate, dispute resolution time, app reliability

# Standard counter-metrics / guards

- TPV growth guarded by **fraud loss rate (bps of TPV)** — non-negotiable in fintech.
- Onboarding conversion guarded by **KYC false-accept rate / compliance flags**.
- Credit expansion guarded by **NPL / default rate**.
- Payment success optimization guarded by **chargeback rate**.

# Common mistakes

- No risk/loss branch at all — the single most common and most fatal omission.
- KYC funnel missing between signup and first transaction.
- Average transaction value optimized without a fraud guard (large transactions correlate with fraud).
- Treating regulatory metrics as optional tags rather than guard nodes.

# Leading indicators worth having

KYC pass rate, first-transaction latency (time from signup), transaction success rate, fraud model precision drift, support ticket rate per 1k transactions.
