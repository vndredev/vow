/** kebab-case slug → PascalCase type/component name (`task` → `Task`, `audit-log` → `AuditLog`). */
export const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
