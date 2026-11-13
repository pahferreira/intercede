# A layered cost and abuse ceiling instead of AWS WAF

Endpoints are public and every search spends LLM tokens, so cost is bounded in layers: Cloudflare Turnstile on submission and on the first Entry; per-Visitor and per-IP rate limits plus a daily token budget, stored in Postgres; `Idempotency-Key` on POST endpoints (24 h); Lambda reserved concurrency; and AWS Budgets alerts at $1, $5, and $10. AWS WAF was rejected because it alone costs at least $5/month, more than the rest of the system.

## Consequences

- The Visitor is an anonymous id in a signed httpOnly cookie. Clearing cookies resets the per-Visitor limits, which the per-IP limits and Turnstile cover.
