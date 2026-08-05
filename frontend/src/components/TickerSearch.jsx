import { useState, useRef } from "react";
import { searchTickers } from "../api";

export default function TickerSearch({ id, name, value, onChange }) {
  const [results, setResults] = useState([]);
  // Tracks whether a pending async search should be discarded (Escape / blur)
  const cancelled = useRef(false);

  const closeDropdown = () => {
    cancelled.current = true;
    setResults([]);
  };

  const handleChange = async (e) => {
    const newValue = e.target.value;
    onChange(newValue);

    const parts = newValue.split(",");
    const lastPart = parts[parts.length - 1].trim();

    if (lastPart.length > 1) {
      cancelled.current = false;
      try {
        const data = await searchTickers(lastPart);
        if (!cancelled.current) {
          console.log("Search results for:", lastPart, data);
          setResults(data);
        }
      } catch (err) {
        console.error("Search failed", err);
      }
    } else {
      setResults([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") closeDropdown();
  };

  // 150 ms delay lets a mousedown on a list item register before the blur clears it
  const handleBlur = () => {
    setTimeout(closeDropdown, 150);
  };

  const handleSelect = (symbol) => {
    const parts = value.split(",");
    // Replace the last typed token with the selected ticker
    parts[parts.length - 1] = ` ${symbol}`;
    // Join parts and clean up extra spaces/commas
    const newValue = parts
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ");
    onChange(newValue);
    setResults([]);
  };

  return (
    <div className="ticker-search">
      <input
        id={id}
        name={name || id}
        type="text"
        placeholder="Search company or ticker..."
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {results.length > 0 && (
        <ul className="ticker-results">
          {results.map((item) => (
            <li key={item.symbol} onClick={() => handleSelect(item.symbol)}>
              <span className="ticker-symbol">{item.symbol}</span>
              <span className="ticker-name"> - {item.shortname}</span>
              <span className="ticker-exchange"> ({item.exchange})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
