import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  JournalProvider,
  repairJournal,
  useJournal,
  type Folder,
  type Note,
} from "./JournalContext";
import { STORAGE_KEYS } from "@/lib/storage";

const wrapper = ({ children }: { children: ReactNode }) => (
  <JournalProvider>{children}</JournalProvider>
);
const render = () => renderHook(() => useJournal(), { wrapper });
type Journal = ReturnType<typeof render>["result"];

const storedNotes = (): Note[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.notes) ?? "[]");
const storedFolders = (): Folder[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.folders) ?? "[]");

/**
 * Root
 * ├─ Work            (note: w)
 * │  └─ Projects     (note: p)
 * │     └─ Archive   (note: a)
 * └─ Home            (note: h)
 * (unfiled note: u)
 */
async function seed(result: Journal) {
  let work!: Folder, projects!: Folder, archive!: Folder, home!: Folder;
  await act(async () => {
    work = await result.current.createFolder("Work");
    home = await result.current.createFolder("Home");
    projects = await result.current.createFolder("Projects", work.id);
    archive = await result.current.createFolder("Archive", projects.id);
  });
  const notes: Record<string, Note> = {};
  await act(async () => {
    notes.w = await result.current.saveNote("w", "", "<p>w</p>", work.id);
    notes.p = await result.current.saveNote("p", "", "<p>p</p>", projects.id);
    notes.a = await result.current.saveNote("a", "", "<p>a</p>", archive.id);
    notes.h = await result.current.saveNote("h", "", "<p>h</p>", home.id);
    notes.u = await result.current.saveNote("u", "", "<p>u</p>");
  });
  return { work, projects, archive, home, notes };
}

describe("JournalContext folder deletion", () => {
  it("delete-all removes the folder, every nested subfolder and all their notes", async () => {
    const { result } = render();
    const { work, home } = await seed(result);

    await act(() => result.current.deleteFolder(work.id, "delete-all"));

    expect(result.current.folders.map((f) => f.name)).toEqual(["Home"]);
    expect(result.current.notes.map((n) => n.title).sort()).toEqual(["h", "u"]);
    expect(result.current.notes.find((n) => n.title === "h")?.folderId).toBe(
      home.id
    );
    // Persisted too.
    expect(storedFolders().map((f) => f.name)).toEqual(["Home"]);
    expect(storedNotes().map((n) => n.title).sort()).toEqual(["h", "u"]);
  });

  it("move-to-parent (default) keeps contents and moves them up one level", async () => {
    const { result } = render();
    const { work, projects, archive, notes } = await seed(result);

    await act(() => result.current.deleteFolder(projects.id));

    const folderById = new Map(result.current.folders.map((f) => [f.id, f]));
    expect(folderById.has(projects.id)).toBe(false);
    // Archive (a direct child) now hangs off Work, and keeps its own note.
    expect(folderById.get(archive.id)?.parentId).toBe(work.id);
    const noteById = new Map(result.current.notes.map((n) => [n.id, n]));
    expect(noteById.get(notes.p.id)?.folderId).toBe(work.id);
    expect(noteById.get(notes.a.id)?.folderId).toBe(archive.id);
    expect(result.current.notes).toHaveLength(5);
  });

  it("moving a top-level folder's contents to the root unfiles its notes", async () => {
    const { result } = render();
    const { work, projects, notes } = await seed(result);

    await act(() => result.current.deleteFolder(work.id, "move-to-parent"));

    expect(
      result.current.folders.find((f) => f.id === projects.id)?.parentId
    ).toBeUndefined();
    expect(
      result.current.notes.find((n) => n.id === notes.w.id)?.folderId
    ).toBeUndefined();
  });

  it("reports recursive stats used by the delete dialog", async () => {
    const { result } = render();
    const { work } = await seed(result);
    expect(result.current.getFolderStats(work.id)).toEqual({
      noteCount: 3,
      subfolderCount: 2,
      directNoteCount: 1,
      directSubfolderCount: 1,
    });
  });
});

describe("JournalContext note edits", () => {
  it("editNote keeps the folder when the patch does not mention it", async () => {
    const { result } = render();
    const { projects, notes } = await seed(result);

    await act(async () => {
      await result.current.editNote(notes.p.id, {
        title: "Renamed",
        content: "<p>new</p>",
      });
    });

    const edited = result.current.getNote(notes.p.id)!;
    expect(edited.title).toBe("Renamed");
    expect(edited.content).toBe("<p>new</p>");
    expect(edited.folderId).toBe(projects.id);
    expect(storedNotes().find((n) => n.id === notes.p.id)?.folderId).toBe(
      projects.id
    );
  });

  it("moveNote moves a note between folders and back to the root", async () => {
    const { result } = render();
    const { home, notes } = await seed(result);

    await act(() => result.current.moveNote(notes.u.id, home.id));
    expect(result.current.getNote(notes.u.id)?.folderId).toBe(home.id);

    await act(() => result.current.moveNote(notes.u.id, undefined));
    expect(result.current.getNote(notes.u.id)?.folderId).toBeUndefined();
    expect(storedNotes().find((n) => n.id === notes.u.id)?.folderId).toBeUndefined();
  });

  it("back-to-back mutations do not overwrite each other", async () => {
    const { result } = render();
    await act(async () => {
      await Promise.all([
        result.current.saveNote("one", "", ""),
        result.current.saveNote("two", "", ""),
      ]);
    });
    expect(storedNotes().map((n) => n.title).sort()).toEqual(["one", "two"]);
  });
});

describe("JournalContext folder names", () => {
  it("rejects empty and duplicate sibling names (ignoring case)", async () => {
    const { result } = render();
    await seed(result);
    expect(result.current.validateFolderName("   ")).not.toBeNull();
    expect(result.current.validateFolderName("work")).not.toBeNull();
    expect(result.current.validateFolderName("Work 2")).toBeNull();
    await expect(result.current.createFolder("HOME")).rejects.toThrow();
  });
});

describe("repairJournal / legacy data", () => {
  it("moves orphans and cycles to the root without dropping anything", () => {
    const t = "2024-01-01T00:00:00.000Z";
    const folders: Folder[] = [
      { id: "a", name: "A", created_at: t, updated_at: t, parentId: "b" },
      { id: "b", name: "B", created_at: t, updated_at: t, parentId: "a" },
      { id: "c", name: "C", created_at: t, updated_at: t, parentId: "gone" },
    ];
    const notes: Note[] = [
      { id: "n", title: "n", subtitle: "", content: "", created_at: t, updated_at: t, folderId: "gone" },
    ];
    const out = repairJournal(notes, folders);
    expect(out.repaired).toBe(true);
    expect(out.folders).toHaveLength(3);
    expect(out.folders.find((f) => f.id === "c")?.parentId).toBeUndefined();
    expect(out.folders.some((f) => f.parentId === undefined && ["a", "b"].includes(f.id))).toBe(true);
    expect(out.notes[0].folderId).toBeUndefined();
  });

  it("backfills ids for notes saved before ids existed and finds them by created_at", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = "2023-05-05T10:00:00.000Z";
    localStorage.setItem(
      STORAGE_KEYS.notes,
      JSON.stringify([
        { title: "Legacy", subtitle: "", content: "<p>x</p>", created_at: t, updated_at: t },
      ])
    );
    const { result } = render();
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].id).toBe(t);
    expect(result.current.getNote(t)?.title).toBe("Legacy");
  });
});
