"use client";

import { useMemo, useState } from "react";
import { BoxControls } from "@/components/BoxControls";
import { BoxPreview } from "@/components/BoxPreview";
import {
  createDefaultCutouts,
  getCutoutTargetFaces,
  parseSvgCutout,
  validateCutouts,
} from "@/lib/geometry/cutouts";
import {
  DEFAULT_BOX_PARAMS,
  clampBoxParams,
  generateOpenBoxGeometry,
  getMaxCornerChamfer,
  getOuterDimensions,
  validateBoxParams,
} from "@/lib/geometry/box";
import { meshToAsciiStl } from "@/lib/geometry/stl";
import type {
  BoxParams,
  CutoutAssignmentMode,
  CutoutPairName,
  CutoutTarget,
  FaceCutout,
  FaceName,
} from "@/lib/types";

export function BoxGenerator() {
  const [params, setParams] = useState<BoxParams>(DEFAULT_BOX_PARAMS);
  const [cutoutAssignmentMode, setCutoutAssignmentMode] =
    useState<CutoutAssignmentMode>("faces");
  const [activeFace, setActiveFace] = useState<FaceName>("front");
  const [activePair, setActivePair] = useState<CutoutPairName>("frontBack");
  const [cutouts, setCutouts] = useState(createDefaultCutouts);
  const safeParams = useMemo(() => clampBoxParams(params), [params]);
  const issues = useMemo(
    () => [
      ...validateBoxParams(params),
      ...validateCutouts(safeParams, cutouts),
    ],
    [cutouts, params, safeParams],
  );
  const meshData = useMemo(
    () => generateOpenBoxGeometry(safeParams, cutouts),
    [cutouts, safeParams],
  );
  const outerDimensions = useMemo(
    () => getOuterDimensions(safeParams),
    [safeParams],
  );
  const maxCornerChamfer = useMemo(
    () => getMaxCornerChamfer(safeParams),
    [safeParams],
  );
  const canExport = issues.length === 0;

  function updateCutout(target: CutoutTarget, cutout: FaceCutout) {
    const faces = getCutoutTargetFaces(target);

    setCutouts((current) => ({
      ...current,
      ...Object.fromEntries(faces.map((face) => [face, cutout])),
    }));
  }

  function clearCutout(target: CutoutTarget) {
    const faces = getCutoutTargetFaces(target);

    setCutouts((current) => {
      const next = { ...current };

      for (const face of faces) {
        next[face] = {
          enabled: false,
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

  function downloadStl() {
    if (!canExport) {
      return;
    }

    const mesh = generateOpenBoxGeometry(params, cutouts);
    const stl = meshToAsciiStl(mesh, "tarot_box");
    const blob = new Blob([stl], { type: "model/stl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getFileName(params);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] text-zinc-950">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[360px_minmax(0,1fr)]">
        <BoxControls
          activeFace={activeFace}
          activePair={activePair}
          cutoutAssignmentMode={cutoutAssignmentMode}
          cutouts={cutouts}
          dimensions={outerDimensions}
          issues={issues}
          maxCornerChamfer={maxCornerChamfer}
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
        />

        <section className="flex min-h-[620px] min-w-0 flex-col">
          <div className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Live mesh preview
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-zinc-950">
                Open-top box
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-zinc-600">
                {meshData.triangles.length} triangles
              </p>
              <button
                className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                disabled={!canExport}
                onClick={downloadStl}
                type="button"
              >
                Download STL
              </button>
            </div>
          </div>

          {issues.length > 0 ? (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 lg:px-6">
              Fix the highlighted values or cutout settings before exporting.
            </div>
          ) : null}

          <BoxPreview meshData={meshData} />
        </section>
      </div>
    </main>
  );
}

function getFileName(params: BoxParams) {
  const width = Math.round(params.interiorWidth);
  const depth = Math.round(params.interiorDepth);
  const height = Math.round(params.interiorHeight);

  return `tarot-box-${width}x${depth}x${height}mm.stl`;
}
