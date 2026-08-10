/**
 * Minimal Luau syntax highlighter for relationship source snippets.
 *
 * Deliberately dependency-free and lightweight — it tokenizes just enough
 * (comments, strings, numbers, keywords, Roblox globals, calls) to make a
 * one-to-few-line snippet readable. Returns safe HTML (input is escaped).
 */

import { escapeHtml } from "./dom";

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true",
  "until", "while", "continue", "export", "type",
]);

const GLOBALS = new Set([
  "game", "workspace", "script", "require", "wait", "task", "print", "warn",
  "Instance", "Enum", "Vector3", "CFrame", "UDim2", "Color3", "self",
]);

export function highlightLuau(code: string): string {
  // Token regex: comments, strings, numbers, identifiers, everything else.
  const re =
    /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\s])/g;

  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const [, comment, str, num, ident, ws, other] = m;
    if (comment !== undefined) out += span("cmt", comment);
    else if (str !== undefined) out += span("str", str);
    else if (num !== undefined) out += span("num", num);
    else if (ident !== undefined) {
      if (KEYWORDS.has(ident)) out += span("kw", ident);
      else if (GLOBALS.has(ident)) out += span("glob", ident);
      else out += span("id", ident);
    } else if (ws !== undefined) out += escapeHtml(ws);
    else if (other !== undefined) out += span("punc", other);
  }
  return out;
}

function span(cls: string, text: string): string {
  return `<span class="tok-${cls}">${escapeHtml(text)}</span>`;
}
