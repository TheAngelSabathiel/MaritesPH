import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import fil from "@/i18n/messages/fil.json";

/** Message trees: nested objects, string leaves, and string arrays (walked by index). */
type Tree = { [key: string]: unknown };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else if (value && typeof value === "object") Object.assign(acc, flatten(value as Tree, path));
    return acc;
  }, {});
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message files", () => {
  const flatEn = flatten(en as unknown as Tree);
  const flatFil = flatten(fil as unknown as Tree);

  it("have exactly the same keys", () => {
    expect(Object.keys(flatFil).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("use the same {placeholders} for every key", () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatFil[key] ?? ""), key).toEqual(placeholders(flatEn[key]));
    }
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...Object.entries(flatEn), ...Object.entries(flatFil)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("use the official feature names in both languages", () => {
    expect(en.features).toEqual(fil.features);
    expect(en.features.verifiedBadge).toBe("Verified ni Marites");
    expect(en.features.community).toBe("Chika sa Pila");
  });
});
