import React, { useEffect, useRef } from 'react';

export const Global3DBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let step = 0;

    // Projection 3D vers 2D
    const project3D = (x3d, y3d, z3d) => {
      const fov = 350;
      const cameraZ = 400;
      const scale = fov / (fov + z3d + cameraZ);
      
      return {
        x: width / 2 + x3d * scale,
        y: height / 2 + (y3d + 120) * scale,
        scale,
      };
    };

    const render = () => {
      step += 0.02;
      ctx.clearRect(0, 0, width, height);

      const rows = 28;
      const cols = 45;
      const spacingX = 40;
      const spacingZ = 35;
      
      const isLight = document.documentElement.classList.contains('light');
      const baseColor = isLight ? '5, 150, 105' : '45, 212, 191';

      // Calcul des points 3D projetés
      const grid = [];

      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          const x3d = (c - cols / 2) * spacingX;
          const z3d = r * spacingZ;
          
          // Calcul de l'onde 3D
          const distance = Math.sqrt(x3d * x3d + z3d * z3d) * 0.005;
          const y3d = Math.sin(step - distance + r * 0.15) * 45 + Math.cos(step + c * 0.1) * 20;

          grid[r][c] = project3D(x3d, y3d, z3d);
        }
      }

      ctx.lineWidth = 1;

      // Lignes horizontales
      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        for (let c = 0; c < cols; c++) {
          const pt = grid[r][c];
          if (c === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        const alpha = Math.max(0, (1 - r / rows) * 0.45);
        ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`;
        ctx.stroke();
      }

      // Lignes verticales (maillage 3D)
      for (let c = 0; c < cols; c++) {
        ctx.beginPath();
        for (let r = 0; r < rows; r++) {
          const pt = grid[r][c];
          if (r === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        const alpha = Math.max(0, 0.25 - (c / cols) * 0.1);
        ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="app-3d-background">
      <canvas ref={canvasRef} className="app-3d-canvas" />
    </div>
  );
};