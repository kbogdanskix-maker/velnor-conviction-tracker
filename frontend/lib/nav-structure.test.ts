import { describe, it, expect } from "vitest";
import { NAV_GROUPS, ALL_HREFS, buildNav, type NavGroup } from "./nav-structure";

function hrefsOf(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.href));
}

describe("nav-structure", () => {
  it("has no duplicate hrefs across all groups", () => {
    const all = hrefsOf(NAV_GROUPS);
    expect(new Set(all).size).toBe(all.length);
  });

  it("puts the conviction spine in non-lab groups with the reframed labels", () => {
    const spine = NAV_GROUPS.filter((g) => !g.lab).flatMap((g) => g.items);
    const byHref = new Map(spine.map((i) => [i.href, i.label]));
    expect(byHref.get("/portfolio")).toBe("Positions");
    expect(byHref.get("/watchlist")).toBe("Lookout");
    expect(byHref.get("/thesis")).toBe("Thesis");
    expect(byHref.get("/reflect")).toBe("Reflect");
    expect(byHref.get("/journey")).toBe("Stock Journey");
  });

  it("places /journey in Accuracy & Conviction group (non-lab, non-secondary)", () => {
    const accuracyGroup = NAV_GROUPS.find((g) => g.label === "Accuracy & Conviction");
    expect(accuracyGroup).toBeDefined();
    const journeyItem = accuracyGroup?.items.find((i) => i.href === "/journey");
    expect(journeyItem?.label).toBe("Stock Journey");
  });

  it("places /closed in Accuracy & Conviction group (non-lab, non-secondary)", () => {
    const accuracyGroup = NAV_GROUPS.find((g) => g.label === "Accuracy & Conviction");
    expect(accuracyGroup).toBeDefined();
    expect(accuracyGroup?.lab).toBeFalsy();
    expect(accuracyGroup?.secondary).toBeFalsy();
    const closedItem = accuracyGroup?.items.find((i) => i.href === "/closed");
    expect(closedItem?.label).toBe("Closed & Lessons");
  });

  it("marks Planning secondary and Lab as lab", () => {
    const planning = NAV_GROUPS.find((g) => g.label === "Planning");
    const lab = NAV_GROUPS.find((g) => g.label === "Lab");
    expect(planning?.secondary).toBe(true);
    expect(lab?.lab).toBe(true);
  });

  it("keeps deferred tools in Lab, not the spine", () => {
    const spineHrefs = new Set(
      NAV_GROUPS.filter((g) => !g.lab).flatMap((g) => g.items.map((i) => i.href)),
    );
    for (const h of ["/insurance", "/fees", "/monte-carlo", "/retirement", "/learn", "/journal", "/notes"]) {
      expect(spineHrefs.has(h)).toBe(false);
    }
  });

  it("buildNav hides Lab by default and shows it when enabled", () => {
    expect(buildNav(false).some((g) => g.lab)).toBe(false);
    expect(buildNav(true).some((g) => g.lab)).toBe(true);
  });

  it("ALL_HREFS contains every item across every group", () => {
    expect([...ALL_HREFS].sort()).toEqual([...new Set(hrefsOf(NAV_GROUPS))].sort());
  });
});
