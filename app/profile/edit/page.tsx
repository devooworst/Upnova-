import type { Metadata } from "next";
import EditProfile from "@/components/profile/EditProfile";

export const metadata: Metadata = {
  title: "Edit Profile",
  description:
    "Update how people see you, what you do, and what you're available for — profile, professional identity, work, verification, links, and privacy.",
};

export default function EditProfilePage() {
  return <EditProfile />;
}
