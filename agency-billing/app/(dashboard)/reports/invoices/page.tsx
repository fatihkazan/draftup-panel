import { redirect } from "next/navigation";

export default function InvoiceStatusReportRedirect() {
  redirect("/reports?report=invoices");
}
