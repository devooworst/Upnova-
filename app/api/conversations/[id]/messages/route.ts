import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { requireConversationMember } from "@/lib/server/authz";
import { notify } from "@/lib/server/notify";
import { maybeAutoReply } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** GET — messages in a conversation (members only). Marks as read. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    requireConversationMember(params.id, user.id);

    const msgs = db
      .select()
      .from(tables.messages)
      .where(eq(tables.messages.conversationId, params.id))
      .orderBy(asc(tables.messages.createdAt))
      .all();

    db.update(tables.conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(tables.conversationMembers.conversationId, params.id),
          eq(tables.conversationMembers.userId, user.id)
        )
      )
      .run();

    return {
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderId === user.id,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}

/** POST — send a message (members only). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    requireConversationMember(params.id, user.id);
    const text = String(body.body || "").trim();
    if (!text) throw new ApiError(400, "Message is required");
    if (text.length > 4000) throw new ApiError(400, "Message is too long");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.messages)
      .values({ id, conversationId: params.id, senderId: user.id, body: text })
      .run();
    db.update(tables.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(tables.conversations.id, params.id))
      .run();

    // notify the other member(s) — routed to the exact conversation
    const members = db
      .select()
      .from(tables.conversationMembers)
      .where(eq(tables.conversationMembers.conversationId, params.id))
      .all();
    for (const m of members) {
      if (m.userId === user.id) continue;
      notify({
        userId: m.userId,
        actorId: user.id,
        type: "message",
        title: `New message from ${user.profile.displayName}`,
        body: text.slice(0, 80),
        href: `/messages?c=${params.id}`,
      });
    }

    // dev demo: seed users reply so conversations feel alive
    maybeAutoReply(params.id, user.id);

    return { id };
  });
}
