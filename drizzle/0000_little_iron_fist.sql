CREATE TABLE "clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" text,
	"action" text NOT NULL,
	"calendar" text,
	"was_recommended" boolean,
	"os" text DEFAULT 'other' NOT NULL,
	"browser" text DEFAULT '' NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"in_app" text DEFAULT '' NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT '' NOT NULL,
	"utm_source" text DEFAULT '' NOT NULL,
	"utm_medium" text DEFAULT '' NOT NULL,
	"utm_campaign" text DEFAULT '' NOT NULL,
	"utm_content" text DEFAULT '' NOT NULL,
	"page_session" text DEFAULT '' NOT NULL,
	"app_version" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"start_local" text NOT NULL,
	"end_local" text NOT NULL,
	"timezone" text NOT NULL,
	"start_utc" timestamp with time zone NOT NULL,
	"end_utc" timestamp with time zone NOT NULL,
	"reminder_minutes" integer,
	"sequence" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clicks_event_action_idx" ON "clicks" USING btree ("event_id","action");