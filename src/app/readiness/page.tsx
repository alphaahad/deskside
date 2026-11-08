import type { Metadata } from "next";
import { Readiness } from "./Readiness";

export const metadata: Metadata = { title: "Deployment readiness · Deskside" };

export default function ReadinessPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Next · thin slice</p>
      <h1 className="mt-1 text-2xl font-semibold">Deployment readiness</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Before a customer goes live, run a handful of their real invoices through the same read and 3-way match Meera uses, without posting anything.
        You see which would be decided automatically and which would come to a person, with the reason. It sets expectations for the first week
        and shows where master data needs fixing first.
      </p>
      <Readiness />
      <p className="mt-6 text-xs text-muted">
        Mock data: the samples and the POs and receipts they are matched against are synthetic. Uploaded PDFs are read by Gemini and matched against the same mock master data, so
        a real invoice will almost always go to review (its PO isn&apos;t in the mock ERP). Nothing is stored beyond the cached read.
      </p>
    </div>
  );
}
