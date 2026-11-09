/**
 * The emulator-only host, shared by the mobile web export CLI and the Next.js
 * SPA sync script.
 *
 * `10.0.2.2` means "the host machine" only inside the Android emulator. A bundle
 * that still contains it was built for the emulator and cannot reach the API
 * from a phone, another laptop or a deployed site. Both build scripts scan the
 * exported JS for this host before publishing the bundle.
 */
export const EMULATOR_HOST = "10.0.2.2";

/** True when a built bundle still contains the emulator host. */
export function containsEmulatorOrigin(source) {
  return /(^|[^\d.])10\.0\.2\.2(?=$|[^\d])/.test(source);
}
