import { describe, expect, it } from "vitest";
import { formatMinorToPrice, parsePriceToMinor } from "@/ui/gift-price";

describe("parsePriceToMinor", () => {
  it("treats an empty field as no price", () => {
    expect(parsePriceToMinor("")).toBeNull();
    expect(parsePriceToMinor("   ")).toBeNull();
  });

  it("parses whole amounts and both decimal separators", () => {
    expect(parsePriceToMinor("250")).toBe(25000);
    expect(parsePriceToMinor("250.50")).toBe(25050);
    expect(parsePriceToMinor("250,5")).toBe(25050);
    expect(parsePriceToMinor(" 250,05 ")).toBe(25005);
    expect(parsePriceToMinor("0")).toBe(0);
    expect(parsePriceToMinor("0,01")).toBe(1);
  });

  /** `0.29 * 100` is `28.999999999999996`, so the parts are parsed as strings. */
  it("does not lose a minor unit to float arithmetic", () => {
    expect(parsePriceToMinor("0.29")).toBe(29);
    expect(parsePriceToMinor("1.15")).toBe(115);
    expect(parsePriceToMinor("8.13")).toBe(813);
  });

  /** A trailing separator is a half-typed number, not an error. */
  it("accepts a trailing separator", () => {
    expect(parsePriceToMinor("250.")).toBe(25000);
  });

  it("rejects garbage, negatives and more than two decimals", () => {
    for (const value of ["-5", "abc", "12.3.4", "1 000", "1,000", "12.345", ",5", "."]) {
      expect(parsePriceToMinor(value)).toBe("invalid");
    }
  });

  it("accepts the Int ceiling and rejects anything above it", () => {
    expect(parsePriceToMinor("21474836.47")).toBe(2_147_483_647);
    expect(parsePriceToMinor("21474836.48")).toBe("invalid");
    expect(parsePriceToMinor("99999999999999999999")).toBe("invalid");
  });
});

describe("formatMinorToPrice", () => {
  it("drops an empty fraction and pads a short one", () => {
    expect(formatMinorToPrice(25000)).toBe("250");
    expect(formatMinorToPrice(25050)).toBe("250.50");
    expect(formatMinorToPrice(25005)).toBe("250.05");
    expect(formatMinorToPrice(0)).toBe("0");
    expect(formatMinorToPrice(1)).toBe("0.01");
    expect(formatMinorToPrice(2_147_483_647)).toBe("21474836.47");
  });

  it("round-trips every stored amount back through the parser", () => {
    for (const minor of [0, 1, 5, 29, 99, 100, 101, 25000, 25050, 2_147_483_647]) {
      expect(parsePriceToMinor(formatMinorToPrice(minor))).toBe(minor);
    }
  });
});
