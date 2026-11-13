# Invoices (Ausgangsrechnungen, ZUGFeRD/Factur-X)

Outgoing invoices as hybrid PDF/A-3 with embedded CII XML (profile EN 16931). Rules as seen from
outside, the gross-to-net scheme and what is deliberately missing:
[domains/rechnungen.md](../domains/rechnungen.md). Code in `apps/bakery-api/`:

| File                                             | What                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/services/invoice.core.js`                   | the one formula: cents, VAT per rate, rounding, required fields, pure CII XML builder        |
| `src/services/invoices.service.ts`               | DB, transactions, audit; draft / issue / cancel; `InvoiceError`                              |
| `src/services/invoice-pdf.ts`                    | PDF/A-3b with `factur-x.xml` via pdfkit (no headless browser)                                |
| `src/services/invoice-anonymize.ts`              | wipes buyer data of stale drafts in the 90-day job                                           |
| `src/services/invoice-seller.ts`                 | seller from the Impressum data (`@bakery/shared/legal`) + bank details from the environment  |
| `src/routes/invoices.routes.ts`                  | `createInvoicesRouter({ preorders, seller?, now? })`, mounted at `/api/invoices` by `app.ts` |
| `migrations/20270320000000-invoices.js`          | tables `invoices`, `invoice_lines`; `down` refuses while issued invoices exist               |
| `migrations/20270325000000-invoices-pdf-paid.js` | frozen PDF, paid state, `number_key`, `anonymized_at`                                        |
| `assets/fonts/`                                  | Liberation Sans (OFL) - PDF/A needs embedded fonts                                           |

## Endpoints

All below the global session guard, **`inhaber` with a personal session only**
(`router.use(requireRole('inhaber'), requirePersonalSession)`); every other role gets 403
`forbidden`, an owner logged in by PIN at a station 403 `personal_session_required` - an `inhaber`
with a PIN can open a station session, so the check is needed. The management app lists
`/admin/rechnungen` in `PERSONAL_ONLY_ROUTES`. Answers
`{ success, data }`; errors `{ success: false, error, message, fields? }` with a German `message`
and `fields: [{ field, message }]` where a form field is at fault.

| Endpoint                        | Answer / effect                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/invoices/config`      | `{ vatRates, defaultVatRate, paymentTermDays, paymentText, today, seller, bankConfigured, bankMessage }` |
| `GET /api/invoices`             | list, newest invoice date first; `?status=entwurf\|ausgestellt\|storniert`, `?preorderId=`               |
| `GET /api/invoices/:id`         | invoice with `buyer`, `seller`, `lines[]`, `vat[]`, `totals`, `paymentTerms`, `issuable`, `missing[]`    |
| `POST /api/invoices`            | 201, new draft: empty, or `{ preorderId }` (lines, customer name, pickup date, code from the preorder)   |
| `PUT /api/invoices/:id`         | change a draft; absent fields keep their value, `lines` replaces all lines                               |
| `DELETE /api/invoices/:id`      | delete a draft                                                                                           |
| `POST /api/invoices/:id/issue`  | check required fields, freeze seller + totals + XML, status `ausgestellt`                                |
| `POST /api/invoices/:id/cancel` | `{ reason }` (required, ≤ 200 chars): status `storniert`                                                 |
| `GET /api/invoices/:id/pdf`     | `application/pdf`, `Rechnung-<Nummer>.pdf`: the bytes frozen at issue, header `X-Invoice-Sha256`         |
| `GET …/pdf?variant=storniert`   | the frozen version with the „STORNIERT“ line, `…-storniert.pdf` (cancelled invoices only)                |
| `GET /api/invoices/:id/xml`     | `application/xml`, the frozen Factur-X XML                                                               |

Input: `number`, `invoiceDate`, `deliveryDate` (`YYYY-MM-DD`), `paymentTermDays` (0–365),
`paymentText`, `note`, `paid` (boolean), `paidOn`, `paidMethod` (`bar` | `karte`),
`buyer { name, careOf, street, postcode, city, countryCode }`,
`lines[] { name, unit, quantity (≤ 3 decimals), unitPriceGross (Euro, `,`or`.`) or
unitPriceGrossCents, vatRate (7 | 19, default 7), productId? }`. Money in answers is integer cents.
`dueDate` = `invoiceDate` + `paymentTermDays`. `totals` carries `dueCents` (gross invoice amount),
`prepaidCents` (BT-113) and `payableCents` (BT-115; 0 when `paid`). A draft also answers
`warnings[]` (German; a paid preorder that does not match the invoice), `preorderPaidCents` and
`anonymizedAt`; an issued invoice `pdfSha256`. `config` adds `paymentMethods`, `pdfReady`,
`pdfMessage` (fonts missing).

Errors: 400 `invalid_status` / `invalid_preorder` / `invalid_variant`; 403
`personal_session_required`; 404 `invoice_not_found` / `preorder_not_found`;
409 `invoice_immutable` (change or delete of an issued invoice), `invoice_not_draft` (issue twice),
`invoice_not_issued` (PDF/XML/cancel of a draft), `invoice_cancelled`, `invoice_exists` (a
non-cancelled invoice for this preorder exists; `invoiceId` in the body), `preorder_cancelled`,
`invoice_not_cancelled` (stamped PDF of a non-cancelled invoice), `number_taken` (compared by
`numberKey()`), `bank_not_configured` (transfer invoices only); 422 `validation_failed` (also a
line whose quantity × price exceeds 999 999,99 € - never a 500), `invoice_incomplete` (issue; all
missing fields in `fields`, including the date bounds), `preorder_price_invalid` (a preorder price
with fractions of a cent; names the product); 503 `invoice_fonts_missing` (nothing is issued).

## Data

- `invoices`: `number` (nullable, **unique** - SQLite allows many NULLs, so drafts without a number
  coexist), `status`, buyer columns, dates, payment terms, `preorder_id` / `preorder_code` (no
  foreign key: the invoice keeps everything itself and outlives the preorder's anonymisation),
  and the frozen parts written at issue: `seller` (JSON, with bank details), `totals`
  (`{ vat[], totals }`), `xml` (TEXT), **`pdf` (BLOB) + `pdf_sha256` + `pdf_stored_at`**,
  `issued_at/_by`; `cancelled_at/_by`, `cancel_reason`, `cancel_pdf` + `cancel_pdf_sha256` (the
  stamped version, written at cancel - the original stays). `number_key` (unique) is the comparison
  form of `number`. `paid`, `paid_on`, `paid_method`, `preorder_paid_cents`; `anonymized_at`
  (drafts only).
- **The PDF is rendered once.** `issue` renders inside the transaction and stores the bytes; the
  download serves them and never renders again. The blobs are excluded from every list and detail
  query (`WITHOUT_FILES`). An invoice issued before the columns existed has `pdf` NULL: the first
  download (or its cancellation) renders it once from the frozen state, stores it and writes an
  audit row `pdf_freeze`. Stored in SQLite, not as files, so the box backup covers it (runbook §5).
- `invoice_lines`: `position`, `name`, `unit`, `quantity` DECIMAL(12,3), `unit_price_gross_cents`,
  `vat_rate`, and the computed `gross_cents`, `net_cents`, `net_unit_price`, `net_basis_quantity`.
- Money is INTEGER cents, not DECIMAL.
- A draft's amounts are recomputed on every read; an issued invoice answers from the frozen columns,
  so a later change of the formula or of the seller configuration does not rewrite old invoices.
- `audit_log`: `create` / `update` / `delete` / `issue` / `cancel` on entity `invoice`; the data
  holds number and amount only, never name or address.
- Issued and cancelled invoices are not touched by `anonymize-preorders` (retention, § 14b UStG).
  **Drafts are:** the same job (`anonymizeInvoiceDrafts`, report field `invoiceDrafts`) empties
  buyer name, c/o, street, postcode, city and note of drafts whose reference day is before the
  cutoff - the preorder's pickup date, else the delivery date, else the day of the last change -
  and sets `anonymized_at`. Lines stay.
- `migrations/20270320000000-invoices.js` `down` throws while a non-draft invoice exists; only
  `INVOICES_ALLOW_DROP=1` overrides (never on the box without a database copy).

## Seller and bank details

`currentSeller()` reads name, address, country code, USt-IdNr., phone and e-mail from
`LEGAL` in `libs/shared/utils/src/lib/legal.ts` - the same source as the Impressum and the price
list - through the single-file alias `@bakery/shared/legal` in `tsconfig.base.json` (not the barrel
`@bakery/shared/utils`, which pulls in React; the file must stay import-free, esbuild bundles it
into the API). Bank details come from the
environment, read on every call:

| Variable                 | Required to issue | Note                                        |
| ------------------------ | ----------------- | ------------------------------------------- |
| `INVOICE_IBAN`           | yes               | spaces allowed; checksum is verified        |
| `INVOICE_BIC`            | yes               |                                             |
| `INVOICE_ACCOUNT_HOLDER` | yes               |                                             |
| `INVOICE_BANK_NAME`      | no                | printed only                                |
| `INVOICE_FONTS_DIR`      | no                | override for `apps/bakery-api/assets/fonts` |

Missing or invalid: `config.bankConfigured` is false, the draft lists it in `missing`, issuing
answers 409 `bank_not_configured`. Never a placeholder.

## XML and PDF

- `buildCiiXml(invoice)` is pure (same input, same bytes): `rsm:CrossIndustryInvoice`, type code
  380, guideline `urn:cen.eu:en16931:2017`, VAT category `S`, payment means 58 (SEPA credit
  transfer) with IBAN/BIC, payment terms with due date, `ram:RoundingAmount` only when not 0.
  Unit codes: `Stück` → `H87`, `kg` → `KGM`, … unknown → `C62`.
- `renderInvoicePdf()` uses **pdfkit** (`subset: 'PDF/A-3b'`, PDF 1.7): sRGB output intent and
  `pdfaid` from pdfkit; the XML as embedded file `factur-x.xml`, MIME `text/xml`, `AFRelationship`
  `Alternative`, in the catalog's `/AF` and the `EmbeddedFiles` name tree; XMP with the Factur-X
  extension schema and `fx:DocumentType INVOICE`, `fx:DocumentFileName`, `fx:Version 1.0`,
  `fx:ConformanceLevel EN 16931`; Liberation Sans embedded as subsets, never one of the 14 standard
  fonts. Same invoice, same bytes (timestamps come from `issued_at`).
- pdfkit stays external to the esbuild bundle like every npm package; the fonts are read from the
  repository tree next to the bundle (a release on the box is a git worktree).
- A paid invoice (`paid`): payment means type code 10 (cash) or 48 (card) without account, payment
  terms „Betrag bereits bezahlt am … (bar).“ without due date, `ram:TotalPrepaidAmount` = gross
  amount, `ram:DuePayableAmount` 0.00 (BR-CO-16 holds with the rounding amount too). The PDF prints
  „Bereits bezahlt“ / „Noch zu zahlen 0,00 €“ and neither a payment request nor bank details.
- A cancelled invoice keeps its original PDF and XML; the version with the red „STORNIERT“ line is
  a second stored file.
- Fonts missing: `InvoiceFontsError` → 503 `invoice_fonts_missing`; `server.ts` logs a `[WARN]` at
  start and `GET /config` answers `pdfReady: false`.

## Verification

| What                                              | Where                                                                     | Local                         |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| amounts, BR-CO rules, required fields, golden XML | `tests/unit/invoiceCore.test.js`, `tests/fixtures/invoice-golden.xml`     | yes                           |
| XML against the official EN 16931 XSD             | same test, `xmllint --schema tests/fixtures/facturx-en16931/…`            | yes if `xmllint` is installed |
| PDF structure (attachment, AF, XMP, fonts)        | `tests/unit/invoicePdf.test.ts`                                           | yes                           |
| routes, roles, immutability, anonymisation        | `tests/integration/invoices.test.ts`                                      | yes                           |
| **PDF/A-3b (veraPDF) + EN 16931 Schematron**      | `.github/workflows/invoice-conformance.yml` (Mustang-CLI, pinned by hash) | **no** - needs Java           |

The conformance workflow runs on changes to the invoice code, fonts, fixtures or the lockfile and
on demand (`workflow_dispatch`). It renders the synthetic sample invoices (mixed rates, rounding
case, multi-page, cancelled, already paid), validates each PDF, and checks that a tampered total is rejected.
Reports and sample PDFs are kept as the artifact `rechnungen-konformitaet`.

To validate one real invoice by hand (outside the repo - real data):
`java -jar Mustang-CLI-2.26.0.jar --action validate --source Rechnung-….pdf` (Java 11+), or veraPDF
for the PDF/A part alone. Regenerate the golden file after an intended change:
`UPDATE_INVOICE_GOLDEN=1 npx jest -c apps/bakery-api/jest.config.js --testPathPattern invoiceCore`.
