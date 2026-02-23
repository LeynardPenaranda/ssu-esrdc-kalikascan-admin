import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

type Body = {
  applicationId: string;
  // uid is no longer needed if you truly only delete the global doc
  // uid?: string;
};

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

    // only admins
    if (!decoded.admin) {
      return NextResponse.json(
        { error: "Forbidden (not admin)" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Body;

    if (!body?.applicationId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const appRef = adminDb
      .collection("expert_applications")
      .doc(body.applicationId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(appRef);
      if (!snap.exists) throw new Error("Application not found");

      const data = snap.data() as any;
      const status = String(data?.status ?? "pending");

      // Only allow delete if already reviewed
      if (status !== "approved" && status !== "rejected") {
        throw new Error("Only approved/rejected applications can be deleted.");
      }

      // delete ONLY the global application
      tx.delete(appRef);
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
