import { redirect } from "next/navigation";

export default function RevenueReportRedirect() {
  redirect("/reports?report=revenue");
}
