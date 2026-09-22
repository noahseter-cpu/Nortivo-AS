# Tilgang til supportsaker

Implementert lokalt 21. september 2026. Ingen produksjonsdata, skjemaer, nøkler eller leverandørinnstillinger er endret. Publisering, faktisk e-postlevering og driftstest gjenstår.

## API og klientflyt

1. `POST /.netlify/functions/ticket-access` med JSON `{ "action": "request", "ticketNumber": "NT-2026-ABC234", "email": "kunde@example.com", "language": "nb" }`.
2. Gyldig syntaks gir alltid `202 { "ok": true, "message": "…" }`, også ved ukjent sak/e-post, begrensede forsøk eller leveringsfeil. Kun en eksisterende kombinasjon får e-post med bekreftelseslenke. Responsen inneholder aldri privat saksinnhold.
3. Lenken har formen `https://<godkjent-nettsted>/support/#access=<token>`. Klienten må straks fjerne fragmentet med `history.replaceState`, og deretter sende `POST ticket-access` med `{ "action": "verify", "token": "…", "language": "nb" }`.
4. Gyldig token gir `200 { "ok": true, "ticketNumber": "…", "email": "…" }` og en saksspesifikk cookie. Ugyldig/utløpt token gir `401`, kode `INVALID_ACCESS`. Kunden må be om ny lenke ved utløp. Token og e-post skal ikke lagres i nettleserlagring eller logger.
5. Klienten henter samtalen med `GET /.netlify/functions/tickets?ticketNumber=…&language=nb` og same-origin credentials. Cookie binder både saken og e-postadressen. Uten korrekt cookie blir resultatet `401 ACCESS_REQUIRED` før databasetilgang. Det gamle parameteret `ticket` støttes. E-post kan fortsatt sendes av eldre klienter, men må da stemme med cookien. Nye klienter bør utelate e-post for å holde den ute av URL og tilgangslogger.

`language` kan være `nb` eller `en`; standard er engelsk. Opprettelse av sak og administratorsvar støtter også feltet. Språk lagres ikke i dagens database; avsenderklienten må derfor velge språket ved hvert svar.

Eksisterende `POST tickets` beholder `{ ticket: { ticket_number, status } }` og legger til `confirmationSent: boolean`. Lagring er avgjørende for vellykket opprettelse. En mislykket bekreftelsesmelding opphever ikke en lagret sak, og klienten skal ikke love levert e-post når feltet er `false`. Opprettelse gir aldri cookie eller lesetilgang. Kontaktmeldinger bruker samme skjema/API og et tydelig emneprefiks.

## Beskyttelse

- E-postlenken varer 15 minutter. Sakscookien `nortivo_ticket` varer 30 minutter og har `HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/`.
- Token bruker AES-256-GCM og HMAC-SHA-256 med separate nøkler avledet fra eksisterende `ADMIN_SESSION_SECRET`. Formålene `email-proof` og `ticket-session`, kryptering/signatur og administratorens eksisterende signatur er atskilt. Hemmeligheten må være minst 32 byte, i tråd med tidligere oppsettskrav; ingen ny hemmelighet opprettes.
- Token inneholder kun formål, sak/e-post og utstedelses-/utløpstid. Innholdet er kryptert, slik at e-postadressen ikke er lesbar fra URL-tokenet. Signaturer sammenlignes med `crypto.timingSafeEqual` etter format-/lengdekontroll.
- POST/PATCH krever samme origin via `Origin` eller `Referer`; eksplisitte forespørsler fra annen origin avvises også på private GET-endepunkter. Lenker bruker bare HTTPS-origins fra Netlifys `URL`, `DEPLOY_PRIME_URL`, `DEPLOY_URL` eller den eksisterende Nortivo-standardadressen. Verken `Host` eller `X-Forwarded-Host` bestemmer lenkemålet. Lokal HTTP tillates bare med `NETLIFY_DEV=true` og localhost-adresse. Browser-cookieatferd ved lokal HTTP må kontrolleres separat.
- Administratorens eksisterende passord, cookieformat og åtte timers sesjon bevares. En kundecookie kan ikke autorisere administratorhandlinger, og en admincookie erstatter ikke e-postbevis for offentlig oppslag.
- JSON-kropper er begrenset til 20 000 byte. Serverfeil returnerer generelle meldinger og stabile koder; leverandørrespons, nøkkelnavn, saksinnhold og token skrives ikke til feilrespons/logger.

## Forsøksbegrensning og kjente driftsgrenser

En minnebasert teller håndhever følgende grenser per serverprosess:

| Handling | IP-grense | E-postgrense | Vindu |
| --- | --- | --- | --- |
| Be om lenke | 8 | 3 | 15 min |
| Bekrefte lenke | 20 | — | 15 min |
| Lese bekreftet sak | 60 | — | 15 min |
| Opprette sak | 6 | 3 | 60 min |
| Admininnlogging | 10 | — | 15 min |

IP hentes fra Netlifys `x-nf-client-connection-ip`; `X-Forwarded-For` ignoreres. Manglende IP deler én reserveteller. E-postadresser/IP lagres som hasher i tellernøklene. Tabellen er begrenset til 5 000 aktive oppføringer og avviser nye oppføringer ved full kapasitet.

Tellerne deles **ikke** mellom serverløse instanser og nullstilles ved ny prosess. Global beskyttelse krever en separat, godkjent vedvarende limiter eller leverandørregel før man kan love en samlet grense. Ingen slik tjeneste er opprettet her. Nøytral respons hindrer direkte oppslag i svarinnhold/status, men total responstid er ikke konstant fordi e-postlevering er ekstern.

Lenken er et tilgangsbevis og kan brukes flere ganger frem til utløp. Éngangsbruk og individuell tilbakekalling krever vedvarende tilstand; det er ikke lagt inn migrasjon for dette. Ny kundecookie erstatter tidligere sakstilgang i samme nettleser. Rotasjon av `ADMIN_SESSION_SECRET` tilbakekaller eksisterende admin- og kundesesjoner samt lenker. Slettede saker gir ikke data selv med gyldig cookie.

Databasetabeller, eksisterende rader og RLS-policyer er uendret. Eksisterende administratorsvar sendes fortsatt før svar/status lagres; leverings- og lagringsoperasjonene er ikke atomiske.

## Verifikasjon

Kjør `node --test tests/support-security.test.mjs` fra prosjektroten; ingen pakkeinstallasjon kreves. Testene bruker bare syntetisk konfigurasjon og simulerte Supabase-/Resend-kall. De dekker utløpsgrenser, signaturmanipulering, atskilte formål, riktig/feil sakscookie, skjult e-post i lenken, ingen privat databasetilgang før bevis, origin-kontroll, forsøkstellere, kompatible adminsesjoner, skjemabevaring, språk og håndtering av tjenestefeil.

Dette beviser kodeatferd lokalt, ikke konfigurerte produksjonsvariabler, Netlify-headeres faktiske driftsegenskaper, e-postlevering eller nettleserens cookiehåndtering. Disse må verifiseres i et godkjent test-/publiseringsløp uten å åpne reelle kundesaker unødvendig.
