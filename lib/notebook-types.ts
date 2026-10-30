export type Photo = { key: string; name: string; type: string; size: number };
export type Mistake = { id: string; title: string; category: string; images: Photo[]; createdAt: number; updatedAt: number };
export const photoUrl = (key: string) => `/api/photos/${encodeURIComponent(key)}`;
