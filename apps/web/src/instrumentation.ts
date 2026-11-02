export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { installPeerAddress } = await import("./lib/peer-address");
  installPeerAddress();
}
