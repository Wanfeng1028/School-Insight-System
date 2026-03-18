import { useEffect, useMemo, useRef, useState } from "react";

function samplePoint(points, progress) {
  if (!points?.length) return null;
  if (points.length === 1) return points[0];
  const clamped = Math.max(0, Math.min(1, progress));
  const scaled = clamped * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const [x1, y1] = points[index];
  const [x2, y2] = points[index + 1];
  return [x1 + (x2 - x1) * local, y1 + (y2 - y1) * local];
}

function VideoTrackingPlayer({ videoUrl, tracks, detections = [], title, meta, analysisBusy }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLabel, setTimeLabel] = useState("00:00 / 00:00");

  const activeBoxes = useMemo(() => tracks.filter((item) => item.points?.length >= 1), [tracks]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = video.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const format = (value) => {
      if (!Number.isFinite(value)) return "00:00";
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const render = () => {
      const rect = video.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const duration = video.duration || 1;
      const progress = Math.max(0, Math.min(1, (video.currentTime || 0) / duration));
      setTimeLabel(`${format(video.currentTime || 0)} / ${format(video.duration || 0)}`);

      const hasDetectionFrames = Array.isArray(detections) && detections.length > 0;
      if (hasDetectionFrames) {
        const current = video.currentTime || 0;
        let frame = detections[0];
        for (let i = 1; i < detections.length; i += 1) {
          if (detections[i].t <= current) frame = detections[i];
          else break;
        }
        const boxes = frame?.boxes || [];
        boxes.forEach((box) => {
          const [x1, y1, x2, y2] = box.bbox || [0, 0, 0, 0];
          const left = Math.max(0, x1 * rect.width);
          const top = Math.max(0, y1 * rect.height);
          const width = Math.max(2, (x2 - x1) * rect.width);
          const height = Math.max(2, (y2 - y1) * rect.height);

          ctx.lineWidth = 2.4;
          ctx.strokeStyle = "#ff3b30";
          ctx.fillStyle = "rgba(255, 59, 48, 0.12)";
          ctx.beginPath();
          ctx.roundRect(left, top, width, height, 10);
          ctx.fill();
          ctx.stroke();

          const label = box.label || box.id || "person";
          ctx.fillStyle = "#ff3b30";
          ctx.beginPath();
          ctx.roundRect(left, Math.max(8, top - 26), 120, 22, 8);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "12px Segoe UI";
          ctx.fillText(label, left + 8, Math.max(23, top - 11));
        });
      } else activeBoxes.forEach((track, index) => {
        const point = samplePoint(track.points, progress);
        if (!point) return;
        const scaleX = rect.width / videoSize.width;
        const scaleY = rect.height / videoSize.height;
        const x = point[0] * scaleX;
        const y = point[1] * scaleY;
        const width = 62 + (index % 3) * 14;
        const height = 118 + (index % 2) * 18;
        const left = Math.max(12, Math.min(rect.width - width - 12, x - width / 2));
        const top = Math.max(12, Math.min(rect.height - height - 12, y - height / 2));

        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "#ff4d4f";
        ctx.fillStyle = "rgba(255, 77, 79, 0.12)";
        ctx.beginPath();
        ctx.roundRect(left, top, width, height, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.roundRect(left, Math.max(8, top - 28), 104, 24, 8);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Segoe UI";
        ctx.fillText(track.label, left + 10, Math.max(24, top - 12));
      });

      rafRef.current = requestAnimationFrame(render);
    };

    const syncVideoMeta = () => {
      setVideoSize({
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      });
      resize();
    };

    syncVideoMeta();
    resize();
    rafRef.current = requestAnimationFrame(render);
    window.addEventListener("resize", resize);
    video.addEventListener("loadedmetadata", syncVideoMeta);
    video.addEventListener("play", () => setIsPlaying(true));
    video.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      video.removeEventListener("loadedmetadata", syncVideoMeta);
    };
  }, [activeBoxes, detections, videoSize.height, videoSize.width, videoUrl]);

  return (
    <div className="video-track-card">
      <div className="video-track-head">
        <div>
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
        <div className="video-track-badges">
          <span className={`video-badge ${analysisBusy ? "busy" : "ready"}`}>{analysisBusy ? "分析中" : "原画追踪"}</span>
          <span className="video-badge dark">{timeLabel}</span>
        </div>
      </div>

      <div className="video-stage-shell">
        {videoUrl ? (
          <>
            <video ref={videoRef} className="tracking-video" src={videoUrl} controls muted playsInline />
            <canvas ref={canvasRef} className="tracking-overlay" />
          </>
        ) : (
          <div className="video-empty-state">
            <strong>暂无可用视频</strong>
            <span>请先上传并绑定视频，然后执行人物追踪分析。</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoTrackingPlayer;
