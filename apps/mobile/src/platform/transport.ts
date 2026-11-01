// Stub for tsc and Vitest (browser behaviour). Real implementations: transport.native.ts, transport.web.ts.
export {
  prepareRequest,
  readResponse,
  resolveUrl,
  type PreparedRequest,
} from "./transport.web";
