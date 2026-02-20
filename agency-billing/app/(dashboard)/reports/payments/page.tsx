import { redirect } from "next/navigation";

export default function PaymentsReportRedirect() {
  redirect("/reports?report=payments");
}
