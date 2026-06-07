---
id: vow_invoicetotal
fulfills: bind ./invoice-total.ts#computeTotal
---

# Invoice total with a 5% staggered discount from 10 units

## proves

- a discount applies from 10 units
- under 10 units there is no discount
