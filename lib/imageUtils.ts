import imageCompression from "browser-image-compression";

interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

export async function compressImageFile(
  file: File,
  options?: CompressOptions
): Promise<File> {
  const config = {
    maxSizeMB: options?.maxSizeMB ?? 0.35, // Compresses to ~350 KB
    maxWidthOrHeight: options?.maxWidthOrHeight ?? 1440, // Max dimension
    useWebWorker: true,
    fileType: "image/webp", // Modern WebP format
  };

  try {
    const compressedBlob = await imageCompression(file, config);
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    return new File([compressedBlob], `${baseName}.webp`, {
      type: "image/webp",
    });
  } catch (error) {
    console.error("Compression failed, using original file:", error);
    return file;
  }
}

/**
 * Extracts the storage path from a Supabase public URL.
 * e.g., ".../public/gallery/david/image.webp" -> "david/image.webp"
 */
export function extractStoragePath(publicUrl: string, bucketName: string): string | null {
  try {
    const marker = `/${bucketName}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(publicUrl.substring(index + marker.length));
  } catch {
    return null;
  }
}