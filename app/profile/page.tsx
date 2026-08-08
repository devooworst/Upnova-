import type { Metadata } from "next";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabs from "@/components/profile/ProfileTabs";

export const metadata: Metadata = {
  title: "Devin Carter",
  description:
    "Music producer, content creator, and entrepreneur on UpNova — portfolio, services, and opportunities.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <ProfileHeader />
      <ProfileTabs />
    </div>
  );
}
