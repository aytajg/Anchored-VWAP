/** @jsxImportSource https://esm.sh/react@18.2.0 */
import { useState, useRef, useEffect, useCallback } from "https://esm.sh/react@18.2.0";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export function SearchBar({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      setResults(data.results || []);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => search(val), 300);
  };

  const handleSelect = (sym: string) => {
    setQuery(sym);
    setIsOpen(false);
    onSelect(sym);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      setIsOpen(false);
      onSelect(query.trim().toUpperCase());
    }
  };

  const typeEmoji: Record<string, string> = {
    EQUITY: "📈",
    ETF: "📦",
    CRYPTOCURRENCY: "🪙",
    CURRENCY: "💱",
    FUTURES: "📊",
    INDEX: "🏛️",
  };

  return (
    <div ref={containerRef} class="relative">
      <div class="flex items-center bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700 focus-within:border-blue-500 transition-colors">
        <span class="text-gray-500 mr-2">🔍</span>
        <input
          type="text"
          value={query}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search symbol (AAPL, BTC-USD, EURUSD=X)"
          class="bg-transparent outline-none text-sm text-white placeholder-gray-500 w-64"
        />
        {loading && <span class="text-gray-500 text-xs ml-2 animate-pulse">...</span>}
      </div>

      {isOpen && results.length > 0 && (
        <div class="absolute top-full mt-1 left-0 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              class="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left"
              onClick={() => handleSelect(r.symbol)}
            >
              <span class="text-lg">{typeEmoji[r.type] || "📄"}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white">{r.symbol}</div>
                <div class="text-xs text-gray-400 truncate">{r.name}</div>
              </div>
              <span class="text-xs text-gray-500">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
