import { cn } from "@/lib/utils";
import {
  comboKeys,
  DESKTOP_SHORTCUTS,
  EDITOR_SHORTCUTS,
  GLOBAL_SHORTCUTS,
  PALETTE_SHORTCUTS,
} from "@/lib/shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Keycaps for a combo such as "mod+shift+n". */
export function Kbd({ combo, className }: { combo: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {comboKeys(combo).map((key, i) => (
        <kbd
          key={i}
          className="pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

interface Section {
  title: string;
  items: { combo: string; label: string }[];
}

function sections(): Section[] {
  const groups = new Map<string, Section>();
  for (const s of GLOBAL_SHORTCUTS) {
    const section = groups.get(s.group) ?? { title: s.group, items: [] };
    section.items.push(s);
    groups.set(s.group, section);
  }
  return [
    ...groups.values(),
    { title: "Desktop (system-wide)", items: DESKTOP_SHORTCUTS },
    { title: "Command palette", items: PALETTE_SHORTCUTS },
    { title: "Note editor", items: EDITOR_SHORTCUTS },
  ];
}

/** Every keyboard shortcut, grouped. Used by Settings and the shortcuts dialog. */
export function ShortcutsList({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2", className)}>
      {sections().map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {section.title}
          </h3>
          <ul className="space-y-1.5">
            {section.items.map((item) => (
              <li
                key={`${item.combo}-${item.label}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span>{item.label}</span>
                <Kbd combo={item.combo} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts with ⌘/Ctrl work everywhere, including while typing.
          </DialogDescription>
        </DialogHeader>
        <ShortcutsList />
      </DialogContent>
    </Dialog>
  );
}
