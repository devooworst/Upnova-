/* ------------------------------------------------------------------ */
/*  Authorization — app-layer equivalents of the RLS policies in       */
/*  db/rls.sql. Every mutation route calls one of these before         */
/*  touching data. When production moves to Postgres, RLS enforces     */
/*  the same rules at the database level as a second line of defense.  */
/* ------------------------------------------------------------------ */

import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "./auth";

export function isConversationMember(conversationId: string, userId: string): boolean {
  const row = db
    .select({ userId: tables.conversationMembers.userId })
    .from(tables.conversationMembers)
    .where(
      and(
        eq(tables.conversationMembers.conversationId, conversationId),
        eq(tables.conversationMembers.userId, userId)
      )
    )
    .get();
  return !!row;
}

export function requireConversationMember(conversationId: string, userId: string) {
  if (!isConversationMember(conversationId, userId))
    throw new ApiError(403, "Not a member of this conversation");
}

export function getProjectForParty(projectId: string, userId: string) {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  if (project.clientId !== userId && project.creatorId !== userId)
    throw new ApiError(403, "Not a party to this project");
  return project;
}

export function requireServiceOwner(serviceId: string, userId: string) {
  const service = db.select().from(tables.services).where(eq(tables.services.id, serviceId)).get();
  if (!service) throw new ApiError(404, "Service not found");
  if (service.ownerId !== userId) throw new ApiError(403, "Not your service");
  return service;
}

export function requireOpportunityPoster(opportunityId: string, userId: string) {
  const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, opportunityId)).get();
  if (!opp) throw new ApiError(404, "Opportunity not found");
  if (opp.posterId !== userId) throw new ApiError(403, "Not your opportunity");
  return opp;
}

export function hasWorkedTogether(a: string, b: string): boolean {
  const row = db
    .select({ id: tables.projects.id })
    .from(tables.projects)
    .where(
      and(
        eq(tables.projects.clientId, a < b ? a : b),
        eq(tables.projects.creatorId, a < b ? b : a)
      )
    )
    .get();
  if (row) return true;
  const rev = db
    .select({ id: tables.projects.id })
    .from(tables.projects)
    .where(
      and(
        eq(tables.projects.clientId, a < b ? b : a),
        eq(tables.projects.creatorId, a < b ? a : b)
      )
    )
    .get();
  return !!rev;
}

/** Can `viewerId` open a conversation with the owner of `targetProfile`? */
export function canMessage(
  targetProfile: typeof tables.profiles.$inferSelect,
  viewerId: string
): boolean {
  if (targetProfile.userId === viewerId) return false;
  switch (targetProfile.whoCanMessage) {
    case "nobody":
      return false;
    case "everyone":
      return true;
    case "following": {
      // target must follow the viewer ("people I follow")
      const row = db
        .select({ followerId: tables.follows.followerId })
        .from(tables.follows)
        .where(
          and(eq(tables.follows.followerId, targetProfile.userId), eq(tables.follows.followingId, viewerId))
        )
        .get();
      return !!row;
    }
    case "worked":
      return hasWorkedTogether(targetProfile.userId, viewerId);
    default:
      return true;
  }
}
