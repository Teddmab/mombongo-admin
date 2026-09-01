import { useId, useRef, useState } from "react";

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  isLoading?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
  emptyLabel?: string;
}

/**
 * A real combobox (WAI-ARIA combobox pattern): a text input that filters
 * a dropdown listbox, not a permanently-visible list under a search box.
 * Selecting an option collapses the dropdown and shows the chosen label
 * in the input; typing again reopens search over the full option set.
 */
export function Combobox({ options, isLoading, selectedId, onSelect, placeholder, emptyLabel = "Aucun résultat." }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === selectedId) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = !q ? options : options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));

  function openWithFreshQuery() {
    setQuery("");
    setIsOpen(true);
    setHighlighted(0);
  }

  function selectOption(option: ComboboxOption) {
    onSelect(option.id);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) selectOption(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const displayValue = isOpen ? query : (selected?.label ?? "");

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={displayValue}
        onFocus={openWithFreshQuery}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHighlighted(0); }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={selected ? selected.label : placeholder}
        className="form-input"
        style={{ width: "100%" }}
      />
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="panel"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, maxHeight: 280, overflowY: "auto", padding: 6 }}
        >
          {isLoading ? (
            <li className="muted text-sm" style={{ padding: 10 }}>Chargement…</li>
          ) : filtered.length === 0 ? (
            <li className="muted text-sm" style={{ padding: 10 }}>{emptyLabel}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.id} role="option" id={`${listboxId}-${o.id}`} aria-selected={o.id === selectedId}>
                {/* onMouseDown, not onClick — fires before the input's onBlur, so selection registers before the dropdown closes */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}
                  className={`select-row ${o.id === selectedId ? "selected" : ""}`}
                  style={{ background: i === highlighted && o.id !== selectedId ? "hsl(var(--gray-50))" : undefined }}
                >
                  <div>
                    <div className="font-semibold text-sm">{o.label}</div>
                    {o.sublabel && <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{o.sublabel}</div>}
                  </div>
                  {o.badge && <span className="pill status-active">{o.badge}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
