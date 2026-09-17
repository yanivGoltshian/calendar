CREATE TYPE "BusinessReviewOrigin" AS ENUM ('CUSTOMER', 'OWNER');
CREATE TYPE "BusinessReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

CREATE TABLE "BusinessReview" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorUserId" TEXT,
    "origin" "BusinessReviewOrigin" NOT NULL,
    "status" "BusinessReviewStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "requestKey" TEXT,
    "requestHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "BusinessReview_name_check" CHECK (char_length(trim("name")) BETWEEN 1 AND 40),
    CONSTRAINT "BusinessReview_text_check" CHECK (char_length("text") <= 240 AND char_length("originalText") <= 240),
    CONSTRAINT "BusinessReview_origin_check" CHECK (
        ("origin" = 'CUSTOMER' AND "appointmentId" IS NOT NULL AND "authorUserId" IS NOT NULL)
        OR ("origin" = 'OWNER' AND "appointmentId" IS NULL AND "authorUserId" IS NULL)
    ),
    CONSTRAINT "BusinessReview_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessReview_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BusinessReview_appointmentId_key" ON "BusinessReview"("appointmentId");
CREATE UNIQUE INDEX "BusinessReview_businessId_requestKey_key" ON "BusinessReview"("businessId", "requestKey");
CREATE INDEX "BusinessReview_businessId_status_createdAt_idx" ON "BusinessReview"("businessId", "status", "createdAt");
CREATE INDEX "BusinessReview_authorUserId_idx" ON "BusinessReview"("authorUserId");
