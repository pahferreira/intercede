# Conversations are not stored on the server

What Intercessors write about their lives is sensitive, so the server keeps no conversation history. The browser holds the transcript and sends it with each Refinement. The server signs the transcript with an HMAC and verifies it on the next turn, so a client cannot forge earlier assistant turns or tool results. Only outcomes (Suggestions and Commitments) are persisted. PostHog receives LLM metrics (tokens, latency, cost) but never prompt or Entry content, and session replay is disabled.
