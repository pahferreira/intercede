# Intercede

An anonymous platform where people leave prayer intentions and others find, through an AI-assisted search, intentions they feel called to pray for.

## People

**Requester**:
A Visitor who leaves an Intention so others can pray for it.
_Avoid_: Submitter, author, poster

**Intercessor**:
A Visitor who looks for Intentions to pray for and commits to some of them.
_Avoid_: Prayer (ambiguous with the act), reader, user

**Visitor**:
The anonymous identity of whoever is using Intercede; never linked to a real person. The same Visitor may act as Requester and Intercessor.
_Avoid_: User, account, anonymous user, session

## Intentions context

Receives Intentions from Requesters, decides whether they may be published, and owns their lifecycle.

**Intention**:
A cause a Requester leaves anonymously for others to pray for. Requesters know it as a prayer request ("pedido de oração"), which is how the screens they see word it.
_Avoid_: Prayer request (outside Requester-facing copy), pray intention, post

**Moderation Verdict**:
The decision, made before an Intention exists, of whether a submitted text may be published, with the reasons when it may not (spam, abuse, personal data, off-topic). A rejected text is never kept.
_Avoid_: Review, approval

**Published**:
The state of an Intention that may be suggested to Intercessors.

**Archived**:
The state of an Intention that has aged out: kept, still counted, but never suggested again.
_Avoid_: Deleted, expired

**Intention Code**:
A short public reference to an Intention, such as `INT-7K3QD`, given to the Requester when it is published; anyone holding it can see the Intention and how many Commitments it received.
_Avoid_: Label, ID, number, token

## Intercession context

Helps Intercessors find Intentions that fit what they want to intercede for, keeps suggestions fair, and records Commitments.

**Entry**:
What an Intercessor writes to say what they want to intercede for, such as "for families". Never itself an Intention.
_Avoid_: Query, prompt, search, message

**Clarifying Question**:
The single question the assistant may ask back when an Entry is too vague to search.

**Refinement**:
A follow-up Entry that narrows or redirects a previous search ("something more about family").
_Avoid_: Follow-up message, chat turn

**Suggestion**:
An Intention shown to an Intercessor in response to an Entry, with a short note on why it fits.
_Avoid_: Match, result, recommendation

**Commitment**:
An Intercessor's decision to pray for a suggested Intention. An Intercessor may commit to many Intentions.
_Avoid_: Choice, selection, pick, like

**Catalog**:
Intercession's own view of the Published Intentions it can suggest.
_Avoid_: Index, feed

**Unattended Intention**:
A Published Intention that has received no Commitments for a while and deserves to be surfaced.
_Avoid_: Neglected intention, forgotten intention

## Scripture context (Phase 2, not built)

Will suggest a Bible passage to guide an Intercessor's prayer for a committed Intention.

**Passage Suggestion**:
A Bible passage offered alongside a Commitment.
_Avoid_: Verse of the day

## Languages

**Language**:
The language an Intention is written in, `pt` or `en`. Decides which Intercessors it can be suggested to.
_Avoid_: Locale (for an Intention)

**Locale**:
The language the interface is shown in, `en` or `pt-BR`. `en` is the source and the default: copy is written in English first and translated to `pt-BR`, even though most Visitors are in Brazil. Picked from the browser on the first visit, falling back to `en`, and kept on the device. Its first subtag (`en`, `pt`) is the matching Language.
_Avoid_: Language (for the interface)

## Relationships

- **Intentions → Intercession**: Intentions announces when an Intention is published or archived; Intercession keeps its Catalog in step. Intercession never reads Intentions' data directly.
- **Intercession → Scripture** (Phase 2): a Commitment will be the moment a Passage Suggestion is offered.
