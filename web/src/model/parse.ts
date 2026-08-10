/**
 * Data model layer — parse.
 *
 * Turns raw text (from a file or drop) into a validated RawDocument. Kept
 * separate from normalization so the source of the text doesn't matter.
 */

import { validateDocument } from "./validate";
import type { RawDocument } from "./types";

export function parseText(text: string): RawDocument {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`The file is not valid JSON.\n\n${msg}`);
  }
  return validateDocument(data);
}

export async function parseFile(file: File): Promise<RawDocument> {
  const text = await file.text();
  return parseText(text);
}
