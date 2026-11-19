CREATE TABLE "intercession"."suggestions" (
	"visitor_id" uuid NOT NULL,
	"intention_id" uuid NOT NULL,
	"suggested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "suggestions_visitor_intention_suggested_at_idx" ON "intercession"."suggestions" USING btree ("visitor_id","intention_id","suggested_at");