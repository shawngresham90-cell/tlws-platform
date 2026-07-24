# Raw Census responses

Raw, **unmodified** Census `addressbatch` output goes here — one file per run,
named `census-<set>-output.<UTC-timestamp>.csv`. These are the untouched
service responses; the parser/validator reads from them and never edits them.
Empty until a batch is actually run (this environment is NETWORK BLOCKED for
`geocoding.geo.census.gov` — see `../calibration/README.md`).
