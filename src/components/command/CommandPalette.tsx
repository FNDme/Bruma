import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  CalendarCog,
  CheckCircle2,
  Circle,
  Dices,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Home,
  Key,
  Keyboard,
  List,
  ListPlus,
  Monitor,
  Moon,
  PanelLeft,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SquarePercent,
  Sun,
  SunMoon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useJournal } from "@/contexts/JournalContext";
import { useTodo } from "@/contexts/TodoContext";
import { useRoutine } from "@/contexts/RoutineContext";
import { useTheme } from "@/contexts/ThemeProvider";
import { useSystemChecks } from "@/contexts/SystemChecksContext";
import {
  htmlToPlainText,
  indexNotes,
  normalizeText,
  searchFolders,
  searchItems,
  searchNotes,
} from "@/lib/search";
import { formatCombo, shortcutFor, type ShortcutId } from "@/lib/shortcuts";
import { Highlight } from "./Highlight";
import { Kbd } from "./ShortcutsList";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSidebar: () => void;
  onShowShortcuts: () => void;
}

interface ActionItem {
  id: string;
  label: string;
  group: "Quick actions" | "Go to" | "Theme";
  icon: ReactNode;
  keywords?: string;
  shortcut?: ShortcutId;
  run: () => void;
}

const MAX_NOTES = 8;
const MAX_FOLDERS = 5;
const MAX_TODOS = 6;
const MAX_ROUTINES = 5;
const MAX_RECENT = 5;

function noteTime(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Cmd/Ctrl+K palette: global search over notes (title, subtitle, body text),
 * folders, todos and routines, plus navigation and quick actions.
 *
 * Filtering is done here (cmdk's own filter is off) so note bodies can be
 * searched with snippets and results ranked the same way as the collection
 * search box.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onToggleSidebar,
  onShowShortcuts,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { notes, folders, getFolderLabel } = useJournal();
  const { todos, addTodo } = useTodo();
  const { tasks } = useRoutine();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { runChecks, isRunning } = useSystemChecks();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");

  // Reset the query every time the palette closes.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Only index while open; indexNotes caches plain text per HTML string.
  const noteIndex = useMemo(() => (open ? indexNotes(notes) : []), [open, notes]);

  const close = () => onOpenChange(false);
  const go = (to: string, state?: unknown) => {
    close();
    navigate(to, state ? { state } : undefined);
  };

  const actions: ActionItem[] = [
    {
      id: "action:new-note",
      label: "New note",
      group: "Quick actions",
      icon: <Plus />,
      keywords: "write create journal entry",
      shortcut: "newNote",
      run: () => go("/collection/new"),
    },
    {
      id: "action:new-todo",
      label: "New todo",
      group: "Quick actions",
      icon: <ListPlus />,
      keywords: "task add create",
      shortcut: "newTodo",
      run: () => go("/todo", { focus: "new-todo" }),
    },
    {
      id: "action:new-folder",
      label: "New folder",
      group: "Quick actions",
      icon: <FolderPlus />,
      keywords: "create collection",
      run: () => go("/collection", { focus: "new-folder" }),
    },
    {
      id: "action:run-checks",
      label: isRunning ? "System checks are running…" : "Run system checks",
      group: "Quick actions",
      icon: <Play />,
      keywords: "security antivirus encryption screen lock compliance",
      run: () => {
        go("/system-checks");
        if (!isRunning) void runChecks();
      },
    },
    {
      id: "action:toggle-theme",
      label: `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`,
      group: "Quick actions",
      icon: <SunMoon />,
      keywords: "toggle theme dark light mode appearance",
      shortcut: "toggleTheme",
      run: () => {
        close();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      },
    },
    {
      id: "action:toggle-sidebar",
      label: "Collapse or expand sidebar",
      group: "Quick actions",
      icon: <PanelLeft />,
      keywords: "toggle sidebar navigation menu",
      shortcut: "toggleSidebar",
      run: () => {
        close();
        onToggleSidebar();
      },
    },
    {
      id: "action:shortcuts",
      label: "Keyboard shortcuts",
      group: "Quick actions",
      icon: <Keyboard />,
      keywords: "hotkeys keys help",
      shortcut: "shortcutsHelp",
      run: () => {
        close();
        onShowShortcuts();
      },
    },
    { id: "page:home", label: "Home", group: "Go to", icon: <Home />, keywords: "welcome start", run: () => go("/") },
    { id: "page:collection", label: "Collection", group: "Go to", icon: <BookOpen />, keywords: "notes journal", shortcut: "goCollection", run: () => go("/collection") },
    { id: "page:todo", label: "Todo List", group: "Go to", icon: <List />, keywords: "tasks", shortcut: "goTodo", run: () => go("/todo") },
    { id: "page:routines", label: "Routines", group: "Go to", icon: <Calendar />, keywords: "habits daily weekly monthly streak", shortcut: "goRoutines", run: () => go("/routines") },
    { id: "page:manage-routines", label: "Manage routines", group: "Go to", icon: <CalendarCog />, keywords: "habits edit add", run: () => go("/routines/manage") },
    { id: "page:system-checks", label: "System Checks", group: "Go to", icon: <ShieldCheck />, keywords: "security report", shortcut: "goSystemChecks", run: () => go("/system-checks") },
    { id: "page:password-generator", label: "Password Generator", group: "Go to", icon: <Key />, keywords: "security random", shortcut: "goPasswordGenerator", run: () => go("/password-generator") },
    { id: "page:dice-roller", label: "Dice Roller", group: "Go to", icon: <Dices />, keywords: "random roll", shortcut: "goDiceRoller", run: () => go("/dice-roller") },
    { id: "page:choose-for-me", label: "Choose For Me", group: "Go to", icon: <SquarePercent />, keywords: "random pick decide", shortcut: "goChooseForMe", run: () => go("/choose-for-me") },
    { id: "page:settings", label: "Settings", group: "Go to", icon: <Settings />, keywords: "preferences options reminders notifications", shortcut: "settings", run: () => go("/settings") },
    ...(
      [
        ["system", "System", <Monitor key="i" />],
        ["light", "Light", <Sun key="i" />],
        ["dark", "Dark", <Moon key="i" />],
      ] as const
    ).map(([value, label, icon]): ActionItem => ({
      id: `theme:${value}`,
      label: `Theme: ${label}${theme === value ? " (current)" : ""}`,
      group: "Theme",
      icon,
      keywords: "appearance mode color",
      run: () => {
        close();
        setTheme(value);
      },
    })),
  ];

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo(() => {
    if (!searching) return null;
    return {
      notes: searchNotes(noteIndex, trimmed, MAX_NOTES),
      folders: searchFolders(folders, trimmed, MAX_FOLDERS),
      todos: searchItems(
        // Open tasks first when scores tie.
        [...todos].sort((a, b) => Number(a.completed) - Number(b.completed)),
        trimmed,
        (t) => [{ value: t.text, weight: 10 }],
        MAX_TODOS
      ),
      routines: searchItems(
        tasks,
        trimmed,
        (r) => [
          { value: r.title, weight: 10 },
          { value: r.description ?? "", weight: 3 },
          { value: r.frequency, weight: 1 },
        ],
        MAX_ROUTINES
      ),
    };
  }, [searching, trimmed, noteIndex, folders, todos, tasks]);

  // Actions are rebuilt every render (their handlers close over fresh state),
  // and there are only a handful, so they're matched without memoizing.
  const actionResults = searching
    ? searchItems(actions, trimmed, (a) => [
        { value: a.label, weight: 10 },
        { value: a.keywords ?? "", weight: 3 },
        { value: a.group, weight: 1 },
      ])
    : [];
  // Typing a command name ("sett", "new no") should put commands above content.
  const commandsFirst =
    actionResults.length > 0 &&
    normalizeText(actionResults[0].label).startsWith(normalizeText(trimmed));

  const recentNotes = useMemo(
    () =>
      searching
        ? []
        : [...notes]
            .sort(
              (a, b) =>
                noteTime(b.updated_at || b.created_at) -
                noteTime(a.updated_at || a.created_at)
            )
            .slice(0, MAX_RECENT),
    [notes, searching]
  );

  // Visible ids in display order, so the first result is selected after each keystroke.
  const orderedIds = !results
    ? [
        ...actions.filter((a) => a.group === "Quick actions").map((a) => a.id),
        ...recentNotes.map((n) => `note:${n.id}`),
        ...actions.filter((a) => a.group !== "Quick actions").map((a) => a.id),
      ]
    : [
      ...(commandsFirst ? actionResults.map((a) => a.id) : []),
      ...results.notes.map((r) => `note:${r.note.id}`),
      ...results.folders.map((r) => `folder:${r.folder.id}`),
      ...results.todos.map((t) => `todo:${t.id}`),
      ...results.routines.map((r) => `routine:${r.id}`),
      ...(commandsFirst ? [] : actionResults.map((a) => a.id)),
      "create:todo",
      ...(results.notes.length > 0 ? ["search:notes"] : []),
    ];

  const firstId = orderedIds[0] ?? "";
  useEffect(() => {
    setSelected(firstId);
  }, [trimmed, firstId, open]);

  const renderAction = (action: ActionItem) => (
    <CommandItem key={action.id} value={action.id} onSelect={action.run}>
      {action.icon}
      <span className="truncate">
        <Highlight text={action.label} query={trimmed} />
      </span>
      {action.shortcut && (
        <CommandShortcut>
          <Kbd combo={shortcutFor(action.shortcut).combo} />
        </CommandShortcut>
      )}
    </CommandItem>
  );

  const renderNote = (
    note: (typeof notes)[number],
    snippet: string | undefined
  ) => {
    const location = note.folderId ? getFolderLabel(note.folderId) : "";
    return (
      <CommandItem
        key={note.id}
        value={`note:${note.id}`}
        onSelect={() => go(`/collection/${note.id}`)}
        className="items-start"
      >
        <FileText className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium">
              <Highlight text={note.title || "Untitled"} query={trimmed} />
            </span>
            {location && (
              <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[40%]">
                {location}
              </span>
            )}
          </div>
          {note.subtitle && (
            <div className="truncate text-xs text-muted-foreground">
              <Highlight text={note.subtitle} query={trimmed} />
            </div>
          )}
          {snippet && (
            <div className="line-clamp-2 text-xs text-muted-foreground/80">
              <Highlight text={snippet} query={trimmed} />
            </div>
          )}
        </div>
      </CommandItem>
    );
  };

  const commandsGroup = actionResults.length > 0 && (
    <CommandGroup heading="Commands">
      {actionResults.map(renderAction)}
    </CommandGroup>
  );

  const addTodoFromQuery = () => {
    addTodo(trimmed);
    close();
    toast.success("Todo added", {
      description: trimmed,
      action: { label: "View", onClick: () => navigate("/todo") },
    });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and commands"
      description="Search notes, folders, todos and routines, or run a command."
      commandProps={{
        shouldFilter: false,
        loop: true,
        value: selected,
        onValueChange: setSelected,
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search notes, todos, routines or type a command…"
        aria-label="Search"
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {!results && (
          <>
            <CommandGroup heading="Quick actions">
              {actions.filter((a) => a.group === "Quick actions").map(renderAction)}
            </CommandGroup>
            {recentNotes.length > 0 && (
              <CommandGroup heading="Recent notes">
                {recentNotes.map((note) =>
                  renderNote(note, htmlToPlainText(note.content).slice(0, 120))
                )}
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {actions.filter((a) => a.group === "Go to").map(renderAction)}
            </CommandGroup>
            <CommandGroup heading="Theme">
              {actions.filter((a) => a.group === "Theme").map(renderAction)}
            </CommandGroup>
          </>
        )}

        {results && (
          <>
            {commandsFirst && commandsGroup}
            {results.notes.length > 0 && (
              <CommandGroup heading="Notes">
                {results.notes.map((r) => renderNote(r.note, r.snippet))}
              </CommandGroup>
            )}
            {results.folders.length > 0 && (
              <CommandGroup heading="Folders">
                {results.folders.map(({ folder }) => {
                  const path = getFolderLabel(folder.id);
                  return (
                    <CommandItem
                      key={folder.id}
                      value={`folder:${folder.id}`}
                      onSelect={() => go(`/collection/folder/${folder.id}`)}
                    >
                      <FolderIcon />
                      <span className="truncate">
                        <Highlight text={folder.name} query={trimmed} />
                      </span>
                      {path !== folder.name && (
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {path}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {results.todos.length > 0 && (
              <CommandGroup heading="Todos">
                {results.todos.map((todo) => (
                  <CommandItem
                    key={todo.id}
                    value={`todo:${todo.id}`}
                    onSelect={() => go("/todo", { highlight: todo.id })}
                  >
                    {todo.completed ? <CheckCircle2 /> : <Circle />}
                    <span
                      className={
                        todo.completed
                          ? "truncate line-through text-muted-foreground"
                          : "truncate"
                      }
                    >
                      <Highlight text={todo.text} query={trimmed} />
                    </span>
                    {todo.completed && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Completed
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.routines.length > 0 && (
              <CommandGroup heading="Routines">
                {results.routines.map((routine) => (
                  <CommandItem
                    key={routine.id}
                    value={`routine:${routine.id}`}
                    onSelect={() => go("/routines", { highlight: routine.id })}
                  >
                    {routine.completed ? <CheckCircle2 /> : <Calendar />}
                    <span className="truncate">
                      <Highlight text={routine.title} query={trimmed} />
                    </span>
                    <span className="ml-auto text-xs capitalize text-muted-foreground">
                      {routine.frequency}
                      {routine.completed ? " · done" : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!commandsFirst && commandsGroup}
            <CommandGroup heading="Create">
              <CommandItem value="create:todo" onSelect={addTodoFromQuery}>
                <ListPlus />
                <span className="truncate">
                  Add todo “{trimmed}”
                </span>
              </CommandItem>
              {results.notes.length > 0 && (
                <CommandItem
                  value="search:notes"
                  onSelect={() =>
                    go(`/collection?q=${encodeURIComponent(trimmed)}`)
                  }
                >
                  <Search />
                  <span className="truncate">
                    Show all matching notes in Collection
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Kbd combo="up" />
            <Kbd combo="down" /> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd combo="enter" /> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd combo="escape" /> close
          </span>
        </span>
        <button
          type="button"
          className="hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            close();
            onShowShortcuts();
          }}
        >
          All shortcuts ({formatCombo(shortcutFor("shortcutsHelp").combo)})
        </button>
      </div>
    </CommandDialog>
  );
}
