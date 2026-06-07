---
id: vow_landing
fulfills: emit view
---

# The vow starter landing

## tree

- Container(size=3)
  - Flex(direction=column, gap=7)
    - Flex(direction=column, gap=3)
      - span
        - "vow"
      - h1
        - "The spec-driven framework for Vue"
      - p
        - "Your app is a promise — a vow. You write the intent; vow generates a type-safe Vue app you own, and proves it kept the promise."
    - Grid(columns=3, gap=4)
      - Box(p=5)
        - h3
          - "Vows, not a codebase"
        - p
          - "You write .vow.md — intent, shape, proof. The visible app/ folder is your truth; generated code lives in .generated/ and is never the source."
      - Box(p=5)
        - h3
          - "emit or bind"
        - p
          - "Generated where it's deterministic (entities, views, layout); your own typed code where it isn't — both checked by the compiler."
      - Box(p=5)
        - h3
          - "Proven, not claimed"
        - p
          - "Every promised scenario must have a green test. The scenario-coverage gate turns an unproven claim red."
