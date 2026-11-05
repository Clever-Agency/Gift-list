// @vitest-environment node
import { Button } from "@gift-list/ui";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted = vi.hoisted(function createInserted() {
  return { callbacks: [] as Array<() => ReactNode> };
});

vi.mock("next/navigation", () => ({
  useServerInsertedHTML: vi.fn(function capture(callback: () => ReactNode) {
    inserted.callbacks.push(callback);
  }),
}));

import { TamaguiRegistry } from "./tamagui-registry";

function noop() {}

/** One request: render the tree, then let Next flush the stream `flushes` times. */
function request(flushes: number): string {
  inserted.callbacks = [];
  renderToString(
    <TamaguiRegistry>
      <Button label="Открыть" onPress={noop} />
    </TamaguiRegistry>,
  );
  const callback = inserted.callbacks[0];
  let out = "";
  for (let i = 0; i < flushes; i += 1) {
    const node = callback() as { props?: { id?: string; dangerouslySetInnerHTML?: { __html: string } } } | null;
    if (node?.props) out += `<style id="${node.props.id}">${node.props.dangerouslySetInnerHTML?.__html}</style>`;
  }
  return out;
}

function count(html: string): number {
  return (html.match(/id="tamagui-ssr"/g) ?? []).length;
}

describe("TamaguiRegistry", () => {
  beforeEach(() => {
    inserted.callbacks = [];
  });

  it("в каждом ответе не больше одного #tamagui-ssr, без дублей id", () => {
    const first = request(4);
    const second = request(4);

    expect(count(first)).toBeLessThanOrEqual(1);
    expect(count(second)).toBeLessThanOrEqual(1);
  });

  it("в первом ответе есть CSS темы", () => {
    expect(request(4)).toContain("--c-primary");
  });

  it("пустой тег не выдаётся", () => {
    expect(request(4)).not.toContain("></style>");
  });
});
