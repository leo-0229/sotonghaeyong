# Third-party moderation data

The project license and copyright of leo-0229 do not replace third-party licenses.

## Korcen literal term data

- Discovery: https://github.com/Tanat05/korean-profanity-resources
- Source: https://github.com/Tanat05/korcen/blob/eecd9763dbdccce3dc96ddb578ef0b6396058fa9/korcen/korcen.py
- Copyright (c) 2026 Tanat
- License: MIT; full text in [third_party/korcen-LICENSE.txt](third_party/korcen-LICENSE.txt); the deployed site also includes public/licenses/korcen-MIT.txt.
- Adapted file: supabase/functions/_shared/korcen-terms.ts

The adaptation selects literal Korean general, minor, sexual, belittling, racial and parental abuse terms and selected literal English terms. It removes duplicates, identity-only labels, single-character markers and mixed-script patterns. No upstream Python code is executed or shipped. Matching and review policy are implemented separately for this application. Other datasets linked from the discovery repository have separate licenses; its unlicensed slang.csv and LoL list are not redistributed.
