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

function toISO(v: any): string | null {
  if (!v) return null;
  // Firestore Timestamp has toDate()
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  // Sometimes stored as Date/string
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminClaims(decoded))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const snap = await adminDb
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();

    const users = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: data.uid ?? d.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        username: data.username ?? null,
        photoURL: data.photoURL ?? null,
        imageUrl: data.imageUrl ?? null,

        role: (data.role === "expert" ? "expert" : "regular") as
          | "regular"
          | "expert",
        isExpert: Boolean(data.isExpert),

        banned: Boolean(data.banned),
        bannedReason: data.bannedReason ?? null,

        createdAt: toISO(data.createdAt),
        lastActiveAt: toISO(data.lastActiveAt),
        updatedAt: toISO(data.updatedAt),
      };
    });

    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
