"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, RotateCcw, Trash2 } from "lucide-react";
import {
  deriveVerifyStatus,
  exportMapPostsToExcelCsv,
  type VerifyStatus,
} from "@/src/utils/exportMapPostsToExcelCsv";
import MapPostDetailsModal from "@/src/components/modals/MapPostDetailsModal";
import DeleteConfirmModal from "@/src/components/modals/DeleteConfirmModal";
import { useToast } from "@/src/hooks/useToast";
import { auth } from "@/src/lib/firebase/client";

const PAGE_SIZE = 10;

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

function lastItem(arr: any) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[arr.length - 1];
}

function expertLabel(x: any) {
  if (!x) return "—";
  if (typeof x === "string") return x;
  return (
    x.displayName || x.username || x.email || x.name || x.uid || x.id || "—"
  );
}

function statusPill(status: VerifyStatus) {
  const base =
    "inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium";
  return <span className={base}>{status}</span>;
}

export default function MapPostsReport() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Details modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  //  Delete confirm modal state (your DeleteConfirmModal)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    label?: string;
  } | null>(null);

  const loadPosts = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/map-posts", { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data?.posts) ? data.posts : []);
      setPage(1);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => setPage(1), [q]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((p) => {
      const user = p?.user ?? p?.userSnapshot ?? {};
      const userText =
        user?.displayName || user?.username || user?.email || p?.uid || "";

      const plant = p?.plant?.scientificName || p?.topSuggestion?.name || "";
      const day = p?.createdDay || "";

      const address =
        p?.detailedAddress ||
        p?.addressText ||
        p?.readableLocation ||
        p?.location?.readableLocation ||
        "";

      const status = deriveVerifyStatus(p);

      return (
        String(userText).toLowerCase().includes(s) ||
        String(plant).toLowerCase().includes(s) ||
        String(day).toLowerCase().includes(s) ||
        String(address).toLowerCase().includes(s) ||
        String(status).toLowerCase().includes(s)
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

  function openDetails(p: any) {
    setSelected(p);
    setOpen(true);
  }
  function closeDetails() {
    setOpen(false);
    setSelected(null);
  }

  async function onDownload() {
    try {
      setDownloading(true);
      exportMapPostsToExcelCsv(filtered);

      showToast({
        type: "success",
        message: "Download started",
        description: `Exported ${filtered.length} map post(s).`,
      });
    } finally {
      setDownloading(false);
    }
  }

  //  open your delete confirm modal instead of window.confirm
  function askDeletePost(p: any) {
    const plant = p?.plant ?? {};
    const top = p?.topSuggestion ?? plant?.topSuggestion ?? {};
    const scientificName =
      plant?.scientificName || top?.name || p?.plantName || "Map Post";

    setPendingDelete({
      id: p.id,
      label: scientificName,
    });
    setDeleteOpen(true);
  }

  async function doDeletePost(postId: string) {
    try {
      setDeletingId(postId);

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

      const res = await fetch("/api/admin/map-posts/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ postId }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast({
          type: "danger",
          message: "Delete failed",
          description: data?.error ?? "Unable to delete this map post.",
        });
        return;
      }

      //  close details modal if deleting the one currently open
      setOpen((wasOpen) => {
        if (wasOpen && selected?.id === postId) {
          setSelected(null);
          return false;
        }
        return wasOpen;
      });

      //  remove from table instantly
      setRows((prev) => prev.filter((x) => x.id !== postId));

      showToast({
        type: "success",
        message: "Map post deleted",
        description: `Deleted ID: ${postId}`,
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
    <div className="w-full h-full overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">
          {loading ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span> posts
            </>
          ) : total === 0 ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span> posts
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
          {/* LEFT SIDE — SEARCH */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Mobile search */}
            <div className="sm:hidden flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search map posts..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none bg-white"
              />
            </div>

            {/* Desktop search */}
            <div className="hidden sm:block">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search user, plant, date, address, status..."
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

          {/* RIGHT SIDE — ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={loadPosts}
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
              title={
                total === 0 ? "No records to export" : "Download results to CSV"
              }
            >
              <FileDown size={14} />
              <span className="hidden sm:inline">
                {downloading ? "Preparing..." : "Download Map Report.csv"}
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

      {/* table */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-gray-100 bg-white">
        <table className="min-w-[1300px] table-fixed text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left border-b border-gray-100">
              <th className="px-4 py-3 font-medium text-gray-600">Posted By</th>
              <th className="px-4 py-3 font-medium text-gray-600">Plant</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Verify Status
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Expert</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Posted Date
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Address</th>
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
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            ) : total === 0 ? (
              <tr className="bg-white">
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {q.trim() ? "No matching posts found." : "No posts found."}
                </td>
              </tr>
            ) : (
              paged.map((p) => {
                const user = p?.user ?? p?.userSnapshot ?? {};
                const display =
                  user?.displayName ||
                  user?.username ||
                  user?.email ||
                  p?.uid ||
                  "Unknown user";

                const status = deriveVerifyStatus(p);

                const validated = Array.isArray(p?.expertValidatedBy)
                  ? p.expertValidatedBy
                  : [];
                const invalidated = Array.isArray(p?.invalidatedByExpert)
                  ? p.invalidatedByExpert
                  : [];

                const expert =
                  status === "Invalidated by Expert"
                    ? expertLabel(lastItem(invalidated))
                    : status === "Verified"
                      ? expertLabel(lastItem(validated))
                      : "—";

                const plant = p?.plant ?? {};
                const top = p?.topSuggestion ?? plant?.topSuggestion ?? {};
                const scientificName =
                  plant?.scientificName || top?.name || p?.plantName || "—";

                const address =
                  p?.detailedAddress ||
                  p?.addressText ||
                  p?.readableLocation ||
                  p?.location?.readableLocation ||
                  "—";

                const lat = p?.location?.latitude ?? p?.latitude ?? null;
                const lon = p?.location?.longitude ?? p?.longitude ?? null;

                const thumb =
                  Array.isArray(p?.imageUrls) && p.imageUrls.length > 0
                    ? p.imageUrls[0]
                    : Array.isArray(plant?.imageUrls) &&
                        plant.imageUrls.length > 0
                      ? plant.imageUrls[0]
                      : null;

                const isDeleting = deletingId === p.id;

                return (
                  <tr
                    key={p.id}
                    onClick={() => openDetails(p)}
                    className="bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {user?.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.photoURL}
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
                            <span className="font-mono">{p?.uid ?? "—"}</span>
                            {user?.email ? (
                              <span className="ml-2">{user.email}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-900">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-black/5"
                          />
                        ) : null}

                        <div className="min-w-0">
                          <div className="font-medium truncate italic">
                            {scientificName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            Post ID: <span className="font-mono">{p.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">{statusPill(status)}</td>
                    <td className="px-4 py-3 text-gray-700">{expert}</td>

                    <td className="px-4 py-3 text-gray-700">
                      {p?.createdDay ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      <div className="line-clamp-2">{address}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {lat != null && lon != null ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">
                            {formatLatLon(Number(lat), Number(lon))}
                          </div>
                          <a
                            href={mapsLink(Number(lat), Number(lon))}
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
                          e.stopPropagation(); //  don’t open modal
                          askDeletePost(p);
                        }}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2 text-xs rounded-lg border border-red-200 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete this post"
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

      {/*  Delete confirm modal (reusable) */}
      <DeleteConfirmModal
        open={deleteOpen}
        title="Delete this map post?"
        message={
          "This will permanently delete the map post.\nThis cannot be undone."
        }
        itemLabelText={pendingDelete?.label}
        itemIdText={
          pendingDelete?.id ? `Post ID: ${pendingDelete.id}` : undefined
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

          // close modal first for snappy UX
          setDeleteOpen(false);
          setPendingDelete(null);

          await doDeletePost(id);
        }}
      />

      {/* Details modal */}
      <MapPostDetailsModal open={open} post={selected} onClose={closeDetails} />
    </div>
  );
}
