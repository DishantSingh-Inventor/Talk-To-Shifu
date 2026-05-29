import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const createNotification = mutation({
  args: { type: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    await ctx.db.insert("notifications", {
      userId,
      type: args.type,
      payload: args.payload,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== userId) throw new Error("Invalid notification");
    await ctx.db.patch(args.notificationId, { read: true });
  },
});
