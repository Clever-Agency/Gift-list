import { BroadcastChannel } from "node:worker_threads";
import { expect, it, vi } from "vitest";
import { openSessionEvents } from "./session-events";

it("доставляет сигнал BroadcastChannel соседнему подписчику", async function notifyOtherTab() {
  vi.stubGlobal("window", { BroadcastChannel });
  const received = Promise.withResolvers<void>();
  const senderCallback = vi.fn();
  const sender = openSessionEvents(senderCallback);
  const receiver = openSessionEvents(received.resolve);
  try {
    expect(sender).not.toBeNull();
    expect(receiver).not.toBeNull();
    sender?.publish();
    await received.promise;
    expect(senderCallback).not.toHaveBeenCalled();
  } finally {
    receiver?.close();
    sender?.close();
    vi.unstubAllGlobals();
  }
});
