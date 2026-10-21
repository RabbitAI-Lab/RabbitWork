/** STAFF-002 预置人设模板结构完整性（骨架四段 + 键唯一）。 */
import { describe, expect, it } from "vitest";
import { PERSONA_TEMPLATES, personaTemplateByKey } from "../persona-templates";

describe("PERSONA_TEMPLATES（STAFF-002）", () => {
  it("≥6 个预置模板,key 唯一", () => {
    expect(PERSONA_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const keys = PERSONA_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("每个模板四段完整且长度合规（personaPrompt≤20000 与 staffCreateInput 对齐）", () => {
    for (const t of PERSONA_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.personaPrompt.length).toBeGreaterThan(20);
      expect(t.personaPrompt.length).toBeLessThanOrEqual(20000);
      expect(t.boundary.length).toBeGreaterThan(0);
    }
  });

  it("按 key 查找命中/未命中", () => {
    expect(personaTemplateByKey("code-reviewer")?.title).toBe("代码评审员");
    expect(personaTemplateByKey("no-such")).toBeUndefined();
  });
});
