export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export async function uploadToCloudinaryAdminProfile(
  file: File,
  uid: string,
): Promise<CloudinaryUploadResult> {
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dn2iechhl";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!uploadPreset) {
    throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // folder requirement
  const folder = `admin-profiles/${uid}`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const res = await fetch(uploadUrl, { method: "POST", body: formData });
  const text = await res.text();

  if (!res.ok) throw new Error(`Cloudinary upload failed: ${text}`);

  const data = JSON.parse(text);
  if (!data?.secure_url || !data?.public_id) {
    throw new Error("Cloudinary: missing secure_url/public_id");
  }

  return {
    secureUrl: data.secure_url as string,
    publicId: data.public_id as string,
  };
}
