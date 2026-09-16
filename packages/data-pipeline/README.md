# Data pipeline

Source adapters, normalization, review diffs, and refresh commands will live here. The deployed application reads only validated files in `public/data`; it never receives private source credentials.

Planned adapter order:

1. UN M49 country identity mappings.
2. IPU Parline parliament and election records.
3. Referenced leader records with official-site overrides.
4. Official electoral-commission calendars.
5. Foreign-ministry mission directories.
