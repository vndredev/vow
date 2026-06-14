import {
  PRIMITIVE_ADAPTERS,
  emitBadgeSfc,
  emitButtonSfc,
  emitCalloutSfc,
  emitCardBodySfc,
  emitCardHeaderSfc,
  emitCardSfc,
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitFieldSfc,
  emitRadioGroupSfc,
  emitSelectSfc,
  emitStatSfc,
  emitStatsSfc,
  emitSwitchSfc,
  emitTableCellSfc,
  emitTableHeadSfc,
  emitTableRowSfc,
  emitTableSfc,
  emitTabsSfc,
} from "@vow/emit-primitive";
import type { Demo } from "./types.ts";

/** The generated layout SFC — forwards the frontmatter-derived sidebar to @vow/docs's Layout. */
export const LAYOUT_SFC = [
  `<script setup lang="ts">`,
  `import Layout from "@vow/docs/Layout.vue";`,
  `import { config, search, sidebar, tocByPath } from "./vow-docs.routes.ts";`,
  `import "@vow/docs/style.css";`,
  `defineProps<{ path: string }>();`,
  `</script>`,
  ``,
  `<template>`,
  `  <Layout :config="config" :groups="sidebar" :toc-by-path="tocByPath" :search="search" :path="path"><slot /></Layout>`,
  `</template>`,
  ``,
].join("\n");

/** The CodeGroup component a `::: code-group` renders to — a tablist over its panels (the slot
    children, one per fence), showing the active one. Materialised into .generated when referenced. */
const CODE_GROUP_SFC = [
  `<script setup lang="ts">`,
  `import { type Component, computed, ref, useSlots } from "vue";`,
  `defineProps<{ labels: string[] }>();`,
  `const slots = useSlots();`,
  `const active = ref(0);`,
  `const panel = computed<Component>(() => () => slots.default?.()[active.value] ?? null);`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-code-group">`,
  `    <div class="vow-code-group__tabs" role="tablist">`,
  `      <button`,
  `        v-for="(label, i) in labels"`,
  `        :key="i"`,
  `        type="button"`,
  `        role="tab"`,
  `        :aria-selected="i === active"`,
  `        class="vow-code-group__tab"`,
  `        :class="{ 'is-active': i === active }"`,
  `        @click="active = i"`,
  `      >`,
  `        {{ label }}`,
  `      </button>`,
  `    </div>`,
  `    <component :is="panel" />`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

/** Prose-components @vow/docs materialises into .generated when a page references them. */
export const PROSE_COMPONENTS: Record<string, string> = { CodeGroup: CODE_GROUP_SFC };

/** Live primitive demos a `::: demo <X>` renders to — a wrapper around the generated adapter. */
const DEMO_CHECKBOX = `<script setup lang="ts">
import { ref } from "vue";
import Checkbox from "./Checkbox.vue";
const done = ref(false);
const subscribed = ref(true);
</script>

<template>
  <div class="vow-demo">
    <Checkbox v-model="done" label="Mark as done" />
    <Checkbox v-model="subscribed" label="Subscribe to updates" />
    <Checkbox :model-value="false" label="Locked (disabled)" disabled />
  </div>
</template>
`;

const DEMO_COLLAPSIBLE = `<script setup lang="ts">
import { ref } from "vue";
import Collapsible from "./Collapsible.vue";
const open = ref(true);
</script>

<template>
  <div class="vow-demo">
    <Collapsible v-model="open" label="What is a vow?">
      A vow is a promise the app makes — intent, shape, proof — and vow keeps it by generating
      type-safe code that a test holds to account.
    </Collapsible>
  </div>
</template>
`;

const DEMO_TABS = `<script setup lang="ts">
import { ref } from "vue";
import Tabs from "./Tabs.vue";
const active = ref("Vue");
const items = ["Vue", "React", "Solid"];
</script>

<template>
  <div class="vow-demo">
    <Tabs v-model="active" :items="items">
      <template #Vue>The Vue adapter ships today.</template>
      <template #React>The React adapter is on the roadmap.</template>
      <template #Solid>The Solid adapter is on the roadmap.</template>
    </Tabs>
  </div>
</template>
`;

const DEMO_DIALOG = `<script setup lang="ts">
import { ref } from "vue";
import Dialog from "./Dialog.vue";
const open = ref(false);
</script>

<template>
  <div class="vow-demo">
    <button type="button" class="vow-demo__trigger" @click="open = true">Open dialog</button>
    <Dialog v-model="open" title="A dialog">
      A modal dialog — focus is trapped, Esc or the close button dismisses it.
    </Dialog>
  </div>
</template>
`;

const DEMO_SELECT = `<script setup lang="ts">
import { ref } from "vue";
import Select from "./Select.vue";
const value = ref("todo");
const options = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];
</script>

<template>
  <div class="vow-demo">
    <Select v-model="value" :options="options" label="Status" />
  </div>
</template>
`;

const DEMO_BUTTON = `<script setup lang="ts">
import Button from "./Button.vue";
</script>

<template>
  <div class="vow-demo">
    <div class="vow-demo__row">
      <Button label="Solid" />
      <Button label="Soft" variant="soft" />
      <Button label="Outline" variant="outline" />
      <Button label="Ghost" variant="ghost" />
      <Button label="Link" variant="link" />
    </div>
    <div class="vow-demo__row">
      <Button label="Accent" tone="accent" />
      <Button label="Success" tone="success" />
      <Button label="Warning" tone="warning" />
      <Button label="Danger" tone="danger" variant="outline" />
    </div>
    <div class="vow-demo__row">
      <Button label="Extra small" size="xs" />
      <Button label="Small" size="sm" />
      <Button label="Medium" />
      <Button label="Large" size="lg" />
      <Button label="Extra large" size="xl" />
    </div>
    <div class="vow-demo__row">
      <Button label="Add task" icon="plus" />
      <Button label="Edit" icon="pencil" variant="outline" />
      <Button label="Delete" icon="trash" tone="danger" variant="ghost" />
      <Button label="Compact" density="compact" />
    </div>
  </div>
</template>
`;

const DEMO_FIELD = `<script setup lang="ts">
import { ref } from "vue";
import Field from "./Field.vue";
const name = ref("");
</script>

<template>
  <div class="vow-demo">
    <Field label="Project name" control-id="demo-name" description="Shown across your dashboard.">
      <input id="demo-name" class="vow-input" v-model="name" placeholder="Acme Inc." />
    </Field>
    <Field label="Work email" control-id="demo-email" error="Enter a valid email address.">
      <input id="demo-email" class="vow-input" value="not-an-email" aria-invalid="true" aria-describedby="demo-email-error" />
    </Field>
  </div>
</template>
`;

const DEMO_SWITCH = `<script setup lang="ts">
import { ref } from "vue";
import Switch from "./Switch.vue";
const notifications = ref(true);
const sync = ref(false);
</script>

<template>
  <div class="vow-demo">
    <Switch v-model="notifications" label="Notifications" />
    <Switch v-model="sync" label="Background sync" />
    <Switch :model-value="false" label="Locked (disabled)" disabled />
  </div>
</template>
`;

const DEMO_RADIO = `<script setup lang="ts">
import { ref } from "vue";
import RadioGroup from "./RadioGroup.vue";
const status = ref("doing");
const options = ["todo", "doing", "done"];
</script>

<template>
  <div class="vow-demo">
    <RadioGroup v-model="status" :options="options" label="Status" />
  </div>
</template>
`;

const DEMO_BADGE = `<script setup lang="ts">
import Badge from "./Badge.vue";
</script>

<template>
  <div class="vow-demo">
    <div class="vow-demo__row">
      <Badge label="Backlog" />
      <Badge label="In review" tone="accent" />
      <Badge label="Done" tone="success" icon="check" />
      <Badge label="At risk" tone="warning" />
      <Badge label="Blocked" tone="danger" icon="close" />
    </div>
    <div class="vow-demo__row">
      <Badge label="Soft" tone="accent" />
      <Badge label="Outline" tone="accent" variant="outline" />
      <Badge label="Solid" tone="accent" variant="solid" />
    </div>
  </div>
</template>
`;

const DEMO_TABLE = `<script setup lang="ts">
import Table from "./Table.vue";
import TableRow from "./TableRow.vue";
import TableHead from "./TableHead.vue";
import TableCell from "./TableCell.vue";
import Badge from "./Badge.vue";
const rows = [
  { task: "Fix the login flow", status: "blocked", tone: "warning" },
  { task: "Ship the timeline", status: "done", tone: "success" },
  { task: "Draft the board", status: "todo", tone: "neutral" },
];
</script>

<template>
  <div class="vow-demo">
    <Table>
      <thead>
        <TableRow>
          <TableHead scope="col">Task</TableHead>
          <TableHead scope="col">Status</TableHead>
        </TableRow>
      </thead>
      <tbody>
        <TableRow v-for="r in rows" :key="r.task">
          <TableCell>{{ r.task }}</TableCell>
          <TableCell><Badge :label="r.status" :tone="r.tone" /></TableCell>
        </TableRow>
      </tbody>
    </Table>
  </div>
</template>
`;

const DEMO_CARD = `<script setup lang="ts">
import Card from "./Card.vue";
import CardHeader from "./CardHeader.vue";
import CardBody from "./CardBody.vue";
import Badge from "./Badge.vue";
</script>

<template>
  <div class="vow-demo">
    <Card>
      <CardHeader>
        Fix the login flow
        <Badge label="blocked" tone="warning" />
      </CardHeader>
      <CardBody>A user can't sign in after the redirect — the session is dropped.</CardBody>
    </Card>
  </div>
</template>
`;

const DEMO_STATS = `<script setup lang="ts">
import Stats from "./Stats.vue";
import Stat from "./Stat.vue";
</script>

<template>
  <div class="vow-demo">
    <Stats>
      <Stat :value="12" label="Open" />
      <Stat :value="34" label="Done" />
      <Stat :value="3" label="Blocked" />
    </Stats>
  </div>
</template>
`;

const DEMO_CALLOUT = `<script setup lang="ts">
import Callout from "./Callout.vue";
</script>

<template>
  <div class="vow-demo">
    <Callout variant="tip" title="Tip">A table is just composable parts — compose what you need.</Callout>
    <Callout variant="warning" title="Heads up">The board writes a drag straight back to the vow.</Callout>
  </div>
</template>
`;

/** `::: demo <X>` → the VowDemo<X> component; @vow/docs materialises the wrapper + the adapter. */
export const DEMOS: Record<string, Demo> = {
  VowDemoBadge: { adapter: "Badge", emit: emitBadgeSfc, sfc: DEMO_BADGE },
  VowDemoButton: { adapter: "Button", emit: emitButtonSfc, sfc: DEMO_BUTTON },
  VowDemoCallout: { adapter: "Callout", emit: emitCalloutSfc, sfc: DEMO_CALLOUT },
  VowDemoCard: {
    adapter: "Card",
    also: [
      { emit: emitCardHeaderSfc, name: "CardHeader" },
      { emit: emitCardBodySfc, name: "CardBody" },
      { emit: emitBadgeSfc, name: "Badge" },
    ],
    emit: emitCardSfc,
    sfc: DEMO_CARD,
  },
  VowDemoCheckbox: { adapter: "Checkbox", emit: emitCheckboxSfc, sfc: DEMO_CHECKBOX },
  VowDemoCollapsible: { adapter: "Collapsible", emit: emitCollapsibleSfc, sfc: DEMO_COLLAPSIBLE },
  VowDemoDialog: { adapter: "Dialog", emit: emitDialogSfc, sfc: DEMO_DIALOG },
  VowDemoField: { adapter: "Field", emit: emitFieldSfc, sfc: DEMO_FIELD },
  VowDemoRadio: { adapter: "RadioGroup", emit: emitRadioGroupSfc, sfc: DEMO_RADIO },
  VowDemoSelect: { adapter: "Select", emit: emitSelectSfc, sfc: DEMO_SELECT },
  VowDemoStats: {
    adapter: "Stats",
    also: [{ emit: emitStatSfc, name: "Stat" }],
    emit: emitStatsSfc,
    sfc: DEMO_STATS,
  },
  VowDemoSwitch: { adapter: "Switch", emit: emitSwitchSfc, sfc: DEMO_SWITCH },
  VowDemoTable: {
    adapter: "Table",
    also: [
      { emit: emitTableRowSfc, name: "TableRow" },
      { emit: emitTableHeadSfc, name: "TableHead" },
      { emit: emitTableCellSfc, name: "TableCell" },
      { emit: emitBadgeSfc, name: "Badge" },
    ],
    emit: emitTableSfc,
    sfc: DEMO_TABLE,
  },
  VowDemoTabs: { adapter: "Tabs", emit: emitTabsSfc, sfc: DEMO_TABS },
};

/** Primitive adapters a page may reference directly — the closed registry from @vow/emit-primitive
 *  (one source of truth, shared with the `## view` vocabulary). A markdown task list (`- [x]`) renders
 *  <Checkbox>; prose can use any primitive by name. */
export const PRIMITIVES = PRIMITIVE_ADAPTERS;
