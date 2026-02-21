import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);

    // only superadmins can delete admins
    if (!decoded.superadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { uid?: string };
    const uid = body.uid;

    if (!uid) {
      return NextResponse.json(
        { error: "Invalid payload. Expected { uid }" },
        { status: 400 },
      );
    }

    // safety: can't delete yourself
    if (decoded.uid === uid) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 },
      );
    }

    // safety: can't delete a superadmin
    const target = await adminAuth.getUser(uid);
    const targetIsSuper = Boolean(target.customClaims?.superadmin);
    if (targetIsSuper) {
      return NextResponse.json(
        { error: "You cannot delete a superadmin." },
        { status: 400 },
      );
    }

    // delete auth user + firestore admin doc (same uid doc id)
    const adminDocRef = adminDb.collection("admins").doc(uid);

    // run deletes (no need transaction; these are different systems)
    await Promise.allSettled([adminAuth.deleteUser(uid), adminDocRef.delete()]);

    return NextResponse.json({ ok: true, uid });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to delete admin" },
      { status: 500 },
    );
  }
}
