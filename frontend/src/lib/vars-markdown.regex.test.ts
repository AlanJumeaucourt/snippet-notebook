import { expect, test } from "vite-plus/test";
import { formatVarLine, parseVarLine, updateVarValue } from "./vars-markdown";

test("regex var keeps pattern after selection", () => {
  const doc = [
    "```vars global",
    "kentika_int_s3ns_project_id:s3ns:tpc-prj-5gdikdye-2511190856",
    "got_int_s3ns_project_id:your-s3ns-project-id",
    "```",
    "",
    "```vars",
    "s3ns_project_id = name:/_int_s3ns_project_id$/",
    "```",
    "",
    "```bash",
    "export PROJECT_ID='{{s3ns_project_id}}'",
    "```",
  ].join("\n");

  const blockStart = doc.split("\n").indexOf("```bash");
  const updated = updateVarValue(
    doc,
    "local",
    "s3ns_project_id",
    "s3ns:tpc-prj-5gdikdye-2511190856",
    blockStart,
  );
  const varsLine = updated.split("\n").find((l) => l.startsWith("s3ns_project_id"));
  expect(varsLine).toBe(
    "s3ns_project_id = s3ns:tpc-prj-5gdikdye-2511190856 | name:/_int_s3ns_project_id$/",
  );

  const reparsed = parseVarLine(varsLine!);
  expect(reparsed?.config.regex).toBe("_int_s3ns_project_id$");
  expect(reparsed?.config.regexTarget).toBe("name");
  expect(reparsed?.config.value).toBe("s3ns:tpc-prj-5gdikdye-2511190856");
  expect(reparsed?.config.options).toEqual([]);
});

test("colon syntax regex parses and formats as equals", () => {
  const parsed = parseVarLine("s3ns_project_id: name:/_int_s3ns_project_id$/");
  expect(parsed?.config.regex).toBe("_int_s3ns_project_id$");
  expect(formatVarLine("s3ns_project_id", parsed!.config)).toBe(
    "s3ns_project_id = name:/_int_s3ns_project_id$/",
  );
});

test("stale expanded options in file are ignored on parse", () => {
  const line =
    "s3ns_project_id = your-s3ns-project-id | name:/_int_s3ns_project_id$/, got_int_s3ns_project_id:your-s3ns-project-id, kentika_int_s3ns_project_id:s3ns:tpc-prj-5gdikdye-2511190856";
  const parsed = parseVarLine(line);
  expect(parsed?.config.options).toEqual([]);
  expect(parsed?.config.value).toBe("your-s3ns-project-id");
  expect(formatVarLine("s3ns_project_id", parsed!.config)).toBe(
    "s3ns_project_id = your-s3ns-project-id | name:/_int_s3ns_project_id$/",
  );
});
