export type BoxParams = {
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number;
  wallThickness: number;
  floorThickness: number;
  cornerRadius: number;
};

export type BoxField = keyof BoxParams;

export type BoxDimensions = {
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
};

export type Vec3 = [number, number, number];
export type Triangle = [Vec3, Vec3, Vec3];

export type MeshData = {
  triangles: Triangle[];
  dimensions: BoxDimensions;
};

export type ValidationIssue = {
  field?: BoxField;
  message: string;
};
