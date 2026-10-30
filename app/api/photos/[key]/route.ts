import { ApiError, apiError, bucket, checkOrigin, database, owner } from "@/lib/notebook-server";
import type { Photo } from "@/lib/notebook-types";
type Context = { params: Promise<{key: string}> };
export async function GET(_request: Request, context: Context) {
  try {
    const ownerId = await owner(); const { key } = await context.params; const object = await bucket().get(key);
    if (!object || object.customMetadata?.ownerId !== ownerId) throw new ApiError("图片不存在。", 404);
    return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request); const ownerId = await owner(); const { key } = await context.params; const object = await bucket().head(key);
    if (!object || object.customMetadata?.ownerId !== ownerId) throw new ApiError("图片不存在。", 404);
    const records = await database().prepare("SELECT images FROM mistakes WHERE owner_id = ?").bind(ownerId).all<{images: string}>();
    if (records.results.some(row => (JSON.parse(row.images) as Photo[]).some(photo => photo.key === key))) throw new ApiError("该图片仍在错题中，无法删除。", 409);
    await bucket().delete(key); return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
