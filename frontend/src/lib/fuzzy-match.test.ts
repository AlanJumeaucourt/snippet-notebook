import { expect, test } from "vite-plus/test";
import { fuzzyFilterOptions, fuzzyScore } from "./fuzzy-match";

test("fuzzyScore matches subsequence", () => {
  expect(fuzzyScore("kiprd", "kentika_prd_s3ns_project_id")).not.toBeNull();
  expect(fuzzyScore("zzz", "kentika_int_s3ns_project_id")).toBeNull();
});

test("fuzzyFilterOptions ranks by label and value", () => {
  const options = [
    { label: "kentika_int_s3ns_project_id", value: "s3ns:tpc-prj-5gdikdye" },
    { label: "rpa_int_s3ns_project_id", value: "s3ns:tpc-prj-zjhgvp8x" },
    { label: "got_int_s3ns_project_id", value: "your-s3ns-project-id" },
  ];
  const filtered = fuzzyFilterOptions(options, "rpa int");
  expect(filtered[0]?.label).toBe("rpa_int_s3ns_project_id");
});

test("empty query returns all options in order", () => {
  const options = [
    { label: "a", value: "1" },
    { label: "b", value: "2" },
  ];
  expect(fuzzyFilterOptions(options, "")).toEqual(options);
  expect(fuzzyFilterOptions(options, "   ")).toEqual(options);
});
