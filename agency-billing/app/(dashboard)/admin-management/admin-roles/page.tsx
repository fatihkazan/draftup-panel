import { redirect } from "next/navigation";

export default function AdminRolesRedirectPage() {
  redirect("/settings/admin-roles");
}
