const channelName = "gift-list.session-change";

export function openSessionEvents(onChange: () => void) {
  if (typeof window === "undefined") return null;
  if (typeof window.BroadcastChannel !== "function") return openStorageSessionEvents(onChange);
  const channel = new window.BroadcastChannel(channelName);

  channel.addEventListener("message", function handleMessage(event: MessageEvent) {
    if (event.data === null) onChange();
  });

  return {
    publish() {
      channel.postMessage(null);
    },
    close() {
      channel.close();
    },
  };
}

function openStorageSessionEvents(onChange: () => void) {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return null;
  }

  function handleStorage(event: StorageEvent) {
    if (event.storageArea === storage && event.key === channelName && event.newValue === "") {
      onChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  return {
    publish() {
      try {
        storage.setItem(channelName, "");
        storage.removeItem(channelName);
      } catch {
        // The local session still works if the browser disables storage.
      }
    },
    close() {
      window.removeEventListener("storage", handleStorage);
    },
  };
}
