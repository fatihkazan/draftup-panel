import { redirect } from "next/navigation";

export default function SubscriptionRedirectPage() {
  redirect("/settings/subscription");
}
