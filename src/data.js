export const metricCards = [
  { label: "今日采集点数", value: "12,580", delta: "+12%", accent: "positive" },
  { label: "活跃儿童 (Children)", value: "18", delta: "目标识别稳定", accent: "muted" },
  { label: "活跃区域计数 (Active Zones)", value: "6", delta: "+2 高频区", accent: "warning" },
];

export const trendHours = ["08H", "10H", "12H", "14H", "16H", "18H"];
export const trendValues = [820, 1080, 1490, 1210, 1810, 1320];

export const zoneDurations = [
  { name: "跑道", value: 42 },
  { name: "教学楼", value: 68 },
  { name: "沙池区", value: 96 },
  { name: "游乐区", value: 77 },
];

export const logLevels = ["全部级别", "INFO", "DEBUG", "WARN"];
export const logWindows = ["最近1小时", "最近6小时", "最近24小时"];

export const initialLogs = [
  { ts: "2026-03-17 10:20:01", level: "INFO", text: "System boot initiated | version 2.4.0-stable" },
  { ts: "2026-03-17 10:20:05", level: "INFO", text: "WebSocket server started on port 8080" },
  { ts: "2026-03-17 10:21:12", level: "DEBUG", text: "Redis connection established: redis://127.0.0.1:6379" },
  { ts: "2026-03-17 10:22:30", level: "INFO", text: "Upload successfully: classroom01.mp4 (128MB)" },
  { ts: "2026-03-17 10:22:45", level: "INFO", text: "API Binding camera_id: 1 matched metadata" },
  { ts: "2026-03-17 10:23:00", level: "INFO", text: "Stream running. Analytics thread [0xAF4] started." },
  { ts: "2026-03-17 10:23:05", level: "DEBUG", text: "Track point payload received: {id: \"child_01\", x: 120, y: 450}" },
  { ts: "2026-03-17 10:23:10", level: "DEBUG", text: "Track point payload received: {id: \"child_02\", x: 340, y: 210}" },
  { ts: "2026-03-17 10:24:15", level: "WARN", text: "FPS dropped below 15 for 2.4s (IO bottleneck)" },
  { ts: "2026-03-17 10:25:00", level: "INFO", text: "Batch persist 512 track points to PostgreSQL" },
];

export const trackSeeds = [
  {
    id: "child_01",
    color: "#ff4d4f",
    label: "child_01",
    points: [[140, 116], [162, 138], [188, 144], [214, 133], [238, 118]],
  },
  {
    id: "child_02",
    color: "#16c25f",
    label: "child_02",
    points: [[410, 300], [424, 342], [487, 328], [550, 316]],
  },
  {
    id: "child_04",
    color: "#ffb11a",
    label: "child_04",
    points: [[262, 372], [302, 388], [348, 392], [394, 378], [438, 350]],
  },
  {
    id: "debug_1",
    color: "#2f6df6",
    label: "debug_1",
    points: [[620, 116], [643, 132], [682, 136], [714, 135], [733, 151], [742, 189]],
  },
  {
    id: "child_05",
    color: "#fb8c2f",
    label: "child_05",
    points: [[534, 74], [555, 62], [586, 61], [618, 72]],
  },
  {
    id: "child_03",
    color: "#8a63ff",
    label: "child_03",
    points: [[108, 420], [144, 404], [168, 392], [188, 430]],
  },
];
