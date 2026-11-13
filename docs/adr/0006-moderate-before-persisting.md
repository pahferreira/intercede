# Moderate before persisting; rejected text is never stored

A submitted text is moderated synchronously (one Haiku call with structured output) **before** any Intention is created. If the Moderation Verdict is a rejection, nothing is written and the Requester gets an actionable reason (for example "use initials instead of full names"). Only an anonymous count of rejection reasons reaches analytics. If Bedrock is unavailable the API returns 503 and asks the Requester to try again. This keeps personal data out of the database and gives immediate feedback to people who cannot be contacted later.

## Considered Options

- **Persist as Pending, moderate asynchronously**: rejected because raw personal data would be stored, and an anonymous Requester would never learn why their text was rejected.

## Consequences

- The Intention lifecycle is only `Published → Archived` (archived 90 days after publication, configurable). There is no Pending state, and the sweeper only drains the outbox.
- Text is 10–1000 characters; language is `pt` or `en`.
- On publication the Requester receives a Follow-up Token; only its hash is stored, ready for a future follow-up page.
