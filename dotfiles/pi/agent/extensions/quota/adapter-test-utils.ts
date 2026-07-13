import type { AdapterLogger } from "./adapter-registry.js";

/** Logger that swallows log events. */
export const silentLogger: AdapterLogger = {
  log: () => {
    /* no-op */
  },
};
