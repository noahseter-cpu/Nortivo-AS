# Nortivo: undersøkelse før ny designretning

Dato: 21. september 2026. Omfang: skrivebeskyttet kodegjennomgang og nettleserobservasjoner. Kun denne rapporten er lagt til; ingen kildekode, konfigurasjon, saker eller produksjonsdata er endret.

## Bekreftet brukerflyt

1. **Forside → produkter:** Forsiden presenterer digitale produkter og leder til produktoversikten. På mobil forsvinner navigasjonslenken «Products»; hovedknappen gir fortsatt tilgang. Arc kommer etter tjenestelisten. Gründerens navn finnes kun som liten tekst i bunnteksten.
2. **Produkter → forstå Arc:** Produktsiden beskriver penger, helse og fremgang, men viser ingen faktiske produktbilder eller konkret demonstrasjon. Mobilnavigasjonen virker trang. Nortivo Support presenteres som tilgjengelig; Arc som privat beta under utvikling.
3. **Support → opprette eller finne sak:** Fanene kan byttes. Oppslag ber om saksnummer og e-post. Ingen skjema ble sendt, ingen e-post utløst og ingen private saker åpnet under nettleserkontrollen.

Nettleserbelegg: Codex IAB, desktop 1440 × 1000 og mobil 390 × 844. Skjermbilder ligger i `.impeccable/review/2026-09-21/`: `01-home-desktop.png`, `02-home-mobile.png`, `03-home-founder-mobile.png`, `04-products-mobile.png`, `05-products-desktop.png`, `06-support-desktop.png` og `07-support-lookup-mobile.png`.

## Kodefunn og personvern

**Oppslag mangler bekreftelse av e-posteierskap.** `netlify/functions/tickets.mjs:54` returnerer opprinnelig melding og alle svar etter treff på saksnummer og e-post. `dist/support/index.html:165` viser resultatet direkte. Ingen engangskode, bekreftelseslenke eller kundesesjon finnes. Bekreftelsesmeldingen ved opprettelse inneholder bare saksnummeret; leveringsfeil logges uten å underkjenne opprettelsen.

En isolert funksjonstest med syntetiske data og fullstendig simulert `fetch` bekreftet at offentlig oppslag uten cookie returnerer melding og svar. Testen gjorde ingen eksterne nettverkskall, databaseendringer eller e-postsendinger. Den ønskede flyten må håndheves på serveren: saksnummer/e-post → bekreftelseslenke eller kode → bekreftet tilgang → privat samtale. Responsen før bekreftelse må ikke inneholde samtalen.

Admin har serververifisert, signert cookie med åtte timers levetid, `HttpOnly`, `SameSite=Strict` og `Secure` ved HTTPS. Samme isolerte test bekreftet 401 uten cookie, før databasetilgang. Supabase-skjemaet aktiverer RLS uten offentlige policyer. Ingen ratebegrensning er synlig i applikasjonskoden; eventuell beskyttelse hos leverandøren er ukjent. Kunden kan ikke svare i portalen; svarskjemaet tillater kun administrator.

## Innhold, språk og publisering

- Eksisterende ruter: `/`, `/products/`, `/support/`, `/admin/`. Kontaktmål mangler: ingen `/contact/`, generell kontaktfunksjon eller offentlig `mailto:`-lenke.
- Alle fire sider, serverfeil og e-postmaler er hardkodet på engelsk. Ingen språkvelger eller lagret språkpreferanse finnes.
- Arc-prosjektets README/pakke viser nå privat `1.0.0-rc.2`; utgivelsesdokumentet viser fortsatt `rc.1`. Ingen offentlig utgivelse er bekreftet. Gjeldende identitet er det rene Arc-ordmerket; den gamle A-markøren skal ikke brukes som produktidentitet.
- Nettstedet er statisk HTML/CSS med Netlify Functions, Supabase og Resend. `netlify.toml` publiserer `dist`. Dokumentert GitHub → Netlify-oppsett og miljøkonfigurasjon er ikke verifisert i drift. Arbeidsmappen var ren på `main`, commit `b9b2765`, før rapporten.

## Videre struktur og designport

Forslag til kort forside: tydelig hovedbudskap → Arc → tjenester → konkret produktfordypning, eventuelt samlet med Arc → om Nortivo/gründer → kontakt og support. Dette er et strukturutgangspunkt, ikke godkjent design.

Brukeren avviste de første genererte konseptene A og B og ba om noe vesentlig annerledes. De skal ikke brukes videre. C er ikke generert. **Ingen designretning er godkjent; implementering av nytt grensesnitt og publisering er ikke autorisert.** Nye konsepter må vurderes før eventuell implementering.

Testgrenser: ingen full tilgjengelighets- eller ytelsestest, autentisert administratorkontroll, produksjonsoppslag, e-postlevering eller ende-til-ende-test av serverintegrasjonene.
