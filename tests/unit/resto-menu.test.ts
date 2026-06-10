import { describe, expect, it } from "vitest";

import { cleanPrice, mainsByKind, soupNames } from "@/lib/resto/format";
import { restoOverviewSchema, type RestoDay } from "@/lib/resto/types";

const day: RestoDay = {
  date: "2026-06-10",
  open: true,
  meals: [
    { kind: "soup", name: "Groentesoep klein", price: "€ 1,20", type: "side", allergens: [] },
    { kind: "soup", name: "Groentesoep groot", price: "€ 1,80", type: "side", allergens: [] },
    { kind: "soup", name: "Maïs ep met tomaat / € 1,80 klein", price: "€ 1,20", type: "side", allergens: [] },
    { kind: "vegan", name: "Spaghetti met groentesaus", price: "€ 4,55", type: "main", allergens: [] },
    { kind: "vegetarian", name: "Bloemkool-kaasburger", price: "€ 5,20", type: "main", allergens: [] },
    { kind: "meat", name: "Vol-au-vent", price: "€ 5,30", type: "main", allergens: [] },
    { kind: "fish", name: "Witvis meunière", price: "kokosso", type: "main", allergens: [] },
  ],
  vegetables: ["veggie: Pastinaak met honing", "vegan: Rauwkostslaatje"],
};

describe("mainsByKind", () => {
  it("groups mains by kind in display order, skipping sides", () => {
    const sections = mainsByKind(day);
    expect(sections.map((s) => s.kind)).toEqual([
      "meat",
      "fish",
      "vegetarian",
      "vegan",
    ]);
    expect(sections[0].meals[0].name).toBe("Vol-au-vent");
  });

  it("drops kinds with no main dishes", () => {
    const soupOnly: RestoDay = { ...day, meals: day.meals.filter((m) => m.kind === "soup") };
    expect(mainsByKind(soupOnly)).toEqual([]);
  });
});

describe("soupNames", () => {
  it("dedupes klein/groot variants and strips price fragments", () => {
    expect(soupNames(day)).toEqual(["Groentesoep", "Maïs ep met tomaat"]);
  });
});

describe("cleanPrice", () => {
  it("keeps real prices and rejects garbled ones", () => {
    expect(cleanPrice("€ 4,55")).toBe("€ 4,55");
    expect(cleanPrice("kokosso")).toBeNull();
    expect(cleanPrice(null)).toBeNull();
    expect(cleanPrice(undefined)).toBeNull();
  });
});

describe("restoOverviewSchema", () => {
  it("parses a minimal feed and applies defaults", () => {
    const parsed = restoOverviewSchema.parse([{ date: "2026-06-10" }]);
    expect(parsed[0]).toMatchObject({ open: true, meals: [], vegetables: [] });
  });

  it("rejects a non-array payload", () => {
    expect(restoOverviewSchema.safeParse({ date: "x" }).success).toBe(false);
  });
});
