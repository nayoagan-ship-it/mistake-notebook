import { ApiError, apiError, categoryName, checkOrigin, database, owner } from "@/lib/notebook-server";
import { listCategories } from "@/lib/notebook-categories";
export async function GET() {
  try {
    const ownerId = await owner();
    return Response.json({ categories: await listCategories(ownerId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const ownerId = await owner();
    const payload = await request.json() as Record<string, unknown>; const name = categoryName(payload.name);
    const result = await database().prepare("INSERT OR IGNORE INTO categories (owner_id, name, created_at) VALUES (?, ?, ?)").bind(ownerId, name, Date.now()).run();
    if (!result.meta.changes) throw new ApiError("这个分类已经存在。", 409);
    return Response.json({ name, categories: await listCategories(ownerId) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
