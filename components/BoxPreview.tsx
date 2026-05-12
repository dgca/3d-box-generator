"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MeshData, Vec3 } from "@/lib/types";

export type PreviewMesh = {
  color?: number;
  meshData: MeshData;
  opacity?: number;
  position?: Vec3;
};

type BoxPreviewProps = {
  meshes: PreviewMesh[];
  viewKey: string;
};

type PreviewScene = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  meshes: THREE.Mesh[];
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};

export function BoxPreview({ meshes, viewKey }: BoxPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasFramedCameraRef = useRef(false);
  const sceneRef = useRef<PreviewScene | null>(null);

  useEffect(() => {
    hasFramedCameraRef.current = false;
  }, [viewKey]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7fb);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.width = "100%";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 25;

    const grid = new THREE.GridHelper(360, 24, 0xc8cdd7, 0xe1e4ea);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.ShadowMaterial({ color: 0x171717, opacity: 0.12 }),
    );
    floor.position.z = -0.05;
    floor.receiveShadow = true;
    scene.add(floor);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x98a2b3, 1.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(-80, -110, 160);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff3d8, 0.8);
    fillLight.position.set(130, 80, 90);
    scene.add(fillLight);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        return;
      }

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let frameId = 0;
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    sceneRef.current = { camera, controls, meshes: [], renderer, scene };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      clearPreviewMeshes(sceneRef.current);
      grid.geometry.dispose();
      floor.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hasFramedCameraRef.current = false;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const preview = sceneRef.current;

    if (!preview) {
      return;
    }

    clearPreviewMeshes(preview);

    for (const mesh of meshes) {
      const geometry = meshDataToBufferGeometry(mesh.meshData);
      const opacity = mesh.opacity ?? 1;
      const material = new THREE.MeshStandardMaterial({
        color: mesh.color ?? 0x43a6a3,
        metalness: 0.02,
        opacity,
        roughness: 0.58,
        transparent: opacity < 1,
      });
      const object = new THREE.Mesh(geometry, material);
      const position = mesh.position ?? [0, 0, 0];

      object.position.set(position[0], position[1], position[2]);
      object.castShadow = opacity >= 1;
      object.receiveShadow = true;
      preview.scene.add(object);
      preview.meshes.push(object);
    }

    if (hasFramedCameraRef.current) {
      updateCameraBounds(preview.camera, preview.controls, meshes);
    } else {
      fitCamera(preview.camera, preview.controls, meshes);
      hasFramedCameraRef.current = true;
    }
  }, [meshes]);

  return (
    <div
      aria-label="3D box preview"
      className="h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-[#f7f7fb]"
      ref={containerRef}
    />
  );
}

function meshDataToBufferGeometry(meshData: MeshData) {
  const positions = new Float32Array(meshData.triangles.length * 9);
  let cursor = 0;

  for (const triangle of meshData.triangles) {
    for (const vertex of triangle) {
      positions[cursor] = vertex[0];
      positions[cursor + 1] = vertex[1];
      positions[cursor + 2] = vertex[2];
      cursor += 3;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function clearPreviewMeshes(preview: PreviewScene | null) {
  if (!preview) {
    return;
  }

  for (const mesh of preview.meshes) {
    preview.scene.remove(mesh);
    mesh.geometry.dispose();

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
    } else {
      mesh.material.dispose();
    }
  }

  preview.meshes = [];
}

function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  meshes: PreviewMesh[],
) {
  const { distance, targetZ } = getCameraFrame(meshes);

  controls.target.set(0, 0, targetZ);
  camera.near = Math.max(0.1, distance / 1000);
  camera.far = distance * 8;
  camera.position.set(distance * 0.8, -distance * 1.05, distance * 0.72);
  camera.updateProjectionMatrix();
  controls.update();
}

function updateCameraBounds(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  meshes: PreviewMesh[],
) {
  const { distance, targetZ } = getCameraFrame(meshes);
  const previousTarget = controls.target.clone();
  const nextTarget = new THREE.Vector3(0, 0, targetZ);
  const cameraOffset = camera.position.clone().sub(previousTarget);

  controls.target.copy(nextTarget);
  camera.position.copy(nextTarget.add(cameraOffset));
  camera.near = Math.max(0.1, distance / 1000);
  camera.far = Math.max(distance * 8, cameraOffset.length() * 4);
  camera.updateProjectionMatrix();
  controls.update();
}

function getCameraFrame(meshes: PreviewMesh[]) {
  const bounds = getPreviewBounds(meshes);
  const maxDimension = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    bounds.maxZ - bounds.minZ,
  );

  return {
    distance: Math.max(120, maxDimension * 1.85),
    targetZ: (bounds.minZ + bounds.maxZ) / 2,
  };
}

function getPreviewBounds(meshes: PreviewMesh[]) {
  if (meshes.length === 0) {
    return {
      maxX: 50,
      maxY: 50,
      maxZ: 50,
      minX: -50,
      minY: -50,
      minZ: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const mesh of meshes) {
    const [x, y, z] = mesh.position ?? [0, 0, 0];
    const halfWidth = mesh.meshData.dimensions.outerWidth / 2;
    const halfDepth = mesh.meshData.dimensions.outerDepth / 2;

    minX = Math.min(minX, x - halfWidth);
    maxX = Math.max(maxX, x + halfWidth);
    minY = Math.min(minY, y - halfDepth);
    maxY = Math.max(maxY, y + halfDepth);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z + mesh.meshData.dimensions.outerHeight);
  }

  return { maxX, maxY, maxZ, minX, minY, minZ };
}
