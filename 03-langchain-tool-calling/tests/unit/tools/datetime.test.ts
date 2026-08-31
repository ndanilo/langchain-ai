import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentDateTimeTool } from "../../../src/tools/datetime.js";

describe("get_current_datetime", () => {
  it("exposes a snake_case name and a schema the model can fill", () => {
    assert.equal(currentDateTimeTool.name, "get_current_datetime");
    assert.ok(currentDateTimeTool.description.length > 0);
  });

  it("returns an ISO timestamp when no time zone is given", async () => {
    const raw = await currentDateTimeTool.invoke({});
    const parsed = JSON.parse(raw as string);

    assert.equal(parsed.timeZone, "UTC");
    assert.ok(!Number.isNaN(Date.parse(parsed.iso)));
  });

  it("localises to a requested IANA time zone", async () => {
    const raw = await currentDateTimeTool.invoke({ timeZone: "America/Sao_Paulo" });
    const parsed = JSON.parse(raw as string);

    assert.equal(parsed.timeZone, "America/Sao_Paulo");
    assert.ok(parsed.local.length > 0);
  });

  it("reports bad time zones back to the model instead of throwing", async () => {
    const raw = await currentDateTimeTool.invoke({ timeZone: "Mars/Olympus_Mons" });

    assert.match(raw as string, /Unknown time zone/);
  });
});
