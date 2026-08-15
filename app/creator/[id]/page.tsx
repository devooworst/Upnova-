import ResponsiveProfile from "@/components/ResponsiveProfile";

/* Every creator URL resolves against the database — any real user's
   handle works here, nothing is limited to a hardcoded list. */

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `@${params.id}` };
}

export default function CreatorPage({ params }: { params: { id: string } }) {
  return <ResponsiveProfile handle={params.id} />;
}
