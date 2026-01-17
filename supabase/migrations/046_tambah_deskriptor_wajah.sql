-- Migration: Add face_descriptor column to face_enrollments
-- Created: 2026-01-17
-- Description: Adds JSONB column to store face-api.js descriptors for real face recognition

ALTER TABLE face_enrollments 
ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

COMMENT ON COLUMN face_enrollments.face_descriptor IS 'Face-api.js descriptor (Float32Array) stored as JSON array';
