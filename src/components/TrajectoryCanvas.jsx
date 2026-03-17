import { useEffect, useMemo, useRef, useState } from "react";

function interpolate(points, t) {
  if (points.length === 1) return points[0];
  const segmentCount = points.length - 1;
  const scaled = t * segmentCount;
  const index = Math.min(Math.floor(scaled), segmentCount - 1);
  const localT = scaled - index;
  const [x1, y1] = points[index];
  const [x2, y2] = points[index + 1];
  return [x1 + (x2 - x1) * localT, y1 + (y2 - y1) * localT];
}

function TrajectoryCanvas({ tracks }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const startRef = useRef(0);
  const fpsRef = useRef(24);
  const [, setFps] = useState(24);

  const panelItems = useMemo(
    () => [
      { key: "fps", tone: "online", text: `FPS: ${fpsRef.current} | POINTS: ${tracks.length}` },
      { key: "log", tone: "muted", text: "LOG: RECEIVE_BUFFER_OK" },
      { key: "sub", tone: "muted", text: "SUB: camera.1.tracks" },
    ],
    [tracks.length],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frameCounter = 0;
    let lastFpsTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 5000;
      const loopT = elapsed % 1;

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.fillStyle = "#1d2740";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      tracks.forEach((track) => {
        const livePoints = track.points.map((_, index) => {
          const pointT = Math.max(0, Math.min(1, loopT - (track.points.length - index - 1) * 0.055));
          return interpolate(track.points, pointT);
        });

        ctx.lineWidth = 2;
        ctx.strokeStyle = track.color;
        ctx.beginPath();
        livePoints.forEach(([x, y], index) => {
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        livePoints.forEach(([x, y], index) => {
          const alpha = index / livePoints.length;
          ctx.fillStyle = `${track.color}${Math.round(alpha * 120).toString(16).padStart(2, "0")}`;
          ctx.beginPath();
          ctx.arc(x, y, index === livePoints.length - 1 ? 4 : 2.3, 0, Math.PI * 2);
          ctx.fill();
        });

        const [x, y] = livePoints[livePoints.length - 1];
        ctx.fillStyle = track.color;
        ctx.font = "12px Segoe UI";
        ctx.fillText(track.label, x + 8, y + 5);
      });

      frameCounter += 1;
      if (ts - lastFpsTime >= 1000) {
        fpsRef.current = frameCounter;
        setFps(frameCounter);
        frameCounter = 0;
        lastFpsTime = ts;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
      startRef.current = 0;
    };
  }, [tracks]);

  return (
    <div className="trajectory-stage">
      <canvas ref={canvasRef} className="trajectory-canvas" />
      <div className="stage-overlay">
        {panelItems.map((item, index) => (
          <div className={`stage-status ${item.tone}`} key={item.key + index}>
            {item.tone === "online" ? <span className="stage-led" /> : null}
            <span>{item.key === "fps" ? `FPS: ${fpsRef.current} | POINTS: ${tracks.length}` : item.text}</span>
          </div>
        ))}
      </div>
      <div className="stage-controls">
        <button className="stage-button">CAM</button>
        <button className="stage-button">CFG</button>
        <div className="stage-timeline" />
        <span>00:12:45 / 03:00:00</span>
      </div>
    </div>
  );
}

export default TrajectoryCanvas;
