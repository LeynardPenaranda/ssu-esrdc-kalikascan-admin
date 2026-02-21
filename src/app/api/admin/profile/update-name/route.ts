import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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

    // require admin claim (same pattern as your other routes)
    if (!decoded.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const displayName = (body?.displayName ?? "").toString().trim();

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 },
      );
    }

    if (displayName.length > 60) {
      return NextResponse.json(
        { error: "Display name is too long" },
        { status: 400 },
      );
    }

    // update Firestore admins doc
    const ref = adminDb.collection("admins").doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    await ref.update({
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // optional: also update Firebase Auth displayName
    await adminAuth.updateUser(decoded.uid, { displayName });

    return NextResponse.json({ ok: true, displayName });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
