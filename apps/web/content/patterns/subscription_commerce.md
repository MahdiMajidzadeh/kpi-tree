---
archetype: subscription_commerce
title: Subscription commerce
version: 1
---

# North Star candidates

- **Active subscribers** — `Subscribers with a live, paying subscription`. Simple and honest; hides basket/frequency economics.
- **Weekly delivered orders** — for box/replenishment models where delivery cadence is the habit.
- **Net subscription revenue** — `Active subscribers × ARPU − refunds`. Money-first; lags churn drivers badly.

# Canonical decomposition

- Net subscription revenue = Active subscribers × ARPU *(multiplicative)*
  - Active subscribers = Previous actives + New subscribers − Churned − Paused *(additive)*
    - New subscribers = Visitors × Trial start rate × Trial→paid rate *(multiplicative)*
    - Churned: decompose into voluntary vs involuntary (failed payments) *(additive)*
  - ARPU = Base plan price + Add-on revenue per subscriber *(additive)*
- Habit branch *(influence into churn)*: skip rate, box customization rate, first-box satisfaction, delivery-on-time rate

# Standard counter-metrics / guards

- New subscriber growth guarded by **first-90-day churn**.
- Discount/trial pushes guarded by **trial→paid conversion** and **CAC payback**.
- Add-on upsells guarded by **skip/pause rate**.
- Fulfillment speed guarded by **cost per box** and **damage rate**.

# Common mistakes

- Ignoring involuntary churn (failed payments) — often a third of all churn and the cheapest fix.
- Skip/pause treated as churn (or ignored entirely) instead of modeled as its own state.
- Trials counted as subscribers in the North Star.
- No first-box-experience branch even though it predicts most churn.

# Leading indicators worth having

First-box NPS, skip rate trend, payment retry success rate, time-to-first-delivery, customization engagement.
