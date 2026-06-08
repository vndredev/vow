/** Hand-written logic, bound by vow "task-summary" — the escape hatch (vow doesn't generate this). */
export interface TaskLike {
  done: boolean;
}

/** A short progress summary of a task list: how many are done out of the total. */
export function summarise(tasks: readonly TaskLike[]): string {
  const done = tasks.filter((t) => t.done).length;
  return `${done} of ${tasks.length} done`;
}
