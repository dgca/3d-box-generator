import {
  getCutoutPointCount,
  getLidCutoutDesignMetrics,
} from "3d-box-generator";
import type {
  BoxParams,
  LidCutDepth,
  LidCutout,
  LidField,
  LidParams,
  LidSeatStyle,
  ValidationIssue,
} from "3d-box-generator";

type FieldConfig = {
  key: LidField;
  label: string;
  min: number;
  step: number;
};

type LidControlsProps = {
  cutout: LidCutout;
  issues: ValidationIssue[];
  lidParams: LidParams;
  onChange: (params: LidParams) => void;
  onClearCutout: () => void;
  onCutoutChange: (cutout: LidCutout) => void;
  onReset: () => void;
  onSvgUpload: (file: File) => void;
  safeBoxParams: BoxParams;
};

const FIELDS: FieldConfig[] = [
  { key: "clearance", label: "Clearance", min: 0, step: 0.1 },
  { key: "topThickness", label: "Top thickness", min: 0.2, step: 0.1 },
  { key: "plugDepth", label: "Seat depth", min: 0.2, step: 0.1 },
  { key: "overhang", label: "Overhang", min: 0, step: 0.1 },
];

const SEAT_STYLES: Array<{
  description: string;
  label: string;
  value: LidSeatStyle;
}> = [
  {
    description: "A center plug fits inside the box opening.",
    label: "Plug fit",
    value: "plug",
  },
  {
    description: "A channel captures the box rim.",
    label: "Rim groove",
    value: "rimGroove",
  },
];

const CUT_DEPTHS: Array<{
  description: string;
  label: string;
  value: LidCutDepth;
}> = [
  {
    description: "Leaves the underside seat solid.",
    label: "Top only",
    value: "top",
  },
  {
    description: "Cuts through the top and underside seat.",
    label: "Through lid",
    value: "through",
  },
];

export function LidControls({
  cutout,
  issues,
  lidParams,
  onChange,
  onClearCutout,
  onCutoutChange,
  onReset,
  onSvgUpload,
  safeBoxParams,
}: LidControlsProps) {
  const issuesByField = new Map<LidField, string>();
  const fitMode = cutout.fitMode ?? "contain";
  const metrics = getLidCutoutDesignMetrics(safeBoxParams, lidParams, cutout);
  const pointCount = getCutoutPointCount(cutout);

  for (const issue of issues) {
    if (issue.lidField && !issuesByField.has(issue.lidField)) {
      issuesByField.set(issue.lidField, issue.message);
    }
  }

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col gap-6 bg-white px-5 py-6 lg:px-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
            Lid settings
          </h2>
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
        </div>
        <p className="text-sm leading-6 text-zinc-600">
          Tune the separate lid part and top artwork.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <span className="text-sm font-medium text-zinc-800">Seat style</span>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
            {SEAT_STYLES.map((style) => (
              <FitModeButton
                isActive={lidParams.seatStyle === style.value}
                key={style.value}
                label={style.label}
                onClick={() =>
                  onChange({
                    ...lidParams,
                    seatStyle: style.value,
                  })
                }
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            {
              SEAT_STYLES.find((style) => style.value === lidParams.seatStyle)
                ?.description
            }
          </p>
        </div>

        {FIELDS.map((field) => {
          const issue = issuesByField.get(field.key);
          const inputId = `lid-${field.key}`;
          const value = lidParams[field.key];

          return (
            <label className="grid gap-2" htmlFor={inputId} key={field.key}>
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-800">
                {field.label}
                <span className="text-xs font-normal text-zinc-500">mm</span>
              </span>
              <input
                aria-describedby={issue ? `${inputId}-error` : undefined}
                aria-invalid={Boolean(issue)}
                className="h-11 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-600 focus:bg-white focus:ring-3 focus:ring-teal-100 aria-invalid:border-rose-500 aria-invalid:focus:ring-rose-100"
                id={inputId}
                inputMode="decimal"
                min={field.min}
                onChange={(event) =>
                  onChange({
                    ...lidParams,
                    [field.key]:
                      event.target.value.trim() === ""
                        ? Number.NaN
                        : Number(event.target.value),
                  })
                }
                step={field.step}
                type="number"
                value={Number.isFinite(value) ? value : ""}
              />
              {issue ? (
                <span
                  className="text-xs leading-5 text-rose-600"
                  id={`${inputId}-error`}
                >
                  {issue}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <div className="grid gap-4 border-t border-zinc-200 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Lid artwork
        </p>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Top plate</p>
              <p className="text-xs leading-5 text-zinc-500">
                Dark filled SVG shapes carve the lid.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                checked={cutout.enabled}
                className="h-4 w-4 accent-teal-700"
                disabled={cutout.shapes.length === 0 && !cutout.error}
                onChange={(event) =>
                  onCutoutChange({
                    ...cutout,
                    enabled: event.target.checked,
                  })
                }
                type="checkbox"
              />
              Enabled
            </label>
          </div>

          <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Artwork sizing
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SizingMetric
                label="Usable area"
                value={`${formatMm(metrics.usableWidth)} x ${formatMm(
                  metrics.usableDepth,
                )} mm`}
              />
              <SizingMetric
                label="Placed artwork"
                value={
                  metrics.placedWidth === null || metrics.placedDepth === null
                    ? "No SVG"
                    : `${formatMm(metrics.placedWidth)} x ${formatMm(
                        metrics.placedDepth,
                      )} mm`
                }
              />
            </div>
            <p className="text-xs leading-5 text-zinc-500">
              Margin, plug clearance, and rounded corner buffer excluded.
            </p>
          </div>

          <div className="grid gap-2 text-sm font-medium text-zinc-800">
            Cut depth
            <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
              {CUT_DEPTHS.map((option) => (
                <FitModeButton
                  isActive={lidParams.cutDepth === option.value}
                  key={option.value}
                  label={option.label}
                  onClick={() =>
                    onChange({
                      ...lidParams,
                      cutDepth: option.value,
                    })
                  }
                />
              ))}
            </div>
            <p className="text-xs leading-5 text-zinc-500">
              {
                CUT_DEPTHS.find(
                  (option) => option.value === lidParams.cutDepth,
                )?.description
              }
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <label
              className="inline-flex h-10 cursor-pointer items-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              htmlFor="lid-cutout-upload"
            >
              Upload SVG
            </label>
            <input
              accept=".svg,image/svg+xml"
              className="sr-only"
              id="lid-cutout-upload"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  onSvgUpload(file);
                }

                event.currentTarget.value = "";
              }}
              type="file"
            />
            {(cutout.fileName || cutout.error) && (
              <button
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
                onClick={onClearCutout}
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {cutout.fileName ? (
            <p
              className="truncate text-xs text-zinc-600"
              title={cutout.fileName}
            >
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
                  onCutoutChange({
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
                  onCutoutChange({
                    ...cutout,
                    fitMode: "contain",
                  })
                }
              />
              <FitModeButton
                isActive={fitMode === "stretch"}
                label="Stretch to area"
                onClick={() =>
                  onCutoutChange({
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
                  onCutoutChange({
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
    </section>
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

function formatMm(value: number) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}
