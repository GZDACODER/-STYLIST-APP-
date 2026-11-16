// Shrinks a photo in the browser before uploading, so a big phone photo
// uploads quickly and the booking page loads fast. Browser code only.
// Used for the cover photo and portfolio photos.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Opens the photo the way the browser shows images, which works for every
// format the device can display (including iPhone photos) and keeps it the
// right way up.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photo couldn't be opened"));
    };
    img.src = url;
  });
}

// Returns a JPEG Blob no longer than maxSide pixels on its longest side.
export async function shrinkPhoto(file, maxSide = 2000) {
  const { img, done } = await loadImage(file);
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error("The photo has no size");
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The photo couldn't be converted"))),
        "image/jpeg",
        0.85
      )
    );
  } finally {
    done();
  }
}
