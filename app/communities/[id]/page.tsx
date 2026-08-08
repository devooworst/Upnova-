import { notFound } from "next/navigation";
import { communities } from "@/lib/data";
import CommunityView from "@/components/CommunityView";

export function generateStaticParams() {
  return communities.map((c) => ({ id: c.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const c = communities.find((x) => x.id === params.id);
  return { title: c ? c.name : "Community" };
}

export default function CommunityPage({ params }: { params: { id: string } }) {
  const community = communities.find((c) => c.id === params.id);
  if (!community) notFound();
  return <CommunityView id={params.id} />;
}
