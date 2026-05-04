// playground.ts — edit freely, run with: pnpm play
// pnpm play:watch  re-runs on every save

import { test } from 'vitest'
import { z } from 'zod'

import { createMediaLibraryWorld } from './tests/integration/media-library/world.js'
import {
  RawDataSchema,
  TextApiSchema,
  AudioApiSchema,
  BankApiSchema,
  EntityApiSchema,
} from './tests/integration/media-library/schemas.js'

import { createInvoicingWorld } from './tests/integration/invoicing/world.js'
import {
  InvoiceSchema,
  CustomerSummarySchema,
} from './tests/integration/invoicing/schemas.js'

import { createDocumentCorpusWorld } from './tests/integration/document-corpus/world.js'
import {
  DocumentSchema,
  SentenceSchema,
  AnnotationSchema,
} from './tests/integration/document-corpus/schemas.js'

function section(title: string, data: unknown) {
  const bar = '─'.repeat(60)
  console.log(`\n${bar}\n  ${title}\n${bar}`)
  console.log(JSON.stringify(data, null, 2))
}

test('playground', () => {
  // ---------------------------------------------------------------------------
  // Media Library  (seed 42)
  //   rawdata must be generated first so file subjects enter the registry
  // ---------------------------------------------------------------------------

  const mediaWorld = createMediaLibraryWorld(42)

  const rawdata = mediaWorld.generate(z.array(RawDataSchema).min(6).max(12))
  section('Media Library — rawdata (all files)', rawdata)

  const texts  = mediaWorld.generate(z.array(TextApiSchema))
  section('Media Library — text API', texts)

  const audios = mediaWorld.generate(z.array(AudioApiSchema))
  section('Media Library — audio API', audios)

  const banks  = mediaWorld.generate(z.array(BankApiSchema))
  section('Media Library — bank API', banks)

  const entities = mediaWorld.generate(z.array(EntityApiSchema))
  section('Media Library — entity API (persons + file IDs)', entities)

  // ---------------------------------------------------------------------------
  // Invoicing  (seed 42)
  // ---------------------------------------------------------------------------

  const invoiceWorld = createInvoicingWorld(42)

  const invoices = invoiceWorld.generate(z.array(InvoiceSchema).min(4).max(6))
  section('Invoicing — invoices', invoices)

  const summaries = invoiceWorld.generate(z.array(CustomerSummarySchema))
  section('Invoicing — customer summaries', summaries)

  // ---------------------------------------------------------------------------
  // Document Corpus  (seed 42)
  // ---------------------------------------------------------------------------

  const docWorld = createDocumentCorpusWorld(42)

  const docs = docWorld.generate(z.array(DocumentSchema).min(3).max(5))
  section('Document Corpus — documents', docs)

  const sentences = docWorld.generate(z.array(SentenceSchema).min(8).max(15))
  section('Document Corpus — sentences', sentences)

  const annotations = docWorld.generate(z.array(AnnotationSchema).min(5).max(10))
  section('Document Corpus — annotations', annotations)
})
