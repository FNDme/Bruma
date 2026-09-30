import { Fragment, useMemo } from "react";
import { findMatchRanges, tokenize } from "@/lib/search";

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

/** Renders `text` with the parts that match `query` wrapped in <mark>. */
export function Highlight({ text, query, className }: HighlightProps) {
  const parts = useMemo(() => {
    const ranges = findMatchRanges(text, tokenize(query));
    if (ranges.length === 0) return [text];
    const out: React.ReactNode[] = [];
    let last = 0;
    ranges.forEach(([start, end], i) => {
      if (start > last) out.push(<Fragment key={`t${i}`}>{text.slice(last, start)}</Fragment>);
      out.push(
        <mark
          key={`m${i}`}
          className="rounded-sm bg-yellow-200/70 px-0.5 text-inherit dark:bg-yellow-500/30"
        >
          {text.slice(start, end)}
        </mark>
      );
      last = end;
    });
    if (last < text.length) out.push(<Fragment key="tail">{text.slice(last)}</Fragment>);
    return out;
  }, [text, query]);

  return <span className={className}>{parts}</span>;
}
