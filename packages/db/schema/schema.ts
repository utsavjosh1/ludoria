import * as s from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * USERS TABLE
 */
export const users = s.sqliteTable("users", {
  id: s.text("id").primaryKey().notNull(),

  email: s.text("email").notNull().unique(),

  name: s.text("name").notNull(),

  picture: s.text("picture"), // optional

  googleId: s.text("google_id").notNull().unique(),

  createdAt: s
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .defaultNow(),

  updatedAt: s
    .integer("updated_at", { mode: "timestamp" })
    .notNull()
    .defaultNow(),

  lastLogin: s.integer("last_login", { mode: "timestamp" }),
});

/**
 * REFRESH TOKENS TABLE
 */
export const refreshTokens = s.sqliteTable("refresh_tokens", {
  id: s.text("id").primaryKey().notNull(),

  token: s.text("token").notNull().unique(),

  userId: s
    .text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  expiresAt: s.integer("expires_at", { mode: "timestamp" }).notNull(),

  createdAt: s
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .defaultNow(),
});

/**
 * RELATIONS
 */
export const userRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}));

export const refreshTokenRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

/**
 * INFERRED TYPES
 */
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;
