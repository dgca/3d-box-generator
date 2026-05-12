"use client";

import { useMemo, useState } from "react";
import { BoxControls } from "@/components/BoxControls";
import { BoxPreview, type PreviewMesh } from "@/components/BoxPreview";
import { LidControls } from "@/components/LidControls";
import {
  createBodyMesh,
  createBodyStl,
  createLidMesh,
  createLidStl,
} from "@/lib";
import {
  createDefaultCutout,
  createDefaultCutouts,
  getCutoutTargetFaces,
  parseSvgCutout,
  validateCutouts,
} from "@/lib/geometry/cutouts";
import {
  DEFAULT_BOX_PARAMS,
  clampBoxParams,
  getMaxCornerAmount,
  getOuterDimensions,
  validateBoxParams,
} from "@/lib/geometry/box";
import {
  DEFAULT_LID_PARAMS,
  clampLidParams,
  validateLidParams,
} from "@/lib/geometry/lid";
import type {
  BoxParams,
  CutoutAssignmentMode,
  CutoutPairName,
  CutoutTarget,
  FaceCutout,
  FaceName,
  LidCutout,
  LidParams,
  PartMode,
} from "@/lib/types";

export function BoxGenerator() {
  const [activePart, setActivePart] = useState<PartMode>("body");
  const [params, setParams] = useState<BoxParams>(DEFAULT_BOX_PARAMS);
  const [lidParams, setLidParams] = useState<LidParams>(DEFAULT_LID_PARAMS);
  const [cutoutAssignmentMode, setCutoutAssignmentMode] =
    useState<CutoutAssignmentMode>("faces");
  const [activeFace, setActiveFace] = useState<FaceName>("front");
  const [activePair, setActivePair] = useState<CutoutPairName>("frontBack");
  const [cutouts, setCutouts] = useState(createDefaultCutouts);
  const [lidCutout, setLidCutout] = useState<LidCutout>(createDefaultCutout);
  const safeParams = useMemo(() => clampBoxParams(params), [params]);
  const safeLidParams = useMemo(() => clampLidParams(lidParams), [lidParams]);
  const boxParamIssues = useMemo(() => validateBoxParams(params), [params]);
  const bodyIssues = useMemo(
    () => [...boxParamIssues, ...validateCutouts(safeParams, cutouts)],
    [boxParamIssues, cutouts, safeParams],
  );
  const lidIssues = useMemo(
    () => [
      ...boxParamIssues,
      ...validateLidParams(safeParams, lidParams, lidCutout),
    ],
    [boxParamIssues, lidCutout, lidParams, safeParams],
  );
  const activeIssues = activePart === "body" ? bodyIssues : lidIssues;
  const bodyMeshData = useMemo(
    () => createBodyMesh({ cutouts, params: safeParams }),
    [cutouts, safeParams],
  );
  const lidMeshData = useMemo(
    () =>
      createLidMesh({
        boxParams: safeParams,
        cutout: lidCutout,
        lidParams: safeLidParams,
      }),
    [lidCutout, safeLidParams, safeParams],
  );
  const outerDimensions = useMemo(
    () => getOuterDimensions(safeParams),
    [safeParams],
  );
  const maxCornerAmount = useMemo(
    () => getMaxCornerAmount(safeParams),
    [safeParams],
  );
  const previewMeshes = useMemo<PreviewMesh[]>(() => {
    if (activePart === "lid") {
      return [
        {
          color: 0x9aa4b2,
          meshData: bodyMeshData,
          opacity: 0.24,
        },
        {
          color: 0x43a6a3,
          meshData: lidMeshData,
          position: [0, 0, outerDimensions.outerHeight + 8],
        },
      ];
    }

    return [{ meshData: bodyMeshData }];
  }, [activePart, bodyMeshData, lidMeshData, outerDimensions.outerHeight]);
  const canExportBody = bodyIssues.length === 0;
  const canExportLid = lidIssues.length === 0;
  const activeTriangleCount =
    activePart === "lid"
      ? lidMeshData.triangles.length
      : bodyMeshData.triangles.length;

  function updateCutout(target: CutoutTarget, cutout: FaceCutout) {
    const faces = getCutoutTargetFaces(target);
    const normalizedCutout = withCutoutDefaults(cutout);

    setCutouts((current) => ({
      ...current,
      ...Object.fromEntries(faces.map((face) => [face, normalizedCutout])),
    }));
  }

  function clearCutout(target: CutoutTarget) {
    const faces = getCutoutTargetFaces(target);

    setCutouts((current) => {
      const next = { ...current };

      for (const face of faces) {
        next[face] = {
          enabled: false,
          fitMode: current[face].fitMode ?? "contain",
          margin: current[face].margin,
          scale: current[face].scale,
          shapes: [],
        };
      }

      return next;
    });
  }

  async function uploadSvgCutout(target: CutoutTarget, file: File) {
    const faces = getCutoutTargetFaces(target);
    const primaryFace = faces[0];

    if (file.type && file.type !== "image/svg+xml") {
      updateCutout(target, {
        ...cutouts[primaryFace],
        enabled: true,
        error: "Upload an SVG file for vector cutouts.",
        fileName: file.name,
        shapes: [],
      });
      return;
    }

    try {
      const svgText = await file.text();
      const shapes = parseSvgCutout(svgText);

      updateCutout(target, {
        ...cutouts[primaryFace],
        enabled: true,
        error: undefined,
        fileName: file.name,
        shapes,
      });
    } catch (error) {
      updateCutout(target, {
        ...cutouts[primaryFace],
        enabled: true,
        error:
          error instanceof Error
            ? error.message
            : "Could not read this SVG cutout.",
        fileName: file.name,
        shapes: [],
      });
    }
  }

  function clearLidCutout() {
    setLidCutout((current) => ({
      enabled: false,
      fitMode: current.fitMode ?? "contain",
      margin: current.margin,
      scale: current.scale,
      shapes: [],
    }));
  }

  async function uploadLidSvgCutout(file: File) {
    if (file.type && file.type !== "image/svg+xml") {
      setLidCutout((current) =>
        withCutoutDefaults({
          ...current,
          enabled: true,
          error: "Upload an SVG file for vector cutouts.",
          fileName: file.name,
          shapes: [],
        }),
      );
      return;
    }

    try {
      const svgText = await file.text();
      const shapes = parseSvgCutout(svgText);

      setLidCutout((current) =>
        withCutoutDefaults({
          ...current,
          enabled: true,
          error: undefined,
          fileName: file.name,
          shapes,
        }),
      );
    } catch (error) {
      setLidCutout((current) =>
        withCutoutDefaults({
          ...current,
          enabled: true,
          error:
            error instanceof Error
              ? error.message
              : "Could not read this SVG cutout.",
          fileName: file.name,
          shapes: [],
        }),
      );
    }
  }

  function downloadBodyStl() {
    if (!canExportBody) {
      return;
    }

    const stl = createBodyStl({ cutouts, params, solidName: "box" });
    downloadStlText(stl, getBodyFileName(params));
  }

  function downloadLidStl() {
    if (!canExportLid) {
      return;
    }

    const stl = createLidStl({
      boxParams: params,
      cutout: lidCutout,
      lidParams,
      solidName: "box_lid",
    });
    downloadStlText(stl, getLidFileName(params));
  }

  function downloadStlText(stl: string, fileName: string) {
    const blob = new Blob([stl], { type: "model/stl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#f7f7fb] text-zinc-950">
      <header className="sticky top-0 z-20 flex min-h-20 shrink-0 flex-col gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-zinc-950">
            3D Box Generator
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-600">
            {activeTriangleCount} triangles
          </p>
          <button
            className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            disabled={!canExportBody}
            onClick={downloadBodyStl}
            type="button"
          >
            Download Body STL
          </button>
          <button
            className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            disabled={!canExportLid}
            onClick={downloadLidStl}
            type="button"
          >
            Download Lid STL
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="max-h-[48vh] w-full shrink-0 overflow-y-auto border-b border-zinc-200 bg-white lg:h-full lg:max-h-none lg:w-[360px] lg:border-r lg:border-b-0">
          <PartModeToggle activePart={activePart} onChange={setActivePart} />
          {activePart === "body" ? (
            <BoxControls
              activeFace={activeFace}
              activePair={activePair}
              cutoutAssignmentMode={cutoutAssignmentMode}
              cutouts={cutouts}
              dimensions={outerDimensions}
              issues={bodyIssues}
              maxCornerAmount={maxCornerAmount}
              onActiveFaceChange={setActiveFace}
              onActivePairChange={setActivePair}
              onClearCutout={clearCutout}
              onChange={setParams}
              onCutoutAssignmentModeChange={setCutoutAssignmentMode}
              onCutoutChange={updateCutout}
              onReset={() => setParams(DEFAULT_BOX_PARAMS)}
              onSvgUpload={(target, file) => {
                void uploadSvgCutout(target, file);
              }}
              params={params}
              safeParams={safeParams}
            />
          ) : (
            <LidControls
              cutout={lidCutout}
              issues={lidIssues}
              lidParams={lidParams}
              onChange={setLidParams}
              onClearCutout={clearLidCutout}
              onCutoutChange={(cutout) => setLidCutout(withCutoutDefaults(cutout))}
              onReset={() => {
                setLidParams(DEFAULT_LID_PARAMS);
                setLidCutout(createDefaultCutout());
              }}
              onSvgUpload={(file) => {
                void uploadLidSvgCutout(file);
              }}
              safeBoxParams={safeParams}
            />
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {activeIssues.length > 0 ? (
            <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 lg:px-6">
              Fix the highlighted values or cutout settings before exporting.
            </div>
          ) : null}

          <BoxPreview meshes={previewMeshes} viewKey={activePart} />
        </section>
      </div>
    </main>
  );
}

function PartModeToggle({
  activePart,
  onChange,
}: {
  activePart: PartMode;
  onChange: (part: PartMode) => void;
}) {
  return (
    <div className="border-b border-zinc-200 px-5 py-4 lg:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Part
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
        {(["body", "lid"] as const).map((part) => (
          <button
            aria-pressed={activePart === part}
            className={`h-9 rounded px-2 text-xs font-semibold capitalize transition ${
              activePart === part
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
            key={part}
            onClick={() => onChange(part)}
            type="button"
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  );
}

function getBodyFileName(params: BoxParams) {
  const width = Math.round(params.interiorWidth);
  const depth = Math.round(params.interiorDepth);
  const height = Math.round(params.interiorHeight);

  return `box-body-${width}x${depth}x${height}mm.stl`;
}

function getLidFileName(params: BoxParams) {
  const width = Math.round(params.interiorWidth);
  const depth = Math.round(params.interiorDepth);

  return `box-lid-${width}x${depth}mm.stl`;
}

function withCutoutDefaults(cutout: FaceCutout): FaceCutout {
  return {
    ...cutout,
    fitMode: cutout.fitMode ?? "contain",
  };
}
