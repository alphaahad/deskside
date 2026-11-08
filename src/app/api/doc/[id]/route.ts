import { NextResponse } from "next/server";
import { context } from "@/lib/api";
import { invoiceRow } from "@/lib/service";
import { poOf, receiptFor, seedInvoice, vendorOf, paidBills } from "@/lib/data/seed";

export const dynamic = "force-dynamic";

// Everything the document drawer needs: the PDF, what was read from it, and the PO and receipt it was matched to.
export async function GET(_req: Request, ctx: RouteContext<"/api/doc/[id]">) {
  const { id } = await ctx.params;
  const { ws } = await context();
  const seed = seedInvoice(id);
  if (!seed) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = await invoiceRow(ws.id, id);
  return NextResponse.json({
    invoiceId: id,
    pdf: `/invoices/${id}.pdf`,
    vendor: vendorOf(seed.vendorId),
    extraction: row?.extraction ?? null,
    read: { source: row?.extraction_source ?? null, ms: row?.extraction_ms ?? null },
    match: row?.match ?? null,
    po: poOf(seed.poId) ?? null,
    receipt: receiptFor(seed.poId) ?? null,
    paidBill: paidBills.find((b) => row?.match?.checks.some((c) => c.citations.some((x) => x.ref === b.billId))) ?? null,
  });
}
