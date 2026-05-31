import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id("users"),
    nativeLanguage: v.optional(v.string()),
    learningLanguage: v.optional(v.string()),
    ageGroup: v.optional(v.string()), // e.g. "18-24", "25-34", etc.
    interests: v.optional(v.array(v.string())),
    game: v.optional(v.string()), // lowercase free‑text game name
    topics: v.optional(v.array(v.string())), // free‑text interests/topics
    debateTopic: v.optional(v.string()), // exact debate subject
    politicsTopic: v.optional(v.string()),
    subscriptionTier: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("premium"))),
    dailyCallTimeSeconds: v.optional(v.number()),
    lastCallDate: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  
  matches: defineTable({
    user1: v.id("users"),
    user2: v.optional(v.id("users")), // Null until matched
    user1Status: v.union(v.literal("waiting"), v.literal("accepted"), v.literal("declined")),
    user2Status: v.optional(v.union(v.literal("waiting"), v.literal("accepted"), v.literal("declined"))),
    status: v.union(v.literal("waiting"), v.literal("connecting"), v.literal("active"), v.literal("ended")),
    sdpOffer: v.optional(v.string()), // JSON stringified RTCSessionDescription
    sdpAnswer: v.optional(v.string()),
    user1Muted: v.optional(v.boolean()),
    user1VideoOff: v.optional(v.boolean()),
    user1Speaking: v.optional(v.boolean()),
    user2Muted: v.optional(v.boolean()),
    user2VideoOff: v.optional(v.boolean()),
    user2Speaking: v.optional(v.boolean()),
  }).index("by_status", ["status"]),
  
  iceCandidates: defineTable({
    matchId: v.id("matches"),
    senderId: v.id("users"),
    candidate: v.string(), // JSON stringified RTCIceCandidate
  }).index("by_matchId", ["matchId"]),
  
  reports: defineTable({
    reporterId: v.id("users"),
    reportedId: v.id("users"),
    reason: v.string(),
    details: v.optional(v.string()),
  }),
  
  favorites: defineTable({
    userId: v.id("users"),
    favoriteUserId: v.id("users"),
  }).index("by_user", ["userId"]),
  
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    payload: v.any(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  friends: defineTable({
    userId: v.id('users'),
    friendId: v.id('users'),
    status: v.string(), // 'pending' or 'accepted'
    createdAt: v.float64(),
  }).index('by_user', ['userId']),
});
