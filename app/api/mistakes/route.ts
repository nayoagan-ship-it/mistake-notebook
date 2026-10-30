import { apiError, database, owner, readFields, toMistake } from "@/lib/notebook-server";
import { insertCategory } from "@/lib/notebook-categories";
export async function GET() {
  try {
    const ownerId = await owner();
    const rows = await database().prepare("SELECT id, title, category, images, created_at, updated_at FROM mistakes WHERE owner_id = ? ORDER BY created_at DESC, id DESC").bind(ownerId).all();
    return Response.json({ mistakes: rows.results.map(toMistake) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const ownerId = await owner(); const fields = await readFields(request, ownerId); const id = crypto.randomUUID(); const now = Date.now();
    const insert = database().prepare("INSERT INTO mistakes (id, owner_id, title, category, images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, ownerId, fields.title, fields.category, JSON.stringify(fields.images), now, now);
    await database().batch(fields.category ? [insertCategory(ownerId, fields.category, now), insert] : [insert]);
    return Response.json({ mistake: { id, ...fields, createdAt: now, updatedAt: now } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
