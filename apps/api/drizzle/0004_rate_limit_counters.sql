CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."rate_limit_counters" (
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limit_counters_action_subject_window_start_pk" PRIMARY KEY("action","subject","window_start")
);
