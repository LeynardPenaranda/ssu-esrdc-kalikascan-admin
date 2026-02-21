import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import admin from "firebase-admin";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}
function isAdminClaims(decoded: any) {
  return Boolean(decoded?.admin || decoded?.superadmin);
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminClaims(decoded))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const uid = String(body?.uid || "");
    const banned = Boolean(body?.banned);
    const bannedReason = body?.bannedReason ?? null;

    if (!uid)
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (uid === decoded.uid)
      return NextResponse.json(
        { error: "You cannot ban yourself." },
        { status: 400 },
      );

    // 1) Update Firestore doc
    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          banned,
          bannedReason: banned
            ? typeof bannedReason === "string"
              ? bannedReason
              : null
            : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    // 2) Disable/enable Firebase Auth user
    // Use UID (most reliable). Email lookup is not needed.
    await adminAuth.updateUser(uid, { disabled: banned });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // If Auth user doesn't exist but Firestore doc does, show clearer error
    const msg = String(e?.message ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
