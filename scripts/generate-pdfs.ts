// Generates the synthetic invoice PDFs in public/invoices (the inbox) and public/samples (readiness tab).
// Three layouts, so extraction is a real reading problem, not a fixed template.
// Run: npm run pdfs
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invoices, vendorOf, BUYER } from "../src/lib/data/seed";
import { samples } from "../src/lib/data/samples";
import type { SeedInvoice } from "../src/lib/types";

const BUYER_LINES = [`Bill to: ${BUYER.replace(" (mock)", "")} (MOCK)`, "Plot 14, KIADB Industrial Area", "Bengaluru 562114, Karnataka", "GSTIN 29AAACA0000A1Z0 (synthetic)"];

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso: string, style: "dmy" | "long" | "iso") => {
  const d = new Date(iso + "T00:00:00Z");
  if (style === "iso") return iso;
  if (style === "dmy") return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

type Ctx = { page: PDFPage; font: PDFFont; bold: PDFFont };
const text = (c: Ctx, s: string, x: number, y: number, size = 9, b = false, color = rgb(0.1, 0.1, 0.12)) =>
  c.page.drawText(s, { x, y, size, font: b ? c.bold : c.font, color });
const right = (c: Ctx, s: string, xRight: number, y: number, size = 9, b = false) => {
  const f = b ? c.bold : c.font;
  text(c, s, xRight - f.widthOfTextAtSize(s, size), y, size, b);
};
const rule = (c: Ctx, y: number, x1 = 40, x2 = 555, t = 0.6) => c.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color: rgb(0.7, 0.7, 0.72) });

function watermark(c: Ctx) {
  c.page.drawText("MOCK DATA", { x: 120, y: 300, size: 90, font: c.bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.08, rotate: degrees(35) });
  text(c, "Synthetic invoice generated for a product demo. Not a real document, vendor or transaction.", 40, 24, 7, false, rgb(0.6, 0.2, 0.2));
}

const amt = (l: SeedInvoice["lines"][number]) => Math.round(l.qty * l.price * 100) / 100;

function classic(c: Ctx, inv: SeedInvoice) {
  const v = vendorOf(inv.vendorId);
  text(c, v.name.toUpperCase(), 40, 790, 14, true);
  text(c, `${v.city}, India  |  ${v.email}`, 40, 774, 8);
  text(c, `GSTIN: ${v.gstin}`, 40, 762, 8);
  right(c, "TAX INVOICE", 555, 790, 16, true);
  right(c, `Invoice No: ${inv.number}`, 555, 770, 9);
  right(c, `Invoice Date: ${fmtDate(inv.date, "dmy")}`, 555, 758, 9);
  right(c, `Your PO Ref: ${inv.poId}`, 555, 746, 9);
  rule(c, 732);
  BUYER_LINES.forEach((l, i) => text(c, l, 40, 715 - i * 12, 8.5));
  let y = 640;
  c.page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: rgb(0.93, 0.93, 0.95) });
  text(c, "#", 46, y, 8.5, true); text(c, "Item", 64, y, 8.5, true); text(c, "Description", 130, y, 8.5, true);
  right(c, "Qty", 380, y, 8.5, true); right(c, "Rate (INR)", 460, y, 8.5, true); right(c, "Amount (INR)", 550, y, 8.5, true);
  y -= 22;
  inv.lines.forEach((l, i) => {
    text(c, String(i + 1), 46, y); text(c, l.item, 64, y); text(c, l.description, 130, y);
    right(c, String(l.qty), 380, y); right(c, inr(l.price), 460, y); right(c, inr(amt(l)), 550, y);
    y -= 18;
  });
  rule(c, y + 6);
  y -= 12;
  right(c, "Taxable value", 460, y); right(c, inr(inv.subtotal), 550, y); y -= 14;
  if (v.gstin.startsWith("29")) {
    const half = Math.round((inv.tax / 2) * 100) / 100;
    right(c, "CGST @ 9%", 460, y); right(c, inr(half), 550, y); y -= 14;
    right(c, "SGST @ 9%", 460, y); right(c, inr(Math.round((inv.tax - half) * 100) / 100), 550, y); y -= 16;
  } else {
    right(c, "IGST @ 18%", 460, y); right(c, inr(inv.tax), 550, y); y -= 16;
  }
  right(c, "Invoice Total (INR)", 460, y, 10, true); right(c, inr(inv.total), 550, y, 10, true);
  text(c, `Payment terms: ${v.terms}. Please quote the invoice number with remittance.`, 40, 120, 8);
}

function modern(c: Ctx, inv: SeedInvoice) {
  const v = vendorOf(inv.vendorId);
  c.page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: rgb(0.13, 0.2, 0.3) });
  text(c, v.name, 40, 805, 15, true, rgb(1, 1, 1));
  text(c, `${v.city}  ·  GST Reg. ${v.gstin}`, 40, 788, 8.5, false, rgb(0.85, 0.88, 0.92));
  text(c, "INVOICE", 470, 805, 15, true, rgb(1, 1, 1));
  const meta: [string, string][] = [["Invoice #", inv.number], ["Issued", fmtDate(inv.date, "long")], ["Purchase order", inv.poId], ["Currency", "INR"]];
  meta.forEach(([k, val], i) => { text(c, k, 360, 730 - i * 14, 8, false, rgb(0.4, 0.4, 0.45)); text(c, val, 450, 730 - i * 14, 9, true); });
  text(c, "Billed to", 40, 730, 8, false, rgb(0.4, 0.4, 0.45));
  BUYER_LINES.forEach((l, i) => text(c, l.replace("Bill to: ", ""), 40, 716 - i * 12, 8.5));
  let y = 640;
  text(c, "DESCRIPTION", 40, y, 7.5, true); text(c, "SKU", 260, y, 7.5, true);
  right(c, "UNITS", 380, y, 7.5, true); right(c, "UNIT PRICE", 465, y, 7.5, true); right(c, "LINE TOTAL", 555, y, 7.5, true);
  rule(c, y - 6, 40, 555, 1);
  y -= 22;
  inv.lines.forEach((l) => {
    text(c, l.description, 40, y); text(c, l.item, 260, y);
    right(c, l.qty.toLocaleString("en-IN"), 380, y); right(c, `Rs. ${inr(l.price)}`, 465, y); right(c, `Rs. ${inr(amt(l))}`, 555, y);
    y -= 20;
  });
  y -= 10;
  const rows: [string, string, boolean][] = [["Subtotal", inr(inv.subtotal), false], ["GST (18%)", inr(inv.tax), false], ["Amount due", `Rs. ${inr(inv.total)}`, true]];
  rows.forEach(([k, val, b]) => { right(c, k, 465, y, b ? 10 : 9, b); right(c, val, 555, y, b ? 10 : 9, b); y -= 16; });
  text(c, `Due within ${v.terms.replace("Net ", "")} days of the issue date.`, 40, 120, 8);
}

function compact(c: Ctx, inv: SeedInvoice) {
  const v = vendorOf(inv.vendorId);
  text(c, `${v.name}  -  ${v.city}`, 40, 800, 11, true);
  text(c, `GSTIN ${v.gstin}   ·   ${v.email}`, 40, 786, 8);
  rule(c, 776);
  text(c, `Bill No. ${inv.number}`, 40, 758, 10, true);
  text(c, `Dated ${fmtDate(inv.date, "iso")}`, 220, 758, 9);
  text(c, `Against P.O. ${inv.poId}`, 380, 758, 9);
  text(c, BUYER_LINES.join("  ·  "), 40, 740, 7);
  let y = 712;
  text(c, "Qty x Item @ Rate = Amount", 40, y, 8, true);
  y -= 16;
  inv.lines.forEach((l) => {
    text(c, `${l.qty} x ${l.item} (${l.description}) @ ${inr(l.price)}`, 40, y, 8.5);
    right(c, inr(amt(l)), 555, y, 8.5);
    y -= 15;
  });
  rule(c, y + 5);
  y -= 10;
  right(c, `Net ${inr(inv.subtotal)}   +   GST 18% ${inr(inv.tax)}   =   Total INR ${inr(inv.total)}`, 555, y, 9.5, true);
  text(c, `Terms: ${v.terms}`, 40, 120, 8);
}

async function render(inv: SeedInvoice) {
  const doc = await PDFDocument.create();
  doc.setTitle(`MOCK invoice ${inv.number}`);
  doc.setProducer("Nod demo (synthetic data)");
  doc.setCreationDate(new Date("2026-11-08T00:00:00Z"));
  doc.setModificationDate(new Date("2026-11-08T00:00:00Z"));
  const page = doc.addPage([595, 842]);
  const c: Ctx = { page, font: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  ({ classic, modern, compact })[vendorOf(inv.vendorId).layout](c, inv);
  watermark(c);
  return doc.save({ useObjectStreams: false });
}

async function main() {
  for (const [dir, list] of [["invoices", invoices], ["samples", samples]] as const) {
    const out = join(process.cwd(), "public", dir);
    mkdirSync(out, { recursive: true });
    for (const inv of list) writeFileSync(join(out, `${inv.id}.pdf`), await render(inv));
    console.log(`Wrote ${list.length} PDFs to public/${dir}`);
  }
}

main();
