import { useEffect, useRef } from "react";
import * as echarts from "echarts";

function BarChart({ data }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      animationDuration: 900,
      grid: { top: 20, right: 18, bottom: 10, left: 66 },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        data: data.map((item) => item.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#7e8da8", fontSize: 13 },
      },
      series: [
        {
          type: "bar",
          data: data.map((item) => item.value),
          barWidth: 10,
          showBackground: true,
          backgroundStyle: { color: "#edf2fd", borderRadius: 999 },
          itemStyle: { color: "#2f6df6", borderRadius: 999 },
          label: { show: false },
        },
      ],
      tooltip: {
        trigger: "item",
        backgroundColor: "#122033",
        borderWidth: 0,
        textStyle: { color: "#fff" },
      },
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data]);

  return <div className="chart-host compact" ref={chartRef} />;
}

export default BarChart;
