import {
  FACE_LABELS,
  FACE_NAMES,
  getCutoutPointCount,
} from "@/lib/geometry/cutouts";
import type { CutoutSet, FaceCutout, FaceName } from "@/lib/types";

type CutoutControlsProps = {
  activeFace: FaceName;
  cutouts: CutoutSet;
  onActiveFaceChange: (face: FaceName) => void;
  onChange: (face: FaceName, cutout: FaceCutout) => void;
  onClear: (face: FaceName) => void;
  onSvgUpload: (face: FaceName, file: File) => void;
};

export function CutoutControls({
  activeFace,
  cutouts,
  onActiveFaceChange,
  onChange,
  onClear,
  onSvgUpload,
}: CutoutControlsProps) {
  const cutout = cutouts[activeFace];
  const pointCount = getCutoutPointCount(cutout);
  const fileInputId = `cutout-upload-${activeFace}`;

  return (
    <div className="grid gap-4 border-t border-zinc-200 pt-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          SVG cutouts
        </p>
        <div className="grid grid-cols-4 gap-1 rounded-md bg-zinc-100 p-1">
          {FACE_NAMES.map((face) => (
            <button
              className={`h-9 rounded px-2 text-xs font-semibold transition ${
                activeFace === face
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              key={face}
              onClick={() => onActiveFaceChange(face)}
              type="button"
            >
              {FACE_LABELS[face]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              {FACE_LABELS[activeFace]} wall
            </p>
            <p className="text-xs leading-5 text-zinc-500">
              Dark filled SVG shapes become through-holes.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              checked={cutout.enabled}
              className="h-4 w-4 accent-teal-700"
              disabled={cutout.shapes.length === 0 && !cutout.error}
              onChange={(event) =>
                onChange(activeFace, {
                  ...cutout,
                  enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
            Enabled
          </label>
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
                onSvgUpload(activeFace, file);
              }

              event.currentTarget.value = "";
            }}
            type="file"
          />
          {(cutout.fileName || cutout.error) && (
            <button
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
              onClick={() => onClear(activeFace)}
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
                onChange(activeFace, {
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

        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Scale
          <span className="flex items-center gap-3">
            <input
              className="w-full accent-teal-700"
              max={100}
              min={10}
              onChange={(event) =>
                onChange(activeFace, {
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
