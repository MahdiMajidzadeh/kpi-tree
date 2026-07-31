---
archetype: saas
title: B2B/B2C SaaS
version: 1
---

# North Star candidates

- **Weekly active accounts doing the core job** — activity in the product's core workflow. Usage-centric; risks ignoring monetization.
- **Net MRR** — `New MRR + Expansion MRR − Churned MRR − Contraction MRR`. Money-centric; lags product health by months.
- **Activated teams per week** — for PLG motions where activation is the bottleneck.

# Canonical decomposition

- Net MRR = New MRR + Expansion MRR − Churned MRR *(additive)*
  - New MRR = New customers × ARPA *(multiplicative)*
    - New customers = Signups × Signup→paid CVR *(multiplicative)*
      - Signups: by channel *(additive)*, each a leading, actionable leaf
      - Signup→paid: activation rate × trial→paid rate *(multiplicative)*
  - Expansion MRR: seat expansion + plan upgrades *(additive)*
    - Driven by feature adoption depth, seat utilization *(influence)*
  - Churned MRR: logo churn × ARPA *(multiplicative)*
    - Driven by activation quality, support experience, weekly engagement *(influence)*
- Engagement branch *(influence into churn/expansion)*: WAU/MAU stickiness, core-action frequency, time-to-value for new users

# Standard counter-metrics / guards

- Signup growth guarded by **activation rate** (junk signups pollute everything).
- Expansion pushes guarded by **NPS / support ticket volume**.
- Discount-driven new MRR guarded by **net revenue retention**.
- Feature velocity guarded by **crash/error rates**.

# Common mistakes

- MRR decomposed only additively by plan — hides acquisition/activation levers.
- No engagement branch: churn appears in the tree with no leading drivers.
- "Churn rate" as a leaf — always decompose into its influence drivers.
- Counting trials as customers in the North Star.

# Leading indicators worth having

Time-to-first-value, onboarding completion rate, weekly core-action frequency, seat utilization, failed payment rate.
