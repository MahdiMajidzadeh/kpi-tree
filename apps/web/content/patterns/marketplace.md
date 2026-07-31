---
archetype: marketplace
title: Two-sided marketplace
version: 1
---

# North Star candidates

- **Weekly completed orders** — `Completed orders per week`. Volume-centric; great for growth stage, risks ignoring basket size and take-rate economics.
- **GMV** — `Orders × AOV`. Captures both volume and value; can hide unit-economics rot behind big baskets.
- **Weekly transacting users** — `Unique buyers with ≥1 completed order / week`. Habit-centric; best when repeat behavior is the battleground.

# Canonical decomposition

- GMV = Orders × AOV *(multiplicative)*
  - Orders = Sessions × Overall CVR *(multiplicative)*
    - Sessions: New sessions + Returning sessions *(additive)*
      - Traffic per channel (leading, actionable leaves)
    - Overall CVR: decomposes down the funnel *(multiplicative)* — search→PDP, PDP→cart, cart→checkout, checkout→payment success
  - AOV: Items per order × Average item price *(multiplicative)*
- Supply health branch *(influence into CVR and Sessions)*:
  - Active sellers, live listings per category, in-stock rate, price competitiveness index
- Repeat/retention branch *(influence into Orders)*:
  - Repeat purchase rate, time-to-second-order, buyer NPS (influence)

# Standard counter-metrics / guards

- Order growth guarded by **return/refund rate** and **order defect rate**.
- Delivery speed guarded by **delivery cost per order**.
- Take rate / monetization guarded by **seller churn** and **price competitiveness**.
- Promotion-driven GMV guarded by **contribution margin per order**.

# Common mistakes

- No supply-side branch at all — the tree reads like a pure e-commerce funnel; marketplaces die from supply gaps first.
- GMV decomposed additively by category only — hides the funnel levers.
- Counter-metrics missing on logistics speed pushes.
- Leaves like "conversion rate" with no further decomposition — non-actionable.
- NPS wired as a math edge; it is an influence relationship.

# Leading indicators worth having

Search null-result rate, PDP availability rate, checkout error rate, seller onboarding time, listing freshness, app crash rate on checkout path.
