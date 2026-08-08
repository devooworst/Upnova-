import { notFound } from "next/navigation";
import { events } from "@/lib/data";
import EventDetail from "@/components/EventDetail";

export function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const e = events.find((x) => x.id === params.id);
  return { title: e ? e.title : "Event" };
}

export default function EventPage({ params }: { params: { id: string } }) {
  const event = events.find((e) => e.id === params.id);
  if (!event) notFound();
  return <EventDetail id={params.id} />;
}
