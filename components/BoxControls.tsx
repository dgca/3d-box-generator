import type {
  BoxDimensions,
  BoxField,
  BoxParams,
  CutoutAssignmentMode,
  CutoutPairName,
  CutoutSet,
  FaceCutout,
  FaceName,
  CutoutTarget,
  ValidationIssue,
} from "@/lib/types";
import { CutoutControls } from "@/components/CutoutControls";

type FieldConfig = {
  key: BoxField;
  label: string;
  min: number;
  step: number;
};

type BoxControlsProps = {
  activeFace: FaceName;
  activePair: CutoutPairName;
  cutoutAssignmentMode: CutoutAssignmentMode;
  cutouts: CutoutSet;
  dimensions: BoxDimensions;
  issues: ValidationIssue[];
  maxCornerChamfer: number;
  onActiveFaceChange: (face: FaceName) => void;
  onActivePairChange: (pair: CutoutPairName) => void;
  onChange: (params: BoxParams) => void;
  onClearCutout: (target: CutoutTarget) => void;
  onCutoutAssignmentModeChange: (mode: CutoutAssignmentMode) => void;
  onCutoutChange: (target: CutoutTarget, cutout: FaceCutout) => void;
  onReset: () => void;
  onSvgUpload: (target: CutoutTarget, file: File) => void;
  params: BoxParams;
};

const FIELDS: FieldConfig[] = [
  { key: "interiorWidth", label: "Interior width", min: 1, step: 0.5 },
  { key: "interiorDepth", label: "Interior depth", min: 1, step: 0.5 },
  { key: "interiorHeight", label: "Interior height", min: 1, step: 0.5 },
  { key: "wallThickness", label: "Wall thickness", min: 0.2, step: 0.1 },
  { key: "floorThickness", label: "Floor thickness", min: 0.2, step: 0.1 },
  { key: "cornerRadius", label: "Corner chamfer", min: 0, step: 0.5 },
];

export function BoxControls({
  activeFace,
  activePair,
  cutoutAssignmentMode,
  cutouts,
  dimensions,
  issues,
  maxCornerChamfer,
  onActiveFaceChange,
  onActivePairChange,
  onChange,
  onClearCutout,
  onCutoutAssignmentModeChange,
  onCutoutChange,
  onReset,
  onSvgUpload,
  params,
}: BoxControlsProps) {
  const issuesByField = new Map<BoxField, string>();

  for (const issue of issues) {
    if (issue.field && !issuesByField.has(issue.field)) {
      issuesByField.set(issue.field, issue.message);
    }
  }

  return (
    <section className="flex h-full w-full min-w-0 flex-col gap-6 border-b border-zinc-200 bg-white px-5 py-6 shadow-sm lg:border-r lg:border-b-0 lg:px-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Printable body
          </p>
          <button
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
            type="button"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
          Parametric Box Generator
        </h1>
        <p className="text-sm leading-6 text-zinc-600">
          Configure an open-top tarot card box in millimeters.
        </p>
      </div>

      <div className="grid gap-4">
        {FIELDS.map((field) => {
          const issue = issuesByField.get(field.key);
          const inputId = `box-${field.key}`;
          const value = params[field.key];

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
                max={
                  field.key === "cornerRadius" ? maxCornerChamfer : undefined
                }
                min={field.min}
                onChange={(event) =>
                  onChange({
                    ...params,
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

      <CutoutControls
        activeFace={activeFace}
        activePair={activePair}
        assignmentMode={cutoutAssignmentMode}
        cutouts={cutouts}
        onActiveFaceChange={onActiveFaceChange}
        onActivePairChange={onActivePairChange}
        onAssignmentModeChange={onCutoutAssignmentModeChange}
        onChange={onCutoutChange}
        onClear={onClearCutout}
        onSvgUpload={onSvgUpload}
      />

      <div className="mt-auto grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Outer size
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="Width" value={dimensions.outerWidth} />
          <Metric label="Depth" value={dimensions.outerDepth} />
          <Metric label="Height" value={dimensions.outerHeight} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-zinc-950">{formatMm(value)} mm</p>
    </div>
  );
}

function formatMm(value: number) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}
