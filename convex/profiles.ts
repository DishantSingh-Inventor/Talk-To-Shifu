import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const updateProfile = mutation({
  args: {
    nativeLanguage: v.optional(v.string()),
    learningLanguage: v.optional(v.string()),
    ageGroup: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    game: v.optional(v.string()),
    topics: v.optional(v.array(v.string())),
    debateTopic: v.optional(v.string()),
    politicsTopic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        ...args,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        ...args,
      });
    }
  },
});

export const incrementCallTime = mutation({
  args: {
    matchId: v.id("matches"),
    intervalSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return { allowed: false, reason: "no_profile" };

    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== "active") return { allowed: false, reason: "invalid_match" };

    // Check if the other user is a friend
    const otherUserId = match.user1 === userId ? match.user2 : match.user1;
    let isFriend = false;
    if (otherUserId) {
      const friendship1 = await ctx.db.query("friends").withIndex("by_user", q => q.eq("userId", userId)).filter(q => q.eq(q.field("friendId"), otherUserId)).first();
      const friendship2 = await ctx.db.query("friends").withIndex("by_user", q => q.eq("userId", otherUserId)).filter(q => q.eq(q.field("friendId"), userId)).first();
      if ((friendship1 && friendship1.status === "accepted") || (friendship2 && friendship2.status === "accepted")) {
        isFriend = true;
      }
    }

    if (isFriend) {
      return { allowed: true };
    }

    const today = new Date().toISOString().split("T")[0];
    let newTime = profile.dailyCallTimeSeconds || 0;
    
    if (profile.lastCallDate !== today) {
      newTime = 0;
    }

    newTime += args.intervalSeconds;
    
    const tier = profile.subscriptionTier || "free";
    const limit = tier === "free" ? 15 * 60 : (tier === "pro" ? 2 * 60 * 60 : Infinity);

    await ctx.db.patch(profile._id, {
      dailyCallTimeSeconds: newTime,
      lastCallDate: today,
    });

    if (newTime >= limit) {
      return { allowed: false, reason: "limit_reached" };
    }

    return { allowed: true };
  }
});
