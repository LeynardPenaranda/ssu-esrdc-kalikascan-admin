"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import PlantScanDetailsModal, {
  PlantScanRow,
} from "@/src/components/modals/PlantScanDetailsModal";
import { exportPlantScansToExcelCsv } from "@/src/utils/exportPlantScansToExcelCsv";
import { FileDown, RotateCcw, Trash2 } from "lucide-react";
import { auth } from "@/src/lib/firebase/client";

import DeleteConfirmModal from "@/src/components/modals/DeleteConfirmModal";
import { useToast } from "@/src/hooks/useToast";

const PAGE_SIZE = 10;

function pct(n: number | null) {
  if (n == null) return "—";
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

export default function PlantScansReport() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlantScanRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [addrMap, setAddrMap] = useState<Record<string, string>>({});

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlantScanRow | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  //  per-row delete loading
  const [deletingId, setDeletingId] = useState<string | null>(null);

  //  delete modal state (reusable)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    label?: string;
  } | null>(null);

  const loadScans = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plant-scans", { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data?.scans) ? data.scans : []);
      setPage(1);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  useEffect(() => setPage(1), [q]);

  // reverse geocode missing addresses
  useEffect(() => {
    const missing = rows.filter(
      (r) =>
        !r.addressText &&
        r.latitude != null &&
        r.longitude != null &&
        !addrMap[r.id],
    );

    if (missing.length === 0) return;

    let cancelled = false;

    async function run() {
      const batch = missing.slice(0, 10);

      for (const r of batch) {
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${r.latitude}&lon=${r.longitude}`,
          );
          const data = await res.json();

          if (cancelled) return;

          if (data?.address) {
            setAddrMap((m) => ({ ...m, [r.id]: data.address }));

            await fetch("/api/admin/plant-scans/set-address", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scanId: r.id, addressText: data.address }),
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
      const plant = r.plantName || r.topSuggestion?.name || "";
      const day = r.createdDay || "";
      const addr = r.addressText || "";

      return (
        userText.toLowerCase().includes(s) ||
        plant.toLowerCase().includes(s) ||
        day.toLowerCase().includes(s) ||
        addr.toLowerCase().includes(s)
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

  function openDetails(r: PlantScanRow) {
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
      exportPlantScansToExcelCsv(filtered);
    } finally {
      setDownloading(false);
    }
  }

  //  open delete modal (instead of window.confirm)
  function askDelete(r: PlantScanRow) {
    const label =
      r.topSuggestion?.name ??
      r.plantName ??
      r.user?.displayName ??
      r.user?.email ??
      r.uid ??
      "Plant Scan";
    setPendingDelete({ id: r.id, label: String(label) });
    setDeleteOpen(true);
  }

  async function onDeleteScan(scanId: string) {
    try {
      setDeletingId(scanId);

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

      const res = await fetch("/api/admin/plant-scans/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ scanId }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast({
          type: "danger",
          message: "Delete failed",
          description: data?.error ?? "Could not delete this scan.",
        });
        return;
      }

      //  close details modal if deleting the one currently open
      setOpen((wasOpen) => {
        if (wasOpen && selected?.id === scanId) {
          setSelected(null);
          return false;
        }
        return wasOpen;
      });

      //  remove from table instantly
      setRows((prev) => prev.filter((x) => x.id !== scanId));

      //  success toast
      showToast({
        type: "success",
        message: "Deleted successfully",
        description: `Plant scan removed (ID: ${scanId}).`,
      });
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Unexpected error.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const pendingId = pendingDelete?.id ?? null;
  const modalLoading = !!pendingId && deletingId === pendingId;

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      {/*  Reusable delete confirm modal */}
      <DeleteConfirmModal
        open={deleteOpen}
        title="Delete plant scan?"
        message="This action cannot be undone."
        itemLabelText={pendingDelete?.label}
        itemIdText={
          pendingDelete?.id ? `Scan ID: ${pendingDelete.id}` : undefined
        }
        confirmText="Delete scan"
        loading={modalLoading}
        onClose={() => {
          if (modalLoading) return;
          setDeleteOpen(false);
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete?.id) return;
          await onDeleteScan(pendingDelete.id);
          setDeleteOpen(false);
          setPendingDelete(null);
        }}
      />

      {/* Top bar */}
      {/* Top bar (keep OLD desktop layout; only change on small screens) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">
          {loading ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span> scans
            </>
          ) : total === 0 ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span> scans
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

        {/*  Buttons area:
      - Desktop (sm+): your original row w/ hidden input (sm:block input)
      - Mobile (<sm): input becomes part of this same row + wraps nicely
  */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* LEFT SIDE — SEARCH */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Mobile search */}
            <div className="sm:hidden flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search scans..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none bg-white"
              />
            </div>

            {/* Desktop search */}
            <div className="hidden sm:block">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search user, plant, date, address..."
                className="w-[340px] text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white"
              />
            </div>

            {q.trim() && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* RIGHT SIDE — ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={loadScans}
              disabled={refreshing}
              className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 transition disabled:opacity-50 inline-flex items-center gap-2"
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
            >
              <FileDown size={14} />
              <span className="hidden sm:inline">
                {downloading ? "Preparing..." : "Download Plant Report.csv"}
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
              Page <span className="font-medium">{page}</span> /
              <span className="font-medium"> {totalPages}</span>
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

      {/* table */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-gray-100 bg-white">
        <table className="min-w-[1100px] table-fixed text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left border-b border-gray-100">
              <th className="px-4 py-3 font-medium text-gray-600">
                Scanned By
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Plant</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Confidence
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Is Plant</th>
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
                  {q.trim() ? "No matching scans found." : "No scans found."}
                </td>
              </tr>
            ) : (
              paged.map((r) => {
                const display =
                  r.user?.displayName ||
                  r.user?.username ||
                  r.user?.email ||
                  "Unknown user";

                const isDeleting = deletingId === r.id;

                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetails(r)}
                    className="bg-white border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.user?.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
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

                    <td className="px-4 py-3 text-gray-900">
                      <div className="flex items-center gap-3">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-black/5"
                          />
                        ) : null}

                        <div className="min-w-0">
                          <div className="font-medium truncate italic">
                            {r.topSuggestion?.name ?? r.plantName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            Scan ID: <span className="font-mono">{r.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {pct(r.confidence)}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {r.isPlantBinary == null
                        ? "—"
                        : r.isPlantBinary
                          ? `Yes (${pct(r.isPlantProbability)})`
                          : `No (${pct(r.isPlantProbability)})`}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {r.createdDay ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {r.latitude != null && r.longitude != null ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">
                            {formatLatLon(r.latitude, r.longitude)}
                          </div>

                          <div className="text-sm text-gray-800 line-clamp-2">
                            {r.addressText ??
                              addrMap[r.id] ??
                              "Fetching address..."}
                          </div>

                          <a
                            href={mapsLink(r.latitude, r.longitude)}
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

                    {/*  Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          askDelete(r);
                        }}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2 text-xs rounded-lg border border-red-200 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete this scan"
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

      {/* Bottom pagination */}
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

      <PlantScanDetailsModal
        open={open}
        scan={selected}
        onClose={closeDetails}
      />
    </div>
  );
}
