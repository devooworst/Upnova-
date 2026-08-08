import { notFound } from "next/navigation";
import { creators } from "@/lib/data";
import CreatorProfile from "@/components/CreatorProfile";

export function generateStaticParams() {
  return creators.map((c) => ({ id: c.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const c = creators.find((x) => x.id === params.id);
  return { title: c ? c.name : "Creator" };
}

export default function CreatorPage({ params }: { params: { id: string } }) {
  const creator = creators.find((c) => c.id === params.id);
  if (!creator) notFound();
  return <CreatorProfile id={params.id} />;
}
