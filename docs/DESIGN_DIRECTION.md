# Designretning

Status: Implementert direkte etter brukerens instruks
Prosjekt: Nortivo website
Dato: 2026-09-17
Omfang: Forside, support og admin
Gjeldende brukerbestilling: Gjør siden mindre «vibe code» og mindre basic ved bruk av design- og animasjonsferdighetene.

## Oppgave og rammer

Viktigste besøkendeoppgave: Forstå hva Nortivo bygger, eller få hjelp uten omvei.
Innhold/funksjoner som må bevares: Nortivo-navnet, gründerkreditering, Arc, `/support/`, `/admin/`, skjema-ID-er og Netlify-funksjoner.
Avvist tidligere retning: Generisk mørk cyan side med rutenett, glød og ett stort glasskort.
Eksisterende usikre opplysninger: Ingen dokumenterte kunder, caser eller salgskanal utover support.

## Faktisk undersøkte referanser

| Kilde / fil | Konkret observasjon | Prinsipp vi vil bruke | Hva vi ikke kopierer |
|---|---|---|---|
| Tidligere `dist/index.html` og live forside | Ett sentrert hero-utsagn, tre tjenesteord og ett glasskort ga alle elementer nesten samme visuelle språk. | Tydelig asymmetri og én hovedprioritet. | Rutenettbakgrunn, cyan glød og gradienttekst. |
| Tidligere `dist/support/index.html` og live support | Stor overskrift til venstre og et funksjonelt skjema til høyre, men hele flaten leste som en vanlig dark-mode-mal. | Behold den raske todelingen, gi instruksjonene og skjemaet ulike roller. | Kicker over hver overskrift og glasspreg på alle flater. |
| Eksisterende admin i `dist/admin/index.html` | List/detail-strukturen og statusene er nyttige og bør overleve. | Bevar den operative tettheten og skill den fra den offentlige landingssiden. | Store separate KPI-kort som hoveduttrykk. |

## Valgt retning

Navn / én setning som beskriver hovedideen: Mørkt redaksjonelt produktstudio med varm mint, presis typografi og rolige arbeidsflater.
Valgt av bruker i melding / dato: Direkte implementering etter instruks 2026-09-17; tidligere bildeport er uttrykkelig overstyrt for denne byggingen.
Visuelt mål, fil eller referanse: Faktisk implementasjon og QA-bilder i `docs/qa/`.

Hovedfokus og blikkrekkefølge: Nortivos formål → handling og avsender → kompetanse → Arc.
Typografiske roller: Syne for tydelige displaynivåer; Manrope for lesing og kontroller.
Palettens funksjon: Nesten svart gir ro, papirfarget tekst gir varme, mint viser handling og produktenergi.
Bildebehandling: Ingen bilder var nødvendige eller dokumenterte; tydelig type og enkel geometri bærer identiteten.
Komposisjon og tetthet: Asymmetrisk hero, smal kompetanserail, kontrasterende Arc-stripe; tett og oppgaveorientert admin.
Én eller to særegne nyttige løsninger: Kompetansene leses som en redaksjonell indeks; Arc skifter materiale fra mørk bakgrunn til papirflate.
Mobilprioritering: Én naturlig leserekkefølge, store trykkmål og ingen sideveis scrolling.

## Bilder og godkjenning før frontend-koding

Representativ side / ekte innhold: Nortivo-forside og faktisk supportskjema.
Tre konseptbilder, filreferanser: Ikke brukt; Noahs stående instruks for denne byggingen er direkte implementering uten ny A/B/C-runde.
Valgt retning og brukerens beskjed: Forbedre den publiserte siden direkte med design- og animasjonsferdighetene.
Nøyaktig godkjent bildeversjon: Ikke relevant under overstyringen.
Uttrykkelig godkjenning / implementeringsbeskjed, dato: Brukerens melding 2026-09-17.
Tillatt implementeringsomfang: Visuell og innholdsmessig forbedring av nettstedet, uten å endre backend-kontraktene.

## Etter implementering og testing

Status: Implementert, testet lokalt og klar for publisering.
Viktigste endringer: Ny komposisjon, lokalt lastede skrifter, nytt fargesystem, form- og adminpolering, hensiktsdrevet motion og redusert-bevegelse-støtte.
Avvik fra visuelt mål: Ingen separat mockup ble brukt etter eksplisitt prosjektunntak.
Skjermbilder: `docs/qa/home-desktop-1440.png`, `home-mobile-390.png`, `support-desktop-1440.png`, `support-mobile-390.png`, `admin-mobile-390.png`.
