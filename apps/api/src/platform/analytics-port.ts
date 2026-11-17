export type LlmGeneration = {
	model: string;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
	costUsd: number;
};

export type Analytics = {
	captureException: (error: unknown) => void;
	captureLlmGeneration: (generation: LlmGeneration) => void;
	shutdown: () => Promise<void>;
};

export type OpenAnalytics = () => Analytics;

export type AnalyticsEnv = { Variables: { analytics: Analytics } };
