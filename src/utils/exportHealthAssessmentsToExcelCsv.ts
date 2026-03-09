import type { HealthAssessmentRow } from "@/src/components/modals/HealthAssessmentDetailsModal";

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
    };
  } | null;
};

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

function pctNumber(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100));
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

function getIsPlantText(row: HealthAssessmentRowEx) {
  const { notPlant, binary } = getPlantSignals(row);
  if (notPlant) return "No";
  if (binary === true) return "Yes";
  return "Unknown";
}

export function exportHealthAssessmentsToExcelCsv(
  items: HealthAssessmentRowEx[],
) {
  const headers = [
    "Assessed By",
    "User Email",
    "Created Day",
    "Is Plant",
    "Is Healthy",
    "Confidence (%)",
    "Is Plant Probability (%)",
    "Is Healthy Probability (%)",
    "Top Disease",
    "Top Disease Probability (%)",
    "Address",
    "Coordinate - Latitude",
    "Coordinate - Longitude",
    "Image URLs",
    "Disease Suggestions (names)",
  ];

  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(","));

  for (const r of items) {
    const userName =
      r.user?.displayName || r.user?.username || r.user?.email || "Unknown";

    const email = r.user?.email || "";

    const lat = r.location?.latitude ?? "";
    const lon = r.location?.longitude ?? "";

    const { notPlant, probability } = getPlantSignals(r);
    const isPlant = getIsPlantText(r);

    const topDiseaseName = !notPlant
      ? r.diseaseName ||
        r.topDisease?.details?.local_name ||
        r.topDisease?.name ||
        ""
      : "";

    const topDiseaseProb = !notPlant
      ? (r.topDisease?.probability ?? null)
      : null;

    const suggestionNames = !notPlant
      ? ((r.diseaseSuggestions ?? [])
          .map((d) => d.details?.local_name || d.name)
          .filter(Boolean) as string[])
      : [];

    const imageUrls = Array.isArray(r.imageUrls) ? r.imageUrls : [];

    const row = [
      safe(userName),
      safe(email),
      safe(r.createdDay ?? ""),
      safe(isPlant),
      !notPlant
        ? r.isHealthyBinary == null
          ? ""
          : r.isHealthyBinary
            ? "Yes"
            : "No"
        : "",
      pctNumber(r.confidence ?? null),
      pctNumber(probability ?? null),
      !notPlant ? pctNumber(r.isHealthyProbability ?? null) : "",
      safe(topDiseaseName),
      !notPlant ? pctNumber(topDiseaseProb ?? null) : "",
      safe(r.addressText ?? ""),
      safe(lat),
      safe(lon),
      safe(imageUrls.join(" | ")),
      !notPlant ? joinList(suggestionNames) : "",
    ];

    lines.push(row.map(csvCell).join(","));
  }

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const fileName = `health_assessments_report_${new Date()
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
