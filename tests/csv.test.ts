import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/server/lib/csv";

describe("parseCsv", () => {
  it("parses plain rows, CRLF and a BOM", () => {
    expect(parseCsv("\uFEFFa,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    expect(parseCsv('a,"b, ""x""",c\n"line1\nline2",d,e')).toEqual([
      ["a", 'b, "x"', "c"],
      ["line1\nline2", "d", "e"],
    ]);
  });
  it("skips blank lines and keeps empty cells", () => {
    expect(parseCsv("a,,c\n\n\nd,e,\n")).toEqual([["a", "", "c"], ["d", "e", ""]]);
  });
  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a,"b')).toThrow();
  });
  it("round-trips through toCsv", () => {
    const rows = [["x", 'he said "hi", ok'], ["1", "2"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
