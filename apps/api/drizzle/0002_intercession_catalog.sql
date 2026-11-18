CREATE SCHEMA "intercession";
--> statement-breakpoint
CREATE TABLE "intercession"."catalog" (
	"intention_id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"language" text NOT NULL,
	"embedding" vector(512) NOT NULL
);
