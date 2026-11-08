// All MOCK data. Vendors, POs, receipts, invoices and history are invented for this demo.
// Deterministic: the same seed every run, so the demo and the tests are reproducible.
import type { Line, PaidBill, Person, PurchaseOrder, Receipt, SeedInvoice, Vendor } from "../types";

export const BUYER = "Acme Fulfilment India Pvt Ltd (mock)";

export const vendors: Vendor[] = [
  { id: "V1", name: "Haldenwerk Steel Supplies Pvt Ltd", gstin: "29AAHCH4471K1Z5", city: "Bengaluru", email: "billing@haldenwerk.example", terms: "Net 30", layout: "classic" },
  { id: "V2", name: "Kaveri Packaging Co", gstin: "33AAKCK2210P1Z2", city: "Chennai", email: "accounts@kaveripack.example", terms: "Net 45", layout: "modern" },
  { id: "V3", name: "Saffron Office Supplies", gstin: "27AASFS9921Q1Z8", city: "Mumbai", email: "invoices@saffronoffice.example", terms: "Net 30", layout: "compact" },
  { id: "V4", name: "Brightline Electricals LLP", gstin: "07AAJFB5532M1Z1", city: "New Delhi", email: "ar@brightline.example", terms: "Net 30", layout: "classic" },
  { id: "V5", name: "Coastal Chemicals Ltd", gstin: "24AACCC7781R1Z9", city: "Ahmedabad", email: "billing@coastalchem.example", terms: "Net 60", layout: "modern" },
];

const ITEMS: Record<string, { description: string; price: number; vendor: string }> = {
  "HS-PL6": { description: "MS plate 6mm", price: 1000, vendor: "V1" },
  "HS-AN40": { description: "Angle 40x40x5", price: 640, vendor: "V1" },
  "HS-BLT12": { description: "Hex bolt M12 (box)", price: 420, vendor: "V1" },
  "KP-BX5": { description: "5-ply carton 18x12x12", price: 38, vendor: "V2" },
  "KP-TP48": { description: "BOPP tape 48mm", price: 52, vendor: "V2" },
  "KP-SW": { description: "Stretch wrap roll", price: 610, vendor: "V2" },
  "SO-A4": { description: "A4 paper ream", price: 265, vendor: "V3" },
  "SO-TNR": { description: "Toner cartridge 88A", price: 2150, vendor: "V3" },
  "SO-CHR": { description: "Task chair", price: 6400, vendor: "V3" },
  "BL-LED40": { description: "LED panel 40W", price: 1500, vendor: "V4" },
  "BL-CBL25": { description: "Cable 2.5 sq mm (90m)", price: 2890, vendor: "V4" },
  "BL-MCB": { description: "MCB 32A", price: 315, vendor: "V4" },
  "CC-IPA": { description: "Isopropyl alcohol 20L", price: 2400, vendor: "V5" },
  "CC-DGR": { description: "Degreaser 5L", price: 780, vendor: "V5" },
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const line = (item: string, qty: number, price = ITEMS[item].price): Line => ({ item, description: ITEMS[item].description, qty, price });

type Spec = {
  n: number; // INV-44nn and PO-22nn / GRN-55nn share the suffix, so the demo is easy to follow
  vendor: string;
  number: string;
  date: string;
  po: Line[];
  received?: Record<string, number> | null; // null = no goods receipt at all
  billed?: Line[]; // what the invoice says; defaults to the PO
  wave?: 1 | 2;
  scenario: string;
};

const SPECS: Spec[] = [
  { n: 60, vendor: "V2", number: "KPC-0391", date: "2026-10-28", po: [line("KP-BX5", 800), line("KP-TP48", 120)], scenario: "clean" },
  { n: 61, vendor: "V3", number: "SOS/26-27/1182", date: "2026-10-29", po: [line("SO-A4", 60), line("SO-TNR", 4)], scenario: "clean" },
  { n: 62, vendor: "V1", number: "HSS-INV-3381", date: "2026-10-29", po: [line("HS-AN40", 40)], scenario: "clean" },
  { n: 63, vendor: "V4", number: "BLE/1027", date: "2026-10-30", po: [line("BL-CBL25", 6)], billed: [line("BL-CBL25", 6, 2925)], scenario: "price +1.2%, within the 2% tolerance: passes with a warning" },
  { n: 64, vendor: "V5", number: "CCL-24-5520", date: "2026-10-30", po: [line("CC-DGR", 30)], scenario: "clean" },
  { n: 65, vendor: "V2", number: "KPC-0398", date: "2026-10-31", po: [line("KP-SW", 25)], scenario: "clean" },
  { n: 66, vendor: "V3", number: "SOS/26-27/1190", date: "2026-10-31", po: [line("SO-CHR", 5)], received: null, scenario: "EXCEPTION: no goods receipt" },
  { n: 67, vendor: "V1", number: "HSS-INV-3385", date: "2026-11-01", po: [line("HS-BLT12", 60)], scenario: "clean" },
  { n: 68, vendor: "V4", number: "BLE/1031", date: "2026-11-01", po: [line("BL-MCB", 80)], scenario: "clean" },
  { n: 69, vendor: "V5", number: "CCL-24-5534", date: "2026-11-02", po: [line("CC-IPA", 10)], scenario: "clean" },
  { n: 70, vendor: "V2", number: "KPC-0402", date: "2026-11-02", po: [line("KP-BX5", 1200)], scenario: "clean" },
  { n: 71, vendor: "V1", number: "HSS-INV-3392", date: "2026-11-03", po: [line("HS-PL6", 50)], billed: [line("HS-PL6", 50, 1060)], scenario: "EXCEPTION: price ₹1,060 vs PO ₹1,000 (+6%)" },
  { n: 72, vendor: "V3", number: "SOS/26-27/1201", date: "2026-11-03", po: [line("SO-A4", 40)], scenario: "clean" },
  { n: 73, vendor: "V4", number: "BLE/1036", date: "2026-11-04", po: [line("BL-LED40", 20)], scenario: "clean" },
  { n: 74, vendor: "V2", number: "KPC-42", date: "2026-11-04", po: [line("KP-SW", 50), line("KP-TP48", 450)], scenario: "EXCEPTION: duplicate of KPC/0042, already paid" },
  { n: 75, vendor: "V5", number: "CCL-24-5541", date: "2026-11-05", po: [line("CC-DGR", 40)], scenario: "clean" },
  { n: 76, vendor: "V1", number: "HSS-INV-3398", date: "2026-11-05", po: [line("HS-AN40", 25), line("HS-BLT12", 20)], scenario: "clean" },
  { n: 77, vendor: "V4", number: "BLE/1040", date: "2026-11-06", po: [line("BL-LED40", 120)], received: { "BL-LED40": 100 }, scenario: "EXCEPTION: billed 120, received 100 (+20%); over the clerk's limit" },
  { n: 78, vendor: "V3", number: "SOS/26-27/1214", date: "2026-11-06", po: [line("SO-TNR", 6)], scenario: "clean" },
  { n: 79, vendor: "V5", number: "CCL-24-5550", date: "2026-11-07", po: [line("CC-IPA", 8)], scenario: "clean" },
  // Wave 2: "new mail" that arrives after the user has taught a rule.
  { n: 80, vendor: "V2", number: "KPC-0417", date: "2026-11-08", po: [line("KP-BX5", 600)], wave: 2, scenario: "clean" },
  { n: 81, vendor: "V5", number: "CCL-24-5562", date: "2026-11-08", po: [line("CC-DGR", 107)], received: { "CC-DGR": 100 }, wave: 2, scenario: "billed 107, received 100 (+7%): passes by default (10%), held under a 5% rule" },
  { n: 82, vendor: "V1", number: "HSS-INV-3407", date: "2026-11-08", po: [line("HS-BLT12", 30)], wave: 2, scenario: "clean" },
];

const total = (lines: Line[]) => r2(lines.reduce((s, l) => s + l.qty * l.price, 0));

export const purchaseOrders: PurchaseOrder[] = SPECS.map((s) => ({
  id: `PO-22${s.n}`,
  vendorId: s.vendor,
  date: shiftDate(s.date, -12),
  // The PO for INV-4477 / 4481 ordered what was billed; the shortfall is on the receipt.
  lines: s.po,
}));

export const receipts: Receipt[] = SPECS.filter((s) => s.received !== null).map((s) => ({
  id: `GRN-55${s.n}`,
  poId: `PO-22${s.n}`,
  date: shiftDate(s.date, -2),
  lines: s.po.map((l) => ({ item: l.item, received: s.received?.[l.item] ?? l.qty })),
}));

export const invoices: SeedInvoice[] = SPECS.map((s) => {
  const lines = s.billed ?? s.po;
  const subtotal = total(lines);
  const tax = r2(subtotal * 0.18);
  return {
    id: `INV-44${s.n}`,
    vendorId: s.vendor,
    number: s.number,
    date: s.date,
    poId: `PO-22${s.n}`,
    lines,
    subtotal,
    tax,
    total: r2(subtotal + tax),
    wave: s.wave ?? 1,
    scenario: s.scenario,
  };
});

/** Bills already paid before today: what duplicate detection compares against. */
export const paidBills: PaidBill[] = [
  { vendorId: "V2", number: "KPC/0042", total: invoices.find((i) => i.id === "INV-4474")!.total, paidOn: "2026-10-14", billId: "VB-8812" },
  { vendorId: "V1", number: "HSS-INV-3301", total: 47_200, paidOn: "2026-10-10", billId: "VB-8790" },
  { vendorId: "V3", number: "SOS/26-27/1105", total: 21_830, paidOn: "2026-10-18", billId: "VB-8831" },
];

export const people: Person[] = [
  { id: "priya", name: "Priya", role: "clerk", title: "AP clerk", limit: 100_000 },
  { id: "arjun", name: "Arjun", role: "lead", title: "Finance lead", limit: null },
];

export const EMPLOYEE = { name: "Meera", title: "AP digital employee" };

export const vendorOf = (id: string) => vendors.find((v) => v.id === id)!;
export const poOf = (id: string) => purchaseOrders.find((p) => p.id === id);
export const receiptFor = (poId: string) => receipts.find((r) => r.poId === poId);
export const seedInvoice = (id: string) => invoices.find((i) => i.id === id);
export const personOf = (id: string) => people.find((p) => p.id === id) ?? people[0];

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
