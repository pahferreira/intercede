CREATE TABLE "intercession"."commitments" (
	"visitor_id" uuid NOT NULL,
	"intention_id" uuid NOT NULL,
	"committed_on" date DEFAULT (now() at time zone 'utc')::date NOT NULL,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commitments_visitor_id_intention_id_committed_on_pk" PRIMARY KEY("visitor_id","intention_id","committed_on")
);
