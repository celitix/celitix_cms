// POST /api/content/create rejects any request without an uploaded file
// (`if (!req.file) return errorHandler("No file uploaded", 400)`), so saving
// new content is impossible until a media manager exists. Until then we attach
// this 1×1 PNG so the writer isn't blocked.
//
// It is a stand-in, not a picture: anything saved with it has a 1-pixel image
// attached, and the image-related checks (img_count, img_alt_focus, img_4field)
// will stay red. The editor says so next to the field.

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const PLACEHOLDER_IMAGE_NAME = "celitix-placeholder.png";

/** A throwaway image file that satisfies the backend's upload requirement. */
export function placeholderImageFile(): File {
  const binary = atob(ONE_PIXEL_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], PLACEHOLDER_IMAGE_NAME, { type: "image/png" });
}
