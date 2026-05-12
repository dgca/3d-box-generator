import {
  CUTOUT_PAIR_LABELS,
  CUTOUT_PAIR_NAMES,
  FACE_LABELS,
  FACE_NAMES,
  getCutoutDesignMetrics,
  getCutoutPointCount,
  getCutoutTargetFaces,
  getCutoutTargetLabel,
} from "@/lib/geometry/cutouts";
import type {
  BoxParams,
  CutoutAssignmentMode,
  CutoutPairName,
  CutoutSet,
  CutoutTarget,
  FaceCutout,
  FaceName,
} from "@/lib/types";

type CutoutControlsProps = {
  activeFace: FaceName;
  activePair: CutoutPairName;
  assignmentMode: CutoutAssignmentMode;
  cutouts: CutoutSet;
  onActiveFaceChange: (face: FaceName) => void;
  onActivePairChange: (pair: CutoutPairName) => void;
  onAssignmentModeChange: (mode: CutoutAssignmentMode) => void;
  onChange: (target: CutoutTarget, cutout: FaceCutout) => void;
  onClear: (target: CutoutTarget) => void;
  onSvgUpload: (target: CutoutTarget, file: File) => void;
  params: BoxParams;
};

export function CutoutControls({
  activeFace,
  activePair,
  assignmentMode,
  cutouts,
  onActiveFaceChange,
  onActivePairChange,
  onAssignmentModeChange,
  onChange,
  onClear,
  onSvgUpload,
  params,
}: CutoutControlsProps) {
  const activeTarget = assignmentMode === "faces" ? activeFace : activePair;
  const targetFaces = getCutoutTargetFaces(activeTarget);
  const primaryFace = targetFaces[0];
  const cutout = cutouts[primaryFace];
  const fitMode = cutout.fitMode ?? "contain";
  const designMetrics = getCutoutDesignMetrics(params, primaryFace, cutout);
  const isMixedPair =
    targetFaces.length > 1 &&
    targetFaces.some(
      (face) => getCutoutSignature(cutouts[face]) !== getCutoutSignature(cutout),
    );
  const pointCount = getCutoutPointCount(cutout);
  const fileInputId = `cutout-upload-${activeTarget}`;

  return (
    <div className="grid gap-4 border-t border-zinc-200 pt-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          SVG cutouts
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
          <button
            className={`h-9 rounded px-2 text-xs font-semibold transition ${
              assignmentMode === "faces"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
            onClick={() => onAssignmentModeChange("faces")}
            type="button"
          >
            Each face
          </button>
          <button
            className={`h-9 rounded px-2 text-xs font-semibold transition ${
              assignmentMode === "pairs"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
            onClick={() => onAssignmentModeChange("pairs")}
            type="button"
          >
            Opposite pairs
          </button>
        </div>
        <div
          className={`grid gap-1 rounded-md bg-zinc-100 p-1 ${
            assignmentMode === "faces" ? "grid-cols-4" : "grid-cols-2"
          }`}
        >
          {assignmentMode === "faces" ? (
            FACE_NAMES.map((face) => (
              <TargetButton
                isActive={activeFace === face}
                key={face}
                label={FACE_LABELS[face]}
                onClick={() => onActiveFaceChange(face)}
              />
            ))
          ) : (
            CUTOUT_PAIR_NAMES.map((pair) => (
              <TargetButton
                isActive={activePair === pair}
                key={pair}
                label={CUTOUT_PAIR_LABELS[pair]}
                onClick={() => onActivePairChange(pair)}
              />
            ))
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              {getCutoutTargetLabel(activeTarget)}
              {assignmentMode === "faces" ? " wall" : " walls"}
            </p>
            <p className="text-xs leading-5 text-zinc-500">
              {assignmentMode === "pairs"
                ? "Edits apply to both parallel faces."
                : "Dark filled SVG shapes become through-holes."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              checked={cutout.enabled}
              className="h-4 w-4 accent-teal-700"
              disabled={cutout.shapes.length === 0 && !cutout.error}
              onChange={(event) =>
                onChange(activeTarget, {
                  ...cutout,
                  enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
            Enabled
          </label>
        </div>

        {isMixedPair ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            This pair has different face settings. The next change here will sync
            both faces.
          </p>
        ) : null}

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Artwork sizing
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SizingMetric
              label="Usable area"
              value={`${formatMm(designMetrics.usableWidth)} x ${formatMm(
                designMetrics.usableHeight,
              )} mm`}
            />
            <SizingMetric
              label="Placed artwork"
              value={
                designMetrics.placedWidth === null ||
                designMetrics.placedHeight === null
                  ? "No SVG"
                  : `${formatMm(designMetrics.placedWidth)} x ${formatMm(
                      designMetrics.placedHeight,
                    )} mm`
              }
            />
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            Margin and chamfer excluded.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label
            className="inline-flex h-10 cursor-pointer items-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            htmlFor={fileInputId}
          >
            Upload SVG
          </label>
          <input
            accept=".svg,image/svg+xml"
            className="sr-only"
            id={fileInputId}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onSvgUpload(activeTarget, file);
              }

              event.currentTarget.value = "";
            }}
            type="file"
          />
          {(cutout.fileName || cutout.error || isMixedPair) && (
            <button
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
              onClick={() => onClear(activeTarget)}
              type="button"
            >
              Clear
            </button>
          )}
        </div>

        {cutout.fileName ? (
          <p className="truncate text-xs text-zinc-600" title={cutout.fileName}>
            {cutout.fileName} · {cutout.shapes.length} shape
            {cutout.shapes.length === 1 ? "" : "s"} · {pointCount} points
          </p>
        ) : null}

        {cutout.error ? (
          <p className="text-xs leading-5 text-rose-600">{cutout.error}</p>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Margin
          <span className="flex items-center gap-3">
            <input
              className="h-10 w-24 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-100"
              min={1}
              onChange={(event) =>
                onChange(activeTarget, {
                  ...cutout,
                  margin: Number(event.target.value),
                })
              }
              step={0.5}
              type="number"
              value={cutout.margin}
            />
            <span className="text-xs font-normal text-zinc-500">mm</span>
          </span>
        </label>

        <div className="grid gap-2 text-sm font-medium text-zinc-800">
          Fit
          <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
            <FitModeButton
              isActive={fitMode === "contain"}
              label="Keep proportions"
              onClick={() =>
                onChange(activeTarget, {
                  ...cutout,
                  fitMode: "contain",
                })
              }
            />
            <FitModeButton
              isActive={fitMode === "stretch"}
              label="Stretch to area"
              onClick={() =>
                onChange(activeTarget, {
                  ...cutout,
                  fitMode: "stretch",
                })
              }
            />
          </div>
        </div>

        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Scale
          <span className="flex items-center gap-3">
            <input
              className="w-full accent-teal-700"
              max={100}
              min={10}
              onChange={(event) =>
                onChange(activeTarget, {
                  ...cutout,
                  scale: Number(event.target.value) / 100,
                })
              }
              step={1}
              type="range"
              value={Math.round(cutout.scale * 100)}
            />
            <span className="w-10 text-right text-xs font-normal text-zinc-500">
              {Math.round(cutout.scale * 100)}%
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function FitModeButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`min-h-9 rounded px-2 py-2 text-xs font-semibold transition ${
        isActive
          ? "bg-white text-zinc-950 shadow-sm"
          : "text-zinc-600 hover:text-zinc-950"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SizingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function TargetButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-9 rounded px-2 text-xs font-semibold transition ${
        isActive
          ? "bg-white text-zinc-950 shadow-sm"
          : "text-zinc-600 hover:text-zinc-950"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function getCutoutSignature(cutout: FaceCutout) {
  return JSON.stringify({
    enabled: cutout.enabled,
    error: cutout.error ?? "",
    fileName: cutout.fileName ?? "",
    fitMode: cutout.fitMode ?? "contain",
    margin: cutout.margin,
    points: getCutoutPointCount(cutout),
    scale: cutout.scale,
    shapes: cutout.shapes.length,
  });
}

function formatMm(value: number) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}
