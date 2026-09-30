import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJournal } from "@/contexts/JournalContext";
import { cn } from "@/lib/utils";

// Radix Select does not allow an empty-string value, so the root gets a sentinel.
const ROOT_VALUE = "__root__";

export interface FolderOption {
  id: string;
  label: string;
}

/** Every folder with its full path label, sorted by that path. */
export function useFolderOptions(): FolderOption[] {
  const { folders, getFolderLabel } = useJournal();
  return folders
    .map((folder) => ({ id: folder.id, label: getFolderLabel(folder.id) }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
}

interface FolderSelectProps {
  /** Selected folder id; undefined means the root ("Unfiled"). */
  value: string | undefined;
  onChange: (folderId: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function FolderSelect({
  value,
  onChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel = "Folder",
}: FolderSelectProps) {
  const options = useFolderOptions();
  const selected =
    value && options.some((o) => o.id === value) ? value : ROOT_VALUE;

  return (
    <Select
      value={selected}
      onValueChange={(next) => onChange(next === ROOT_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size="sm"
        aria-label={ariaLabel}
        className={cn("max-w-full min-w-[12rem]", className)}
      >
        <SelectValue placeholder="Unfiled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ROOT_VALUE}>Unfiled (top level)</SelectItem>
        {options.length > 0 && <SelectSeparator />}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
