import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Mistake, Photo } from "./notebook-types";
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function owner() {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("请登录后使用错题本。", 401);
  return user.userId;
}
export function database() { if (!env.DB) throw new ApiError("错题本暂时无法连接，请稍后重试。", 503); return env.DB; }
export function bucket() { if (!env.BUCKET) throw new ApiError("图片暂时无法保存，请稍后重试。", 503); return env.BUCKET; }
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("请从错题本页面进行操作。", 403);
}
export function categoryName(value: unknown, allowEmpty = false) {
  if (typeof value !== "string") throw new ApiError("请填写分类名称。");
  const name = value.normalize("NFC").trim();
  if ((!name && !allowEmpty) || name.length > 24) throw new ApiError("分类名称需为 1–24 字。");
  if (name === "全部") throw new ApiError("请使用“全部”以外的分类名称。");
  return name;
}
export function apiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Notebook storage error", error);
  return Response.json({ error: "保存服务暂时不可用，你的输入已保留，请稍后重试。" }, { status: 503 });
}
export function toMistake(row: Record<string, unknown>): Mistake {
  return { id: String(row.id), title: String(row.title), category: String(row.category ?? ""), images: JSON.parse(String(row.images)) as Photo[], createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
}
export async function findMistake(id: string, ownerId: string) {
  const row = await database().prepare("SELECT id, title, category, images, created_at, updated_at FROM mistakes WHERE id = ? AND owner_id = ?").bind(id, ownerId).first();
  if (!row) throw new ApiError("这道错题不存在，或已被删除。", 404);
  return toMistake(row);
}
export async function readFields(request: Request, ownerId: string, previous?: Mistake) {
  checkOrigin(request);
  const payload = await request.json() as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title || title.length > 80) throw new ApiError("请输入 1–80 字的标题。");
  const category = payload.category === undefined ? previous?.category ?? "" : categoryName(payload.category, true);
  if (!Array.isArray(payload.images) || payload.images.length < 1 || payload.images.length > 6) throw new ApiError("请添加 1–6 张错题图片。");
  const images: Photo[] = []; const keys = new Set<string>();
  const records = await database().prepare("SELECT images FROM mistakes WHERE owner_id = ?").bind(ownerId).all<{images: string}>();
  for (const item of payload.images) {
    if (!item || typeof item.key !== "string" || keys.has(item.key)) throw new ApiError("图片无效，请重新选择。");
    keys.add(item.key);
    const object = await bucket().head(item.key);
    if (!object || object.customMetadata?.ownerId !== ownerId) throw new ApiError("图片已失效，请重新上传。");
    if (!previous?.images.some(photo => photo.key === item.key) && records.results.some(row => (JSON.parse(row.images) as Photo[]).some(photo => photo.key === item.key))) throw new ApiError("该图片已用于其他错题，请重新上传。");
    images.push({ key: item.key, name: object.customMetadata?.name || "错题图片", type: object.httpMetadata?.contentType || "image/jpeg", size: object.size });
  }
  return { title, category, images };
}
