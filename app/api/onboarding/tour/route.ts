import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, isDemoMode } from "@/lib/server/auth";
import { campusVerification } from "@/lib/server/campus";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/tour — the personalized first-run tour, computed
 * SERVER-SIDE from the real account: account type (business vs
 * personal), verified-student status, and plan. The steps reference
 * real navigation targets (data-tour anchors on the actual interface);
 * nothing here is a fake copy of the app. Honest by design: plan
 * differences are mentioned naturally, never as an ad, and nothing in
 * the tour gates anything.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const v = campusVerification(user.id);
    const campus = v ? db.select().from(tables.campuses).where(eq(tables.campuses.id, v.campusId)).get() : null;
    const isStudent = !!v && v.affiliation === "current_student";
    const isBusiness = row.accountType === "business";
    const audience = isBusiness ? "business" : isStudent ? "student" : "creator";
    const plan = row.plan;

    type Step = { id: string; target: string; title: string; body: string; href?: string };
    const steps: Step[] = [];
    const add = (s: Step) => steps.push(s);

    add({
      id: "home",
      target: "home",
      title: "Home",
      body: "Home is where your UpNova world comes together — posts, updates, people you follow, opportunities, and activity relevant to you.",
      href: "/",
    });
    add({
      id: "discover",
      target: "discover",
      title: "Discover",
      body: isBusiness
        ? "Discover creators and talent for your projects — search by skill, location, and interest."
        : "Discover people, creators, businesses, communities, and opportunities based on what you're interested in.",
      href: "/discover",
    });
    add({
      id: "search",
      target: "search",
      title: "Search",
      body: "Want to find someone? Search people by username or name — plus opportunities, services, communities, and posts, all from one box.",
      href: "/search",
    });
    add({
      id: "communities",
      target: "communities",
      title: "Communities",
      body: "Join communities around your craft, your city, or your school — conversations that go deeper than a feed.",
      href: "/communities",
    });
    add({
      id: "opportunities",
      target: "opportunities",
      title: "Opportunities",
      body: isBusiness
        ? "Post opportunities to find talent — gigs, roles, and collaborations. Applicants come to you with real profiles and work history."
        : isStudent
          ? "Find work, collaborations, and career opportunities — including ones scoped to your school. Eligibility can depend on verification or an opportunity's requirements, and it's always shown up front."
          : "Find opportunities to work, collaborate, create, and grow. Some have eligibility requirements (like student verification) — they're always shown honestly up front.",
      href: "/opportunities",
    });
    add({
      id: "services",
      target: "services",
      title: "Services",
      body: isBusiness
        ? "Book creators' services for your business — browse, message, book, and manage the whole engagement on UpNova."
        : "Need something done — or offering something yourself? Browse, message, book, and manage the entire service process through UpNova.",
      href: "/services",
    });
    add({
      id: "messages",
      target: "messages",
      title: "Messages",
      body: "Conversations live here — and they connect to everything: bookings, projects, applications, and payments show their progress right inside the thread.",
      href: "/messages",
    });
    add({
      id: "notifications",
      target: "notifications",
      title: "Notifications",
      body: "You're kept updated when something important happens: messages, booking requests, project and payment updates, applications, and account security events. You control the channels in Settings.",
      href: "/notifications",
    });
    add({
      id: "calendar",
      target: "calendar",
      title: "Bookings & dates",
      body: isBusiness
        ? "Track your organization's bookings, appointments, and important dates in one place."
        : isStudent
          ? "Appointments, bookings, campus events, and deadlines — everything with a date lives here."
          : "Keep track of events, appointments, bookings, and important dates.",
      href: "/calendar",
    });
    if (isStudent && campus)
      add({
        id: "campus",
        target: "campus",
        title: "Your Campus",
        body: `You're verified at ${campus.name} — that unlocks your campus space: student communities, campus events, the student marketplace, and school-scoped opportunities. Campus access comes from verification, never from a paid plan.`,
        href: "/campus",
      });
    add({
      id: "profile",
      target: "profile",
      title: isBusiness ? "Your Business profile" : "Your profile",
      body: isBusiness
        ? "Your organization's home on UpNova: represent your brand, list open roles, and show your work. Verification is earned through the business-verification process."
        : isStudent
          ? "Your UpNova identity — who you are, what you do, your work and experience. As a verified student, your school and class year can appear here (you control that in Settings)."
          : "Your UpNova identity — show people who you are, what you do, your work, services, and experience.",
      href: "/profile",
    });
    add({
      id: "myworld",
      target: "profile",
      title: isBusiness ? "Business World" : "My World",
      body:
        (isBusiness
          ? "Make your business page feel like your brand — themes, layout, and presentation."
          : "This is your world. Arrange your profile, showcase your work, and make your page feel like you.") +
        (plan === "free"
          ? " Members on College+ and Pro unlock deeper Profile Studio customization — everything essential works on the free plan."
          : plan === "college"
            ? " College+ includes student Studio themes; Pro adds the full canvas."
            : ""),
      href: "/profile/studio",
    });
    add({
      id: "settings",
      target: "settings",
      title: "Settings",
      body: "Account, security, notification preferences, and help live in Settings — including replaying this tour whenever you want.",
      href: "/settings",
    });

    return {
      audience,
      demoMode: isDemoMode() ? (row.testerMode === "simulation" ? "simulation" : "demo") : null,
      steps,
    };
  });
}
