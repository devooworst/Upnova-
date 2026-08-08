import type { Metadata } from "next";
import ProfileView from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Devin Carter",
  description:
    "Music producer, content creator, and entrepreneur on UpNova — portfolio, services, and opportunities.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <ProfileView />
    </div>
  );
}
