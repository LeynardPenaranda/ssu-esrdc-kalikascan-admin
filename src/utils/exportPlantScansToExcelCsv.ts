import type { PlantScanRow } from "@/src/components/modals/PlantScanDetailsModal";

function safe(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function joinList(list: any) {
  if (!Array.isArray(list)) return "";
  return list
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .join(", ");
}

function csvCell(value: string) {
  const v = safe(value);
  const escaped = v.replace(/"/g, '""');
  if (/[",\n]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function getIsPlantText(row: PlantScanRow) {
  if (row.isPlantBinary == null) return "Unknown";
  return row.isPlantBinary ? "Yes" : "No";
}

export function exportPlantScansToExcelCsv(scans: PlantScanRow[]) {
  const headers = [
    "Scanned By",
    "User Email",
    "Is Plant",
    "Scientific Name",
    "Confidence (%)",
    "Scanned Date",
    "Address",
    "Coordinate - Latitude",
    "Coordinate - Longitude",
    "Taxonomy - Kingdom",
    "Taxonomy - Phylum",
    "Taxonomy - Class",
    "Taxonomy - Order",
    "Taxonomy - Family",
    "Taxonomy - Genus",
    "Common Names",
    "Image URLs",
  ];

  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(","));

  for (const r of scans) {
    const userName =
      r.user?.displayName || r.user?.username || r.user?.email || "Unknown";

    const email = r.user?.email || "";
    const isPlant = getIsPlantText(r);

    const top = r.topSuggestion ?? {};
    const taxonomy = top.taxonomy ?? {};

    const shouldIncludePlantDetails = r.isPlantBinary !== false;

    const scientificName = shouldIncludePlantDetails
      ? (top.name ?? r.plantName ?? "")
      : "";

    const confidencePct =
      typeof r.confidence === "number" ? Math.round(r.confidence * 100) : "";

    const scannedDate = r.createdDay ?? "";
    const address = r.addressText ?? "";

    const imageUrls = Array.isArray((r as any).imageUrls)
      ? ((r as any).imageUrls as string[])
      : Array.isArray((r as any).images)
        ? ((r as any).images as string[])
        : [];

    const row = [
      safe(userName),
      safe(email),
      safe(isPlant),
      safe(scientificName),
      safe(confidencePct),
      safe(scannedDate),
      safe(address),
      safe(r.latitude ?? ""),
      safe(r.longitude ?? ""),
      safe(shouldIncludePlantDetails ? (taxonomy.kingdom ?? "") : ""),
      safe(shouldIncludePlantDetails ? (taxonomy.phylum ?? "") : ""),
      safe(shouldIncludePlantDetails ? (taxonomy.class ?? "") : ""),
      safe(shouldIncludePlantDetails ? (taxonomy.order ?? "") : ""),
      safe(shouldIncludePlantDetails ? (taxonomy.family ?? "") : ""),
      safe(shouldIncludePlantDetails ? (taxonomy.genus ?? "") : ""),
      safe(shouldIncludePlantDetails ? joinList(top.common_names) : ""),
      safe(imageUrls.join(" | ")),
    ];

    lines.push(row.map(csvCell).join(","));
  }

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const fileName = `plant_scans_report_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
