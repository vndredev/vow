---
group: UI
order: 3.6
---

# Field

A **structural** form field — a label over its control, with an optional description and a live error. Like [Button](/guide/primitives/button), it has **no headless core**: there's no interaction to prove, only markup and the a11y wiring that ties a label to its control and an error to a screen reader. It's what a [`## form`](/guide/emit) wraps every field in.

## See it run

::: demo field
:::

The second field shows the error state — the message is a `role="alert"` live region, announced the moment it appears.

## How the wiring works

The control is the default **slot**. The caller (a form) owns the control's id and passes it as `controlId`, so the `<label for>` and the control's `id` line up — one click on the label focuses the control, one id shared by both:

```vue
<Field label="Project name" control-id="proj" :error="errors.name">
  <input id="proj" class="vow-input" v-model="draft.name" aria-describedby="proj-error" />
</Field>
```

The error renders as `<p class="vow-field__error" id="<controlId>-error" role="alert">`, so the control's `aria-describedby` can point at it. `description` and `error` only render when present (`v-if`).

## Props

| Prop          | Type                | Purpose                                         |
| ------------- | ------------------- | ----------------------------------------------- |
| `label`       | `string`            | the visible label, tied to the control by `for` |
| `controlId`   | `string`            | the control's id — shared with `<label for>`    |
| `description` | `string` (optional) | helper text under the label                     |
| `error`       | `string` (optional) | a `role="alert"` message; absent → not rendered |

## Styling hooks

| Hook                | Where           | Means                             |
| ------------------- | --------------- | --------------------------------- |
| `.vow-field`        | the wrapper     | a column: label · control · error |
| `.vow-field__label` | the `<label>`   | the field label                   |
| `.vow-field__desc`  | the desc `<p>`  | helper text                       |
| `.vow-field__error` | the error `<p>` | the live error message            |

## No a11y core — on purpose

Field is structural — there is no `@vow/headless` logic and no `*.a11y.test.ts`. Its accessibility is the markup it emits: a `for`-associated label and a `role="alert"` error region. The control inside the slot brings its own semantics (a native `<input>`, or a [Checkbox](/guide/primitives/checkbox) / [Select](/guide/primitives/select) that proves its own a11y). See [primitives](/guide/primitives).
