ALTER TABLE "Business"
  ADD COLUMN "ownerPhoneIdentity" TEXT,
  ADD COLUMN "provisionedBy" TEXT;

CREATE UNIQUE INDEX "Business_ownerPhoneIdentity_key" ON "Business"("ownerPhoneIdentity");
