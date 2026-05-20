/** @jsxImportSource https://esm.sh/react@18.2.0 */
import { useState, useEffect, useRef, useCallback } from "https://esm.sh/react@18.2.0";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartData {
  symbol: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  candles: Candle[];
}

// Calculate anchored VWAP from a given index
function calcAnchoredVWAP(candles: Candle[], anchorIdx: number) {
  const vwapData: { time: number; value: number }[] = [];
  let cumTPV = 0; // cumulative (typical price * volume)
  let cumVol = 0; // cumulative volume

  for (let i = anchorIdx; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    if (cumVol > 0) {
      vwapData.push({ time: c.time, value: Number((cumTPV / cumVol).toFixed(4)) });
    }
  }
  return vwapData;
}

export function Chart({ symbol, interval }: { symbol: string; interval: "5m" | "1d" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const vwapSeriesRef = useRef<any>(null);
  const candlesRef = useRef<Candle[]>([]);
  const [anchorTime, setAnchorTime] = useState<number | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [chartInfo, setChartInfo] = useState<{ symbol: string; currency: string } | null>(null);
  const lwcModuleRef = useRef<any>(null);

  const range = interval === "5m" ? "5d" : "1y";

  // Load lightweight-charts dynamically
  const getLWC = useCallback(async () => {
    if (lwcModuleRef.current) return lwcModuleRef.current;
    lwcModuleRef.current = await import("https://esm.sh/lightweight-charts@4.1.3");
    return lwcModuleRef.current;
  }, []);

  // Initialize chart
  useEffect(() => {
    let disposed = false;

    (async () => {
      const lwc = await getLWC();
      if (disposed || !containerRef.current) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = lwc.createChart(containerRef.current, {
        layout: {
          background: { color: "#0a0a1a" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: "#374151",
        },
        timeScale: {
          borderColor: "#374151",
          timeVisible: interval === "5m",
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        wickUpColor: "#22c55e",
      });

      const volumeSeries = chart.addHistogramSeries({
        color: "#3b82f6",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      // Handle resize
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries[0] && chartRef.current) {
          const { width, height } = entries[0].contentRect;
          chartRef.current.applyOptions({ width, height });
        }
      });
      resizeObserver.observe(containerRef.current);

      // Click handler for anchoring
      chart.subscribeClick((param: any) => {
        if (!param.time) return;
        // Find the candle index by time
        const candles = candlesRef.current;
        const clickedTime = typeof param.time === "object"
          ? new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000
          : param.time;
        const idx = candles.findIndex((c) => c.time === clickedTime);
        if (idx >= 0) {
          setAnchorTime(clickedTime);
          drawVWAP(candles, idx);
        }
      });

      return () => {
        resizeObserver.disconnect();
      };
    })();

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [interval]);

  // Draw VWAP line
  const drawVWAP = useCallback(async (candles: Candle[], anchorIdx: number) => {
    const lwc = await getLWC();
    if (!chartRef.current) return;

    // Remove old VWAP line
    if (vwapSeriesRef.current) {
      chartRef.current.removeSeries(vwapSeriesRef.current);
      vwapSeriesRef.current = null;
    }

    const vwapData = calcAnchoredVWAP(candles, anchorIdx);
    if (vwapData.length === 0) return;

    const vwapSeries = chartRef.current.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      lineStyle: lwc.LineStyle.Solid,
      title: "AVWAP",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    vwapSeries.setData(vwapData);

    // Add anchor marker
    candleSeriesRef.current?.setMarkers([{
      time: candles[anchorIdx].time,
      position: "belowBar",
      color: "#f59e0b",
      shape: "arrowUp",
      text: "⚓ Anchor",
    }]);

    vwapSeriesRef.current = vwapSeries;
  }, [getLWC]);

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("Loading...");
      setAnchorTime(null);

      // Remove old vwap and markers
      if (vwapSeriesRef.current && chartRef.current) {
        chartRef.current.removeSeries(vwapSeriesRef.current);
        vwapSeriesRef.current = null;
      }
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setMarkers([]);
      }

      try {
        const resp = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`);
        const data: ChartData = await resp.json();
        if (cancelled) return;

        if ((data as any).error) {
          setStatus((data as any).error);
          return;
        }

        const candles = data.candles;
        candlesRef.current = candles;

        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
          );
        }

        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            candles.map((c) => ({
              time: c.time,
              value: c.volume,
              color: c.close >= c.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
            })),
          );
        }

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setChartInfo({ symbol: data.symbol, currency: data.currency });
        setStatus("");
      } catch (err) {
        if (!cancelled) setStatus("Failed to load data");
      }
    })();

    return () => { cancelled = true; };
  }, [symbol, interval, range]);

  // Clear anchor
  const clearAnchor = () => {
    setAnchorTime(null);
    if (vwapSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(vwapSeriesRef.current);
      vwapSeriesRef.current = null;
    }
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setMarkers([]);
    }
  };

  return (
    <div class="relative w-full h-full">
      {/* Status bar */}
      {(status || chartInfo || anchorTime) && (
        <div class="absolute top-2 left-3 z-10 flex items-center gap-3">
          {status && <span class="text-sm text-yellow-400 bg-gray-900/80 px-2 py-1 rounded">{status}</span>}
          {chartInfo && !status && (
            <span class="text-sm text-gray-400 bg-gray-900/80 px-2 py-1 rounded">
              {chartInfo.symbol} · {chartInfo.currency} · {interval === "5m" ? "5 min" : "Daily"}
            </span>
          )}
          {anchorTime && (
            <button
              onClick={clearAnchor}
              class="text-xs bg-amber-600/80 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors"
            >
              ⚓ Clear Anchor
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
}
