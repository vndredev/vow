/** Kebab-case slug to PascalCase type/component name (`task` -> `Task`, `audit-log` -> `AuditLog`). */
export const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
