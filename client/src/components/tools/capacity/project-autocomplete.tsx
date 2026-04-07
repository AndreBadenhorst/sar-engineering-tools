import { useState, useRef, useEffect } from "react";
import { useProjectSearch, type Project } from "@/hooks/use-capacity";
import { Input } from "@/components/ui/input";

interface ProjectAutocompleteProps {
  value: string;
  onChange: (project: { id: number; number: string; description: string | null } | null) => void;
  placeholder?: string;
}

export function ProjectAutocomplete({ value, onChange, placeholder }: ProjectAutocompleteProps) {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: results } = useProjectSearch(search);

  // Sync external value changes
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange(null);
        }}
        onFocus={() => search.length >= 2 && setOpen(true)}
        placeholder={placeholder || "Project #"}
        className="h-7 text-xs px-1.5"
      />
      {open && results && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 mt-1 w-72 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {results.map((p: Project) => (
            <button
              key={p.id}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setSearch(p.number);
                onChange({ id: p.id, number: p.number, description: p.description });
                setOpen(false);
              }}
            >
              <span className="font-medium">{p.number}</span>
              {p.customer && (
                <span className="text-muted-foreground"> — {p.customer}</span>
              )}
              {p.description && (
                <div className="text-muted-foreground truncate">{p.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
