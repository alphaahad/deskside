# Nod: ask your digital employee, decide where you are

*A one-page pitch. Prototype by Ahad Nadeem. All product data in the demo is mock data; nothing connects to a real ERP or to Zamp.*

## The problem (a hypothesis)
Finance leads can't see or steer their digital employees without logging into yet another tool. **My hypothesis** is that, as a result, held items sit for days and trust in the agent stalls: the agent does 90% of the work, and the 10% that needs a human waits for someone to remember to check a console.

"Held items sit for days" is an assumption, not a measured fact. The demo's "before" number (a median of about 2 days) is a **mock baseline**, clearly labelled as such.

## The product
**Nod** sits on top of a digital-employee product and doesn't replace it. A finance lead talks to the AP employee ("Meera") like a coworker:
- "Why is 4471 on hold?" gets a grounded answer citing the PO, receipt and invoice lines.
- "Approve it" or "reject it" decides right there. The action lands in a live activity feed with its source and a one-click undo.
- "Always hold quantity variance over 5%" is remembered and applied to the next invoices.
- Roles are enforced in code: a clerk can approve under ₹1 lakh. Above that, Meera refuses, explains, and escalates to the finance lead.
- The same tools are exposed over **MCP**, so the conversation can happen in Claude (and later Slack or Teams), where finance leads already are.

## How I'd measure it
- **North star:** the median time from the agent holding an item to a human decision.
- **Guardrail:** the reversal rate on decisions made through chat must not exceed the rate for decisions made with buttons (or the baseline). It isn't judged until there are 20 or more chat decisions.
- **Supporting:** the share of holds decided in under 4 hours, escalations resolved per day, and rules taught per account (a sign of trust and of the agent learning).

## What I'd verify first
1. **Is waiting really the problem?** Pull hold-to-decision time from existing customers' logs. If the median is already hours, not days, the wedge is trust and explanation quality, not speed.
2. **Where do finance leads actually look?** Interview 5–8 leads and AP managers about email, Slack/Teams or the product console. This decides whether MCP or Slack ships first.
3. **Do chat decisions get reversed more?** Run a two-week pilot with the guardrail instrumented, comparing chat against buttons on the same queue.
4. **What blocks a decision?** Is it missing context (which citations fix) or missing authority (which escalation fixes)? Tag a sample of held items.
5. **Are rules wanted, or feared?** Check whether leads want to teach rules in chat, or need an approval step for policy changes.

## What's next
1. **Meet them where they are:** MCP is built. Next come Slack and Teams with the same tools and permissions.
2. **Portal watchdog:** alert when a vendor portal's layout changes, pause that source, and ask for a mapping decision, in the same conversation.
3. **Deployment readiness:** before go-live, run a customer's sample invoices and show what would be auto-decided against what would go to review.

## Why me
At TartanHQ I reported to the CEO and owned the HyperSync roadmap end to end: MCP, permission-aware retrieval, RBAC, sync and audit logs with rollback, and health monitoring. Nod is the same set of problems applied to a digital employee: an agent that acts on permissioned data, has to explain itself, and has to be reversible and auditable for people to trust it.
