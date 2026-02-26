import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  applicationId: string;
  uid: string;
  status: "approved" | "rejected";
  adminNote: string | null;
};

async function sendIndiePushFromServer(params: {
  fromToken: string; // admin idToken (same token you already validated)
  toUid: string;
  title: string;
  message: string;
  pushData?: any;
}) {
  // Call your existing push API route
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/push/indie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${params.fromToken}`,
    },
    body: JSON.stringify({
      toUid: params.toUid,
      title: params.title,
      message: params.message,
      pushData: params.pushData ?? null,
    }),
  });

  // Don’t crash the whole request if push fails, but do return info
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

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

    if (!decoded.admin) {
      return NextResponse.json(
        { error: "Forbidden (not admin)" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Body;

    if (!body?.applicationId || !body?.uid || !body?.status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (body.status !== "approved" && body.status !== "rejected") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const appRef = adminDb
      .collection("expert_applications")
      .doc(body.applicationId);

    const userRef = adminDb.collection("users").doc(body.uid);

    const userAppRef = userRef
      .collection("expert_applications")
      .doc(body.applicationId);

    await adminDb.runTransaction(async (tx) => {
      const [appSnap, userSnap, userAppSnap] = await Promise.all([
        tx.get(appRef),
        tx.get(userRef),
        tx.get(userAppRef),
      ]);

      if (!appSnap.exists) throw new Error("Global application not found");
      if (!userSnap.exists) throw new Error("User not found");
      if (!userAppSnap.exists)
        throw new Error("User application doc not found");

      const appData = appSnap.data() as any;
      const userAppData = userAppSnap.data() as any;

      const globalUid = appData?.uid;
      const nestedUid = userAppData?.uid;

      if (!globalUid || globalUid !== body.uid) {
        throw new Error("UID mismatch (global application)");
      }
      if (!nestedUid || nestedUid !== body.uid) {
        throw new Error("UID mismatch (user application)");
      }

      const currentStatus = (appData?.status ?? "pending") as string;
      if (currentStatus !== "pending") {
        throw new Error(`Already reviewed (${currentStatus})`);
      }

      const reviewPatch = {
        status: body.status,
        adminNote: body.adminNote ?? null,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: decoded.uid,
      };

      tx.update(appRef, reviewPatch);
      tx.update(userAppRef, reviewPatch);

      if (body.status === "approved") {
        tx.set(
          userRef,
          { role: "expert", updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      } else {
        tx.set(
          userRef,
          { role: "regular", updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
    });

    // ✅ Send notification AFTER transaction succeeds
    const isApproved = body.status === "approved";

    const title = isApproved
      ? "Expert application approved ✅"
      : "Expert application rejected ❌";

    const notePart =
      body.adminNote && body.adminNote.trim()
        ? `\n\nAdmin note: ${body.adminNote.trim()}`
        : "";

    const message = isApproved
      ? `Congratulations! Your expert application has been approved.${notePart}\n\nPlease logout your account to clean/refresh the profile.`
      : `Your expert application has been rejected.${notePart}`;

    const pushResult = await sendIndiePushFromServer({
      fromToken: idToken,
      toUid: body.uid,
      title,
      message,
      pushData: {
        type: "expert_application_reviewed",
        status: body.status,
        applicationId: body.applicationId,
      },
    });

    return NextResponse.json({ ok: true, push: pushResult });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
