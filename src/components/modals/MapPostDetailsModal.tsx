// src/components/modals/MapPostDetailsModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, AlertTriangle } from "lucide-react";

import ImageCarousel from "@/src/components/ImageCarousel";
import SimilarImagesCarousel from "@/src/components/SimilarImagesCarousel";
import BadgeList from "@/src/components/ui/BadgeList";
import UserBadge from "@/src/components/ui/UserBadge";
import InfoDropdown from "@/src/components/InfoDropdown";

import {
  deriveVerifyStatus,
  type VerifyStatus,
} from "@/src/utils/exportMapPostsToExcelCsv";

type UserRole = "regular" | "expert";

type ExpertSnap =
  | string
  | {
      uid?: string;
      displayName?: string;
      username?: string;
      email?: string;
      photoURL?: string;
      name?: string;
      id?: string;
    };

type SimilarImage = {
  url?: string | null;
  url_small?: string | null;
  similarity?: number | null;
  citation?: string | null;
  license_name?: string | null;
  license_url?: string | null;
};

type Taxonomy = {
  kingdom?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
  genus?: string | null;
};

function expertLabel(x: ExpertSnap) {
  if (!x) return "Unknown";
  if (typeof x === "string") return x;
  return (
    x.displayName ||
    x.username ||
    x.email ||
    x.name ||
    x.uid ||
    x.id ||
    "Unknown"
  );
}

function expertAvatar(x: ExpertSnap) {
  if (typeof x === "string") return null;
  return x.photoURL || null;
}

function normalizeProbability(raw: any): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, normalized));
}

function getConfidence(p?: number | null) {
  if (typeof p !== "number") return null;
  if (p >= 0.85) return { label: "High", color: "#2E7D32", bg: "#E8F5E9" };
  if (p >= 0.6) return { label: "Medium", color: "#F9A825", bg: "#FFF8E1" };
  return { label: "Low", color: "#C62828", bg: "#FFEBEE" };
}

function formatLatLon(lat: number, lon: number) {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(
    6,
  )}° ${lonDir}`;
}

function mapsLink(lat: number, lon: number) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
      {children}
    </span>
  );
}

function TaxRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="w-full flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className="text-sm font-medium text-gray-900 text-right break-words">
        {value && String(value).trim().length > 0 ? value : "—"}
      </div>
    </div>
  );
}

function statusBanner(status: VerifyStatus) {
  if (status === "Verified") {
    return {
      bg: "bg-sky-500",
      icon: <BadgeCheck className="h-4 w-4 text-white" />,
      text: "Verified by expert(s)",
    };
  }
  if (status === "Invalidated by Expert") {
    return {
      bg: "bg-red-600",
      icon: <AlertTriangle className="h-4 w-4 text-white" />,
      text: "Invalidated by expert(s)",
    };
  }
  if (status === "Invalid") {
    return {
      bg: "bg-red-700",
      icon: <AlertTriangle className="h-4 w-4 text-white" />,
      text: "Invalid (removed/flagged)",
    };
  }
  return {
    bg: "bg-gray-600",
    icon: null,
    text: "Still not validated by an expert",
  };
}

function getImages(post: any): string[] {
  const plantUrls = post?.plant?.imageUrls;
  if (Array.isArray(plantUrls) && plantUrls.length) return plantUrls;

  const rootUrls = post?.imageUrls;
  if (Array.isArray(rootUrls) && rootUrls.length) return rootUrls;

  const rawUrls = post?.rawSummary?.imageUrls;
  if (Array.isArray(rawUrls) && rawUrls.length) return rawUrls;

  return [];
}

function safeArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function uniqExperts(list: ExpertSnap[]) {
  const seen = new Set<string>();
  const out: ExpertSnap[] = [];
  for (const x of list) {
    const key =
      typeof x === "string"
        ? x
        : x.uid || x.email || x.id || x.username || x.displayName || x.name;
    const k = (key || "").toString();
    if (!k) {
      out.push(x);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export default function MapPostDetailsModal({
  open,
  post,
  onClose,
}: {
  open: boolean;
  post: any | null;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExpanded(false);
      setTimeout(() => sheetRef.current?.focus(), 0);
    } else {
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const safePost = post ?? null;
  const status = useMemo<VerifyStatus>(
    () => (safePost ? deriveVerifyStatus(safePost) : "Unverified"),
    [safePost],
  );
  const banner = statusBanner(status);

  const userSnapshot = safePost?.userSnapshot ?? {};
  const posterRole: UserRole =
    userSnapshot?.role === "expert" ? "expert" : "regular";
  const roleLabel = posterRole === "expert" ? "Expert" : "Adventurer";

  const username = useMemo(() => {
    const u = userSnapshot ?? {};
    return (
      u?.username || u?.displayName || u?.email || safePost?.uid || "Unknown"
    );
  }, [userSnapshot, safePost?.uid]);

  const photo = useMemo(() => {
    const u = userSnapshot ?? {};
    return (
      u?.photoURL ||
      "https://res.cloudinary.com/dn2iechhl/image/upload/v1770614019/dnvu5qi7voondxp2zpmg.png"
    );
  }, [userSnapshot]);

  const address = useMemo(() => {
    const p = safePost;
    return (
      p?.detailedAddress ||
      p?.readableLocation ||
      p?.addressText ||
      p?.location?.readableLocation ||
      "N/A"
    );
  }, [safePost]);

  const lat = safePost?.location?.latitude ?? safePost?.latitude ?? null;
  const lon = safePost?.location?.longitude ?? safePost?.longitude ?? null;
  const hasCoords = lat != null && lon != null;

  const plant = safePost?.plant ?? {};
  const top =
    safePost?.topSuggestion ??
    safePost?.rawSummary?.topSuggestion ??
    plant?.topSuggestion ??
    {};
  const taxonomy: Taxonomy = (top?.taxonomy ?? plant?.taxonomy ?? {}) as any;

  const hasAnyTaxonomy = useMemo(() => {
    const t = taxonomy ?? {};
    return Boolean(
      t.kingdom || t.phylum || t.class || t.order || t.family || t.genus,
    );
  }, [taxonomy]);

  const images = useMemo(
    () => (safePost ? getImages(safePost) : []),
    [safePost],
  );

  // Similar images items
  const similarItems = useMemo(() => {
    const arr = Array.isArray(top?.similar_images) ? top.similar_images : [];
    return (arr as SimilarImage[])
      .map((img) => ({
        url: (img?.url || img?.url_small || "").trim(),
        similarity: typeof img?.similarity === "number" ? img.similarity : null,
        citation: img?.citation ?? null,
        license_name: img?.license_name ?? null,
        license_url: (img as any)?.license_url ?? null,
      }))
      .filter((x) => x.url.length > 0);
  }, [top?.similar_images]);

  const mainName = useMemo(() => {
    return (
      plant?.scientificName || top?.name || safePost?.plantName || "Unknown"
    );
  }, [plant?.scientificName, top?.name, safePost?.plantName]);

  // Confidence
  const probability01 = useMemo(() => {
    const fromTop = normalizeProbability(top?.probability);
    const fromRaw = normalizeProbability(safePost?.rawSummary?.probability);
    const fromIsPlant = normalizeProbability(
      safePost?.rawSummary?.isPlant?.probability,
    );
    const fromConfidence = normalizeProbability(safePost?.confidence);
    return fromTop ?? fromIsPlant ?? fromRaw ?? fromConfidence ?? null;
  }, [top?.probability, safePost]);

  const confidenceMeta = useMemo(
    () => getConfidence(probability01),
    [probability01],
  );

  const confidencePercentText = useMemo(() => {
    return typeof probability01 === "number"
      ? `${(probability01 * 100).toFixed(1)}%`
      : "N/A";
  }, [probability01]);

  // Caption (with read more)
  const caption = useMemo(() => {
    const text = (safePost?.caption ?? "").trim();
    return text || "No caption";
  }, [safePost?.caption]);

  // Likes + comments
  const likesCount = useMemo(
    () => safeArray(safePost?.likes).length,
    [safePost?.likes],
  );
  const commentsCount = useMemo(() => {
    const n = safePost?.commentsCount;
    if (typeof n === "number") return n;
    return safeArray(safePost?.comments).length;
  }, [safePost?.commentsCount, safePost?.comments]);

  // Common names + synonyms
  const commonNames = useMemo(() => {
    const list = Array.isArray(top?.common_names)
      ? top.common_names
      : Array.isArray(plant?.commonNames)
        ? plant.commonNames
        : [];
    return (list as any[]).filter(Boolean);
  }, [top?.common_names, plant?.commonNames]);

  const synonyms = useMemo(() => {
    const list = Array.isArray(top?.synonyms) ? top.synonyms : [];
    return (list as any[]).filter(Boolean);
  }, [top?.synonyms]);

  // Descriptions / extra info
  const descriptionText = useMemo(() => {
    const p = (plant?.description ?? "").trim();
    const t = (top?.description ?? "").trim();
    return p || t || "N/A";
  }, [plant?.description, top?.description]);

  const commonUsesText = useMemo(
    () => (top?.common_uses ?? "").trim() || "N/A",
    [top?.common_uses],
  );
  const culturalSignificance = useMemo(
    () => (top?.cultural_significance ?? "").trim() || "N/A",
    [top?.cultural_significance],
  );

  const validatedBy = useMemo<ExpertSnap[]>(() => {
    const list: ExpertSnap[] = Array.isArray(safePost?.expertValidatedBy)
      ? safePost.expertValidatedBy
      : [];
    return uniqExperts(list);
  }, [safePost?.expertValidatedBy]);

  const invalidatedBy = useMemo<ExpertSnap[]>(() => {
    const list: ExpertSnap[] = Array.isArray(safePost?.invalidatedByExpert)
      ? safePost.invalidatedByExpert
      : [];
    return uniqExperts(list);
  }, [safePost?.invalidatedByExpert]);

  // Show “expert activity” list depending on status (like your RN logic)
  const expertsToShow = useMemo(() => {
    if (status === "Invalidated by Expert") return invalidatedBy;
    if (status === "Verified") return validatedBy;
    return [];
  }, [status, validatedBy, invalidatedBy]);

  const expertsTitle = useMemo(() => {
    if (status === "Invalidated by Expert") return "Experts who invalidated";
    if (status === "Verified") return "Experts who verified";
    return "Expert Activity";
  }, [status]);

  if (!mounted || !safePost) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          open ? "opacity-100 bg-black/30" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`relative w-full max-w-2xl h-[90vh] bg-white rounded-t-3xl shadow-2xl border border-gray-200 overflow-hidden transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <UserBadge role={posterRole} size="xs" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                className="h-11 w-11 rounded-full object-cover border border-emerald-700/30"
              />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {username}
              </div>
              <div
                className={`text-xs font-semibold ${
                  roleLabel === "Expert" ? "text-sky-600" : "text-emerald-700"
                }`}
              >
                {roleLabel}
              </div>
              {userSnapshot?.email ? (
                <div className="text-xs text-gray-500 truncate">
                  {userSnapshot.email}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-red-600 font-semibold text-sm hover:opacity-80"
          >
            Close
          </button>
        </div>

        {/* Banner */}
        <div
          className={`w-full px-4 py-2 ${banner.bg} flex items-center justify-center gap-2`}
        >
          {banner.icon}
          <div className="text-white text-xs text-center">{banner.text}</div>
        </div>

        {/* Body */}
        <div className="h-[calc(90vh-96px)] overflow-auto px-4 py-4">
          <div className="flex flex-col items-center gap-4">
            {/* Images */}
            <div className="w-full">
              <ImageCarousel images={images} />
            </div>

            {/* Like + comment totals */}
            <div className="w-full flex justify-center gap-2">
              <Pill>
                Likes: <span className="font-semibold">{likesCount}</span>
              </Pill>
              <Pill>
                Comments: <span className="font-semibold">{commentsCount}</span>
              </Pill>
            </div>

            {/* Address + Map + Coordinates */}
            <div className="w-full text-center">
              <div className="text-xs text-gray-600">
                Captured In: <span className="font-semibold">{address}</span>
              </div>

              {hasCoords ? (
                <>
                  <a
                    href={mapsLink(Number(lat), Number(lon))}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-sky-600 hover:underline"
                  >
                    View Map
                  </a>

                  <div className="mt-2 text-xs text-gray-500">
                    Coordinates: {formatLatLon(Number(lat), Number(lon))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Plant name */}
            <div className="w-full text-center text-2xl font-extrabold text-emerald-700 italic">
              {mainName}
            </div>

            {/* Confidence */}
            {confidenceMeta ? (
              <div
                className="mx-auto inline-flex items-center gap-3 px-4 py-2 rounded-full"
                style={{ backgroundColor: confidenceMeta.bg }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: confidenceMeta.color }}
                >
                  Confidence: {confidenceMeta.label}
                </span>
                <span className="w-px h-4 bg-black/15" />
                <span
                  className="text-sm font-bold"
                  style={{ color: confidenceMeta.color }}
                >
                  {confidencePercentText}
                </span>
              </div>
            ) : null}

            {/* Common Names */}
            <div className="w-full">
              <BadgeList label="Common Names" items={commonNames} max={12} />
            </div>

            {/* Description */}
            <div className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
              <div className="font-bold text-sm mb-2">Description</div>
              <p className="text-sm text-gray-800 leading-6 text-justify">
                {descriptionText}
              </p>
            </div>

            {/* Taxonomy list */}
            {hasAnyTaxonomy ? (
              <div className="w-full rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 text-center">
                  Taxonomy
                </div>

                <div className="mt-3">
                  <TaxRow label="Kingdom" value={taxonomy?.kingdom} />
                  <TaxRow label="Phylum" value={taxonomy?.phylum} />
                  <TaxRow label="Class" value={taxonomy?.class} />
                  <TaxRow label="Order" value={taxonomy?.order} />
                  <TaxRow label="Family" value={taxonomy?.family} />
                  <TaxRow label="Genus" value={taxonomy?.genus} />
                </div>
              </div>
            ) : null}

            {/* Info dropdowns */}
            <div className="w-full flex flex-col gap-3">
              <InfoDropdown title="Caption">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {expanded ? caption : caption.slice(0, 500)}
                  {!expanded && caption.length > 500 ? "..." : ""}
                </p>

                {caption.length > 500 ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-sky-600 hover:underline"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                ) : null}
              </InfoDropdown>

              <InfoDropdown title="Common Uses">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {commonUsesText}
                </p>
              </InfoDropdown>

              <InfoDropdown title="Toxicity">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {top?.toxicity ?? "N/A"}
                </p>
              </InfoDropdown>

              <InfoDropdown title="Best Watering">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {top?.best_watering ?? "N/A"}
                </p>
              </InfoDropdown>

              <InfoDropdown title="Best Soil Type">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {top?.best_soil_type ?? "N/A"}
                </p>
              </InfoDropdown>

              <InfoDropdown title="Best Light Condition">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {top?.best_light_condition ?? "N/A"}
                </p>
              </InfoDropdown>

              <InfoDropdown title="Cultural Significance">
                <p className="text-sm text-gray-800 leading-6 text-justify">
                  {culturalSignificance}
                </p>
              </InfoDropdown>

              {top?.url ? (
                <InfoDropdown title="Reference Link (Wikipedia)">
                  <a
                    href={top.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 hover:underline"
                  >
                    Open link
                  </a>
                </InfoDropdown>
              ) : null}
            </div>

            {/* Similar Images */}
            <div className="w-full">
              {similarItems.length ? (
                <SimilarImagesCarousel
                  items={similarItems}
                  title="Similar Images"
                />
              ) : (
                <>
                  <div className="font-bold text-sm mb-2">Similar Images</div>
                  <div className="text-sm text-gray-500">N/A</div>
                </>
              )}
            </div>

            {/* Synonyms */}
            <div className="w-full">
              <BadgeList label="Synonyms" items={synonyms} max={18} />
            </div>

            {/* ✅ Experts who validated/invalidated */}
            <div className="w-full rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">
                {expertsTitle}
              </div>

              {status !== "Verified" && status !== "Invalidated by Expert" ? (
                <div className="mt-2 text-sm text-gray-500">—</div>
              ) : expertsToShow.length === 0 ? (
                <div className="mt-2 text-sm text-gray-500">—</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {expertsToShow.map((x, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {expertAvatar(x) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={expertAvatar(x)!}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover border border-black/5"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-100 border border-black/5 flex items-center justify-center text-xs font-semibold text-gray-600">
                          EX
                        </div>
                      )}
                      <div className="text-sm text-gray-800">
                        {expertLabel(x)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* always show counts */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>
                  Verified By:{" "}
                  <span className="font-semibold">{validatedBy.length}</span>
                </Pill>
                <Pill>
                  Invalidated By:{" "}
                  <span className="font-semibold">{invalidatedBy.length}</span>
                </Pill>
              </div>
            </div>

            {/* Footer pills */}
            <div className="w-full mt-2 text-center text-xs text-gray-500">
              <div className="flex flex-wrap gap-2 justify-center">
                <Pill>
                  Post ID: <span className="font-mono">{safePost.id}</span>
                </Pill>
                <Pill>
                  UID: <span className="font-mono">{safePost.uid ?? "—"}</span>
                </Pill>
                <Pill>Created Day: {safePost.createdDay ?? "—"}</Pill>
              </div>
            </div>

            <div className="h-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
