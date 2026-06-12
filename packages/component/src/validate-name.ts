/**
 * Identifier guards for emitted names that land in expression/name position — the seam where raw
 * author/LLM `## view` input becomes generated code. A bound attribute renders as `:<name>="<expr>"`
 * and an object-literal key as `<key>: <value>`; both put the name OUTSIDE a quoted string, so an
 * unconstrained one can break out (a key like `'a }; alert(1); ({'` runs on render, a name like
 * `'class="x" @click'` forges a real directive). These guards reject any name that does not match the
 * safe shape BEFORE it is rendered, mirroring the value-escaping defense (#283/#299) on the name path.
 */

/** A JS object-literal key: an identifier (`[A-Za-z_$]` then word/`$`), never an expression breakout. */
const OBJECT_KEY = /^[A-Za-z_$][\w$]*$/u;

/** An HTML/directive attribute name: a letter, then letters, digits, `-`, `:`, `.` (e.g. `aria-label`). */
const ATTR_NAME = /^[A-Za-z][\w.:-]*$/u;

/** Reject an object-literal key that is not a bare identifier — it would break out of the literal. */
export function assertObjectKey(key: string): void {
  if (!OBJECT_KEY.test(key)) {
    throw new Error(
      `component: object key "${key}" is not a safe identifier (expected ${OBJECT_KEY.source})`,
    );
  }
}

/** Reject an attribute name carrying anything but letters, digits, `-`, `:`, `.` — it would break out. */
export function assertAttrName(name: string): void {
  if (!ATTR_NAME.test(name)) {
    throw new Error(
      `component: attribute name "${name}" is not a safe attribute name (expected ${ATTR_NAME.source})`,
    );
  }
}
