import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const sendFriendRequest = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Check for reciprocal pending request
    const existing = await ctx.db
      .query("friends")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.targetId),
          q.eq(q.field("friendId"), userId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existing) {
      // Accept both sides
      await ctx.db.patch(existing._id, { status: "accepted" });
      await ctx.db.insert("friends", {
        userId,
        friendId: args.targetId,
        status: "accepted",
        createdAt: Date.now(),
      });
      // Create notifications for both users
      await ctx.db.insert("notifications", {
        userId: args.targetId,
        type: "friend-request-accepted",
        payload: { from: userId },
        read: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        userId,
        type: "friend-request-accepted",
        payload: { from: args.targetId },
        read: false,
        createdAt: Date.now(),
      });
    } else {
      // Create pending request
      await ctx.db.insert("friends", {
        userId,
        friendId: args.targetId,
        status: "pending",
        createdAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        userId: args.targetId,
        type: "friend-request",
        payload: { from: userId },
        read: false,
        createdAt: Date.now(),
      });
    }
  },
});

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("friends")
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("userId"), userId), q.eq(q.field("friendId"), userId)),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect();
  },
});

export const listPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("friends")
      .filter((q) => q.and(q.eq(q.field("friendId"), userId), q.eq(q.field("status"), "pending")))
      .collect();
  },
});

export const updateFriendStatus = mutation({
  args: { friendRecordId: v.id("friends"), action: v.union(v.literal("decline"), v.literal("remove")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    
    const record = await ctx.db.get(args.friendRecordId);
    if (!record) throw new Error("Record not found");
    
    // Make sure user is part of the relationship
    if (record.userId !== userId && record.friendId !== userId) {
      throw new Error("Unauthorized");
    }
    
    // If declining or removing, we just delete the record(s)
    await ctx.db.delete(args.friendRecordId);
    
    // If it was accepted, there might be a reciprocal record to delete as well
    if (record.status === "accepted") {
      const reciprocal = await ctx.db
        .query("friends")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), record.friendId),
            q.eq(q.field("friendId"), record.userId)
          )
        )
        .first();
      
      if (reciprocal) {
        await ctx.db.delete(reciprocal._id);
      }
    }
  }
});
