import { describe, expect, it } from "vitest";

import { ASTRO_GLOSSARY, findGlossaryFixedStar, findGlossaryPlanetByName } from "./astro-glossary";

describe("astro glossary", () => {
  it("contains the required core sections from Notion", () => {
    expect(ASTRO_GLOSSARY.elements).toHaveLength(4);
    expect(ASTRO_GLOSSARY.modalities).toHaveLength(3);
    expect(ASTRO_GLOSSARY.signs).toHaveLength(12);
    expect(ASTRO_GLOSSARY.planets).toHaveLength(10);
    expect(ASTRO_GLOSSARY.houses).toHaveLength(12);
    expect(ASTRO_GLOSSARY.aspects.map((aspect) => aspect.angle)).toEqual([0, 30, 60, 90, 120, 150, 180]);
  });

  it("matches glossary objects by Turkish names and fixed star names", () => {
    expect(findGlossaryPlanetByName("Güneş")?.key).toBe("sun");
    expect(findGlossaryPlanetByName("Merkür")?.keywords).toContain("konuşma");
    expect(findGlossaryFixedStar("Sirius")?.nature).toBe("Jüpiter/Mars");
  });
});
