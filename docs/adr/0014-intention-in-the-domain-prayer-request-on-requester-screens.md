# Intention stays the domain term; Requester screens say "prayer request"

Requesters think of what they leave as a prayer request ("pedido de oração" is what Brazilians are used to), while Intercessors pray for intentions. Intention stays the one domain term, in code, prompts, storage and docs. Only the copy shown to a Requester before and around submitting (submit screen, follow-up page) says "prayer request". Once it is published, the notice already names it an Intention, so the Requester learns the word for what they created; the Intercessor's screens keep "intention".

## Considered Options

- **Rename the domain to Prayer Request**: rejected because Intention is the more accurate name for what Intercessors pray for, and splitting the model into two terms by context added translation code without adding meaning.

## Consequences

- Code that says `intention` behind a screen that says "prayer request" is deliberate, not drift.
- The follow-up link stays `/intention/$code`: it names the Intention the Requester has just been told they created, and links already shared keep working.
- The Intention Code prefix stays `INT-`, read as short for Intercede.
- The Requester funnel events are `prayer_request_submitted` and `prayer_request_rejected`, named after what the Requester did; funnels break at the rename date.
