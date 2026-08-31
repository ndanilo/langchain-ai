import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createProgress } from "../../../src/lib/progress.js";

describe("createProgress", () => {
  let written: string[];
  let restore: () => void;

  beforeEach(() => {
    written = [];
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    restore = () => {
      process.stderr.write = original;
    };
  });

  afterEach(() => restore());

  it("writes nothing but logs when disabled", () => {
    const progress = createProgress(false);

    progress.step("generating");
    progress.done();

    assert.deepEqual(written, []);
  });

  it("still forwards log lines when disabled, so diagnostics work when redirected", () => {
    const progress = createProgress(false);

    progress.log("  generating image");

    assert.deepEqual(written, ["  generating image\n"]);
  });

  it("renders the label and elapsed seconds when enabled", () => {
    const progress = createProgress(true);
    progress.step("generating");
    progress.done();

    const output = written.join("");
    assert.match(output, /generating 0s/);
  });

  it("puts logged lines on their own line, then redraws the spinner", () => {
    const progress = createProgress(true);
    written.length = 0;

    progress.log("  saved image.png");
    progress.done();

    const output = written.join("");
    const logAt = output.indexOf("  saved image.png\n");
    const spinnerAt = output.indexOf("working 0s");

    assert.ok(logAt >= 0, "the log line is written");
    // The spinner is redrawn after the log line rather than being lost.
    assert.ok(spinnerAt > logAt, "the spinner is redrawn below the log line");
  });

  it("clears the line on done and tolerates being called twice", () => {
    const progress = createProgress(true);

    progress.done();
    const afterFirst = written.join("");
    progress.done();

    assert.match(afterFirst, /\u001b\[2K$/);
    assert.equal(written.join(""), afterFirst);
  });
});
