import { describe, it, expect } from "vitest";
import { DISCLAIMER_TEXT, DISCLAIMER_SHORT } from "./disclaimer";

describe("disclaimer", () => {
  it("states it is not investment advice", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("not investment advice");
  });
  it("states educational purposes", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("educational");
  });
  it("directs to a licensed advisor", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("licensed financial advisor");
  });
  it("has a short variant", () => {
    expect(DISCLAIMER_SHORT.toLowerCase()).toContain("not investment advice");
  });
});
