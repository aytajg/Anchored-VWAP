/** @jsxImportSource https://esm.sh/react@18.2.0 */
import { useState, useCallback } from "https://esm.sh/react@18.2.0";
import { SearchBar } from "./SearchBar.tsx";
import { Chart } from "./Chart.tsx";

export function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval_] = useState<"5m" | "1d">("1d");

  const handleSymbolSelect = useCallback((sym: string) => {
    setSymbol(sym);
  }, []);

  return (
    <div class="flex flex-col h-screen">
      {/* Header */}
      <header class="flex items-center gap-4 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <h1 class="text-xl font-bold flex items-center gap-2">
          <span>⚓</span>
          <span>Anchored VWAP</span>
        </h1>

        <SearchBar onSelect={handleSymbolSelect} />

        {/* Interval Toggle */}
        <div class="flex bg-gray-800 rounded-lg overflow-hidden ml-2">
          <button
            class={`px-3 py-1.5 text-sm font-medium transition-colors ${
              interval === "5m" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setInterval_("5m")}
          >
            5 min
          </button>
          <button
            class={`px-3 py-1.5 text-sm font-medium transition-colors ${
              interval === "1d" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setInterval_("1d")}
          >
            Daily
          </button>
        </div>

        <div class="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span>Click any candle to anchor VWAP</span>
          <a href="/source" class="text-blue-400 hover:text-blue-300 underline">view source</a>
        </div>
      </header>

      {/* Chart */}
      <div class="flex-1 min-h-0">
        <Chart symbol={symbol} interval={interval} />
      </div>
    </div>
  );
}
