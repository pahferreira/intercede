# Intercession keeps its own Catalog, fed by a transactional outbox

The embedding is a search concern, not part of what an Intention is, so Intentions owns text and lifecycle while Intercession keeps its own Catalog (text, language, embedding, suggestion and commitment counters) in its own schema. Intentions writes `IntentionPublished` and `IntentionArchived` to an outbox table in the same transaction as the state change. Each event is dispatched in-process right after commit, and a scheduled sweeper Lambda (every 5 minutes) re-dispatches anything left unprocessed. Without the outbox, a failure to embed would leave an Intention published but never findable.

## Consequences

- Event handlers must be idempotent (Catalog upserts are keyed by Intention id).
- Moving to SQS later means swapping the dispatcher adapter, not the domain.
