"use client";

/* ------------------------------------------------------------------ */
/*  GeoSelect — one searchable location combobox.                      */
/*                                                                     */
/*  Used for every level of the cascading location system (country →   */
/*  state → county → city). Options are fetched LAZILY from the geo    */
/*  API as you type (max 50 rows per response) — the browser never     */
/*  downloads the full 145k-city dataset.                              */
/*                                                                     */
/*  Supports: type-to-search, full keyboard navigation (↑ ↓ Enter      */
/*  Escape), clear button, loading / empty / error states with retry.  */
/* ------------------------------------------------------------------ */

import { ChevronDown, Loader2, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoOption {
  id: string;
  name: string;
  hint?: string;
  /** extra payload rows can carry (e.g. a city's county) */
  meta?: Record<string, unknown>;
}

export default function GeoSelect({
  label,
  placeholder,
  value,
  onChange,
  fetchOptions,
  disabled,
  emptyText = "No matches found.",
  hint,
  guide,
}: {
  label: string;
  placeholder: string;
  value: GeoOption | null;
  onChange: (next: GeoOption | null) => void;
  /** fetches options for a query — aborted + refired as the user types */
  fetchOptions: (q: string, signal: AbortSignal) => Promise<GeoOption[]>;
  disabled?: boolean;
  emptyText?: string;
  hint?: string;
  /** data-guide anchor for the QA guide system */
  guide?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<GeoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* close on outside pointerdown */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* debounced, abortable fetch — runs whenever the dropdown is open */
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      fetchOptions(query, ctrl.signal)
        .then((items) => {
          setOptions(items);
          setActive(0);
          setLoading(false);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Couldn't load options");
          setLoading(false);
        });
    }, query ? 180 : 0);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [open, query, retryTick, fetchOptions]);

  const pick = useCallback(
    (o: GeoOption) => {
      onChange(o);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  /* keep the active option scrolled into view within the list only */
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    if (el && listRef.current) {
      const { offsetTop, offsetHeight } = el;
      const { scrollTop, clientHeight } = listRef.current;
      if (offsetTop < scrollTop) listRef.current.scrollTop = offsetTop;
      else if (offsetTop + offsetHeight > scrollTop + clientHeight)
        listRef.current.scrollTop = offsetTop + offsetHeight - clientHeight;
    }
  }, [active, options]);

  return (
    <div ref={rootRef} className="relative" data-guide={guide}>
      <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      <div
        className={`mt-1.5 flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition ${
          disabled
            ? "cursor-not-allowed border-line-soft bg-card text-zinc-600"
            : open
              ? "border-lime-400/50 bg-card-raised text-zinc-100"
              : "cursor-pointer border-line bg-card-raised text-zinc-100 hover:border-zinc-600"
        }`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={value ? value.name : placeholder}
            className="w-full bg-transparent outline-none placeholder:text-zinc-500"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onKeyDown={onKeyDown}
            onFocus={() => !disabled && setOpen(true)}
            className="w-full truncate bg-transparent text-left outline-none"
            disabled={disabled}
          >
            {value ? value.name : <span className="text-zinc-600">{placeholder}</span>}
          </button>
        )}
        {loading && open ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-zinc-500" />
        ) : value && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setQuery("");
            }}
            className="shrink-0 rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-700/60 hover:text-zinc-200"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className={`shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-card shadow-xl shadow-black/40">
          {error ? (
            <div className="px-3.5 py-3 text-xs">
              <p className="text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-medium text-zinc-300 transition hover:border-zinc-600"
              >
                <RotateCw size={12} /> Try again
              </button>
            </div>
          ) : loading && options.length === 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-3 text-xs text-zinc-500">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : options.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-zinc-500">{emptyText}</p>
          ) : (
            <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
              {options.map((o, i) => (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={value?.id === o.id}
                  onPointerDown={(e) => {
                    e.preventDefault(); // don't blur before we pick
                    pick(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-sm transition ${
                    i === active ? "bg-lime-400/10 text-lime-200" : "text-zinc-200"
                  } ${value?.id === o.id ? "font-semibold" : ""}`}
                >
                  <span className="truncate">{o.name}</span>
                  {o.hint && <span className="shrink-0 text-[11px] text-zinc-500">{o.hint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
