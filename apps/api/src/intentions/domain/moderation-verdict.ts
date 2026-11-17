import type { Language } from "./intention";

export const rejectionReasons = [
	"spam",
	"abuse",
	"personal_data",
	"off_topic",
] as const;

export type RejectionReason = (typeof rejectionReasons)[number];

export type ModerationVerdict =
	| { publishable: true; language: Language }
	| { publishable: false; reasons: RejectionReason[] };
