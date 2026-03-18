import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function smoothStep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildParticles(width, height) {
  const dust = Array.from({ length: 420 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 0.9 + 0.24,
    a: Math.random() * 0.18 + 0.04,
    depth: Math.random() * 0.9 + 0.25,
    seed: Math.random() * Math.PI * 2,
  }));

  const rays = Array.from({ length: 280 }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    angle: Math.random() * Math.PI * 2,
    length: 5 + Math.random() * 18,
    width: Math.random() * 1.8 + 0.55,
    alpha: Math.random() * 0.34 + 0.12,
    hue: 208 + (index / 279) * 172,
    drift: 8 + Math.random() * 28,
    orbit: 10 + Math.random() * 42,
    depth: Math.random() * 0.95 + 0.25,
    seed: Math.random() * Math.PI * 2,
  }));

  return { dust, rays };
}

function getFieldCenters(width, height, t) {
  return [
    {
      x: width * (0.2 + Math.sin(t * 0.06) * 0.08 + Math.cos(t * 0.11) * 0.03),
      y: height * (0.24 + Math.cos(t * 0.05) * 0.08),
      phase: t * 0.72,
      weight: 1,
    },
    {
      x: width * (0.78 + Math.cos(t * 0.05) * 0.07),
      y: height * (0.3 + Math.sin(t * 0.07) * 0.09),
      phase: t * 0.66 + 1.8,
      weight: 1.1,
    },
    {
      x: width * (0.52 + Math.sin(t * 0.04) * 0.06),
      y: height * (0.74 + Math.cos(t * 0.06) * 0.07),
      phase: t * 0.58 + 3.2,
      weight: 0.95,
    },
  ];
}

function sampleField(x, y, centers, minSide) {
  let shiftX = 0;
  let shiftY = 0;
  let energy = 0;

  centers.forEach((center, index) => {
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ratio = clamp(distance / (minSide * 0.72), 0, 1.35);
    const envelope = smoothStep(0.02, 0.92, ratio) * (1 - smoothStep(0.9, 1.28, ratio));
    const radialWave = Math.sin(ratio * 8.4 - center.phase + index * 0.85);
    const tangentialWave = Math.cos(ratio * 5.8 - center.phase * 0.8 + index * 0.65);
    const strength = envelope * center.weight;
    shiftX += (dx / distance) * radialWave * 24 * strength + (-dy / distance) * tangentialWave * 6.5 * strength;
    shiftY += (dy / distance) * radialWave * 24 * strength + (dx / distance) * tangentialWave * 6.5 * strength;
    energy += Math.abs(radialWave) * strength;
  });

  return {
    shiftX,
    shiftY,
    energy: clamp(energy, 0, 1.8),
  };
}

function AuthBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const particlesRef = useRef({ dust: [], rays: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = buildParticles(width, height);
    };

    const draw = (time) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const minSide = Math.min(width, height);
      const { dust, rays } = particlesRef.current;
      const t = time * 0.001;
      const centers = getFieldCenters(width, height, t);
      const breathing = 0.56 + Math.sin(t * 0.48) * 0.16 + Math.cos(t * 0.21) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#f7f9fd");
      bg.addColorStop(0.55, "#f7f9fd");
      bg.addColorStop(1, "#f4f7fc");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const wash = ctx.createRadialGradient(width * 0.52, height * 0.46, minSide * 0.08, width * 0.52, height * 0.46, minSide * 0.72);
      wash.addColorStop(0, "rgba(111, 149, 255, 0.035)");
      wash.addColorStop(0.5, "rgba(111, 149, 255, 0.018)");
      wash.addColorStop(1, "rgba(111, 149, 255, 0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      dust.forEach((dot, index) => {
        const driftX = Math.sin(t * (0.06 + dot.depth * 0.012) + dot.seed + index * 0.01) * 0.7;
        const driftY = Math.cos(t * (0.05 + dot.depth * 0.011) + dot.seed * 0.8) * 0.65;
        const field = sampleField(dot.x, dot.y, centers, minSide);
        const pageWave = Math.sin(dot.x / width * 4.2 + dot.y / height * 3.4 - t * 0.55 + dot.seed * 0.7);
        const pageLift = Math.cos(dot.y / height * 4.8 - t * 0.44 + dot.seed) * 1.8;
        const sizeWave = 1 + field.energy * 0.26 * breathing + Math.max(0, pageWave) * 0.12;

        ctx.beginPath();
        ctx.fillStyle = `rgba(30, 45, 79, ${dot.a + field.energy * 0.03 + Math.max(0, pageWave) * 0.02})`;
        ctx.arc(
          dot.x + driftX + field.shiftX * (0.3 + dot.depth * 0.34) + pageWave * 1.6,
          dot.y + driftY + field.shiftY * (0.3 + dot.depth * 0.34) + pageLift * dot.depth,
          dot.r * sizeWave,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });

      rays.forEach((ray, index) => {
        const field = sampleField(ray.x, ray.y, centers, minSide);
        const pageWave = Math.sin(ray.x / width * 3.8 + ray.y / height * 2.6 - t * 0.52 + ray.seed);
        const orbitAngle = ray.angle + Math.sin(t * 0.18 + ray.seed) * 0.55 + field.energy * 0.22;
        const x = ray.x + field.shiftX * (0.42 + ray.depth * 0.34) + Math.cos(t * 0.12 + ray.seed) * ray.orbit + pageWave * 10;
        const y = ray.y + field.shiftY * (0.42 + ray.depth * 0.34) + Math.sin(t * 0.11 + ray.seed * 1.1) * (ray.orbit * 0.8) + pageWave * 8;
        const lineLength = ray.length * (1 + field.energy * 0.52 * breathing + Math.max(0, pageWave) * 0.16);
        const dx = Math.cos(orbitAngle) * lineLength;
        const dy = Math.sin(orbitAngle) * lineLength;

        ctx.strokeStyle = `hsla(${ray.hue}, 92%, 58%, ${Math.min(0.72, ray.alpha + field.energy * 0.12 + Math.max(0, pageWave) * 0.05)})`;
        ctx.lineWidth = ray.width * (1 + field.energy * 0.18);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
      });

      centers.forEach((center, index) => {
        const halo = ctx.createRadialGradient(center.x, center.y, 16, center.x, center.y, minSide * 0.28);
        halo.addColorStop(0, `rgba(94, 132, 255, ${0.032 + index * 0.008})`);
        halo.addColorStop(0.5, "rgba(94, 132, 255, 0.012)");
        halo.addColorStop(1, "rgba(94, 132, 255, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(center.x - minSide * 0.28, center.y - minSide * 0.28, minSide * 0.56, minSide * 0.56);
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-background-canvas" aria-hidden="true" />;
}

export default AuthBackground;
