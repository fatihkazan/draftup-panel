import { redirect } from "next/navigation";

export default async function AdminUserDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/settings/admin-management/${id}`);
}
