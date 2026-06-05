# bind — hand-written

For the 10% that is real, eigenwillige logic — a calculation, a workflow, an integration — you don't generate it. You write it, and vow verifies the seam. This is the deliberate escape hatch: vow never tries to express imperative logic in Markdown.

```markdown
---
id: vow_invoicetotal
fulfills: bind ./logic/invoice-total.ts#computeTotal
---

# Invoice total with a 5% staggered discount from 10 units

## proves

- a discount applies from 10 units
- under 10 units there is no discount
```

The hand-written code lives **visibly** in `app/logic/` — it is the truth, not generated:

```ts
export function computeTotal(input: InvoiceInput): number {
  const gross = input.qty * input.unit;
  return input.qty >= 10 ? gross * 0.95 : gross;
}
```

vow generates a tiny **anchor** in `.generated/` that re-exports the bound symbol:

```ts
export { computeTotal } from "../app/logic/invoice-total.ts";
```

So **tsgo fails the build if the export is missing or renamed** — the `fulfills` declaration can't lie. You prove the behaviour with your own test, whose names are the vow's `## proves`, gated by [scenario-coverage](/guide/proof).

Next: [proof →](/guide/proof)
