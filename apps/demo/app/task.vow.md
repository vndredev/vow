---
id: vow_task
fulfills: emit entity
kind: entity
---

# Eine Aufgabe, die jemand erledigen muss

## fields

- title: text, required
- done: boolean

## proves

- eine gültige Aufgabe entsteht aus ihren Pflichtfeldern
- eine Aufgabe ohne Titel wird abgelehnt
