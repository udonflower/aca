import React, { useEffect, useRef, useState } from 'react';

// A type for the 3D points
interface Point3D {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);
  const interactionRef = useRef({
    isDragging: false,
    hasInteracted: false,
    lastX: 0,
    lastY: 0,
    rotX: 0,
    rotY: 0,
    lastBeatTime: 0,
    touchCount: 0
  });
  const dropsRef = useRef<number[]>([]);
  const historyRef = useRef<{charBuffer: string[], colorBuffer: string[]}[]>([]);

  // Generate the 3D heart point cloud once on mount
  useEffect(() => {
    const generatePoints = () => {
      const points: Point3D[] = [];
      const step = 0.05; // Density of the point cloud
      for (let z = -1.5; z <= 1.5; z += step) {
        for (let y = -1.5; y <= 1.5; y += step) {
          for (let x = -1.5; x <= 1.5; x += step) {
            const a = x * x + 2.25 * y * y + z * z - 1;
            const v = a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
            
            if (v <= 0.0) {
              // Check neighbors to see if it's on the surface
              const a_nx = (x+step)*(x+step) + 2.25*y*y + z*z - 1;
              const v_nx = a_nx*a_nx*a_nx - (x+step)*(x+step)*z*z*z - 0.1125*y*y*z*z*z;
              
              const a_ny = x*x + 2.25*(y+step)*(y+step) + z*z - 1;
              const v_ny = a_ny*a_ny*a_ny - x*x*z*z*z - 0.1125*(y+step)*(y+step)*z*z*z;
              
              const a_nz = x*x + 2.25*y*y + (z+step)*(z+step) - 1;
              const v_nz = a_nz*a_nz*a_nz - x*x*(z+step)*(z+step)*(z+step) - 0.1125*y*y*(z+step)*(z+step)*(z+step);
              
              const a_px = (x-step)*(x-step) + 2.25*y*y + z*z - 1;
              const v_px = a_px*a_px*a_px - (x-step)*(x-step)*z*z*z - 0.1125*y*y*z*z*z;
              
              if (v_nx > 0 || v_ny > 0 || v_nz > 0 || v_px > 0) {
                // Compute surface normal via gradient
                const a_sq = a * a;
                const dfdx = 3 * a_sq * 2 * x - 2 * x * z * z * z;
                const dfdy = 3 * a_sq * 4.5 * y - 0.225 * y * z * z * z;
                const dfdz = 3 * a_sq * 2 * z - 3 * x * x * z * z - 3 * 0.1125 * y * y * z * z;
                
                const len = Math.sqrt(dfdx * dfdx + dfdy * dfdy + dfdz * dfdz) || 1;
                points.push({
                  x, y, z, 
                  nx: dfdx / len, ny: dfdy / len, nz: dfdz / len
                });
              }
            }
          }
        }
      }
      pointsRef.current = points;
      setIsGenerating(false);
    };

    // Use a short timeout to allow initial render to show loading state if needed
    setTimeout(generatePoints, 0);
  }, []);

  useEffect(() => {
    if (isGenerating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = Date.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    window.addEventListener('resize', resize);
    resize();

    const handlePointerDown = (e: PointerEvent) => {
      interactionRef.current.isDragging = true;
      interactionRef.current.hasInteracted = true;
      interactionRef.current.lastX = e.clientX;
      interactionRef.current.lastY = e.clientY;
      interactionRef.current.lastBeatTime = Date.now();
      interactionRef.current.touchCount += 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (interactionRef.current.isDragging) {
        const dx = e.clientX - interactionRef.current.lastX;
        const dy = e.clientY - interactionRef.current.lastY;
        interactionRef.current.rotY += dx * 0.01;
        interactionRef.current.rotX += dy * 0.01;
        
        // Clamp X rotation to prevent flipping upside down completely if desired, 
        // but full rotation is also fun. Let's clamp it to +/- PI/2 for now.
        interactionRef.current.rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, interactionRef.current.rotX));

        interactionRef.current.lastX = e.clientX;
        interactionRef.current.lastY = e.clientY;
      }
    };

    const handlePointerUp = () => {
      interactionRef.current.isDragging = false;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    const message = "Love you.";
    // ASCII characters sorted by visual density (dark to light)
    const densityChars = " .:-=+*#%@";

    const render = () => {
      const time = (Date.now() - startTime) / 1000;
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const cx = width / 2;
      const cy = height / 2;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const charW = Math.max(10, width / 120); 
      const charH = charW * 1.5;
      const cols = Math.floor(width / charW);
      const rows = Math.floor(height / charH);

      ctx.font = `bold ${charW * 1.2}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Waterfall effect
      const waterfallText = "I LOVE U NATASYA ";
      if (dropsRef.current.length !== cols) {
        dropsRef.current = new Array(cols).fill(0).map(() => Math.random() * -rows);
      }
      
      for (let i = 0; i < cols; i++) {
        const headY = dropsRef.current[i];
        
        for (let j = 0; j < 20; j++) {
           const charY = Math.floor(headY - j);
           if (charY >= 0 && charY < rows) {
             const charIndex = (Math.abs(charY) + i) % waterfallText.length;
             const char = waterfallText.charAt(charIndex);
             
             const opacity = 1 - (j / 20);
             ctx.fillStyle = `rgba(255, 50, 100, ${opacity * 0.3})`; 
             ctx.fillText(char, i * charW + charW / 2, charY * charH + charH / 2);
           }
        }
        
        dropsRef.current[i] += 0.3; // speed
        if (dropsRef.current[i] > rows + 20 && Math.random() > 0.95) {
          dropsRef.current[i] = 0;
        }
      }

      // Pulse effect triggered by touch
      let pulse = 0;
      const interaction = interactionRef.current;
      if (interaction.lastBeatTime > 0) {
        const timeSinceBeat = (Date.now() - interaction.lastBeatTime) / 1000;
        if (timeSinceBeat < 1.5) { // Heartbeat animation window
          const beatPhase = timeSinceBeat * Math.PI * 1.5; // Slower speed of heartbeat animation
          if (beatPhase < Math.PI / 2) {
            pulse = Math.sin(beatPhase * 2);
          } else if (beatPhase < Math.PI) {
            pulse = 0.5 * Math.sin((beatPhase - Math.PI / 2) * 2);
          }
        }
      }

      // Base scale
      const baseScale = Math.min(cols, rows) * 0.35;
      const currentScale = baseScale * (1.0 + 0.25 * pulse); // Increased scale multiplier for a larger beat

      // Rotation angles
      const angleY = interaction.rotY; // Rotate around Y axis (left/right)
      const angleX = interaction.rotX; // Tilt up/down
      const angleZ = 0; // Math.sin(time * 0.2) * 0.1; // Slight wobble

      const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
      const cosZ = Math.cos(angleZ), sinZ = Math.sin(angleZ);

      // Z-buffer and Char-buffer
      const gridLen = cols * rows;
      const zBuffer = new Float32Array(gridLen).fill(-Infinity);
      const charBuffer = new Array(gridLen).fill(' ');
      const colorBuffer = new Array(gridLen).fill('');

      // Render 3D points
      const points = pointsRef.current;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        
        // --- ROTATION ---
        // 1. Rotate around X
        let x1 = p.x;
        let y1 = p.y * cosX - p.z * sinX;
        let z1 = p.y * sinX + p.z * cosX;
        
        // 2. Rotate around Y
        let x2 = x1 * cosY + z1 * sinY;
        let y2 = y1;
        let z2 = -x1 * sinY + z1 * cosY;
        
        // 3. Rotate around Z
        let x3 = x2 * cosZ - y2 * sinZ;
        let y3 = x2 * sinZ + y2 * cosZ;
        let z3 = z2;

        // Normal rotation
        let nx1 = p.nx;
        let ny1 = p.ny * cosX - p.nz * sinX;
        let nz1 = p.ny * sinX + p.nz * cosX;
        
        let nx2 = nx1 * cosY + nz1 * sinY;
        let ny2 = ny1;
        let nz2 = -nx1 * sinY + nz1 * cosY;
        
        let nx3 = nx2 * cosZ - ny2 * sinZ;
        let ny3 = nx2 * sinZ + ny2 * cosZ;
        let nz3 = nz2;

        // --- PROJECTION ---
        // The heart equation has z as "up". 
        // We want x = screen X, z = screen Y (inverted since canvas Y goes down).
        // y is depth.
        const screenX = x3;
        const screenY = -z3; // Invert Z for canvas Y
        const depth = y3;    // Y goes into screen, so larger Y is further. Wait, standard depth test: we want closer to be higher in Z-buffer.
        // Let's use -y3 as z-buffer value so closer (negative Y) gets larger values.
        const screenZ = -y3;

        // Scale to grid coordinates
        const gridX = Math.floor(cols / 2 + screenX * currentScale * 2); // aspect ratio correction
        const gridY = Math.floor(rows / 2 + screenY * currentScale);

        if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
          const idx = gridY * cols + gridX;
          
          if (screenZ > zBuffer[idx]) {
            zBuffer[idx] = screenZ;
            
            // --- LIGHTING ---
            // Light source from camera: (0, -0.5, 1) normalized roughly
            const lx = 0, ly = -0.5, lz = 1;
            const lenL = Math.sqrt(lx*lx + ly*ly + lz*lz);
            const nlx = lx/lenL, nly = ly/lenL, nlz = lz/lenL;
            
            // Dot product of normal and light
            const dot = nx3 * nlx + ny3 * nly + nz3 * nlz;
            const intensity = Math.max(0, dot); // 0 to 1
            
            // Ambient light + diffuse
            const finalIntensity = 0.2 + 0.8 * intensity;
            
            let charIdx = Math.floor(finalIntensity * (densityChars.length - 1));
            charIdx = Math.max(0, Math.min(densityChars.length - 1, charIdx));
            
            const shimmerChars = "♥*#@&XOQ08MW%$=+?!~|/^v<>";
            const n = Math.sin(gridX * 12.9898 + gridY * 78.233 + time * 8) * 43758.5453;
            const rand = Math.abs(n - Math.floor(n));
            
            // Only change brighter parts so the dark edges stay subtle
            if (finalIntensity > 0.4) {
              charBuffer[idx] = shimmerChars[Math.floor(rand * shimmerChars.length)];
            } else {
              charBuffer[idx] = densityChars[charIdx];
            }
            
            // Constant candy red color
            const hue = 355;
            // Saturation stays high for candy red, lightness follows intensity
            const sat = 95;
            const lit = 20 + 45 * finalIntensity + 10 * pulse;
            
            colorBuffer[idx] = `hsl(${hue}, ${sat}%, ${lit}%)`;
          }
        }
      }

      // Manage ghosting history
      if (interaction.isDragging) {
        historyRef.current.push({
          charBuffer: [...charBuffer],
          colorBuffer: [...colorBuffer]
        });
        if (historyRef.current.length > 6) { // Store up to 6 frames for a nice trail
          historyRef.current.shift();
        }
      } else {
        if (historyRef.current.length > 0) {
          historyRef.current.shift(); // gradually clear out trail
        }
      }

      // Draw ghost trail
      ctx.shadowBlur = 0;
      for (let i = 0; i < historyRef.current.length; i++) {
        const hist = historyRef.current[i];
        const opacity = (i + 1) / (historyRef.current.length + 1) * 0.4;
        ctx.globalAlpha = opacity;
        
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const idx = y * cols + x;
            const char = hist.charBuffer[idx];
            if (char !== ' ') {
              const px = x * charW + charW / 2;
              const py = y * charH + charH / 2;
              ctx.fillStyle = hist.colorBuffer[idx];
              ctx.fillText(char, px, py);
            }
          }
        }
      }
      ctx.globalAlpha = 1.0;

      // Draw grid
      const glowBase = 5;
      const glowMultiplier = 3;
      // Max out the glow at some point so it doesn't get ridiculously large
      const extraGlow = Math.min(interaction.touchCount * glowMultiplier, 30);
      
      ctx.shadowBlur = glowBase + extraGlow + (pulse * 5);
      ctx.shadowColor = `rgba(255, 105, 180, ${0.5 + Math.min(interaction.touchCount * 0.1, 0.5)})`;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          const char = charBuffer[idx];
          if (char !== ' ') {
            const px = x * charW + charW / 2;
            const py = y * charH + charH / 2;
            ctx.fillStyle = colorBuffer[idx];
            ctx.fillText(char, px, py);
          }
        }
      }
      
      // Reset shadow for the rest of the canvas elements
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Draw the central message
      const msgFontSize = Math.max(24, charW * 2.5);
      ctx.font = `bold ${msgFontSize}px monospace`;
      const msgW = ctx.measureText(message).width;
      const paddingX = 30;
      const paddingY = 20;
      
      // Background pill for readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(
            cx - msgW / 2 - paddingX, 
            cy - msgFontSize / 2 - paddingY, 
            msgW + paddingX * 2, 
            msgFontSize + paddingY * 2, 
            16
        );
      } else {
        ctx.rect(
            cx - msgW / 2 - paddingX, 
            cy - msgFontSize / 2 - paddingY, 
            msgW + paddingX * 2, 
            msgFontSize + paddingY * 2
        );
      }
      ctx.fill();
      
      // Message text with glowing shadow
      ctx.shadowColor = '#ff4d88';
      ctx.shadowBlur = 15 + 10 * pulse;
      ctx.fillStyle = '#ffffff'; 
      ctx.fillText(message, cx, cy);
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isGenerating]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      {isGenerating ? (
        <div className="text-pink-500 font-mono text-xl animate-pulse">Calculating volume...</div>
      ) : (
        <canvas 
          ref={canvasRef} 
          className="block w-full h-full touch-none cursor-grab active:cursor-grabbing" 
        />
      )}
    </div>
  );
}
