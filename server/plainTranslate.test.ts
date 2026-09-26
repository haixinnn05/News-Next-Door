import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGtx } from "./services/plainTranslate.ts";

test("parseGtx joins translated headline chunks", () => {
  assert.equal(parseGtx([[["Una parada de metro nueva en Queens", "A new subway stop in Queens"]]]), "Una parada de metro nueva en Queens");
  assert.equal(
    parseGtx([
      [
        ["Los pasajeros ", "Riders "],
        ["tendrán una estación nueva.", "will get a new station."],
      ],
    ]),
    "Los pasajeros tendrán una estación nueva.",
  );
  assert.equal(parseGtx(null), "");
});
