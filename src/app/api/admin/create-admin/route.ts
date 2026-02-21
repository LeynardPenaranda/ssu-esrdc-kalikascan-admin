import { DEFAULT_ADMIN_AVATAR } from "@/src/constant";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { NextResponse } from "next/server";

type AdminRole = "admin" | "superadmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // Verify caller
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (!decoded.admin) {
      return NextResponse.json(
        { error: "Forbidden (not admin)" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      email: string;
      password: string;
      displayName?: string;
      role?: AdminRole;
    };

    const { email, password, displayName } = body;

    const requestedRole: AdminRole =
      body.role === "superadmin" ? "superadmin" : "admin";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    // Only superadmin can assign superadmin
    if (requestedRole === "superadmin" && !decoded.superadmin) {
      return NextResponse.json(
        { error: "Forbidden (only superadmin can assign superadmin)" },
        { status: 403 },
      );
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || "Admin",
      photoURL: DEFAULT_ADMIN_AVATAR,
    });

    // Set custom claims
    const claims =
      requestedRole === "superadmin"
        ? { admin: true, superadmin: true }
        : { admin: true };

    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    // Store profile in Firestore (ONLY photoURL)
    await adminDb
      .collection("admins")
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        email,
        displayName: displayName || "Admin",
        role: requestedRole,
        photoURL: DEFAULT_ADMIN_AVATAR,
        disabled: false,
        createdAt: new Date(),
        createdBy: decoded.uid,
      });

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      role: requestedRole,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
