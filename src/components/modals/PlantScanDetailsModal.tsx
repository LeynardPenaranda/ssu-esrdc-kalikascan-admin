"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ImageCarousel from "@/src/components/ImageCarousel";
import SimilarImagesCarousel from "@/src/components/SimilarImagesCarousel";

import BadgeList from "@/src/components/ui/BadgeList";
import UserBadge from "@/src/components/ui/UserBadge";
import InfoDropdown from "../InfoDropdown";

type UserSnap = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  username: string | null;
  role?: "regular" | "expert" | null;
};

type SimilarImage = {
  url?: string | null; // full quality
  url_small?: string | null;
  similarity?: number | null;
  citation?: string | null;
  license_name?: string | null;
  // optional if your API provides it
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

type TopSuggestion = {
  name?: string | null;
  rank?: string | null;
  probability?: number | null;

  description?: string | null;
  common_uses?: string | null;
  cultural_significance?: string | null;
  toxicity?: string | null;

  best_watering?: string | null;
  best_soil_type?: string | null;
  best_light_condition?: string | null;

  common_names?: string[] | null;
  synonyms?: string[] | null;

  taxonomy?: Taxonomy | null;
  similar_images?: SimilarImage[] | null;

  url?: string | null;
};

export type PlantScanRow = {
  id: string;
  uid: string | null;

  createdDay: string | null;
  createdAtLocal: number | null;

  caption?: string | null;

  plantName: string | null;
  confidence: number | null;

  isPlantBinary: boolean | null;
  isPlantProbability: number | null;

  latitude: number | null;
  longitude: number | null;
  addressText: string | null;

  imageUrl: string | null;
  imageUrls: string[];

  provider?: string | null;
  modelVersion?: string | null;

  topSuggestion?: TopSuggestion | null;

  user: UserSnap | null;
};

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

export default function PlantScanDetailsModal({
  open,
  scan,
  onClose,
}: {
  open: boolean;
  scan: PlantScanRow | null;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const safeScan: PlantScanRow | null = scan ?? null;
  const top = safeScan?.topSuggestion ?? {};
  const taxonomy = top?.taxonomy ?? {};

  const images = useMemo(() => {
    const s = safeScan;
    if (!s) return [];
    const list =
      s.imageUrls?.length > 0 ? s.imageUrls : s.imageUrl ? [s.imageUrl] : [];
    return list.filter(Boolean);
  }, [safeScan]);

  // ✅ items for SimilarImagesCarousel (includes similarity/license/citation)
  const similarItems = useMemo(() => {
    const arr = Array.isArray(top?.similar_images) ? top.similar_images : [];
    return arr
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
    return top?.name ?? safeScan?.plantName ?? "Unknown";
  }, [top?.name, safeScan?.plantName]);

  const probability01 = useMemo(() => {
    const s = safeScan;
    const fromTop = normalizeProbability(top?.probability);
    const fromIsPlant = normalizeProbability(s?.isPlantProbability);
    const fromRoot = normalizeProbability(s?.confidence);
    return fromTop ?? fromIsPlant ?? fromRoot ?? null;
  }, [top?.probability, safeScan?.isPlantProbability, safeScan?.confidence]);

  const confidenceMeta = useMemo(
    () => getConfidence(probability01),
    [probability01],
  );

  const confidencePercentText = useMemo(() => {
    return typeof probability01 === "number"
      ? `${(probability01 * 100).toFixed(1)}%`
      : "N/A";
  }, [probability01]);

  const caption = useMemo(() => {
    const text = (safeScan?.caption ?? "").trim();
    return text || "No caption";
  }, [safeScan?.caption]);

  const commonNames = useMemo(() => {
    const list = Array.isArray(top?.common_names) ? top.common_names : [];
    return list.filter(Boolean);
  }, [top?.common_names]);

  const synonyms = useMemo(() => {
    const list = Array.isArray(top?.synonyms) ? top.synonyms : [];
    return list.filter(Boolean);
  }, [top?.synonyms]);

  const descriptionText = useMemo(
    () => (top?.description ?? "").trim() || "N/A",
    [top?.description],
  );
  const commonUsesText = useMemo(
    () => (top?.common_uses ?? "").trim() || "N/A",
    [top?.common_uses],
  );
  const culturalSignificance = useMemo(
    () => (top?.cultural_significance ?? "").trim() || "N/A",
    [top?.cultural_significance],
  );

  const userRole = useMemo(() => {
    return safeScan?.user?.role === "expert" ? "expert" : ("regular" as const);
  }, [safeScan?.user?.role]);

  const roleLabel = userRole === "expert" ? "Expert" : "Adventurer";

  const username = useMemo(() => {
    const u = safeScan?.user;
    return u?.username || u?.displayName || u?.email || "Unknown";
  }, [safeScan?.user]);

  const photo = useMemo(() => {
    const u = safeScan?.user;
    return (
      u?.photoURL ||
      "https://res.cloudinary.com/dn2iechhl/image/upload/v1770614019/dnvu5qi7voondxp2zpmg.png"
    );
  }, [safeScan?.user]);

  const hasCoords = safeScan?.latitude != null && safeScan?.longitude != null;

  const hasAnyTaxonomy = useMemo(() => {
    const t = taxonomy ?? {};
    return Boolean(
      t.kingdom || t.phylum || t.class || t.order || t.family || t.genus,
    );
  }, [taxonomy]);

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

  if (!mounted || !safeScan) return null;

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
              <UserBadge role={userRole} size="xs" />
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

        {/* Body */}
        <div className="h-[calc(90vh-64px)] overflow-auto px-4 py-4">
          <div className="flex flex-col items-center gap-4">
            {/* Scan Images */}
            <div className="w-full">
              <ImageCarousel images={images} />
            </div>

            {/* Address + Map + Coordinates */}
            <div className="w-full text-center">
              <div className="text-xs text-gray-600">
                Captured In:{" "}
                <span className="font-semibold">
                  {safeScan.addressText ?? "N/A"}
                </span>
              </div>

              {hasCoords ? (
                <>
                  <a
                    href={mapsLink(safeScan.latitude!, safeScan.longitude!)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-sky-600 hover:underline"
                  >
                    View Map
                  </a>

                  <div className="mt-2 text-xs text-gray-500">
                    Coordinates:{" "}
                    {formatLatLon(safeScan.latitude!, safeScan.longitude!)}
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

            {/* Taxonomy list (NOT dropdown) */}
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
                  {caption}
                </p>
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

            {/* ✅ Similar Images (uses SimilarImagesCarousel) */}
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

            {/* Footer pills */}
            <div className="w-full mt-2 text-center text-xs text-gray-500">
              <div className="flex flex-wrap gap-2 justify-center">
                <Pill>
                  Scan ID: <span className="font-mono">{safeScan.id}</span>
                </Pill>
                <Pill>
                  UID: <span className="font-mono">{safeScan.uid ?? "—"}</span>
                </Pill>
                <Pill>Provider: {safeScan.provider ?? "—"}</Pill>
                <Pill>Model: {safeScan.modelVersion ?? "—"}</Pill>
              </div>
            </div>

            <div className="h-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
