import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    if (!decoded?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!decoded.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { secureUrl, publicId } = await req.json();

    if (!secureUrl || !publicId) {
      return NextResponse.json(
        { error: "Missing secureUrl/publicId" },
        { status: 400 },
      );
    }

    const ref = adminDb.collection("admins").doc(decoded.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const current = snap.data() as {
      photoPublicId?: string | null;
    };

    // 🔥 Delete old cloudinary image
    if (current?.photoPublicId && current.photoPublicId !== publicId) {
      await cloudinary.uploader.destroy(current.photoPublicId, {
        invalidate: true,
      });
    }

    await ref.update({
      photoURL: secureUrl,
      photoPublicId: publicId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
