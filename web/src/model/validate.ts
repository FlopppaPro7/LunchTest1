/**
 * Data model layer — validation.
 *
 * Validates that a parsed object is a plausible rbxflow document *before* the
 * normalizer runs. Produces friendly, specific errors (as the spec requires).
 */

import type { RawDocument } from "./types";

export const RBXFLOW_FORMAT = "rbxflow";
/** Highest schema version this build understands. Newer major = refuse. */
export const SUPPORTED_VERSION = 1;

export class RbxflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RbxflowValidationError";
  }
}

/**
 * Throws {@link RbxflowValidationError} with a human-readable message when the
 * document is not a valid rbxflow file. Returns the value typed as RawDocument
 * on success.
 */
export function validateDocument(data: unknown): RawDocument {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new RbxflowValidationError(
      "The file does not contain a JSON object.\n\nExpected a top-level rbxflow document."
    );
  }

  const doc = data as Record<string, unknown>;

  if (!("format" in doc)) {
    throw new RbxflowValidationError(
      'Invalid RBXFlow file.\n\nExpected:\n  format = "rbxflow"\n\nFound:\n  (no "format" field)'
    );
  }

  if (doc.format !== RBXFLOW_FORMAT) {
    throw new RbxflowValidationError(
      `Invalid RBXFlow file.\n\nExpected:\n  format = "rbxflow"\n\nFound:\n  format = ${JSON.stringify(
        doc.format
      )}`
    );
  }

  if (typeof doc.version !== "number" || !Number.isFinite(doc.version)) {
    throw new RbxflowValidationError(
      `Invalid RBXFlow file.\n\nExpected:\n  version = <number>\n\nFound:\n  version = ${JSON.stringify(
        doc.version
      )}`
    );
  }

  if (doc.version > SUPPORTED_VERSION) {
    throw new RbxflowValidationError(
      `This RBXFlow file was made with a newer format.\n\nFile version: ${doc.version}\nThis app supports up to: ${SUPPORTED_VERSION}\n\nUpdate RBXFlow, or re-export with an older scanner.`
    );
  }

  // Array-typed fields, when present, must actually be arrays.
  for (const key of [
    "instances",
    "scripts",
    "remotes",
    "events",
    "functions",
    "relationships",
    "warnings",
  ]) {
    if (key in doc && doc[key] !== undefined && !Array.isArray(doc[key])) {
      throw new RbxflowValidationError(
        `Invalid RBXFlow file.\n\nField "${key}" must be an array, but found ${typeof doc[
          key
        ]}.`
      );
    }
  }

  return doc as unknown as RawDocument;
}
