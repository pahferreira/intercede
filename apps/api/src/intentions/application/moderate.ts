import type { Analytics } from "../../platform/analytics-port";
import type { Result } from "../../platform/result";
import type { ModerationVerdict } from "../domain/moderation-verdict";

export type ModerationUnavailable = { kind: "moderation_unavailable" };

export type Moderate = (
	text: string,
	analytics: Analytics,
) => Promise<Result<ModerationVerdict, ModerationUnavailable>>;
