# One CloudFront distribution, one origin, in us-east-1

`intercede.pahferreira.dev` is a single CloudFront distribution with three behaviours: the default serves the SPA from a private S3 bucket, `/api/*` forwards to the Lambda Function URL (origin access control, no caching), and `/ingest/*` proxies to PostHog so ad blockers don't drop analytics. Being same-origin removes CORS and lets the Visitor cookie be httpOnly. The record lives in the existing Route 53 zone (same AWS account, looked up by Terraform, not owned by it), and the ACM certificate is in `us-east-1`.

## Consequences

- Everything runs in `us-east-1` even though most users are expected in Brazil: it has every Bedrock model, matches Neon's region, and is cheapest. Model generation time, not the ~120 ms round trip, dominates latency, and CloudFront serves the app from Brazilian edges.
- Moving to a dedicated domain later is a certificate and alias change.
