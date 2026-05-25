import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: salon } = await admin.from("salons").select("id").eq("slug", slug).single();

  if (!salon) notFound();
  redirect(`/s/${salon.id}`);
}
