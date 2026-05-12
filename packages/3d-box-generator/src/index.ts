import {
  DEFAULT_BOX_PARAMS,
  clampBoxParams,
  generateOpenBoxGeometry,
  getMaxCornerAmount,
  getOuterDimensions,
  validateBoxParams,
} from "./geometry/box";
import {
  CUTOUT_PAIR_FACES,
  CUTOUT_PAIR_LABELS,
  CUTOUT_PAIR_NAMES,
  FACE_LABELS,
  FACE_NAMES,
  createDefaultCutout,
  createDefaultCutouts,
  getCutoutDesignMetrics,
  getCutoutPointCount,
  getCutoutTargetFaces,
  getCutoutTargetLabel,
  parseSvgCutout,
  validateCutouts,
} from "./geometry/cutouts";
import {
  DEFAULT_LID_PARAMS,
  clampLidParams,
  generateLidGeometry,
  getLidCutoutDesignMetrics,
  validateLidParams,
} from "./geometry/lid";
import { meshToAsciiStl } from "./geometry/stl";
import type {
  BoxParams,
  CutoutMap,
  LidCutout,
  LidParams,
  MeshData,
  ValidationIssue,
} from "./types";

export type BodyMeshInput = {
  cutouts?: CutoutMap;
  params?: Partial<BoxParams>;
};

export type BodyStlInput = BodyMeshInput & {
  solidName?: string;
};

export type LidMeshInput = {
  boxParams?: Partial<BoxParams>;
  cutout?: LidCutout;
  lidParams?: Partial<LidParams>;
};

export type LidStlInput = LidMeshInput & {
  solidName?: string;
};

export function resolveBoxParams(params: Partial<BoxParams> = {}): BoxParams {
  return clampBoxParams({ ...DEFAULT_BOX_PARAMS, ...params });
}

export function resolveLidParams(params: Partial<LidParams> = {}): LidParams {
  return clampLidParams({ ...DEFAULT_LID_PARAMS, ...params });
}

export function validateBodyInput({
  cutouts,
  params,
}: BodyMeshInput = {}): ValidationIssue[] {
  const resolvedParams = resolveBoxParams(params);
  const issues = validateBoxParams({ ...DEFAULT_BOX_PARAMS, ...params });

  if (!cutouts) {
    return issues;
  }

  return [...issues, ...validateCutouts(resolvedParams, cutouts)];
}

export function validateLidInput({
  boxParams,
  cutout,
  lidParams,
}: LidMeshInput = {}): ValidationIssue[] {
  const rawBoxParams = { ...DEFAULT_BOX_PARAMS, ...boxParams };
  const rawLidParams = { ...DEFAULT_LID_PARAMS, ...lidParams };
  const resolvedBoxParams = resolveBoxParams(boxParams);

  return [
    ...validateBoxParams(rawBoxParams),
    ...validateLidParams(
      resolvedBoxParams,
      rawLidParams,
      cutout ?? createDefaultCutout(),
    ),
  ];
}

export function createBodyMesh(input: BodyMeshInput = {}): MeshData {
  return generateOpenBoxGeometry(resolveBoxParams(input.params), input.cutouts);
}

export function createLidMesh(input: LidMeshInput = {}): MeshData {
  return generateLidGeometry(
    resolveBoxParams(input.boxParams),
    resolveLidParams(input.lidParams),
    input.cutout,
  );
}

export function createBodyStl({
  solidName = "box_body",
  ...input
}: BodyStlInput = {}): string {
  return meshToAsciiStl(createBodyMesh(input), solidName);
}

export function createLidStl({
  solidName = "box_lid",
  ...input
}: LidStlInput = {}): string {
  return meshToAsciiStl(createLidMesh(input), solidName);
}

export {
  CUTOUT_PAIR_FACES,
  CUTOUT_PAIR_LABELS,
  CUTOUT_PAIR_NAMES,
  createDefaultCutout,
  createDefaultCutouts,
  DEFAULT_BOX_PARAMS,
  DEFAULT_LID_PARAMS,
  FACE_LABELS,
  FACE_NAMES,
  clampBoxParams,
  clampLidParams,
  generateLidGeometry,
  generateOpenBoxGeometry,
  getCutoutDesignMetrics,
  getCutoutPointCount,
  getCutoutTargetFaces,
  getCutoutTargetLabel,
  getLidCutoutDesignMetrics,
  getMaxCornerAmount,
  getOuterDimensions,
  meshToAsciiStl,
  parseSvgCutout,
  validateBoxParams,
  validateCutouts,
  validateLidParams,
};
export type {
  BoxDimensions,
  BoxField,
  BoxParams,
  CornerStyle,
  CutoutAssignmentMode,
  CutoutFitMode,
  CutoutMap,
  CutoutPairName,
  CutoutSet,
  CutoutShape,
  CutoutTarget,
  FaceCutout,
  FaceName,
  LidCutDepth,
  LidCutout,
  LidField,
  LidParams,
  LidSeatStyle,
  MeshData,
  PartMode,
  Triangle,
  ValidationIssue,
  Vec2,
  Vec3,
} from "./types";
