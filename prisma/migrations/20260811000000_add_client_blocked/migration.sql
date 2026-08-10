-- Add "blocked" flag to Client for the customer management (CRM) module.
ALTER TABLE "Client" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
