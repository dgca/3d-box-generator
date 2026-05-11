import type { MeshData, Triangle, Vec3 } from "@/lib/types";

export function meshToAsciiStl(mesh: MeshData, solidName = "parametric_box") {
  const safeName = solidName.replace(/[^a-z0-9_-]+/gi, "_");
  const lines = [`solid ${safeName}`];

  for (const triangle of mesh.triangles) {
    const normal = getTriangleNormal(triangle);

    lines.push(`  facet normal ${formatVector(normal)}`);
    lines.push("    outer loop");

    for (const vertex of triangle) {
      lines.push(`      vertex ${formatVector(vertex)}`);
    }

    lines.push("    endloop");
    lines.push("  endfacet");
  }

  lines.push(`endsolid ${safeName}`);

  return `${lines.join("\n")}\n`;
}

function getTriangleNormal([a, b, c]: Triangle): Vec3 {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

function formatVector(vector: Vec3): string {
  return vector.map(formatNumber).join(" ");
}

function formatNumber(value: number): string {
  const cleanValue = Math.abs(value) < 0.0000001 ? 0 : value;

  return cleanValue.toFixed(6).replace(/\.?0+$/, "") || "0";
}
