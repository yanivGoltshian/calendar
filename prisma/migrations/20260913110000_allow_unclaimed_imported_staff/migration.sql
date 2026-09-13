-- Public business imports can contain factual staff profiles before those people
-- have a verified login identity. Existing staff identities and uniqueness are
-- preserved; PostgreSQL permits multiple NULL values in the composite unique key.
ALTER TABLE "StaffMember" ALTER COLUMN "userId" DROP NOT NULL;
