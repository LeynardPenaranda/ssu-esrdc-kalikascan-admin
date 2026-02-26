import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LastSeenPayload = {
  plant_scans?: number; // ms
  map_posts?: number; // ms
  health_assessments?: string; // ISO
  expert_applications?: string; // ISO
};

function isoToTs(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
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

    const body = (await req.json().catch(() => ({}))) as {
      lastSeen?: LastSeenPayload;
    };
    const lastSeen = body?.lastSeen ?? {};

    // If never seen, default to "now" so you don’t show everything as new on first load.
    const nowMs = Date.now();

    const plantAfter =
      typeof lastSeen.plant_scans === "number" ? lastSeen.plant_scans : nowMs;
    const mapAfter =
      typeof lastSeen.map_posts === "number" ? lastSeen.map_posts : nowMs;

    const healthAfterTs = lastSeen.health_assessments
      ? isoToTs(lastSeen.health_assessments)
      : Timestamp.fromDate(new Date());

    const expertAfterTs = lastSeen.expert_applications
      ? isoToTs(lastSeen.expert_applications)
      : Timestamp.fromDate(new Date());

    // ✅ createdAtLocal collections (number ms)
    const plantCount = await adminDb
      .collection("plant_scans")
      .where("createdAtLocal", ">", plantAfter)
      .count()
      .get();

    const mapCount = await adminDb
      .collection("map_scans")
      .where("createdAtLocal", ">", mapAfter)
      .count()
      .get();

    // ✅ createdAt timestamp collections
    // NOTE: this assumes createdAt exists and is Timestamp in all docs.
    const healthCount = await adminDb
      .collection("health_assessments")
      .where("createdAt", ">", healthAfterTs!)
      .count()
      .get();

    const expertCount = await adminDb
      .collection("expert_applications")
      .where("createdAt", ">", expertAfterTs!)
      .count()
      .get();

    return NextResponse.json({
      counts: {
        plant_scans: plantCount.data().count ?? 0,
        map_posts: mapCount.data().count ?? 0,
        health_assessments: healthCount.data().count ?? 0,
        expert_applications: expertCount.data().count ?? 0,
      },
      serverNow: {
        ms: nowMs,
        iso: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
