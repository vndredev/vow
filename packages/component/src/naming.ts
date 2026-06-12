/** Kebab-case slug to PascalCase type/component name (`task` -> `Task`, `audit-log` -> `AuditLog`). */
export const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/**
 * A camelCase field name to a human sentence-case label (`syncInterval` -> `Sync interval`). Splits on
 * each lowercase-to-uppercase boundary and on digit runs, lowercases the tail, and capitalizes the first
 * letter — so a generated label, placeholder, header, card row or validation message reads as copy, not
 * as a dev identifier. The field name is the only input (a camelCase identifier, never empty).
 */
export const humanizeFieldName = (name: string): string => {
  const words = name
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replaceAll(/([a-zA-Z])([0-9])/gu, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter((word) => word.length > 0);
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};
