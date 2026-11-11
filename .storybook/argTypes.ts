import type { ArgTypes } from "@storybook/react";

/**
 * One row of the Docs / Controls table, with the facts the table shows kept in a
 * single place: the description, the type summary, whether the prop is required,
 * the default and the select options. The catalog writes `argTypes` by hand
 * because the React Native Web framework has no TypeScript docgen pass.
 */
export type PropDocOptions = {
  description: string;
  /** The type summary the Docs table prints, e.g. `"a" | "b"` or `string`. */
  type: string;
  required?: boolean;
  /** The resting value the component uses when the prop is omitted. */
  defaultValue?: string;
  /** The real values of a union prop; also makes the control a select. */
  options?: readonly string[];
  /** Overrides the inferred control; `false` hides the prop from Controls. */
  control?: "text" | "boolean" | "select" | false;
};

type PropArgType = ArgTypes[string];

/**
 * A `propDoc` row. Storybook reads the required asterisk from `type.required`,
 * while the visible type text comes from `table.type.summary`; the type object
 * therefore only carries the flag and the union values.
 */
export function propDoc({
  description,
  type,
  required = false,
  defaultValue,
  options,
  control,
}: PropDocOptions): PropArgType {
  return {
    description,
    control: control ?? inferControl(type, options),
    ...(options ? { options } : {}),
    type: options
      ? { name: "enum", value: [...options], required }
      : { name: "string", raw: type, required },
    table: {
      type: { summary: type },
      ...(defaultValue === undefined ? {} : { defaultValue: { summary: defaultValue } }),
    },
  };
}

/** The union type the Docs / Controls table prints, e.g. `"primary" | "reserve"`. */
export function formatUnionType(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(" | ");
}

/** Text for free-form props, a select for unions, a switch for booleans. */
function inferControl(
  type: string,
  options: readonly string[] | undefined,
): "text" | "boolean" | "select" {
  if (options) return "select";
  if (type === "boolean") return "boolean";
  return "text";
}
