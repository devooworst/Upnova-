import { notFound } from "next/navigation";
import { events } from "@/lib/data";
import EventManager from "@/components/EventManager";

export function generateStaticParams() {
  return events.filter((e) => e.organizedByYou).map((e) => ({ id: e.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const e = events.find((x) => x.id === params.id);
  return { title: e ? `Manage · ${e.title}` : "Event Manager" };
}

export default function EventManagePage({ params }: { params: { id: string } }) {
  const event = events.find((e) => e.id === params.id);
  if (!event || !event.organizedByYou) notFound();
  return <EventManager id={params.id} />;
}
