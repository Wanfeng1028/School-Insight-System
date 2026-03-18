import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function angleDelta(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function buildParticles(width, height) {
  const dust = Array.from({ length: 240 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 0.85 + 0.18,
    a: Math.random() * 0.24 + 0.05,
    depth: Math.random() * 0.8 + 0.2,
    seed: Math.random() * Math.PI * 2,
  }));

  const rays = Array.from({ length: 160 }, (_, index) => ({
    spread: -Math.PI * 0.6 + (index / 159) * Math.PI * 1.2 + (Math.random() - 0.5) * 0.03,
    radius: 36 + Math.pow(Math.random(), 0.62) * Math.min(width, height) * 0.34,
    length: 2 + Math.random() * 8,
    width: Math.random() * 2.2 + 0.55,
    alpha: Math.random() * 0.55 + 0.16,
    hue: 214 + (index / 159) * 188,
    drift: (Math.random() - 0.5) * 9,
    seed: Math.random() * Math.PI * 2,
    depth: Math.random() * 0.95 + 0.25,
  }));

  return { dust, rays };
}

function AuthBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const particlesRef = useRef({ dust: [], rays: [] });
  const pointerRef = useRef({
    targetX: 0.7,
    targetY: 0.52,
    currentX: 0.7,
    currentY: 0.52,
    active: false,
  });

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

    const handleMove = (event) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      pointerRef.current.targetX = clamp(event.clientX / width, 0.06, 0.94);
      pointerRef.current.targetY = clamp(event.clientY / height, 0.08, 0.92);
      pointerRef.current.active = true;
    };

    const handleLeave = () => {
      pointerRef.current.targetX = 0.7;
      pointerRef.current.targetY = 0.52;
      pointerRef.current.active = false;
    };

    const draw = (time) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const { dust, rays } = particlesRef.current;
      const t = time * 0.001;
      const pointer = pointerRef.current;

      pointer.currentX = lerp(pointer.currentX, pointer.targetX, pointer.active ? 0.11 : 0.04);
      pointer.currentY = lerp(pointer.currentY, pointer.targetY, pointer.active ? 0.11 : 0.04);

      const sourceX = width * pointer.currentX;
      const sourceY = height * pointer.currentY;
      const centerAngle = Math.atan2(sourceY - height * 0.5, sourceX - width * 0.5);
      const fanStrength = pointer.active ? 1 : 0.7;

      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#f7f9fd");
      bg.addColorStop(0.55, "#f7f9fd");
      bg.addColorStop(1, "#f4f7fc");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      dust.forEach((dot, index) => {
        const driftX = Math.sin(t * (0.12 + dot.depth * 0.03) + dot.seed + index * 0.02) * 0.85;
        const driftY = Math.cos(t * (0.1 + dot.depth * 0.02) + dot.seed * 0.7) * 0.7;
        const dx = dot.x - sourceX;
        const dy = dot.y - sourceY;
        const distance = Math.hypot(dx, dy) || 1;
        const influence = Math.max(0, 1 - distance / (Math.min(width, height) * 0.28));
        const push = influence * 18 * fanStrength * dot.depth;
        ctx.beginPath();
        ctx.fillStyle = `rgba(30, 45, 79, ${dot.a + influence * 0.05})`;
        ctx.arc(dot.x + driftX + (dx / distance) * push, dot.y + driftY + (dy / distance) * push, dot.r * (1 + influence * 0.22), 0, Math.PI * 2);
        ctx.fill();
      });

      rays.forEach((ray, index) => {
        const liveAngle = centerAngle + ray.spread + Math.sin(t * 0.5 + ray.seed) * 0.018;
        const distanceBoost = 1 + Math.cos(ray.spread) * 0.18 * fanStrength;
        const radius = (ray.radius + Math.sin(t * 0.42 + ray.seed + index * 0.02) * ray.drift) * distanceBoost;
        const x = sourceX + Math.cos(liveAngle) * radius;
        const y = sourceY + Math.sin(liveAngle) * radius;
        const angleWeight = Math.max(0, 1 - Math.abs(ray.spread) / (Math.PI * 0.62));
        const grow = 1 + angleWeight * 0.55 * fanStrength;
        const lineLength = ray.length * grow;
        const dx = Math.cos(liveAngle) * lineLength;
        const dy = Math.sin(liveAngle) * lineLength;

        ctx.strokeStyle = `hsla(${ray.hue}, 92%, 58%, ${ray.alpha})`;
        ctx.lineWidth = ray.width * (1 + angleWeight * 0.22 * fanStrength);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
      });

      const halo = ctx.createRadialGradient(sourceX, sourceY, 12, sourceX, sourceY, Math.min(width, height) * 0.18);
      halo.addColorStop(0, "rgba(63, 117, 255, 0.08)");
      halo.addColorStop(0.4, "rgba(63, 117, 255, 0.03)");
      halo.addColorStop(1, "rgba(63, 117, 255, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(sourceX - 220, sourceY - 220, 440, 440);

      animationRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerleave", handleLeave);
    window.addEventListener("blur", handleLeave);
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerleave", handleLeave);
      window.removeEventListener("blur", handleLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-background-canvas" aria-hidden="true" />;
}

export default AuthBackground;
