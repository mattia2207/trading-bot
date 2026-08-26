---
name: Express route ordering with :id params
description: Sibling literal routes must be registered before a parameterized :id route on the same resource path, or Express matches the literal as the param.
---

Rule: when a router has both `GET /resource/:id` and `GET /resource/literal-name` (e.g. `/signals/:id` and `/signals/quality-filter`), the literal route MUST be registered before the `:id` route.

**Why:** Express matches routes in registration order. If `/resource/:id` is registered first, a request to `/resource/literal-name` matches it too, with `id = "literal-name"`. Any `parseInt`/numeric validation on `id` then fails, typically surfacing as an unexpected 400 on the literal endpoint while direct testing of the `:id` route looks fine.

**How to apply:** When adding a new `:id` detail route to an existing resource router, grep the file first for other literal sub-paths under the same resource prefix (e.g. `/resource/stats`, `/resource/settings`) and place the new `:id` route after all of them.
