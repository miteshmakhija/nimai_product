import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { productsApi } from '../api';
import type { ProductField } from '../types';

interface Props {
  value: string | null;
  onChange: (name: string | null) => void;
  allowNone?: boolean;
  placeholder?: string;
}

export default function ProductPicker({ value, onChange, allowNone = true, placeholder = 'Select product…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductField[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    productsApi.list().then((r) => setProducts(r.data)).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] w-full items-center justify-between rounded-[11px] border border-border bg-input-background px-3.5 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)]"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-[11px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(''); }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent/50"
              >
                No product (use default)
                {value === null && <Check className="h-3.5 w-3.5 text-brand" />}
              </button>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.product_name); setOpen(false); setQuery(''); }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] text-foreground hover:bg-accent/50"
              >
                {p.product_name}
                {value === p.product_name && <Check className="h-3.5 w-3.5 text-brand" />}
              </button>
            ))}
            {filtered.length === 0 && !allowNone && (
              <p className="px-3.5 py-3 text-center text-xs text-muted-foreground">No products found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
