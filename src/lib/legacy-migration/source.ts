import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { readCsvObjects } from "./csv";
import { sha256 } from "./normalize";
import type { LegacyFileName, LoadedLegacySources } from "./types";

const REQUIRED_FILES: LegacyFileName[] = [
  "teachers_rows.csv",
  "students_rows.csv",
  "session_records_rows.csv",
];

const OPTIONAL_FILES: LegacyFileName[] = [
  "camp_teachers_rows.csv",
  "sessions_rows.csv",
  "exams_rows.csv",
  "official_exams_rows.csv",
  "student_transfer_log_rows.csv",
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function loadLegacySources(inputDir: string): Promise<LoadedLegacySources> {
  const files: LoadedLegacySources["files"] = {};
  const hashes: LoadedLegacySources["hashes"] = {};
  const missingOptionalFiles: LegacyFileName[] = [];

  for (const fileName of [...REQUIRED_FILES, ...OPTIONAL_FILES]) {
    const filePath = path.join(inputDir, fileName);
    const present = await exists(filePath);
    if (!present) {
      if (REQUIRED_FILES.includes(fileName)) {
        throw new Error(`Required legacy file is missing: ${filePath}`);
      }
      missingOptionalFiles.push(fileName);
      continue;
    }

    const raw = await readFile(filePath);
    hashes[fileName] = sha256(raw);
    files[fileName] = await readCsvObjects(filePath);
  }

  const fingerprint = sha256(
    Object.entries(hashes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([fileName, hash]) => `${fileName}:${hash}`)
      .join("\n"),
  );

  return { inputDir, files, hashes, missingOptionalFiles, fingerprint };
}
