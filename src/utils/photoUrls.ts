import { buildSignedMediaUrl } from "./mediaCrypto.js";

export type PhotoRecord = {
  id: string;
  url?: string;
  key?: string;
  enc?: boolean;
};

/**
 * Resolve DB photo records → client-safe URLs.
 * Encrypted/private: signed /media URL.
 * Legacy public R2: pass through (until re-uploaded).
 */
export function resolvePhotoUrls(photos: unknown): PhotoRecord[] {
  if (!Array.isArray(photos)) return [];
  return photos.map((raw) => {
    const p = raw as PhotoRecord;
    const id = p.id ?? "";
    const key = p.key || extractKeyFromPublicUrl(p.url);
    if (key && (p.enc || !p.url || p.url === key || !p.url.startsWith("http"))) {
      return {
        id,
        key,
        enc: true,
        url: buildSignedMediaUrl(key),
      };
    }
    if (p.url?.startsWith("http")) {
      return { id, url: p.url, key, enc: false };
    }
    if (key) {
      return { id, key, enc: true, url: buildSignedMediaUrl(key) };
    }
    return { id, url: p.url ?? "" };
  });
}

export function extractKeyFromPublicUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // https://pub-xxx.r2.dev/profiles/user/file.jpeg
  const markers = ["/profiles/", "/liveness/"];
  for (const m of markers) {
    const i = url.indexOf(m);
    if (i >= 0) return url.slice(i + 1); // drop leading slash → profiles/...
  }
  if (url.startsWith("profiles/") || url.startsWith("liveness/")) return url;
  return undefined;
}

export function storageKeyFromPhoto(
  photo: PhotoRecord,
  userId: string,
): string | null {
  if (photo.key) return photo.key;
  const fromUrl = extractKeyFromPublicUrl(photo.url);
  if (fromUrl) return fromUrl;
  if (!photo.id) return null;

  // If url contains an extension, extract and preserve it
  if (photo.url) {
    const extMatch = photo.url.match(/\.(jpeg|jpg|png|webp)(?:\?|$)/i);
    if (extMatch) {
      return `profiles/${userId}/${photo.id}.${extMatch[1].toLowerCase()}`;
    }
  }

  // Default fallback for legacy uploads created with jpeg
  return `profiles/${userId}/${photo.id}.jpeg`;
}
