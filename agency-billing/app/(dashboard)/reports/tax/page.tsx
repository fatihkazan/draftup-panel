import { redirect } from "next/navigation";

export default function TaxReportRedirect() {
  redirect("/reports?report=tax");
}
