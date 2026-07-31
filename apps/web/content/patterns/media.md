---
archetype: media
title: Media / content
version: 1
---

# North Star candidates

- **Weekly engaged time** — `Sum of qualified minutes across users / week`. Attention-centric; risks doom-scroll incentives without quality guards.
- **Weekly active consumers** — reach-centric; hides depth of engagement.
- **Subscriber LTV** (for paywalled models) — money-centric; very lagging.

# Canonical decomposition

- Weekly engaged time = WAU × Sessions per user × Minutes per session *(multiplicative)*
  - WAU = New users + Retained users + Resurrected users *(additive)*
    - New users: by channel (search, social, direct, referral) *(additive)*
    - Retained: driven by content freshness, personalization quality *(influence)*
  - Minutes per session: content depth, autoplay/next-up CTR *(influence)*
- Monetization branch (ads): Ad revenue = Impressions × Fill rate × eCPM *(multiplicative)*, impressions driven by engaged time *(influence)*
- Content supply branch *(influence)*: publish velocity, content utilization rate (% of catalog consumed)

# Standard counter-metrics / guards

- Engaged time guarded by **content quality score / report rate** (attention without quality is churn in disguise).
- Ad load guarded by **session abandonment rate**.
- Clickbait-prone recommendation changes guarded by **regret signals** (quick bounces after click).
- Publish velocity guarded by **utilization** (don't produce what nobody consumes).

# Common mistakes

- Pageviews as the North Star — pure vanity in most models.
- No supply branch: the tree pretends content appears for free.
- Ad revenue wired multiplicatively to engagement when the relation is influence.
- Zero quality guards on engagement-maximizing loops.

# Leading indicators worth having

D1/D7 new-reader retention, content freshness (median age of consumed items), search/browse null rate, notification opt-out rate.
