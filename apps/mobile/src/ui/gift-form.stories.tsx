import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { Button, YStack } from "@gift-list/ui";
import { GiftForm } from "./gift-form";
import type { TagCatalogState } from "./use-tag-catalog";

/**
 * The create/edit wish form (`EXPERIENCE.md` → Форма желания, `DESIGN.md` → Форма):
 * title, description, optional link, optional price with its currency, visibility,
 * quantity and the tag picker. Validation runs on submit, not while typing; the
 * first invalid field takes focus and is announced.
 *
 * The copy is the app's own catalogue (`use-intl`), and the fixed tags are the
 * server catalogue fixture below — the form never keeps fixed-tag captions.
 */
function noop() {}

const TAG_CATALOG: TagCatalogState = {
  status: "ready",
  tags: [
    { id: "tag-home", slug: "home", label: "Дом" },
    { id: "tag-cozy", slug: "cozy", label: "Уют" },
    { id: "tag-winter", slug: "winter", label: "Зима" },
    { id: "tag-books", slug: "books", label: "Книги" },
    { id: "tag-travel", slug: "travel", label: "Путешествия" },
  ],
};

/** The form is long and owns the page width: the frame only gives it the gutter. */
function FormFrame(props: ComponentProps<typeof GiftForm>) {
  return (
    <YStack width={328} paddingVertical="$4">
      <GiftForm {...props} />
    </YStack>
  );
}

FormFrame.displayName = "FormFrame";

const meta = {
  title: "App/GiftForm",
  component: GiftForm,
  parameters: { layout: "fullscreen" },
  args: {
    submitting: false,
    onSubmit: noop,
    submitLabel: "Добавить желание",
    tagCatalog: TAG_CATALOG,
  },
  render: FormFrame,
} satisfies Meta<typeof GiftForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A new wish: every field empty, «Добавить желание» at the bottom. */
export const CreateEmpty: Story = {
  globals: { viewport: { value: "w360" } },
};

/** Editing an existing wish: the values are prefilled once and the draft is tracked. */
export const EditPrefilled: Story = {
  args: {
    submitLabel: "Сохранить",
    initialValues: {
      title: "Плед из шерсти мериноса",
      description: "Тёплый, 200 × 140, цвет — овсяный.",
      link: "https://market.example.com/pled",
      priceAmount: 250000,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
      quantity: "SINGLE",
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { catalogId: "tag-cozy", label: "Уют" },
        { text: "На день рождения" },
      ],
    },
  },
  globals: { viewport: { value: "w360" } },
};

/** Field errors come from the form's own submit: the story presses «Добавить желание». */
export const ValidationErrors: Story = {
  play: pressSubmit,
  globals: { viewport: { value: "w360" } },
};

function pressSubmit({ canvasElement }: { canvasElement: HTMLElement }) {
  const submit = canvasElement.querySelector<HTMLElement>("button[aria-label='Добавить желание']");
  submit?.click();
}

/** A server rejection names one field: the error lands under it and focus moves there. */
export const ServerFieldError: Story = {
  args: {
    initialValues: {
      title: "Плед из шерсти мериноса",
      link: "не-ссылка",
    },
    serverError: { field: "link", message: "VALIDATION" },
  },
  globals: { viewport: { value: "w360" } },
};

/** A rejection without a field is shown above the submit button. */
export const FormLevelError: Story = {
  args: {
    initialValues: { title: "Плед из шерсти мериноса" },
    serverError: { message: "Не получилось сохранить. Попробуйте ещё раз." },
  },
  globals: { viewport: { value: "w360" } },
};

/** The request is running: the submit is busy, «Отмена» is disabled but stays focusable. */
export const Saving: Story = {
  args: {
    submitting: true,
    submitLabel: "Сохраняем…",
    onCancel: noop,
    initialValues: { title: "Плед из шерсти мериноса" },
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * A reserved wish of the edit screen (CLE-82/S23.3): the visibility is editable, the
 * quantity keeps its stored value and stays frozen — «Один раз / Можно дарить снова»
 * changes only on an open wish.
 */
export const ReservedWish: Story = {
  args: {
    submitLabel: "Сохранить",
    quantityLocked: true,
    initialValues: {
      title: "Плед из шерсти мериноса",
      visibility: "FRIENDS",
      quantity: "UNLIMITED",
    },
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * A closed or archived wish is read-only (CLE-82/S23.3, product clarification t351u):
 * the stored values are visible, nothing can be changed, there is no save button, and
 * one caption covers both states.
 */
export const ReadOnlyArchived: Story = {
  args: {
    submitLabel: "Сохранить",
    readOnly: true,
    quantityLocked: true,
    onCancel: noop,
    initialValues: {
      title: "Плед из шерсти мериноса",
      description: "Тёплый, 200 × 140, цвет — овсяный.",
      link: "https://market.example.com/pled",
      priceAmount: 250000,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
      quantity: "SINGLE",
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { text: "На день рождения" },
      ],
    },
  },
  globals: { viewport: { value: "w360" } },
};

/** The edit screen's action row: «Удалить желание», «Отмена» and «Сохранить». */
export const WithDeleteAndCancel: Story = {
  args: {
    submitLabel: "Сохранить",
    initialValues: { title: "Плед из шерсти мериноса" },
    onCancel: noop,
    secondaryAction: <Button label="Удалить желание" variant="destructive" onPress={noop} />,
  },
  globals: { viewport: { value: "w360" } },
};

/** The fixed-tag catalogue is loading: the form stays usable, the strip says so. */
export const TagCatalogLoading: Story = {
  args: { tagCatalog: { status: "loading" } },
  globals: { viewport: { value: "w360" } },
};

/** The catalogue failed: selected tags stay, a retry is offered. */
export const TagCatalogError: Story = {
  args: {
    tagCatalog: { status: "error" },
    onRetryTagCatalog: noop,
    initialValues: {
      title: "Плед из шерсти мериноса",
      tags: [{ catalogId: "tag-home", label: "Дом" }],
    },
  },
  globals: { viewport: { value: "w360" } },
};

/** The server has no fixed tags yet: only «Свой тег» is offered. */
export const TagCatalogEmpty: Story = {
  args: {
    tagCatalog: { status: "ready", tags: [] },
    onRetryTagCatalog: noop,
  },
  globals: { viewport: { value: "w360" } },
};

/** «Свой тег» opens its field: the story presses the real chip. */
export const CustomTagEditor: Story = {
  play: openCustomTag,
  globals: { viewport: { value: "w360" } },
};

function openCustomTag({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[data-testid='custom-tag-trigger']");
  trigger?.click();
}

/** Long Cyrillic values everywhere at 360 px: labels, hints and chips wrap, not clip. */
export const LongValuesNarrow: Story = {
  args: {
    submitLabel: "Сохранить",
    initialValues: {
      title: "Плед из шерсти мериноса с длинной бахромой и подогревом",
      description:
        "Тёплый, 200 × 140, цвет — овсяный. Хочется именно такой, с бахромой по краю, чтобы укрываться на диване холодными вечерами.",
      link: "https://market.example.com/пледы/меринос/овсяный-с-бахромой",
      priceAmount: 1250050,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
      quantity: "SINGLE",
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { text: "Для уютных вечеров вдвоём" },
        { catalogId: "tag-winter", label: "Зима" },
      ],
    },
  },
  globals: { viewport: { value: "w360" } },
};
