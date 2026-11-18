import type { Analytics } from "../../platform/analytics-port";
import type { Result } from "../../platform/result";

export const embeddingDimensions = 512;

export type EmbeddingUnavailable = { kind: "embedding_unavailable" };

export type Embed = (
	text: string,
	analytics: Analytics,
) => Promise<Result<number[], EmbeddingUnavailable>>;
