import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Button } from "./button";
import { TimeInput, parseTimeInput } from "./time-input";

describe("parseTimeInput", () => {
  it.each([
    ["", ""],
    ["9", "09:00"],
    ["09", "09:00"],
    ["21", "21:00"],
    ["930", "09:30"],
    ["0930", "09:30"],
    ["2115", "21:15"],
    ["9:30", "09:30"],
    ["9:", "09:00"],
    ["9.30", "09:30"],
    ["9h30", "09:30"],
    [" 23:59 ", "23:59"],
    ["9pm", "21:00"],
    ["12am", "00:00"],
    ["12 pm", "12:00"],
    ["9:30 a.m.", "09:30"],
  ])("%j -> %j", (input, expected) => {
    expect(parseTimeInput(input)).toBe(expected);
  });

  it.each(["24", "9:60", "12345", "13pm", "0am", "abc", "9:30:00"])(
    "rejects %j",
    (input) => {
      expect(parseTimeInput(input)).toBeNull();
    }
  );
});

function Harness({ initial = "", allowEmpty = true }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TimeInput
        idPrefix="t"
        value={value}
        onChange={setValue}
        allowEmpty={allowEmpty}
        label="Due time"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const field = () => screen.getByLabelText("Due time") as HTMLInputElement;
const value = () => screen.getByTestId("value").textContent;

describe("TimeInput", () => {
  it("an hour alone commits a complete time and is normalized on blur", () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: "14" } });
    expect(value()).toBe("14:00");
    fireEvent.blur(field());
    expect(field().value).toBe("14:00");
  });

  it("invalid text is flagged, not committed, and reverted on blur", () => {
    render(<Harness initial="08:30" />);
    fireEvent.change(field(), { target: { value: "25" } });
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(value()).toBe("08:30");
    fireEvent.blur(field());
    expect(field().value).toBe("08:30");
  });

  it("clearing is allowed only when allowEmpty", () => {
    const { unmount } = render(<Harness initial="08:30" />);
    fireEvent.change(field(), { target: { value: "" } });
    expect(value()).toBe("");
    unmount();

    render(<Harness initial="08:30" allowEmpty={false} />);
    fireEvent.change(field(), { target: { value: "" } });
    expect(value()).toBe("08:30");
    fireEvent.blur(field());
    expect(field().value).toBe("08:30");
  });

  it("follows outside value changes", () => {
    const { rerender } = render(
      <TimeInput idPrefix="t" value="10:00" onChange={() => {}} label="Due time" />
    );
    rerender(<TimeInput idPrefix="t" value="" onChange={() => {}} label="Due time" />);
    expect(field().value).toBe("");
  });

  it("Button forwards refs (needed by Radix asChild triggers)", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
