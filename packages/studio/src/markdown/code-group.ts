/** A `::: code-group … :::` block (its inner content is fenced code blocks, each with a `[label]`). */
const CODE_GROUP = /^::: code-group[^\n]*\n([\s\S]*?)\n::: *$/gm;

/** One fenced block inside a group: the fence, its info string, and the body. */
const FENCE = /(`{3,})([^\n]*)\n([\s\S]*?)\n\1[^\n]*/g;

/**
 * Turn `::: code-group` into a `<Tabs>` over the fenced blocks — each block's `[label]` becomes a tab
 * and its (still-highlighted) code a panel, addressed by a dynamic named slot. Runs before markdown-it
 * so the inner fences are highlighted normally; needs to see the inner fences, so it does NOT use the
 * outside-fences helper.
 */
export function transformCodeGroups(src: string): string {
  return src.replace(CODE_GROUP, (_match, inner: string) => {
    const labels: string[] = [];
    const panels: string[] = [];
    FENCE.lastIndex = 0;
    for (let m = FENCE.exec(inner); m !== null; m = FENCE.exec(inner)) {
      const fence = m[1] ?? "```";
      const info = m[2] ?? "";
      const body = m[3] ?? "";
      const lang = info.trim().split(/\s+/)[0] ?? "";
      const label = /\[([^\]]+)\]/.exec(info)?.[1]?.trim() ?? lang ?? `tab ${labels.length + 1}`;
      labels.push(label);
      panels.push(
        `<template #[\`${label}\`]>\n\n${fence}${info}\n${body}\n${fence}\n\n</template>`,
      );
    }
    return `<Tabs :items='${JSON.stringify(labels)}'>\n${panels.join("\n")}\n</Tabs>`;
  });
}
