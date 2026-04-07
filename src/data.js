export const metricCards = [
  { label: "\u4eca\u65e5\u91c7\u96c6\u70b9\u6570", value: "12,580", delta: "+12%", accent: "positive" },
  { label: "\u6d3b\u8dc3\u513f\u7ae5 (Children)", value: "18", delta: "\u76ee\u6807\u8bc6\u522b\u7a33\u5b9a", accent: "muted" },
  { label: "\u6d3b\u8dc3\u533a\u57df\u8ba1\u6570 (Active Zones)", value: "6", delta: "+2 \u9ad8\u9891\u533a", accent: "warning" },
];

export const trendHours = ["08H", "10H", "12H", "14H", "16H", "18H"];
export const trendValues = [820, 1080, 1490, 1210, 1810, 1320];

export const zoneDurations = [
  { name: "\u8dd1\u9053", value: 42 },
  { name: "\u6559\u5b66\u697c", value: 68 },
  { name: "\u6c99\u6c60\u533a", value: 96 },
  { name: "\u6e38\u4e50\u533a", value: 77 },
];

export const logLevels = ["全部级别", "INFO", "DEBUG", "WARN", "ERROR"];
export const logWindows = ["\u6700\u8fd11\u5c0f\u65f6", "\u6700\u8fd16\u5c0f\u65f6", "\u6700\u8fd124\u5c0f\u65f6"];
export const logSources = [
  { value: "ALL", label: "全部来源" },
  { value: "auth", label: "认证" },
  { value: "http", label: "请求" },
  { value: "upload", label: "上传" },
  { value: "analysis", label: "分析" },
  { value: "ws", label: "WebSocket" },
  { value: "system", label: "系统" },
];

export const initialLogs = [];

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
