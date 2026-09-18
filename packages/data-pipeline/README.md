# Data pipeline

Polity Atlas uses provider adapters and deterministic normalizers. The application reads only reviewed files in `public/data`; source acquisition is an explicit local operation.

## IPU Parline

IPU Parline is the parliamentary-data backbone for the ten configured pilots. The public API is read-only and currently requires **no API key**.

Endpoints used by the acquisition scaffold:

- `/v1/countries/{country_code}`
- `/v1/countries/{country_code}/parliaments`
- `/v1/countries/{country_code}/chambers`
- `/v1/chambers/{chamber_code}/elections`

Fetch one configured pilot:

```sh
npm run data:ipu:fetch -- --country AU
```

Fetch all ten:

```sh
npm run data:ipu:fetch
```

Raw JSON:API responses are written to the ignored `.cache/ipu` directory. They are evidence for normalization and review, not application assets.

The generic normalizer in `ipu/normalize.ts` has no country switches. It preserves statutory chamber size versus post-election total, full versus partial renewal, seats won in the latest renewal versus a supplied full post-renewal composition, directly elected versus indirect/appointed chambers, and one or many expected national parliamentary events.

For a partial renewal, a full post-election composition is emitted only when the upstream record explicitly supplies full-composition seat values. The pipeline never combines prior results to infer the whole chamber. Parline does not provide a general local-election calendar; the canonical event model allows future providers to add subnational, local, and supranational events without changing country-specific UI code.

IPU source records retain:

```text
Inter-Parliamentary Union: Parline, September 2026
https://www.ipu.org/terms-use
```
