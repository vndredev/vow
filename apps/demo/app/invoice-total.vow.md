---
id: vow_invoicetotal
fulfills: bind ./logic/invoice-total.ts#computeTotal
---

# Rechnungssumme mit 5% Staffelrabatt ab 10 Stück

## proves

- ab 10 Stück greift der Rabatt
- unter 10 Stück gibt es keinen Rabatt
