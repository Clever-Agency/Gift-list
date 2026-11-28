import type { Meta, StoryObj } from "@storybook/react";
import type { PersonalDate } from "@gift-list/contracts";
import { PersonalDatesSection, type PersonalDateSaveResult } from "./personal-dates-section";

function date(overrides: Partial<PersonalDate> = {}): PersonalDate {
  return {
    id: "d1",
    kind: "CUSTOM",
    title: "Годовщина свадьбы",
    day: 14,
    month: 3,
    year: null,
    visibility: "FRIENDS",
    yearVisibility: "ONLY_ME",
    ...overrides,
  };
}

async function saved(): Promise<PersonalDateSaveResult> {
  return { ok: true };
}

async function removed(): Promise<boolean> {
  return true;
}

function noop() {}

const meta = {
  title: "App/PersonalDatesSection",
  component: PersonalDatesSection,
  tags: ["autodocs"],
  globals: { viewport: { value: "w360" } },
  parameters: { docs: { story: { inline: false, iframeHeight: "860px" } } },
  args: {
    dates: [
      date(),
      date({
        id: "d2",
        title: "День рождения мамы",
        day: 2,
        month: 9,
        year: 1958,
        visibility: "EVERYONE",
        yearVisibility: "FRIENDS",
      }),
    ],
    status: "ready",
    saving: false,
    onRetry: noop,
    onSave: saved,
    onDelete: removed,
  },
} satisfies Meta<typeof PersonalDatesSection>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The list: the title, the date (a year only when it is set) and both switches. */
export const Playground: Story = {};

/** No dates yet: one line of text and the add button. */
export const Empty: Story = {
  args: { dates: [] },
};

/** Ten dates: «Добавить дату» is blocked with the approved limit sentence. */
export const AtLimit: Story = {
  tags: ["!dev"],
  args: {
    dates: Array.from({ length: 10 }, function makeDate(_, index) {
      return date({ id: `d${index}`, title: `Дата ${index + 1}`, day: index + 1 });
    }),
  },
};

/** The read is in flight. */
export const Loading: Story = {
  tags: ["!dev"],
  args: { status: "loading", dates: [] },
};

/** The read failed: the sentence and «Повторить». */
export const LoadError: Story = {
  tags: ["!dev"],
  args: { status: "error", dates: [] },
};

/** The open form of a new date: every field, both switches and the defaults. */
export const CreateForm: Story = {
  tags: ["!dev"],
  play: openCreate,
};

/** The open form of a stored date, prefilled; the year switch is visible. */
export const EditForm: Story = {
  tags: ["!dev"],
  play: openEdit,
};

/** A save is in flight: the buttons keep their place and take no second press. */
export const Saving: Story = {
  tags: ["!dev"],
  args: { saving: true },
  play: openCreate,
};

/** The delete confirmation names the date and starts on the safe «Отмена». */
export const DeleteConfirm: Story = {
  tags: ["!dev"],
  play: openDelete,
};

function findButton(root: HTMLElement, label: string, startsWith = false): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>("button")).find((node) => {
    const name = node.getAttribute("aria-label") ?? "";
    return startsWith ? name.startsWith(label) : name === label;
  });
}

function openCreate({ canvasElement }: { canvasElement: HTMLElement }) {
  findButton(canvasElement, "Добавить дату")?.click();
}

function openEdit({ canvasElement }: { canvasElement: HTMLElement }) {
  findButton(canvasElement, "Изменить дату", true)?.click();
}

function openDelete({ canvasElement }: { canvasElement: HTMLElement }) {
  findButton(canvasElement, "Удалить дату", true)?.click();
}
