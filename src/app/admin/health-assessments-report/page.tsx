"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, RotateCcw, Trash2 } from "lucide-react";
import HealthAssessmentDetailsModal, {
  HealthAssessmentRow,
} from "@/src/components/modals/HealthAssessmentDetailsModal";
import { exportHealthAssessmentsToExcelCsv } from "@/src/utils/exportHealthAssessmentsToExcelCsv";
import DeleteConfirmModal from "@/src/components/modals/DeleteConfirmModal";
import { useToast } from "@/src/hooks/useToast";
import { auth } from "@/src/lib/firebase/client";
import { useAppDispatch } from "@/src/store/hooks";
import { markSeen } from "@/src/lib/adminLastSeen";
import { fetchAdminNotifSummary } from "@/src/store/slices/adminNotifSlice";

const PAGE_SIZE = 10;
const NOT_PLANT_THRESHOLD = 0.1;

type HealthAssessmentRowEx = HealthAssessmentRow & {
  isPlantBinary?: boolean | null;
  isPlantProbability?: number | null;
  response?: {
    result?: {
      is_plant?: {
        binary?: boolean | null;
        probability?: number | null;
        threshold?: number | null;
      };
      is_healthy?: {
        binary?: boolean | null;
        probability?: number | null;
        threshold?: number | null;
      };
    };
  } | null;
};

function pct(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function formatLatLon(lat: number, lon: number) {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(
    4,
  )}° ${lonDir}`;
}

function mapsLink(lat: number, lon: number) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function initials(s?: string | null) {
  const t = (s ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getPlantSignals(row: HealthAssessmentRowEx) {
  const nestedBinary = row.response?.result?.is_plant?.binary;
  const nestedProbability = row.response?.result?.is_plant?.probability;

  const binary =
    typeof nestedBinary === "boolean"
      ? nestedBinary
      : typeof row.isPlantBinary === "boolean"
        ? row.isPlantBinary
        : null;

  const probability =
    typeof nestedProbability === "number"
      ? nestedProbability
      : typeof row.isPlantProbability === "number"
        ? row.isPlantProbability
        : null;

  const inferredBinary =
    binary != null
      ? binary
      : typeof probability === "number"
        ? probability < NOT_PLANT_THRESHOLD
          ? false
          : true
        : null;

  const notPlant =
    inferredBinary === false ||
    (typeof probability === "number" && probability < NOT_PLANT_THRESHOLD);

  return {
    binary: inferredBinary,
    probability,
    notPlant,
  };
}

function getPlantMeta(row: HealthAssessmentRowEx) {
  const { binary, probability, notPlant } = getPlantSignals(row);

  if (notPlant) {
    return {
      isPlant: false,
      label:
        probability != null ? `Not Plant (${pct(probability)})` : "Not Plant",
      badgeClass: "border-red-200 bg-red-50 text-red-700",
      rowClass: "bg-red-50 hover:!bg-red-100",
    };
  }

  if (binary === true) {
    return {
      isPlant: true,
      label: probability != null ? `Plant (${pct(probability)})` : "Plant",
      badgeClass: "border-green-200 bg-green-50 text-green-700",
      rowClass: "",
    };
  }

  return {
    isPlant: null as boolean | null,
    label: probability != null ? `Unknown (${pct(probability)})` : "Unknown",
    badgeClass: "border-gray-200 bg-gray-50 text-gray-600",
    rowClass: "",
  };
}

function resultPill(row: HealthAssessmentRowEx) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold";

  const { notPlant } = getPlantSignals(row);

  if (notPlant) {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
        Not Plant 🚫🌿
      </span>
    );
  }

  if (row.isHealthyBinary === true) {
    return (
      <span
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}
      >
        Healthy 🌿
      </span>
    );
  }

  if (row.isHealthyBinary === false) {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
        Unhealthy 🩺
      </span>
    );
  }

  return (
    <span className={`${base} border-gray-200 bg-gray-50 text-gray-600`}>
      —
    </span>
  );
}

export default function HealthAssessmentsReport() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HealthAssessmentRowEx[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [addrMap, setAddrMap] = useState<Record<string, string>>({});

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HealthAssessmentRowEx | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    label?: string;
  } | null>(null);

  const dispatch = useAppDispatch();

  useEffect(() => {
    markSeen("health_assessments");
    dispatch(fetchAdminNotifSummary());
  }, [dispatch]);

  const loadHealth = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health-assessments", {
        cache: "no-store",
      });
      const data = await res.json();
      setRows(Array.isArray(data?.assessments) ? data.assessments : []);
      setPage(1);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => setPage(1), [q]);

  useEffect(() => {
    const missing = rows.filter(
      (r) =>
        !r.addressText &&
        r.location?.latitude != null &&
        r.location?.longitude != null &&
        !addrMap[r.id],
    );

    if (missing.length === 0) return;

    let cancelled = false;

    async function run() {
      const batch = missing.slice(0, 10);

      for (const r of batch) {
        try {
          const lat = r.location!.latitude!;
          const lon = r.location!.longitude!;

          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
          const data = await res.json();

          if (cancelled) return;

          if (data?.address) {
            setAddrMap((m) => ({ ...m, [r.id]: data.address }));

            await fetch("/api/admin/health-assessments/set-address", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assessmentId: r.id,
                uid: r.uid,
                addressText: data.address,
              }),
            });

            setRows((prev) =>
              prev.map((x) =>
                x.id === r.id ? { ...x, addressText: data.address } : x,
              ),
            );
          }
        } catch {
          // ignore
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [rows, addrMap]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const userText =
        r.user?.displayName || r.user?.username || r.user?.email || r.uid || "";
      const day = r.createdDay || "";
      const addr = r.addressText || "";

      const { notPlant, binary } = getPlantSignals(r);

      const healthStatus = notPlant
        ? ""
        : r.isHealthyBinary == null
          ? ""
          : r.isHealthyBinary
            ? "healthy"
            : "unhealthy";

      const plantStatus =
        binary == null && !notPlant ? "" : notPlant ? "not plant" : "plant";

      const topDisease = notPlant
        ? ""
        : r.diseaseName ||
          r.topDisease?.name ||
          r.topDisease?.details?.local_name ||
          "";

      return (
        userText.toLowerCase().includes(s) ||
        day.toLowerCase().includes(s) ||
        addr.toLowerCase().includes(s) ||
        healthStatus.includes(s) ||
        plantStatus.includes(s) ||
        String(topDisease).toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function openDetailsRow(r: HealthAssessmentRowEx) {
    setSelected(r);
    setOpen(true);
  }

  function closeDetails() {
    setOpen(false);
    setSelected(null);
  }

  async function onDownload() {
    try {
      setDownloading(true);
      exportHealthAssessmentsToExcelCsv(filtered);

      showToast({
        type: "success",
        message: "Download started",
        description: `Exported ${filtered.length} assessment(s).`,
      });
    } finally {
      setDownloading(false);
    }
  }

  function askDelete(r: HealthAssessmentRowEx) {
    const { notPlant } = getPlantSignals(r);

    const topDisease = notPlant
      ? ""
      : r.diseaseName ||
        r.topDisease?.details?.local_name ||
        r.topDisease?.name ||
        "";

    const label = notPlant
      ? "Not Plant Result"
      : topDisease
        ? `Top disease: ${topDisease}`
        : r.isHealthyBinary === true
          ? "Healthy result"
          : r.isHealthyBinary === false
            ? "Unhealthy result"
            : "Health assessment";

    setPendingDelete({ id: r.id, label });
    setDeleteOpen(true);
  }

  async function doDelete(assessmentId: string) {
    try {
      setDeletingId(assessmentId);

      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : null;

      if (!idToken) {
        showToast({
          type: "danger",
          message: "Missing auth token",
          description: "Please login again.",
        });
        return;
      }

      const res = await fetch("/api/admin/health-assessments/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ assessmentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast({
          type: "danger",
          message: "Delete failed",
          description: data?.error ?? "Unable to delete this assessment.",
        });
        return;
      }

      setOpen((wasOpen) => {
        if (wasOpen && selected?.id === assessmentId) {
          setSelected(null);
          return false;
        }
        return wasOpen;
      });

      setRows((prev) => prev.filter((x) => x.id !== assessmentId));

      showToast({
        type: "success",
        message: "Health assessment deleted",
        description: `Deleted ID: ${assessmentId}`,
      });
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Something went wrong.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col mt-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">
          {loading ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span>{" "}
              assessments
            </>
          ) : total === 0 ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span>{" "}
              assessments
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-gray-700">
                {showingFrom}-{showingTo}
              </span>{" "}
              of <span className="font-medium text-gray-700">{total}</span>
            </>
          )}

          {q.trim() ? (
            <span className="ml-2 text-gray-400">
              (filtered by “{q.trim()}”)
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="sm:hidden flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search health assessments..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none bg-white"
              />
            </div>

            <div className="hidden sm:block">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search user, status, disease, date, address..."
                className="w-[360px] text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white transition"
              />
            </div>

            {q.trim() && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition"
                title="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={loadHealth}
              disabled={refreshing}
              className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition disabled:opacity-50 inline-flex items-center gap-2"
              title="Refresh data"
            >
              <RotateCcw
                className={refreshing ? "animate-spin" : ""}
                size={14}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={onDownload}
              disabled={loading || downloading || total === 0}
              className="h-9 px-4 text-xs rounded-lg border border-gray-200 bg-app-button text-white hover:bg-app-buttonHover transition disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap"
              title={total === 0 ? "No records to export" : "Download CSV"}
            >
              <FileDown size={14} />
              <span className="hidden sm:inline">
                {downloading ? "Preparing..." : "Download Health Report.csv"}
              </span>
              <span className="sm:hidden">
                {downloading ? "Preparing..." : "Download"}
              </span>
            </button>

            <button
              type="button"
              onClick={goPrev}
              disabled={loading || page <= 1}
              className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition disabled:opacity-50"
            >
              Prev
            </button>

            <div className="text-xs text-gray-600 whitespace-nowrap">
              Page <span className="font-medium">{page}</span> /{" "}
              <span className="font-medium">{totalPages}</span>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={loading || page >= totalPages}
              className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-gray-100 bg-white">
        <table className="min-w-[1200px] table-fixed text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left border-b border-gray-100">
              <th className="px-4 py-3 font-medium text-gray-600">
                Assessed By
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Result</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Confidence
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Top Disease
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Captured In
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {loading ? (
              <tr className="bg-white">
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            ) : total === 0 ? (
              <tr className="bg-white">
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {q.trim()
                    ? "No matching health assessments found."
                    : "No health assessments found."}
                </td>
              </tr>
            ) : (
              paged.map((r) => {
                const display =
                  r.user?.displayName ||
                  r.user?.username ||
                  r.user?.email ||
                  "Unknown user";

                const lat = r.location?.latitude ?? null;
                const lon = r.location?.longitude ?? null;

                const plantMeta = getPlantMeta(r);
                const isNotPlant = plantMeta.isPlant === false;

                const topDisease = isNotPlant
                  ? "Not Plant"
                  : r.diseaseName ||
                    r.topDisease?.details?.local_name ||
                    r.topDisease?.name ||
                    "—";

                const isDeleting = deletingId === r.id;

                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetailsRow(r)}
                    className={`border-b border-gray-50 cursor-pointer transition ${
                      plantMeta.rowClass || "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.user?.photoURL ? (
                          <img
                            src={r.user.photoURL}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border border-black/5"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gray-100 border border-black/5 flex items-center justify-center text-xs font-semibold text-gray-600">
                            {initials(display)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {display}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            <span className="font-mono">{r.uid ?? "—"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {resultPill(r)}

                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${plantMeta.badgeClass}`}
                        >
                          {plantMeta.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {pct(r.confidence)}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      <div className="min-w-0">
                        <div
                          className={`truncate ${isNotPlant ? "text-red-700 font-medium" : ""}`}
                        >
                          {topDisease}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          Assessment ID:{" "}
                          <span className="font-mono">{r.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {r.createdDay ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {lat != null && lon != null ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">
                            {formatLatLon(lat, lon)}
                          </div>

                          <div className="text-sm text-gray-800 line-clamp-2">
                            {r.addressText ??
                              addrMap[r.id] ??
                              "Fetching address..."}
                          </div>

                          <a
                            href={mapsLink(lat, lon)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Map
                          </a>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          askDelete(r);
                        }}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2 text-xs rounded-lg border border-red-200 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete this assessment"
                      >
                        <Trash2 size={14} />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={loading || page <= 1}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="text-xs text-gray-600">
            Page <span className="font-medium">{page}</span> /{" "}
            <span className="font-medium">{totalPages}</span>
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={loading || page >= totalPages}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      ) : null}

      <DeleteConfirmModal
        open={deleteOpen}
        title="Delete this health assessment?"
        message={
          "This will permanently delete the assessment.\nThis cannot be undone."
        }
        itemLabelText={pendingDelete?.label}
        itemIdText={
          pendingDelete?.id ? `Assessment ID: ${pendingDelete.id}` : undefined
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={!!(pendingDelete?.id && deletingId === pendingDelete.id)}
        lockWhileLoading={true}
        onClose={() => {
          if (deletingId) return;
          setDeleteOpen(false);
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete?.id) return;
          const id = pendingDelete.id;

          setDeleteOpen(false);
          setPendingDelete(null);

          await doDelete(id);
        }}
      />

      <HealthAssessmentDetailsModal
        open={open}
        assessment={selected}
        onClose={closeDetails}
      />
    </div>
  );
}
