import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const findMatch = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      const today = new Date().toISOString().split("T")[0];
      const newTime = profile.lastCallDate === today ? (profile.dailyCallTimeSeconds || 0) : 0;
      const tier = profile.subscriptionTier || "free";
      const limit = tier === "free" ? 15 * 60 : (tier === "pro" ? 2 * 60 * 60 : Infinity);

      if (newTime >= limit) {
        throw new Error("DAILY_LIMIT_REACHED");
      }
    }

    // Clear any existing active or waiting matches for this user
    const existingMatches = await ctx.db
      .query("matches")
      .filter((q) => 
        q.or(
          q.eq(q.field("user1"), userId),
          q.eq(q.field("user2"), userId)
        )
      )
      .filter((q) => q.neq(q.field("status"), "ended"))
      .collect();

    for (const match of existingMatches) {
      await ctx.db.patch(match._id, { status: "ended" });
    }

    // Find someone else waiting
    const waitingMatch = await ctx.db
      .query("matches")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .filter((q) => q.neq(q.field("user1"), userId)) // Don't match with self
      .first();

    if (waitingMatch) {
      // Join existing match
      await ctx.db.patch(waitingMatch._id, {
        user2: userId,
        status: "connecting",
        user2Status: "waiting"
      });
      return waitingMatch._id;
    } else {
      // Create new match
      return await ctx.db.insert("matches", {
        user1: userId,
        user1Status: "waiting",
        status: "waiting",
      });
    }
  },
});

export const getMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.matchId);
  },
});

export const updateMatchStatus = mutation({
  args: {
    matchId: v.id("matches"),
    action: v.union(v.literal("accept"), v.literal("decline"), v.literal("end")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;

    const match = await ctx.db.get(args.matchId);
    if (!match) return;

    const isUser1 = match.user1 === userId;
    const isUser2 = match.user2 === userId;
    
    if (!isUser1 && !isUser2) return;

    if (args.action === "end" || args.action === "decline") {
      await ctx.db.patch(args.matchId, {
        status: "ended",
        ...(isUser1 ? { user1Status: "declined" } : { user2Status: "declined" })
      });
      return;
    }

    if (args.action === "accept") {
      const updates = isUser1 ? { user1Status: "accepted" as const } : { user2Status: "accepted" as const };
      await ctx.db.patch(args.matchId, updates);
      
      // If both accepted, status becomes active
      const updatedMatch = await ctx.db.get(args.matchId);
      if (updatedMatch?.user1Status === "accepted" && updatedMatch?.user2Status === "accepted") {
        await ctx.db.patch(args.matchId, { status: "active" });
      }
    }
  },
});

export const setSDP = mutation({
  args: {
    matchId: v.id("matches"),
    type: v.union(v.literal("offer"), v.literal("answer")),
    sdp: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;

    if (args.type === "offer") {
      await ctx.db.patch(args.matchId, { sdpOffer: args.sdp });
    } else {
      await ctx.db.patch(args.matchId, { sdpAnswer: args.sdp });
    }
  },
});

export const addIceCandidate = mutation({
  args: {
    matchId: v.id("matches"),
    candidate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;

    await ctx.db.insert("iceCandidates", {
      matchId: args.matchId,
      senderId: userId,
      candidate: args.candidate,
    });
  },
});

export const getIceCandidates = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iceCandidates")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();
  },
});
