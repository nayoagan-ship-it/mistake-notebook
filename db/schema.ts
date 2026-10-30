import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
export const mistakes = sqliteTable("mistakes", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  title: text("title").notNull(), category: text("category").notNull(),
  // Retired answer fields stay archived and are never exposed or edited by routes.
  answer: text("answer").notNull().default(""), analysis: text("analysis").notNull().default(""),
  images: text("images").notNull(), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (table) => [index("mistakes_owner_created_idx").on(table.ownerId, table.createdAt)]);

export const categories = sqliteTable("categories", {
  ownerId: text("owner_id").notNull(), name: text("name").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.ownerId, table.name] })]);
