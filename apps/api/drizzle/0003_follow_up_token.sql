ALTER TABLE "intentions"."intentions" ADD COLUMN "follow_up_token_hash" text;--> statement-breakpoint
UPDATE "intentions"."intentions" SET "follow_up_token_hash" = encode(sha256(gen_random_uuid()::text::bytea), 'hex');--> statement-breakpoint
ALTER TABLE "intentions"."intentions" ALTER COLUMN "follow_up_token_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "intentions"."intentions" ADD CONSTRAINT "intentions_follow_up_token_hash_unique" UNIQUE("follow_up_token_hash");
