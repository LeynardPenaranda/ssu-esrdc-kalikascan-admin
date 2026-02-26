import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    // Require a logged-in user (prevents random spam)
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    const { toUid, title, message, pushData } = (await req.json()) as {
      toUid: string;
      title: string;
      message: string;
      pushData?: any;
    };

    if (!toUid || !title || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // optional: don't send to yourself
    if (toUid === decoded.uid) {
      return NextResponse.json({ ok: true, skipped: "self" });
    }

    const appId = Number(process.env.NATIVE_NOTIFY_APP_ID);
    const appToken = process.env.NATIVE_NOTIFY_APP_TOKEN;

    if (!appId || !appToken) {
      return NextResponse.json({ error: "Missing env" }, { status: 500 });
    }

    const res = await fetch(
      "https://app.nativenotify.com/api/indie/notification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subId: toUid,
          appId,
          appToken,
          title,
          message,
          ...(pushData ? { pushData: JSON.stringify(pushData) } : {}),
        }),
      },
    );

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(
      { ok: res.ok, data },
      { status: res.ok ? 200 : 400 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
