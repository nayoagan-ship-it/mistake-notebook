import { ApiError, apiError, bucket, checkOrigin, owner } from "@/lib/notebook-server";
export async function POST(request: Request) {
  try {
    checkOrigin(request); const ownerId = await owner();
    if (Number(request.headers.get("content-length") || 0) > 4 * 1024 * 1024) throw new ApiError("图片太大，请选择较小的图片。", 413);
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 3 * 1024 * 1024) throw new ApiError("请选择不超过 3 MB 的图片。", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const type = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
    if (!type) throw new ApiError("支持 JPG、PNG、WebP 图片，请换一张再试。");
    const key = crypto.randomUUID(); const name = file.name.slice(0, 120);
    await bucket().put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { ownerId, name } });
    return Response.json({ photo: { key, name, type, size: file.size } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
