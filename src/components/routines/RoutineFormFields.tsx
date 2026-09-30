import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import type { RoutineFrequency, RoutineTaskInput } from "@/types/routine";
import { WEEKDAY_LABELS, defaultReminderDay } from "@/lib/reminders";
import { requestReminderPermission } from "@/components/reminders/requestReminderPermission";

export interface RoutineFormValues extends RoutineTaskInput {
  description: string;
  /** "HH:MM", or "" for no reminder. */
  reminderTime: string;
}

export const DEFAULT_REMINDER_TIME = "09:00";

// Weekday options in Monday-first order.
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0];
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

interface RoutineFormFieldsProps {
  idPrefix: string;
  values: RoutineFormValues;
  onChange: (values: RoutineFormValues) => void;
  autoFocus?: boolean;
}

export function RoutineFormFields({
  idPrefix,
  values,
  onChange,
  autoFocus,
}: RoutineFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}-title`}
          className="block text-sm font-medium mb-1"
        >
          Title
        </label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="Enter task title"
          autoFocus={autoFocus}
          required
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-description`}
          className="block text-sm font-medium mb-1"
        >
          Description (Optional)
        </label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          placeholder="Enter task description"
        />
      </div>

      <div>
        <span className="block text-sm font-medium mb-1">Frequency</span>
        <ToggleGroup
          type="single"
          value={values.frequency}
          onValueChange={(value) => {
            // Radix emits "" when the active item is clicked again; keep a value.
            if (!value) return;
            const frequency = value as RoutineFrequency;
            onChange({
              ...values,
              frequency,
              // Weekday and day-of-month numbers mean different things.
              reminderDay:
                frequency === values.frequency
                  ? values.reminderDay
                  : defaultReminderDay(frequency),
            });
          }}
          aria-label="Frequency"
        >
          <ToggleGroupItem value="daily" aria-label="Daily">
            <Calendar className="mr-2 h-4 w-4" />
            Daily
          </ToggleGroupItem>
          <ToggleGroupItem value="weekly" aria-label="Weekly">
            <CalendarDays className="mr-2 h-4 w-4" />
            Weekly
          </ToggleGroupItem>
          <ToggleGroupItem value="monthly" aria-label="Monthly">
            <CalendarRange className="mr-2 h-4 w-4" />
            Monthly
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ReminderFields idPrefix={idPrefix} values={values} onChange={onChange} />
    </div>
  );
}

function ReminderFields({
  idPrefix,
  values,
  onChange,
}: Pick<RoutineFormFieldsProps, "idPrefix" | "values" | "onChange">) {
  const enabled = values.reminderTime !== "";
  const day = values.reminderDay ?? defaultReminderDay(values.frequency);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id={`${idPrefix}-reminder`}
          checked={enabled}
          onCheckedChange={(checked) => {
            onChange({
              ...values,
              reminderTime: checked ? DEFAULT_REMINDER_TIME : "",
              reminderDay: checked
                ? (values.reminderDay ?? defaultReminderDay(values.frequency))
                : values.reminderDay,
            });
            if (checked) void requestReminderPermission();
          }}
        />
        <label htmlFor={`${idPrefix}-reminder`} className="text-sm font-medium">
          Remind me if not done
        </label>
      </div>

      {enabled && (
        <div className="flex flex-wrap items-center gap-2 pl-10">
          {values.frequency === "weekly" && day !== undefined && (
            <Select
              value={String(day)}
              onValueChange={(v) => onChange({ ...values, reminderDay: Number(v) })}
            >
              <SelectTrigger className="w-[150px]" aria-label="Reminder day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {WEEKDAY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {values.frequency === "monthly" && day !== undefined && (
            <Select
              value={String(day)}
              onValueChange={(v) => onChange({ ...values, reminderDay: Number(v) })}
            >
              <SelectTrigger className="w-[150px]" aria-label="Reminder day of month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {MONTH_DAY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Day {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-sm text-muted-foreground">at</span>
          <TimeInput
            idPrefix="routine-reminder"
            value={values.reminderTime || DEFAULT_REMINDER_TIME}
            onChange={(reminderTime) => onChange({ ...values, reminderTime })}
            allowEmpty={false}
            label="Reminder time"
          />
          {values.frequency === "monthly" && day !== undefined && day > 28 && (
            <p className="basis-full text-xs text-muted-foreground">
              In shorter months the reminder is on the last day.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
