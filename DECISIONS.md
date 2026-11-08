# Decisions

What I built first, what I cut, and why. Items marked **ASSUMPTION** are things I believe about Zamp, its customers or finance teams that I couldn't verify from public material. They're collected in §9.

## 1. The metric

**North star: the median time from the agent holding an item to a human decision.**
- **Clock start:** the moment Meera logs the hold.
- **Clock stop:** the approve or reject that sticks. A decision that is later undone doesn't count as decided; the item is back on hold and its clock keeps running from the original hold.
- **Why the median:** a few items will legitimately wait (a vendor needs to send a credit note), and the median isn't dragged around by them. In production I'd also report p90 and "% decided within 4 hours".
- **Escalations don't stop the clock.** A clerk asking and being refused is not a decision; the item still waits for the finance lead.

**Guardrail: the reversal rate on decisions made via chat must not exceed the rate for decisions made with buttons (or the baseline).**
- **Why:** chat makes deciding faster, and the real risk is that it makes deciding *careless*.
- **Sample-size gate:** it isn't judged below 20 chat decisions. The card says "Too early" instead of flashing red after one demo undo.
- **What counts as a reversal:** any undo. In production I'd separate misclick undos (under 60 seconds) from real reversals.

**Baseline:** 40 mock historical holds with a median of about 2 days and 5% reversed, labelled **mock baseline** everywhere. They exist so the card can show a before and after. **ASSUMPTION:** days, not hours, is the real order of magnitude (see PITCH.md, "What I'd verify first").

## 2. What I built first, and why
1. **The deterministic core.** Mock data, 3-way match, policy, roles and metrics are pure TypeScript with 44 unit tests. Everything the agent says has to be traceable to this, so it came before any UI or model call.
2. **Real reads, frozen.**
   - Gemini reads every invoice PDF (3 different layouts).
   - The 29 real reads are snapshotted, and a test scores them against ground truth: all 23 inbox invoices are read exactly.
   - Fresh databases load the snapshot, so the deployed demo doesn't spend free-tier quota, and it labels each read *live*, *cached* or *fallback*.
3. **The Ask layer, as one deep module:** chat, then approve, reject and undo, then roles, then rules, then metrics. These are vertical slices, each usable on its own.
4. **MCP and the two thin "next" tabs** came last, and stay deliberately thin.

## 3. Key judgment calls
- **The LLM talks; code decides.**
  - Gemini does function-calling over seven tools.
  - Permissions, limits, matching and rules are server code.
  - The model can't approve something you aren't allowed to approve: `authorize()` refuses first, whatever the model asks for.
- **Citations come from tool results, never from model text.**
  - "Why is 4471 on hold?" calls `explain_invoice`, which returns the failing checks with structured citations (document, ref, line).
  - The UI renders those as chips. The model writes only the sentence around them and is told not to list them.
- **A write guard on the model.**
  - Approve, reject, undo and rule changes only run if *the user's own words* ask for that action. A deterministic check reads the user's message, not the model's interpretation.
  - For rules, if the user's text parses ("over 5%"), the parsed value wins over whatever number the model passes.
- **"Approve it" resolves deterministically.**
  - "It" is the invoice under discussion, stored server-side.
  - If nothing is under discussion, Meera asks which one instead of guessing.
- **One decision, one owner.** Bulk approval is refused on purpose, so every decision has a named person, a source and its own undo. This is the guardrail's best friend.
- **Rules only tighten.** A user rule can make Meera stricter (hold above 5%), never looser. Loosening tolerances is a policy change that deserves a review flow, not a chat message.
- **Refusals do something.** A refused decision is logged and escalated to someone who can decide. The person isn't left at a dead end.
- **Every action records its source**: agent, chat, button, rule or MCP. That's what makes the chat-vs-button guardrail measurable at all.
- **Offline mode.**
  - If Gemini is unavailable (no key, quota, outage), a deterministic router handles the core requests and the reply is labelled "offline mode".
  - The e2e tests run this way, which proves the recorded demo can't be derailed by a quota limit.
- **The agent works visibly.** It processes one invoice per request, paced at about 0.65s, so the feed shows it working. Pacing affects display only, never the logic.

## 4. What I cut, and why
| Cut | Why |
|---|---|
| Real ERP, email ingestion, sending vendor emails | It isn't the question being tested, and claiming it would be dishonest. Vendor queries are "drafted, not sent". |
| Auth and SSO | The role switcher stands in for sign-in. Roles are still enforced server-side on every path, including MCP. |
| Bulk approve | See "one decision, one owner". |
| Loosening rules, rule approval workflow | A policy change needs review. Out of scope for a chat MVP. |
| Slack and Teams | MCP proves the "use it where you already are" path with the same tools. Slack is next. |
| Portal watchdog (real) | A static, labelled example. Doing it honestly needs real portal fetches. |
| Readiness upload storage | Uploads are read and matched, then discarded. Only the read is cached. |
| Multi-currency, mobile, notifications | Not needed to test the hypothesis. |

## 5. Trust model
| | AP clerk (Priya) | Finance lead (Arjun) |
|---|---|---|
| Approve or reject a held invoice | Up to ₹1,00,000 | Any amount |
| Undo | Own decisions | Anyone's |
| Teach or remove rules | No (refused, can escalate) | Yes |

**ASSUMPTION:** a single amount limit per role is the right first cut. Real AP teams also split by vendor, entity and cost centre.

## 6. Stack, and where I deviated from the brief
- **Framework:** Next.js 16, TypeScript and Tailwind 4 on Vercel.
- **Postgres instead of SQLite or JSON.** Vercel's filesystem is ephemeral and per-instance, so SQLite wouldn't persist between requests. I use Neon in production and PGlite (Postgres in WASM, in-process) locally, so `npm run dev` needs zero setup. The SQL is plain, with no ORM.
- **The model is Gemini (`gemini-3.5-flash-lite`) on the free tier**, with rate limiting per workspace, a single retry on short 429s, then offline mode.
- **The event log is an append-only `events` table.** It feeds the activity feed, undo and the metrics.

## 7. Interaction design
- **The name:** Meera asks, you give the nod. The name is the moment the metric measures.
- **Respond on press:** decision buttons dim the row and lock the moment they're pressed, so there's no dead time while the server decides.
- **Spatial consistency:** the document sheet enters from the right and leaves the same way. It uses CSS transitions, so a close mid-entry reverses from where it is. Popovers grow from their trigger.
- **Focus is always somewhere sensible:** the sheet moves focus in, traps it, and returns it to the chip that opened it. The popover returns focus on Escape. `/` jumps to the composer.
- **Don't fight the reader:** the chat only follows new messages if you're already at the bottom; otherwise it offers "New message ↓".
- **Calm motion:** everything uses one critically damped curve, with no bounce, because nothing here is flicked. Reduced motion swaps travel for cross-fades, reduced transparency makes the bar solid, and higher contrast firms the edges.
- **Honest numbers:** the metric shows "No decisions yet" rather than a dash, and there's no "N× faster" headline against a baseline that is mock data.

## 8. What I'd do next
1. Slack and Teams on the same tools, and real SSO identities on MCP (OAuth) in place of the demo URL key.
2. Separate misclick undos from real reversals, and add p90 plus "% within 4h" to the metric card.
3. A review flow for rule changes, so leads can propose rules in chat and a second person approves them.
4. Portal watchdog with real fetchers, then deployment readiness on real customer samples.

## 9. Assumptions about Zamp (verify these first)
1. Zamp's digital employees hold exceptions for human review, and today that review happens in Zamp's own console.
2. Finance leads aren't in that console daily, so holds wait. Hold-to-decision time is days, not hours.
3. Zamp's agents can expose structured evidence (PO, receipt and invoice lines) for each hold, which this layer would read rather than recompute.
4. Customers have role-based approval limits that Zamp can read or mirror.
5. Exposing agent actions through MCP or chat tools is compatible with Zamp's security posture, given per-user auth.
6. Some of Zamp's vendor invoices are fetched from vendor portals (the premise of the watchdog).
7. A 2% price and 10% quantity tolerance are reasonable defaults. Real customers configure these per vendor or category.
