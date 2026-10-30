import { database } from "./notebook-server";
export async function listCategories(ownerId: string) {
  const db = database();
  const [saved, existing] = await db.batch<{name?: string; category?: string}>([
    db.prepare("SELECT name FROM categories WHERE owner_id = ? ORDER BY created_at ASC, name ASC").bind(ownerId),
    db.prepare("SELECT DISTINCT category FROM mistakes WHERE owner_id = ? AND TRIM(category) <> '' ORDER BY category ASC").bind(ownerId),
  ]);
  return [...new Set([...saved.results.map(row => String(row.name)), ...existing.results.map(row => String(row.category))])];
}
export function insertCategory(ownerId: string, name: string, time: number) {
  return database().prepare("INSERT OR IGNORE INTO categories (owner_id, name, created_at) VALUES (?, ?, ?)").bind(ownerId, name, time);
}
