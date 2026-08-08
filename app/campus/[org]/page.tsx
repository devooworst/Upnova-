import { notFound } from "next/navigation";
import { campusOrgs } from "@/lib/data";
import OrgPage from "@/components/OrgPage";

export function generateStaticParams() {
  return campusOrgs.map((o) => ({ org: o.id }));
}

export function generateMetadata({ params }: { params: { org: string } }) {
  const o = campusOrgs.find((x) => x.id === params.org);
  return { title: o ? o.name : "Organization" };
}

export default function CampusOrgPage({ params }: { params: { org: string } }) {
  const org = campusOrgs.find((o) => o.id === params.org);
  if (!org) notFound();
  return <OrgPage id={params.org} />;
}
