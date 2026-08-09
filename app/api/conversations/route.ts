import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { canMessage } from "@/lib/server/authz";
import { blockedEitherWay } from "@/lib/server/communities";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/conversations — the authenticated user's conversation list. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();

    const memberships = db
      .select()
      .from(tables.conversationMembers)
      .where(eq(tables.conversationMembers.userId, user.id))
      .all();
    const convIds = memberships.map((m) => m.conversationId);
    if (convIds.length === 0) return { conversations: [] };

    const allMembers = db
      .select({ member: tables.conversationMembers, user: tables.users, profile: tables.profiles })
      .from(tables.conversationMembers)
      .innerJoin(tables.users, eq(tables.conversationMembers.userId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(inArray(tables.conversationMembers.conversationId, convIds))
      .all();

    const lastMessages = db
      .select()
      .from(tables.messages)
      .where(inArray(tables.messages.conversationId, convIds))
      .orderBy(desc(tables.messages.createdAt))
      .all();

    const myLastRead = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt?.getTime() ?? 0]));

    const conversations = convIds.map((id) => {
      const other = allMembers.find((m) => m.member.conversationId === id && m.user.id !== user.id);
      const msgs = lastMessages.filter((m) => m.conversationId === id);
      const last = msgs[0];
      const unread = msgs.filter(
        (m) => m.senderId !== user.id && m.createdAt.getTime() > (myLastRead.get(id) ?? 0)
      ).length;
      const project = db
        .select()
        .from(tables.projects)
        .where(eq(tables.projects.conversationId, id))
        .orderBy(desc(tables.projects.updatedAt))
        .get();
      const booking = db
        .select()
        .from(tables.bookings)
        .where(eq(tables.bookings.conversationId, id))
        .orderBy(desc(tables.bookings.createdAt))
        .get();
      return {
        id,
        with: other ? publicUser(other.user, other.profile) : null,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt.toISOString(), mine: last.senderId === user.id } : null,
        unread,
        projectId: project?.id ?? null,
        projectState: project?.state ?? null,
        booking: booking
          ? { id: booking.id, title: booking.title, startsAt: booking.startsAt.toISOString(), status: booking.status, price: booking.price }
          : null,
      };
    });

    conversations.sort(
      (a, b) =>
        (b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0) -
        (a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0)
    );
    return { conversations };
  });
}

/**
 * POST /api/conversations { toHandle, firstMessage? }
 * Opens (or returns) the conversation with that user — the ONLY way a
 * conversation starts. Never defaults to anyone.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const handle = String(body.toHandle || "").trim().toLowerCase();
    if (!handle) throw new ApiError(400, "toHandle is required");

    const target = db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
    if (!target || target.status !== "active") throw new ApiError(404, "User not found");
    if (target.id === user.id) throw new ApiError(400, "You can't message yourself");
    const targetProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, target.id)).get()!;
    if (!canMessage(targetProfile, user.id))
      throw new ApiError(403, "This creator isn't accepting messages from you");
    // blocks work both ways — same neutral message either direction, so the
    // response never reveals who blocked whom
    if (blockedEitherWay(user.id, target.id))
      throw new ApiError(403, "This creator isn't accepting messages from you");

    // find existing 1:1 conversation
    const mine = db
      .select()
      .from(tables.conversationMembers)
      .where(eq(tables.conversationMembers.userId, user.id))
      .all()
      .map((m) => m.conversationId);
    let convId: string | null = null;
    if (mine.length) {
      const theirs = db
        .select()
        .from(tables.conversationMembers)
        .where(inArray(tables.conversationMembers.conversationId, mine))
        .all();
      convId = theirs.find((m) => m.userId === target.id)?.conversationId ?? null;
    }

    if (!convId) {
      convId = randomBytes(12).toString("hex");
      db.insert(tables.conversations).values({ id: convId }).run();
      db.insert(tables.conversationMembers).values([
        { conversationId: convId, userId: user.id },
        { conversationId: convId, userId: target.id },
      ]).run();
    }

    const first = String(body.firstMessage || "").trim();
    if (first) {
      db.insert(tables.messages)
        .values({ id: randomBytes(12).toString("hex"), conversationId: convId, senderId: user.id, body: first })
        .run();
    }

    return { conversationId: convId };
  });
}
