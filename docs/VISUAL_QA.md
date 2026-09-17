# Visuell QA

Status: BESTÅTT MED AVGRENSNINGER
Prosjekt / dato: Nortivo website / 2026-09-17
Godkjent visuelt bildemål: Direkte kodeimplementering etter prosjektets uttrykkelige unntak fra bildeporten.
Uttrykkelig godkjenning før frontend-koding: Brukerens beskjed om å forbedre nettstedet med design- og animasjonsferdighetene, 2026-09-17.
Implementert område: `/`, `/support/`, `/admin/`.
Nettleser og testmiljø: Microsoft Edge via Playwright, lokal statisk server.

## Belegg

| Rute | Bredde / tilstand | Skjermbilde / testreferanse | Observasjon |
|---|---|---|---|
| `/` | 1440px | `qa/home-desktop-1440.png` | Hero, kompetanserail og Arc har tydelig leserekkefølge. |
| `/` | 390px og 320px | `qa/home-mobile-390.png`, `qa/home-reflow-320.png` | Naturlig énkolonnerekkefølge; ingen synlig sideveis overflow. |
| `/support/` | 1440px | `qa/support-desktop-1440.png` | Instruksjon og skjema har separate, tydelige roller. |
| `/support/` | 390px og 320px | `qa/support-mobile-390.png`, `qa/support-reflow-320.png` | Skjema, faner og handlinger flyter om uten avkuttet innhold. |
| `/admin/` | 390px, utlogget | `qa/admin-mobile-390.png` | Innlogging er lesbar og har komfortable trykkmål. |

## Kontroller

| Kontroll | Resultat | Bevis eller begrunnelse |
|---|---|---|
| Samsvar med valgt retning | Bestått | Den implementerte mørke redaksjonelle retningen er dokumentert i `DESIGN.md` og vist i QA-bildene. |
| Desktop | Bestått | Faktisk render kontrollert ved 1440px for forside og support. |
| Mobil | Bestått | Faktisk render kontrollert ved 390px og reflow ved 320px. |
| Lang tekst og store datasett | Ikke testet | Ingen store datasett finnes på offentlig side; admin med mange tickets krever autentisert produksjonsdata. |
| Søk, filtrering og navigasjon | Bestått / avgrenset | Offentlige lenker og ruter rendrer. Admins søk/filter-kode og ID-er er bevart, men autentisert produksjonsflyt ble ikke endret eller kjørt lokalt. |
| Tastatur og fokus | Bestått statisk kontroll | Alle eksisterende semantiske knapper/labels er bevart; global `:focus-visible` er synlig. Full manuell tastaturrunde er ikke kjørt. |
| Kontrast og reflow | Bestått | Målt hovedkombinasjoner: 17.16:1, 7.69:1, 13.02:1 og 7.44:1. Reflow kontrollert ved 320px. |
| Redusert bevegelse | Bestått statisk kontroll | `prefers-reduced-motion` reduserer alle varigheter og beholder innhold synlig. |
| Bevaring av eksisterende data/ID-er | Bestått | Backend-filer er uendret. Skriptkontroll bekrefter at alle `querySelector('#…')`-referanser fortsatt finnes. |
| Build og relevante tester | Bestått / ikke relevant | Statisk prosjekt uten build-kommando. Inline JavaScript og alle Netlify Function-moduler passerer syntakskontroll. |

## Estetisk vurdering

Viktigste styrke med konkret eksempel: Forsiden prioriterer nå ett sterkt budskap, med kompetanse som en roligere rail og Arc som et tydelig materialskifte.
Viktigste svakhet med konkret eksempel: Arc har foreløpig ingen ekte produktbilder eller demonstrasjon, fordi slike godkjente ressurser ikke finnes i repoet.
Hva som er rettet: Generisk sentrert mal, cyan glød/rutenett, gradienttekst, overbruk av glasskort og dekorativ puls.
Hva som gjenstår: Autentisert visuell kontroll av adminlisten med reelle tickets kan gjøres separat etter deploy.

## Beslutning

Brukerens tilbakemelding: Avventer vurdering av den publiserte versjonen.
Godkjent / mer arbeid / avventer: Klar for publisering; visuell brukergodkjenning avventer.
Neste avgrensede steg: Publiser via `main`, kontroller Netlify-deploy og åpne produksjonssidene.
