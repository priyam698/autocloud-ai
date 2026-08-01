'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Unique Neural Connection Grid Background for AutoCloud AI
export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.001); // Subtle deep background fog

    const camera = new THREE.PerspectiveCamera(
      60, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      1, // Near clipping plane
      2000 // Far clipping plane
    );
    // Position camera inside the cloud matrix
    camera.position.z = 800;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    // --- Neural Nodes (Particles) ---
    const particleCount = 200; // Optimal performance/look balance
    const positions = new Float32Array(particleCount * 3);
    const geometry = new THREE.BufferGeometry();

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 1600; // Spread nodes in X
      positions[i + 1] = (Math.random() - 0.5) * 1600; // Spread in Y
      positions[i + 2] = (Math.random() - 0.5) * 1600; // Spread in depth (Z)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x4f46e5, // Indigo AI glow color
      size: 4, // Subtle node size
      transparent: true,
      opacity: 0.6, // Low base opacity for subtlety
      depthWrite: false, // Prevents points from cutting lines
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- Active Dynamic Connections (Lines) ---
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6366f1, // Slightly brighter line color
      transparent: true,
      opacity: 0.2, // Very faint base lines
    });

    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(particleCount * particleCount * 6); // Max possible connections
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const connections = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(connections);

    // --- Mouse & Resize Interaction ---
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (event: MouseEvent) => {
      // Calculate mouse velocity relative to screen center
      mouseX = (event.clientX - window.innerWidth / 2) * 0.05;
      mouseY = (event.clientY - window.innerHeight / 2) * 0.05;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    // --- Animation Loop ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Soft base rotation
      particles.rotation.y += 0.0003;
      particles.rotation.x += 0.0001;
      connections.rotation.y = particles.rotation.y;
      connections.rotation.x = particles.rotation.x;

      // Mouse interactivity: Cam softly lags toward cursor position
      camera.position.x += (mouseX - camera.position.x) * 0.03;
      camera.position.y += (-mouseY - camera.position.y) * 0.03;
      camera.lookAt(scene.position);

      // Re-calculate dynamic connections between nearby points
      let vertexIndex = 0;
      let lineCount = 0;

      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          // Only connect nodes within range (creates the network structure)
          if (distSq < 40000) { // Approx 200 units squared distance
            linePositions[vertexIndex++] = positions[i * 3];
            linePositions[vertexIndex++] = positions[i * 3 + 1];
            linePositions[vertexIndex++] = positions[i * 3 + 2];

            linePositions[vertexIndex++] = positions[j * 3];
            linePositions[vertexIndex++] = positions[j * 3 + 1];
            linePositions[vertexIndex++] = positions[j * 3 + 2];
            
            lineCount++;
          }
        }
      }
      
      // Update geometry with active connections only
      lineGeometry.setDrawRange(0, lineCount * 2);
      lineGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // --- Cleanup on Unmount ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 bg-[#0a0f1d] overflow-hidden"
    />
  );
}