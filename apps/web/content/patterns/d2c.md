---
archetype: d2c
title: D2C e-commerce brand
version: 1
---

# North Star candidates

- **Weekly orders** — volume-centric; clean for single-brand catalogs.
- **Contribution margin** — `Revenue − COGS − shipping − paid marketing`. Profit-centric; the honest choice post-ZIRP, harder to decompose for teams.
- **Repeat customer revenue share** — loyalty-centric; best when retention is the strategic battle.

# Canonical decomposition

- Revenue = Orders × AOV *(multiplicative)*
  - Orders = Sessions × CVR *(multiplicative)*
    - Sessions = Paid sessions + Organic sessions + CRM sessions *(additive)*
      - Paid: by channel with CAC per channel as guards
    - CVR: PDP→cart × cart→checkout × checkout→purchase *(multiplicative)*
  - AOV = Units per order × Average unit price *(multiplicative)*
    - Driven by bundles, cross-sell rate *(influence)*
- Retention branch *(influence into Orders)*: repeat purchase rate, email/SMS engagement, subscription attach rate
- Margin branch *(guard-heavy)*: contribution margin per order, return rate, discount depth

# Standard counter-metrics / guards

- Paid session growth guarded by **blended CAC** and **CAC payback**.
- AOV pushes guarded by **return rate** (bigger baskets return more).
- Discount-driven CVR guarded by **contribution margin per order**.
- Shipping speed promises guarded by **fulfillment cost per order**.

# Common mistakes

- Revenue tree with no margin/guard branch — growth that loses money on every order.
- Blended CAC hiding a dying channel behind a growing one — decompose by channel.
- Returns ignored entirely (they belong as a guard on both AOV and CVR pushes).
- Email list size as a metric instead of CRM-attributed sessions/orders.

# Leading indicators worth having

Add-to-cart rate, checkout error rate, inventory in-stock rate on top sellers, repeat-purchase cohort curves, email deliverability.
