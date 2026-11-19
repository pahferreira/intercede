# Amazon Bedrock for the LLM and embeddings

Amazon Nova Lite (moderation and the search assistant) and Titan Text Embeddings v2 (multilingual, **512 dimensions**) are called through Amazon Bedrock. The Anthropic API offers no embeddings, so going direct would mean two vendors and two secrets; Bedrock authenticates with the Lambda's IAM role and bills through AWS. A Claude subscription does not cover API usage.

Moderation and the search assistant moved from Claude Haiku to Nova Lite because the AWS account has no access to Claude Haiku 5.5, and the Claude Haiku it can use, 4.5, costs about ten times as much per token. Nova Lite costs less than either. The Claude adapters stay in the code, on Claude Haiku 5.5, for when access arrives.

## Consequences

- Both are behind `LlmPort` and `EmbeddingPort`; tests use deterministic fakes.
- The embedding dimension is fixed in the `vector(512)` column: changing provider or dimension means re-embedding the Catalog (a short script at this volume).
- Intentions and Entries are in Portuguese and English; the multilingual embedding model makes cross-language matches work.
- Prompt quality is measured with evals in `apps/api/evals/` (recall@5, clarifying-question decision, moderation cases), run by hand because they cost money; CI runs only deterministic tests.
