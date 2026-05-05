/**
 * Domain schemas for the media-library integration test.
 *
 * Domain: a file-ingestion platform (from Design Doc 10) where text, audio,
 * and bank-statement files are uploaded and processed through multiple APIs.
 *
 * Multiple APIs expose views of the same underlying files:
 *
 *   rawdata API  — all files, type-discriminated
 *   text API     — text files with transcript
 *   audio API    — audio files with duration / waveform info
 *   entities API — persons and their associated file IDs
 *
 * The `fileId` field must be consistent across all APIs for the same file.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Subject schemas
// ---------------------------------------------------------------------------

export const PersonSubjectSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
});

export const TextFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  language: z.enum(["nl", "en", "de"]),
  sizeBytes: z.number().int().min(1).max(50_000_000),
});

export const AudioFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  durationS: z.number().int().min(1).max(7200),
  sizeBytes: z.number().int().min(1).max(500_000_000),
});

export const BankFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  bank: z.enum(["ING", "ABN", "RABO", "SNS"]),
  sizeBytes: z.number().int().min(1).max(5_000_000),
});

// ---------------------------------------------------------------------------
// API schemas
// ---------------------------------------------------------------------------

/** Rawdata API — one record per file, all types combined. */
export const RawDataSchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(["text", "audio", "bank"]).optional(),
  sizeBytes: z.number().int(),
  uploadedAt: z.date(),
  status: z.enum(["queued", "processing", "done", "failed"]),
});

/** Text API — transcript + language info for text files. */
export const TextApiSchema = z.object({
  fileId: z.uuid(),
  uploadedBy: z.uuid(),
  language: z.enum(["nl", "en", "de"]),
  transcript: z.string().min(1),
  wordCount: z.number().int().min(1),
});

/** Audio API — audio file metadata and processing info. */
export const AudioApiSchema = z.object({
  fileId: z.uuid(),
  uploadedBy: z.uuid(),
  durationS: z.number().int().min(1),
  sampleRate: z.union([z.literal(8000), z.literal(16000), z.literal(44100), z.literal(48000)]),
});

/** Bank API — bank statement metadata. */
export const BankApiSchema = z.object({
  fileId: z.uuid(),
  uploadedBy: z.uuid(),
  bank: z.enum(["ING", "ABN", "RABO", "SNS"]),
  periodStart: z.date(),
  periodEnd: z.date(),
});

/** Entity API — person with all their associated file IDs. */
export const EntityApiSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  fileIds: z.array(z.uuid()),
  fileCount: z.number().int().min(0),
});
