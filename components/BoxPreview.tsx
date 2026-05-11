"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MeshData } from "@/lib/types";

type BoxPreviewProps = {
  meshData: MeshData;
};

type PreviewScene = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mesh: THREE.Mesh;
  renderer: THREE.WebGLRenderer;
};

export function BoxPreview({ meshData }: BoxPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PreviewScene | null>(null);

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
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 25;

    const material = new THREE.MeshStandardMaterial({
      color: 0x43a6a3,
      metalness: 0.02,
      roughness: 0.58,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

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

    sceneRef.current = { camera, controls, mesh, renderer };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      material.dispose();
      grid.geometry.dispose();
      floor.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const preview = sceneRef.current;

    if (!preview) {
      return;
    }

    const geometry = meshDataToBufferGeometry(meshData);
    preview.mesh.geometry.dispose();
    preview.mesh.geometry = geometry;
    fitCamera(preview.camera, preview.controls, meshData);
  }, [meshData]);

  return (
    <div
      aria-label="3D box preview"
      className="min-h-[420px] min-w-0 flex-1 overflow-hidden bg-[#f7f7fb] lg:min-h-0"
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

function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  meshData: MeshData,
) {
  const { outerDepth, outerHeight, outerWidth } = meshData.dimensions;
  const maxDimension = Math.max(outerWidth, outerDepth, outerHeight);
  const distance = Math.max(120, maxDimension * 1.85);
  const targetZ = outerHeight * 0.45;

  controls.target.set(0, 0, targetZ);
  camera.near = Math.max(0.1, distance / 1000);
  camera.far = distance * 8;
  camera.position.set(distance * 0.8, -distance * 1.05, distance * 0.72);
  camera.updateProjectionMatrix();
  controls.update();
}
