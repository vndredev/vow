---
id: vow_showcase
fulfills: emit view
---

# The vow layout showcase

## tree

- Container(size=2)
  - Flex(direction=column, gap=6)
    - "vow layout"
    - "Flex — a row of boxes with a gap"
    - Flex(gap=3)
      - Box(p=4)
        - "one"
      - Box(p=4)
        - "two"
      - Box(p=4)
        - "three"
    - "Grid — three equal columns"
    - Grid(columns=3, gap=3)
      - Box(p=4)
        - "A"
      - Box(p=4)
        - "B"
      - Box(p=4)
        - "C"
    - "A view generated from a vow"
    - slot
