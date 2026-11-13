# A bounded agent turn with structured, server-validated suggestions

The Intercessor writes one Entry and gets up to 5 Suggestions, not an open-ended chat. Behind it is one tool-use turn: Claude may call `find_intentions` up to 3 times, then must answer through `present_suggestions` (Intention ids plus a short note) or ask a single Clarifying Question. Up to 2 Refinements follow. This keeps cost and UX predictable and evals writable, while still exercising tool calling, streaming, and multi-turn handling.

## Consequences

- The server rejects any Intention id not returned by `find_intentions` in the same request, so hallucinated or injected ids never reach the UI. Suggestions are recorded server-side, never reported by the client.
- Ranking is a domain policy inside the tool, not the model's judgement. Already-seen Intentions are **penalised, not excluded**, and a minimum-similarity threshold applies, so returning Visitors don't run out of results. Fairness favours Intentions with fewer Commitments.
- Results stream as SSE with typed events (`status`, `note_delta`, `suggestions`, `question`, `done`, `error`).
- `max_tokens` per call, turn and tool-call caps, and a daily token budget per Visitor bound what one Visitor can spend.
