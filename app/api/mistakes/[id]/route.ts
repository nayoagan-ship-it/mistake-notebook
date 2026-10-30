import { apiError, bucket, checkOrigin, database, findMistake, owner, readFields } from "@/lib/notebook-server";
import { insertCategory } from "@/lib/notebook-categories";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const ownerId = await owner(); const { id } = await context.params; const previous = await findMistake(id, ownerId);
    const fields = await readFields(request, ownerId, previous); const now = Date.now();
    const update = database().prepare("UPDATE mistakes SET title = ?, category = ?, images = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(fields.title, fields.category, JSON.stringify(fields.images), now, id, ownerId);
    await database().batch(fields.category ? [insertCategory(ownerId, fields.category, now), update] : [update]);
    await Promise.allSettled(previous.images.filter(photo => !fields.images.some(next => next.key === photo.key)).map(photo => bucket().delete(photo.key)));
    return Response.json({ mistake: { ...previous, ...fields, updatedAt: now } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request); const ownerId = await owner(); const { id } = await context.params; const previous = await findMistake(id, ownerId);
    await database().prepare("DELETE FROM mistakes WHERE id = ? AND owner_id = ?").bind(id, ownerId).run();
    await Promise.allSettled(previous.images.map(photo => bucket().delete(photo.key)));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
