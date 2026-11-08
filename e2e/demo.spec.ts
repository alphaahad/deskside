import { test, expect, type Page } from "@playwright/test";

// The exact flow the 2-minute video shows. Locally this runs with no Gemini key, so it also proves
// the scripted demo works in offline mode (quota cutoff, outage).

async function ask(page: Page, text: string) {
  const before = await page.getByTestId("chat-log").locator("p", { hasText: /^Meera/ }).count();
  await page.getByLabel("Message Meera").fill(text);
  await page.getByLabel("Message Meera").press("Enter");
  // Wait for Meera's reply bubble to land.
  await expect(page.getByTestId("chat-log").locator("p", { hasText: /^Meera/ })).toHaveCount(before + 1, { timeout: 60_000 });
}

test("ask why, approve, undo, refuse over limit, lead decides, teach a rule, rule applies to new mail", async ({ page }) => {
  await page.goto("/?internal=1");
  await expect(page.getByTestId("status")).toContainText("Read all 20 invoices", { timeout: 90_000 });
  await expect(page.getByTestId("held").locator("li")).toHaveCount(4);

  // 1. Grounded answer with citations to the invoice line and the PO line.
  await ask(page, "Why is invoice 4471 on hold?");
  const log = page.getByTestId("chat-log");
  await expect(log).toContainText("₹1,060.00 vs ₹1,000.00 on PO-2271");
  await expect(log.getByRole("button", { name: /PO-2271 · line 1/ })).toBeVisible();
  await expect(log.getByRole("button", { name: /GRN-5571/ })).toBeVisible();

  // 2. Approve in chat as the clerk; it lands in the feed with its source; undo it.
  await ask(page, "approve it");
  await expect(log).toContainText("Priya approved INV-4471");
  const feed = page.getByTestId("feed");
  await expect(feed.locator("li", { hasText: "Priya approved INV-4471" })).toContainText("via chat");
  await log.getByRole("button", { name: "Undo" }).last().click();
  await expect(feed).toContainText("Priya undid the approval of INV-4471");
  await expect(page.getByTestId("held").locator("li")).toHaveCount(4);

  // 3. Over the clerk's limit: refused, explained, escalated.
  await ask(page, "approve 4477");
  await expect(log).toContainText("Not allowed");
  await expect(log).toContainText("your approval limit is ₹1,00,000 and INV-4477 is ₹2,12,400");
  await expect(feed).toContainText("Flagged INV-4477 for Arjun");

  // 4. The finance lead decides it.
  await page.getByRole("radio", { name: /Arjun/ }).click();
  await expect(page.getByLabel("Message Meera")).toHaveAttribute("placeholder", /Arjun/);
  await ask(page, "Reject it, they billed 20 units we never received");
  await expect(feed).toContainText("Arjun rejected INV-4477");

  // 5. Teach a rule; it applies to the next invoices.
  await ask(page, "Always hold quantity variance over 5%");
  await expect(page.getByTestId("rules")).toContainText("R-1");
  await page.getByRole("button", { name: "New mail (3)" }).click();
  await expect(feed.locator("li", { hasText: "Held INV-4481" })).toContainText("R-1", { timeout: 60_000 });
  await expect(feed.locator("li", { hasText: "Held INV-4481" })).toContainText("by rule");

  // 6. The metric moved.
  await expect(page.getByTestId("metric-median")).not.toHaveText("–");
});

test("the same tools work over MCP, under the same permissions", async ({ page }) => {
  await page.goto("/?internal=1");
  const state = await (await page.request.get("/api/state")).json();
  const url = `/api/mcp?ws=${state.workspace}&as=priya`;
  const rpc = async (method: string, params?: unknown) => (await page.request.post(url, { data: { jsonrpc: "2.0", id: 1, method, params } })).json();

  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } });
  expect(init.result.serverInfo.name).toBe("deskside");
  const tools = await rpc("tools/list");
  expect(tools.result.tools.map((t: { name: string }) => t.name)).toContain("approve_invoice");

  await expect(page.getByTestId("status")).toContainText("Read all 20 invoices", { timeout: 90_000 });
  const refused = await rpc("tools/call", { name: "approve_invoice", arguments: { invoice: "4477" } });
  expect(refused.result.isError).toBe(true);
  expect(refused.result.content[0].text).toContain("approval limit");
  const ok = await rpc("tools/call", { name: "approve_invoice", arguments: { invoice: "INV-4466" } });
  expect(ok.result.isError).toBe(false);
  await expect(page.getByTestId("feed").locator("li", { hasText: "Priya approved INV-4466" })).toContainText("via Claude (MCP)");
});
