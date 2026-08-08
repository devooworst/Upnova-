import Stories from "@/components/Stories";
import CreatePost from "@/components/CreatePost";
import Feed from "@/components/Feed";
import RightSidebar from "@/components/RightSidebar";

export default function Home() {
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-5">
        {/* Near You heading */}
        <header className="px-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
            Near You
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Discover creators, opportunities, communities, and events around you.
          </p>
        </header>

        <Stories />
        <CreatePost />
        <Feed />
      </div>

      <RightSidebar />
    </div>
  );
}
