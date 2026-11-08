# Video script: Deskside (2:00)

Screen: the deployed app at 1440 × 900, a fresh workspace (Reset demo), signed in as Priya.
Spoken lines are in quotes; **[on screen]** is what to do.

---

## 0:00–0:20 · Problem and metric (20s)

**[on screen]** The desk, with Meera already reading invoices and the feed filling up on the right.

> "AI employees already do most of accounts payable. But when one holds an invoice, the finance lead has to log into yet another tool to find out why. So held items sit for days, and trust in the agent stalls.
> Deskside lets you just ask your digital employee, and decide right there.
> I measure one thing: the median time from the agent holding an item to a human decision. The guardrail: decisions made in chat must not get reversed more often than ones made with buttons."

## 0:20–1:40 · Demo (80s)

1. **(0:20)** **[click]** *Why is invoice 4471 on hold?*
   > "Meera answers from the match itself: ₹1,060 billed against ₹1,000 on the PO, 6% over a 2% tolerance. These chips are the actual PO, receipt and invoice lines, not model text."

   **[click]** the PO chip, so the drawer opens with the invoice PDF next to the highlighted PO line. **[Esc]**
2. **(0:35)** **[type]** *approve it*
   > "Priya approves in chat. It lands in the activity feed with its source, 'via chat', and a one-click undo."

   **[click]** **Undo** on the card.
   > "Reversible, and the reversal counts against the guardrail."
3. **(0:50)** **[click]** *Approve 4477*
   > "That one is ₹2.1 lakh, above Priya's ₹1 lakh limit. The model doesn't decide permissions; code does. Meera refuses, explains why, and flags it for Arjun."
4. **(1:05)** **[click]** **Arjun** in the switcher. **[type]** *reject it, they billed 20 units we never received*
   > "Arjun is the finance lead. He rejects it, and the vendor query is drafted, not sent."
5. **(1:15)** **[click]** *Always hold quantity variance over 5%*
   > "Now he teaches a rule. Rules can only make Meera stricter, never looser."

   **[click]** **New mail (3)**.
   > "Next batch: a 7% quantity variance. The default would have let it through. Meera holds it, citing rule R-1, set by Arjun in chat."
6. **(1:30)** Point at the metric card.
   > "Hold to decision is now minutes, against a mock baseline of about two days. Chat reversals are tracked separately from buttons, and it won't call the guardrail until there are enough decisions to mean something."

## 1:40–2:00 · Cuts and next (20s)

> "What I cut: real ERP and SSO, bulk approvals (every decision gets one owner and one undo), and any rule that loosens tolerances.
> Next: the same tools already run over MCP, so this can live in Claude or Slack where finance leads already are. Then portal watchdog alerts and a deployment-readiness check before go-live. All data in this demo is mock data."

---

**Fallbacks while recording:** if Gemini is slow or rate-limited, Meera answers in offline mode (labelled under her name) and the same scripted lines still work. If anything goes wrong, use **Reset demo** for a clean workspace.
