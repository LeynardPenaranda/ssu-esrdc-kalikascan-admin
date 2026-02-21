import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

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

    if (!uid)
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (uid === decoded.uid)
      return NextResponse.json(
        { error: "You cannot delete yourself." },
        { status: 400 },
      );

    // Delete auth first (so account is gone even if firestore fails)
    await adminAuth.deleteUser(uid);

    // Delete firestore doc
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
