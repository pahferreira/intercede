# User journey (mobile-first)

The brief for the visual design sessions. It fixes flows, states, rules and copy intent; layout, typography and final wording belong to the design. Terms follow `GLOSSARY.md`. Rough wireframes are in `wireframes/`.

**Final design:** the [Intercede screens](https://claude.ai/artifact/GmiXXnWm8SmPG6p3jxa1dA) in Claude Design, with page Mobile (390 px) and page Desktop (1440 px). They supersede `wireframes/` for layout and copy. Each section below names its screens. Read a screen with the Artifact tool: `read` with `path: "project/<Screen>.dc.html"`. Screens hard-code colours and load fonts from Google Fonts; take layout and copy from them, and styles from the Tailwind theme and `apps/web/src/ui/` components ([design system](https://claude.ai/artifact/JzVJJ5rhZi4k13uWySQyeW), #77).

## Routes

| Route             | Screen                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `/`               | Submit screen, or redirect to `/pray` if this browser submitted or skipped in the last 24 h |
| `/pray`           | Entry screen, which becomes the fullscreen chat after the first Entry                       |
| `/pray/committed` | Commitment confirmation                                                                     |
| `/f/:token`       | Follow-up page for a Requester                                                              |

No locale prefix. "Ask for prayer" always opens the submit screen, even within the 24 h window.

## 1. Submit screen (`/`) — [wireframe](wireframes/01-submit.png)

Design: `Main`, `Submit-Rejected` · `Desktop-Submit`, `Desktop-Submit-Rejected`. The app shell (header, EN/PT segmented language toggle) follows `Main` and `Desktop-Submit` on every screen.

Hero ("Welcome to Intercede", tagline), heading "Submit your pray intention", textarea (10–1000 characters), **Skip** and **Submit**. The language toggle is visible.

- **Submitting:** Turnstile runs invisibly; the button shows a spinner and the textarea is locked while moderation runs (~1–3 s).
- **Rejected:** the text stays in the textarea; the Moderation Verdict's reasons appear inline as actionable hints ("Use initials instead of full names"). The Requester edits and resubmits, or skips.
- **Published:** go to `/pray` with the success confirmation (see 2).
- **Skip:** go to `/pray`; remember the skip for 24 h.
- **Moderation unavailable (503):** "We couldn't check your intention right now. Please try again in a moment." Text kept.
- **Submission limit reached (3/day):** inline message; Skip still available.
- **Turnstile failed:** inline "Couldn't verify, try again". Text kept.

## 2. Entry screen (`/pray`) — [wireframe](wireframes/02-entry.png)

Design: `Entry-Published` · `Desktop-Entry-Published`. Reached by Skip, the Entry screen is the same without the success confirmation.

Same hero, heading "What's in your heart to pray for today?", textarea, **Start**. Turnstile runs invisibly on Start.

**Success confirmation** (only after publishing): a dismissible notice at the top: "Published ✓ — Intention #a3f9" with a **Copy** button for the follow-up URL `/f/<Follow-up Token>`. The short label is display only; the URL carries the token, never the Intention id. The token is also kept in `localStorage`. The notice stays until dismissed.

## 3. Fullscreen chat (`/pray`) — [wireframe](wireframes/03-chat.png)

Design: `Chat-Searching`, `Chat-Clarify` · `Desktop-Chat-Searching`, `Desktop-Chat-Clarify`.

After Start the screen becomes a fullscreen chat, like a typical AI agent.

- **Header:** app name, **New search**, language toggle.
- **Thread:** the Intercessor's Entry as a right-aligned bubble; then a status line while the search runs ("Looking for intentions…"), replaced by the streamed note. Maps to the SSE events `status`, `note_delta`, `suggestions`, `question`, `done`, `error`.
- **Composer:** pinned at the bottom.
- **Clarifying Question:** rendered as an ordinary assistant message, answered in the composer. Does not count as a Refinement.
- **Refinements:** up to 2. After the second, the composer becomes a **New search** button.

## 4. Suggestions — [wireframe](wireframes/04-suggestions.png)

Design: `Chat-Suggestions`, `Chat-NoMatch` · `Desktop-Chat-Suggestions`, `Desktop-Chat-NoMatch`.

Up to 5 Suggestion cards appear in the thread under the note.

- **Card:** the first ~3 lines of the Intention, tap the card body to expand; the "why it fits" note in smaller muted text; a checkbox on the left. Only the checkbox selects, so expanding never commits.
- **I commit!:** a sticky button above the composer, shown only when at least 1 card is checked. Sends all checked Suggestions as one batch; each Commitment is idempotent.
- **No close match:** "I couldn't find a close match. These are still waiting for prayer:" followed by up to 5 Intentions with the fewest Commitments, selectable and committable as usual.
- **Catalog empty:** "No intentions yet. Be the first to ask for prayer" with a link to the submit screen.

## 5. Commitment confirmation (`/pray/committed`)

Design: `Committed` · `Desktop-Committed`.

"You committed to pray for these intentions:", the committed Intentions as full-text cards, and "Have a good prayer". Two quiet actions: **New search**, and **Ask for prayer** (only if this Visitor skipped submitting today). The committed cards are kept in `sessionStorage` so a refresh does not lose them.

## 6. Follow-up page (`/f/:token`)

Design: `FollowUp` · `Desktop-FollowUp`.

The Intention text, its publication date, and "**N people committed to pray for this**" (committed, not prayed). If Archived: "This intention is no longer being suggested", count still shown. Unknown token: a neutral "Link not found". One call to action: **Pray for someone too** → `/pray`.

## Cross-cutting rules

### Language

- UI language comes from `navigator.language` on first visit (`pt-*` → pt-BR, else en), switchable by a toggle on every screen, kept in `localStorage`.
- An Intention's language is detected during moderation; the Requester never picks it.
- Suggestions only include Intentions in the Entry's language.

### State and privacy

- The chat transcript lives in memory only: refresh or a new tab starts over at the Entry screen. Nothing the Intercessor writes is kept in browser storage.
- The browser back button inside the chat goes to the Entry screen, not to a previous turn.
- `localStorage`: UI language, submitted/skipped timestamp, Follow-up Tokens. `sessionStorage`: committed cards only.

### Errors and limits

Design: `Chat-Errors`, `Chat-Limit` · `Desktop-Chat-Errors`, `Desktop-Chat-Limit`.

| Situation                                       | Behaviour                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stream fails mid-turn                           | Inline "Something went wrong" with **Retry**, resending the same Entry; does not use up a Refinement                                      |
| Search rate limit or daily token budget reached | "You've searched a lot today. Come back later. Meanwhile, the intentions you committed to are waiting for your prayer." Composer disabled |
| Commit fails                                    | Selection kept; **Retry** (Commitments are idempotent)                                                                                    |
| Offline                                         | Slim banner; send and commit disabled                                                                                                     |

### PWA

Installable (manifest, icons) with no custom install prompt; only the browser's own. Offline covers the app shell only; nothing for searching or committing.

### Analytics (PostHog)

No user text ever leaves in an event, through any channel:

- **Funnel events** go through `track` and carry only counts and enums: `submit_viewed`, `submit_skipped`, `intention_submitted`, `intention_rejected{reason}`, `entry_sent`, `clarifying_question_shown`, `refinement_sent{n}`, `suggestions_shown{count, fallback}`, `commit_clicked{count}`, `followup_link_copied`, `followup_viewed`.
- **Page views and page leaves** are captured, including client-side route changes, so visitors, sessions, bounce rate and referrers are counted.
- **Exceptions** are captured on the web and the API with their type and stack, never their message.
- **URLs** in any event have the Follow-up Token replaced: `/f/<token>` becomes `/f/:token`.
- **LLM calls** report provider, model, token counts, latency and cost, never the prompt or the output.
- **Off:** click autocapture, rage and dead clicks, heatmaps and session replay, since each records on-screen text such as Intentions.
- **Consent** for the analytics cookie is open: #64.

## Scope changes from the PRD

- The **follow-up page** moves from Phase 2 into Phase 1.
- The **"fewest Commitments" fallback** for no close match, a small part of Unattended surfacing, moves into Phase 1.
