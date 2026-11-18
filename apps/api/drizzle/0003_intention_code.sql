ALTER TABLE "intentions"."intentions" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "intentions"."intentions" SET "code" = 'INT-' || (SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '') FROM generate_series(1, 5) WHERE "id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "intentions"."intentions" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "intentions"."intentions" ADD CONSTRAINT "intentions_code_unique" UNIQUE("code");
