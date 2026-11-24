/** a concept's name */

const unquote = (text: string): string => text.trim().replace(/^(["'])(.*)\1$/s, '$2').trim();

/** a concept's name without its [[brackets]] */
export function bare(text: string): string {
  return unquote(text).replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
}

/** a concept's name as prose: no brackets, dashes and underscores as spaces */
export function spoken(text: string): string {
  return bare(text).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}
