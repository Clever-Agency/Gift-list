// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTagCatalog } from "@/ui/use-tag-catalog";

const api = vi.hoisted(() => ({ fetchTagCatalog: vi.fn() }));
vi.mock("@/api/tags", () => api);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const catalog = useTagCatalog();
  return (
    <div>
      <span data-testid="status">{catalog.state.status}</span>
      <span data-testid="tags">
        {catalog.state.status === "ready"
          ? catalog.state.tags.map((tag) => tag.label).join(",")
          : ""}
      </span>
      <button type="button" onClick={catalog.retry}>
        retry
      </button>
    </div>
  );
}

let root: Root;
let container: HTMLDivElement;

function status(): string {
  return container.querySelector('[data-testid="status"]')?.textContent ?? "";
}

function labels(): string {
  return container.querySelector('[data-testid="tags"]')?.textContent ?? "";
}

async function mount() {
  await act(async () => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  api.fetchTagCatalog.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useTagCatalog", () => {
  it("грузовик сменяется готовым каталогом, пустой — тоже ready", async () => {
    let resolve!: (value: unknown) => void;
    api.fetchTagCatalog.mockReturnValue(new Promise((done) => (resolve = done)));
    await mount();
    expect(status()).toBe("loading");

    await act(async () => {
      resolve({
        ok: true,
        tags: [{ id: "tag_dream", slug: "dream", label: "мечта" }],
      });
    });
    expect(status()).toBe("ready");
    expect(labels()).toBe("мечта");
  });

  it("ошибка даёт retry и не теряет запрос после повтора", async () => {
    api.fetchTagCatalog
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, tags: [] });
    await mount();
    expect(status()).toBe("error");

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });
    expect(status()).toBe("ready");
    expect(labels()).toBe("");
    expect(api.fetchTagCatalog).toHaveBeenCalledTimes(2);
  });

  it("тело не по контракту — ошибка, а не пустой каталог", async () => {
    api.fetchTagCatalog.mockResolvedValue({ ok: false, invalid: true });
    await mount();
    expect(status()).toBe("error");
  });
});
