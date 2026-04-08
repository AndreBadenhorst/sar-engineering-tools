import { useState } from "react";
import { useCapacityChangelog, type ChangelogEntry } from "@/hooks/use-capacity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { History, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "create":
      return <Plus className="h-3 w-3 text-green-400" />;
    case "update":
      return <Pencil className="h-3 w-3 text-blue-400" />;
    case "delete":
      return <Trash2 className="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

function ActionBadge({ action }: { action: string }) {
  const variant = action === "create" ? "default" : action === "delete" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0 h-4 capitalize">
      {action}
    </Badge>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso + "Z"); // SQLite datetime is UTC
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    let relative: string;
    if (diffMin < 1) relative = "just now";
    else if (diffMin < 60) relative = `${diffMin}m ago`;
    else if (diffHr < 24) relative = `${diffHr}h ago`;
    else if (diffDay < 7) relative = `${diffDay}d ago`;
    else relative = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const full = d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

    return { relative, full };
  } catch {
    return { relative: iso, full: iso };
  }
}

function ChangelogItem({ log }: { log: ChangelogEntry }) {
  const time = formatTime(log.createdAt);

  return (
    <div className="flex gap-2.5 py-2 px-1 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
      {/* Action icon */}
      <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center">
        <ActionIcon action={log.action} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ActionBadge action={log.action} />
          {log.field && (
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1 rounded">
              {log.field}
            </span>
          )}
        </div>

        <div className="text-xs text-foreground/90 leading-relaxed">
          {log.summary}
        </div>

        {/* Show old → new for updates */}
        {log.action === "update" && log.oldValue !== null && log.newValue !== null && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="line-through text-red-400/70 truncate max-w-[120px]">{log.oldValue || "(empty)"}</span>
            <span>→</span>
            <span className="text-green-400/70 truncate max-w-[120px]">{log.newValue || "(empty)"}</span>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground/60" title={time.full}>
          {time.relative}
        </div>
      </div>
    </div>
  );
}

export function ChangelogPanel() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useCapacityChangelog(PAGE_SIZE, offset);

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Changelog</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base pr-6">
            <History className="h-4 w-4" />
            Change Log
            {total > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {total} {total === 1 ? "change" : "changes"}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Log list */}
        <div className="flex-1 overflow-auto px-3 py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No changes recorded yet</p>
              <p className="text-xs mt-1">Changes will appear here as you edit the planner</p>
            </div>
          ) : (
            logs.map((log) => <ChangelogItem key={log.id} log={log} />)
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-3 w-3 mr-0.5" />
              Newer
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Older
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
