export type AdminNotifKey =
  | "plant_scans"
  | "map_posts"
  | "health_assessments"
  | "expert_applications";

export type AdminLastSeen = Partial<Record<AdminNotifKey, string>>; // ISO string

const STORAGE_KEY = "kalikascan_admin_last_seen_v1";

export function getAdminLastSeen(): AdminLastSeen {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setAdminLastSeen(patch: AdminLastSeen) {
  if (typeof window === "undefined") return;
  const prev = getAdminLastSeen();
  const next = { ...prev, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function markSeen(key: AdminNotifKey) {
  setAdminLastSeen({ [key]: new Date().toISOString() });
}
