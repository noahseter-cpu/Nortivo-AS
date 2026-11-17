# Third-party fonts

The 17 November 2026 Nortivo studio implementation adds Barlow Condensed SemiBold for public display text. The unmodified font is sourced from the Google Fonts Barlow Condensed directory and served locally as dist/assets/fonts/barlow-condensed-semibold.ttf. The accompanying SIL Open Font License 1.1 is shipped in dist/assets/fonts/BarlowCondensed-OFL.txt. [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)

Manrope remains the body and interface family. Existing Gloock and Syne files remain available for their scoped or historical surfaces. The Barlow addition supersedes the former corporate display-family description without changing those families' source records.

Lune restaurant display text uses Gloock Regular (Duarte Pinto / Gloock Project Authors), sourced from Google Fonts on 2026-09-22. Official project: https://github.com/duartp/gloock . Unmodified TTF from https://fonts.gstatic.com/s/gloock/v8/Iurb6YFw84WUY4N5jw.ttf ; SIL OFL 1.1 is shipped in dist/assets/fonts/Gloock-OFL.txt. This font is served locally at runtime and scoped to Lune.

The website includes Manrope and Syne font files downloaded from Google Fonts on 2026-09-17.

- Manrope: https://fonts.google.com/specimen/Manrope
- Syne: https://fonts.google.com/specimen/Syne
- License: SIL Open Font License 1.1, as published with each family by Google Fonts.

The files are served locally from `dist/assets/fonts` so the page does not rely on a third-party font request at runtime.

## IBM Plex Mono

The incremental V2 extension adds IBM Plex Mono Regular for financial amounts, report statistics, dates and chart readouts. The self-hosted file is dist/assets/fonts/ibm-plex-mono-regular.ttf. The shipped licence is dist/assets/fonts/IBMPlexMono-OFL.txt, carrying the IBM copyright and Reserved Font Name “Plex”. It is licensed under SIL Open Font License 1.1. The interface does not request the font from a third-party server at runtime. [IBM Plex project](https://github.com/IBM/plex), [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)
