import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import CreateModal from "@/components/CreateModal";
import { FollowProvider } from "@/lib/follow";

export const metadata: Metadata = {
  title: {
    default: "UpNova · Find what's happening around you",
    template: "%s • UpNova",
  },
  description:
    "UpNova is a local-first platform where creators, businesses, and everyday people discover each other, find opportunities, offer services, build communities, attend events, collaborate, and make money.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('upnova-theme');var l=t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches);if(l)document.documentElement.classList.add('light')}catch(e){}})()",
          }}
        />
      </head>
      <body className="min-h-screen font-sans">
        <FollowProvider>
        <Navbar />
        <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-3 pb-24 pt-[8rem] sm:px-4 md:pb-10 md:pt-20 lg:px-6">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <MobileNav />
        <CreateModal />
        </FollowProvider>
      </body>
    </html>
  );
}
