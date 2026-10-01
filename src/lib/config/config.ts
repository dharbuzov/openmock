import { parseConfig } from "./schema";

export const config = parseConfig({
  OPENMOCK_AI_PROVIDER: process.env.OPENMOCK_AI_PROVIDER,
  OPENMOCK_AI_MODEL: process.env.OPENMOCK_AI_MODEL,
  OPENMOCK_DISABLED_INTERVIEWS: process.env.OPENMOCK_DISABLED_INTERVIEWS,
});
