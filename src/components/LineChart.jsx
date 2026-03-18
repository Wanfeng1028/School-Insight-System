import { useEffect, useRef } from "react";
import * as echarts from "echarts";

function LineChart({ hours, values }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const element = chartRef.current;
    const chart = instanceRef.current || echarts.init(element);
    instanceRef.current = chart;

    const applyOption = () => {
      chart.setOption(
        {
          animationDuration: 900,
          grid: { top: 28, right: 22, bottom: 28, left: 52 },
          xAxis: {
            type: "category",
            data: hours,
            boundaryGap: false,
            axisLine: { lineStyle: { color: "#d9e2f2" } },
            axisTick: { show: false },
            axisLabel: { color: "#9aa9c2", fontSize: 12 },
          },
          yAxis: {
            type: "value",
            min: 0,
            max: 1800,
            interval: 300,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: "#9aa9c2", fontSize: 12 },
            splitLine: { lineStyle: { color: "#edf2fb" } },
          },
          tooltip: {
            trigger: "axis",
            backgroundColor: "#122033",
            borderWidth: 0,
            textStyle: { color: "#fff" },
          },
          series: [
            {
              data: values,
              type: "line",
              smooth: true,
              symbol: "circle",
              symbolSize: 7,
              showSymbol: false,
              clip: true,
              lineStyle: { width: 4, color: "#2f6df6" },
              itemStyle: { color: "#2f6df6" },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(47,109,246,0.22)" },
                  { offset: 1, color: "rgba(47,109,246,0.02)" },
                ]),
              },
            },
          ],
        },
        true,
      );
      chart.resize();
    };

    applyOption();

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(element);

    const resizeTimer = window.setTimeout(() => {
      chart.resize();
    }, 80);

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [hours, values]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div className="chart-host" ref={chartRef} />;
}

export default LineChart;
