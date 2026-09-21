# Arc by Nortivo – gjør appen klar til versjon 1.0

Du skal jobbe videre med min eksisterende app, **Arc by Nortivo**, og gjøre den klar til sin første ordentlige lansering.

Appens hovedidé er å samle oversikt over penger, forbruk, budsjetter, kalorier, skritt og daglig fremgang på ett sted.

Det finnes allerede et prosjekt. **Ikke bygg en ny app fra bunnen av, og ikke erstatt fungerende løsninger bare fordi du foretrekker en annen teknologi.** Undersøk hva som faktisk finnes, finn svakhetene og forbedre den eksisterende appen.

Dette er ikke bare en oppgave der du skal gi anbefalinger. Du skal gjennomføre nødvendige endringer i prosjektet, teste dem og dokumentere hva som fortsatt eventuelt hindrer lansering.

Mine viktigste krav til versjon 1.0 er:

- Appen skal være stabil, gjennomført og enkel å bruke.
- Den skal ha et ordentlig, samlet søk etter kalorier og næringsinnhold i mat og drikke.
- Hele appen skal fungere på både norsk bokmål og engelsk.
- Standardspråket skal være norsk for nye installasjoner i Norge og engelsk utenfor Norge, med en ærlig og dokumentert løsning når nedlastingslandet ikke kan fastslås.
- Brukeren skal alltid kunne endre språk selv, og valget skal huskes.

## 1. Undersøk prosjektet før du endrer noe

Les relevante prosjektinstruksjoner, README, eventuell AGENTS.md, eksisterende dokumentasjon, konfigurasjon og kode.

Finn ut hvilken teknologistakk appen bruker, hvordan data lagres, hvilke integrasjoner som allerede finnes, og hvordan appen faktisk distribueres. Ikke anta at den er en vanlig nettside, PWA, iOS-app eller Android-app før du har undersøkt dette.

Kartlegg hovedsidene, navigasjonen, datamodellene, innstillingene, autentiseringen dersom den finnes, og hvordan penger, kalorier og skritt beregnes.

Skill tydelig mellom funksjoner som faktisk er implementert og funksjoner som bare er beskrevet i tidligere planer.

Sjekk prosjektets Git-status før endringer. Bevar arbeid som allerede ligger der. Ikke overskriv, tilbakestill eller slett endringer du ikke har laget.

Kjør tilgjengelige tester og byggesjekker tidlig, slik at du vet hvilke problemer som fantes før du begynte.

Lag deretter en konkret arbeidsliste. For hvert viktig problem skal du beskrive hva som er feil, hvordan det kan gjenskapes, hva som må endres og hvordan rettingen skal testes.

**Ikke stopp etter kartleggingen. Fortsett med gjennomføringen av arbeid som ikke krever avklaringer eller særskilt godkjenning.**

## 2. Prioriter det som faktisk er nødvendig for 1.0

Del arbeidet inn i tre nivåer:

**P0 – kritiske feil:** Datatap, sikkerhetshull, krasj, feil summer, ødelagt lagring, innlogging som ikke fungerer eller andre problemer som gjør kjernefunksjonene upålitelige.

**P1 – nødvendig før lansering:** Kalorisøket, full språkstøtte, riktig automatisk standardspråk, viktige mobilproblemer og uferdige kjernefunksjoner.

**P2 – ekstra forbedringer:** Mindre visuelle justeringer, ekstra snarveier og funksjoner som ikke er nødvendige for en stabil første lansering.

Rett P0 først. Ikke bruk mye tid på dekorasjon mens viktige funksjoner fortsatt er ødelagt.

Mine obligatoriske krav skal ikke flyttes til «senere» uten at du tydelig forklarer hva som blokkerer dem.

Samtidig skal du unngå unødvendig utvidelse av prosjektet. Ikke legg til sosiale funksjoner, nye abonnementsløsninger, en AI-coach eller andre store funksjoner jeg ikke har bedt om.

## 3. Norsk og engelsk i hele appen

Implementer et ordentlig system for oversettelser som passer den eksisterende teknologistakken. Gjenbruk det som allerede finnes dersom det er egnet.

Språkene i versjon 1.0 skal være:

**Norsk bokmål:** Bruk en konsekvent språkkode, for eksempel `nb`, og passende norsk formatering.

**Engelsk:** Bruk `en` og konsekvent engelsk tekst.

Alle brukerrettede tekster skal håndteres gjennom dette systemet, ikke gjennom tilfeldige betingelser spredt rundt i komponentene.

Dette gjelder navigasjon, overskrifter, knapper, skjemaer, plassholdertekst, feilmeldinger, bekreftelser, varsler, tomme tilstander, lastetilstander, grafer, innstillinger, onboarding og tilgjengelighetstekster.

Oversett også meldinger som kommer fra appens egne serverfunksjoner. Ikke vis interne feilkoder eller tekniske engelske feilmeldinger direkte til brukeren.

Norsk skal være naturlig bokmål med æ, ø og å. Engelsk skal være naturlig engelsk, ikke en klønete ord-for-ord-oversettelse.

Bruk komplette setninger der det er nødvendig. Ikke bygg setninger ved å sette sammen små oversatte tekstbiter som kan få feil ordstilling.

Håndter entall, flertall, datoer og tall konsekvent.

**Ikke oversett brukerens egne notater, egendefinerte navn eller merkenavn automatisk.**

Legg inn en kontroll som finner manglende oversettelsesnøkler. Det skal ikke dukke opp tekster som `settings.language.title` i den ferdige appen.

## 4. Automatisk standardspråk basert på land

Dette er et viktig produktkrav:

**Norge → norsk bokmål.**

**Alle andre land → engelsk.**

Sverige og Danmark skal også få engelsk som standard. Norsk systemspråk skal ikke alene føre til norsk app dersom en pålitelig landindikasjon sier at installasjonen er utenfor Norge.

### Finn ut hvilken landinformasjon plattformen faktisk gir

Skill mellom nedlastingsland, butikkregion, enhetens regioninnstilling og geografisk plassering ved første oppstart. Ikke behandle disse som identiske.

På Apple-plattformer beskriver Storefront land eller region knyttet til App Store-butikken. Landkoden er på tre bokstaver. Undersøk om dette er tilgjengelig og egnet i prosjektet, men ikke kall det dokumentert fysisk nedlastingsland.
Kilde: https://developer.apple.com/documentation/storekit/storefront/countrycode

På Android kan Google Play Billing oppgi brukerens Google Play-land. Dokumentasjonen har begrensninger på lagring og bruk av disse opplysningene. Ikke lagre landdata fra denne løsningen eller bruke dem til profilering. Undersøk vilkårene før eventuell bruk, og ikke bygg inn en unødvendig betalingsintegrasjon bare for språkvalg.
Kilde: https://developer.android.com/google/play/billing/integrate

For en nettapp eller PWA må du undersøke om den eksisterende driftsplattformen gir et egnet landsignal ved første besøk. Et slikt signal må beskrives som en tilnærming til land ved første bruk, ikke som en sikker registrering av nedlastingslandet.

Bruk bare landinformasjon der den aktuelle bruken er tillatt. Ikke innfør GPS-tillatelse, bakgrunnssporing eller en ny sporingstjeneste bare for å velge språk.

### Prioritet for språkvalg

Bruk følgende rekkefølge:

1. Et språk brukeren uttrykkelig har valgt.
2. Et tidligere lagret språkvalg eller en bevart førstegangsinnstilling, der lagringen er tillatt.
3. Automatisk valg ved første oppstart basert på beste tilgjengelige og tillatte landsignal.
4. Engelsk dersom landet ikke kan fastslås.

Dokumenter hvilken landkilde du bruker på hver støttet plattform, og hvilke begrensninger den har.

Ikke påstå at løsningen alltid vet hvor appen fysisk ble lastet ned. Dersom dette ikke kan fastslås, skal appen bruke en dokumentert reserveløsning og ha et lett tilgjengelig språkvalg.

### Brukeren skal ha kontroll

Legg inn **«Språk / Language»** i innstillingene, med valgene **«Norsk (bokmål)»** og **«English»**.

Gjør språkvalget tilgjengelig under første oppstart uten at brukeren må forstå hele appen først.

Bytte av språk skal oppdatere hele grensesnittet uten å slette data, miste utfylte skjemaer eller kreve ny innlogging.

Husk brukerens valg ved senere oppstarter. Dersom appen har kontoer og synkronisering, må språkpreferansen håndteres per bruker uten å lekke mellom kontoer på samme enhet.

Ikke overstyr et manuelt valg når brukeren reiser, bytter nettverk eller bruker VPN.

Unngå at appen først viser ett språk og plutselig bytter etter at brukeren har begynt å bruke den. Et forsinket svar fra landoppslaget må aldri overstyre et nyere manuelt språkvalg.

Bevar eksisterende brukeres språkpreferanser under oppgraderingen til 1.0.

## 5. Hold språk, valuta og måleenheter adskilt

Å bytte til engelsk skal **ikke** automatisk endre NOK til USD, konvertere beløp eller endre gram til ounces.

Språk, valuta, matmarked, tidssone og måleenheter skal behandles som separate innstillinger eller separate dataverdier.

En bruker skal kunne bruke engelsk grensesnitt med norske kroner og norske matvarer.

Eksisterende pengebeløp, registreringsdatoer og næringsverdier skal ikke endres som følge av språkbytte.

Test inntasting av desimaltall på begge språk. Brukeren må få en forståelig feil dersom et tallformat er tvetydig eller ugyldig, i stedet for at appen lagrer et annet beløp enn forventet.

## 6. Bygg et samlet kalori- og matsøk

Jeg vil kunne søke etter mat og drikke direkte i appen, velge riktig produkt, angi mengde og legge det til i dagsloggen.

Jeg skal ikke måtte søke på nettet og skrive inn næringsinnholdet på nytt hver gang.

Med «universelt søk» mener jeg **ett samlet søk med bred dekning**, ikke en falsk garanti om at absolutt alle produkter i verden finnes.

Søket skal støtte vanlige råvarer, merkevarer, matvarer fra dagligvarebutikker, drikke og restaurantprodukter der en egnet datakilde faktisk finnes.

Det skal fungere med både norske og engelske søkeord.

### Datakilder

Undersøk først om prosjektet allerede har en egnet integrasjon. Utvid en fungerende løsning fremfor å lage et parallelt system.

Vurder disse kildene:

**Matvaretabellen:** Relevant for norske matvarer og grunnleggende næringsdata. Den tilbyr data på både norsk og engelsk og legger til rette for mellomlagring. Oppgi Matvaretabellen som kilde ved bruk.
Kilde: https://www.matvaretabellen.no/api/

**Open Food Facts:** Relevant for merkevarer, pakkede produkter og strekkodeoppslag. Dataene er bidragsbaserte, og kilden garanterer ikke at alle opplysninger er riktige eller komplette. Appen må derfor kunne håndtere manglende og usikre data.
Kilde: https://openfoodfacts.github.io/openfoodfacts-server/api/

**USDA FoodData Central:** Vurder dette som en tilleggskilde for råvarer og engelskspråklig dekning. API-et krever nøkkel, og nøkkelen skal ikke gjøres offentlig tilgjengelig.
Kilde: https://fdc.nal.usda.gov/api-guide

Bruk oppdatert offisiell dokumentasjon for endepunkter, felter og begrensninger. Ikke gjett hvordan et API fungerer basert på gamle eksempler.

Velg en løsning som passer appens størrelse og eksisterende drift. Ikke gjør et betalt abonnement til et skjult krav.

Dersom en kommersiell kilde er nødvendig for ønsket dekning, skal du forklare hva den tilfører, hva som fungerer uten den og hvilke beslutninger jeg må ta før den aktiveres.

### Lisenser og kildebruk

Undersøk vilkår for lagring, indeksering, viderebruk og visning av data og produktbilder. Open Food Facts har egne lisenser for databasen, innholdet og bildene. Ikke anta at alle deler kan behandles likt.
Kilde: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/

Ikke slå sammen store datasett permanent uten å undersøke konsekvensene. Bevar informasjon om hvor opplysningene kommer fra.

Bruk private brukerregistreringer som private data. Ikke send brukernes egne matvarer eller matlogger videre til en offentlig database uten et uttrykkelig valg.

## 7. Søket skal være raskt, relevant og robust

Lag en felles søketjeneste som kan hente fra de valgte kildene og gi appen et konsekvent resultatformat.

Hold kildeintegrasjonene adskilt, slik at én kilde kan vedlikeholdes eller erstattes uten at hele matloggen må bygges om.

Hvert resultat skal ha nødvendige opplysninger som navn, merke når det finnes, kilde, kilde-ID, relevant marked og hvilket grunnlag næringsverdiene gjelder for.

Skill mellom per 100 gram, per 100 milliliter og per porsjon.

### Relevante resultater

Prioriter treff som faktisk passer søket. Et eksakt strekkodetreff eller et eksakt produktnavn med riktig variant skal komme foran løse treff.

Unngå at nesten like resultater fyller hele listen. Ikke slå sammen produkter som bare har lignende navn, men ulik størrelse, oppskrift, tilberedning eller næringsverdi.

La brukeren forstå forskjellen mellom en generell matvare og et konkret merkevareprodukt.

Søk etter «apple» og «eple» skal kunne finne relevante matvarer gjennom tilgjengelige oversettelser eller kontrollerte søkeordkoblinger. Ikke generer oppdiktede næringsverdier som del av oversettelsen.

Prioriter riktig marked der dette er kjent, men gi mulighet til å søke bredere.

Restaurantprodukter må merkes med relevant land eller marked. Ikke presenter næringsdata fra ett land som bekreftede norske verdier.

### Nettverk og begrensninger

Bruk mellomlagring, avbryt utdaterte forespørsler og håndter tidsavbrudd.

Ikke send et nytt eksternt søk for hvert tastetrykk uten å undersøke leverandørens regler. Open Food Facts advarer uttrykkelig mot å bruke deres begrensede søkeendepunkter direkte til søk for hvert tastetrykk. Bruk lokal søking, en egnet indeks eller et tydelig søketrinn når det er nødvendig.
Kilde: https://openfoodfacts.github.io/openfoodfacts-server/api/

Beregn belastning for hele appen, ikke bare én testbruker. Ta hensyn til at mange brukere kan dele samme utgående serveradresse.

Dersom én datakilde er utilgjengelig, skal resten av søket fortsatt fungere der det er mulig. Skill mellom «ingen treff» og «en datakilde svarte ikke».

Vis forståelige tilstander for lasting, manglende nett, delvise resultater og feil. Ikke la brukeren sitte med en evig lastesirkel.

## 8. Næringsverdier og mengder må beregnes riktig

**Ikke bruk AI-gjetninger som dokumenterte kaloriverdier.**

Manglende opplysninger skal vises som ukjent eller utilgjengelig, ikke automatisk som null.

Et produkt med bekreftet nullverdi må samtidig kunne registreres korrekt. Skill derfor mellom `0` og manglende data.

Normaliser data fra de forskjellige kildene før de brukes i beregninger. Bevar informasjon om original enhet, porsjonsgrunnlag og kilde.

Brukeren skal kunne registrere gram, milliliter og dokumenterte porsjoner. Andre enheter kan tilbys når det finnes et pålitelig omregningsgrunnlag.

**Ikke anta at én milliliter alltid tilsvarer ett gram.**

Ikke anta at én porsjon alltid er 100 gram. En «skive», «boks» eller «flaske» må ha en kjent størrelse, ellers må brukeren oppgi mengden.

Skill tydelig mellom rå og tilberedt mat når datakilden gjør det.

Dersom kildeverdien er oppgitt i kilojoule og må omregnes, skal omregningen være eksplisitt og testet. Unngå å blande kilojoule og kilokalorier i samme felt.

### Beregningstester

Bruk blant annet disse syntetiske testverdiene:

En testmatvare med **250 kcal per 100 gram**, registrert som **150 gram**, skal gi **375 kcal**.

En testdrikk med **40 kcal per 100 milliliter**, registrert som **500 milliliter**, skal gi **200 kcal**.

Dette er testdata, ikke påstander om bestemte produkter.

Test også desimalmengder, manglende porsjonsvekt, ugyldige enheter, negative verdier og svært store inntastinger.

### Bevar historikken

Når en matvare registreres, skal loggen bevare mengden og næringsverdiene som faktisk ble brukt på registreringstidspunktet, sammen med kildehenvisningen.

En senere oppdatering i en ekstern database skal ikke stille endre brukerens gamle dagslogger.

Redigering og sletting skal oppdatere dagsummen riktig. Gjentatte trykk eller nettverksforsøk skal ikke lage utilsiktede dobbeltregistreringer.

## 9. Gjør matregistreringen enkel i daglig bruk

Bygg en tydelig flyt:

**Søk → velg matvare → angi mengde → se beregnet næringsinnhold → legg til.**

Brukeren skal kunne velge riktig dag og måltid uten unødvendige skjermbytter.

Vis nok informasjon før lagring til at brukeren kan oppdage feil produkt eller feil porsjon.

Legg til favoritter og nylig brukte matvarer, slik at vanlige registreringer går raskere neste gang.

Gi mulighet til å opprette en egen matvare når det ikke finnes et passende treff. Merk den som brukerdefinert, og gjør den enkel å finne igjen.

Brukeren skal kunne redigere og slette egne registreringer.

Støtt strekkodeoppslag dersom den valgte datakilden gir dette. Kameraskanning kan legges til dersom prosjektet og plattformen støtter det på en forsvarlig måte, men skal ikke forsinke de obligatoriske kravene unødvendig.

Be bare om kameratilgang når brukeren faktisk starter skanning. Avvist tillatelse skal ikke ødelegge vanlig tekstsøk.

Ved manglende nett skal appen bevare utfylte opplysninger. Lokalt tilgjengelige favoritter og tidligere matvarer skal fortsatt kunne brukes der lagringsløsningen tillater det.

Ikke vis en registrering som lagret dersom lagringen faktisk feilet.

## 10. Kontroller penger, budsjetter og skritt

Kalorisøket skal ikke forbedres på bekostning av resten av appen.

### Penger og budsjetter

Kontroller oppretting, redigering og sletting av utgifter, kategorier, datoer, månedsoversikter og budsjettgrenser.

Test følgende scenario:

Jeg setter et matbudsjett på **2 300 kroner** for måneden. Jeg registrerer **120 kroner** og deretter **80 kroner**. Appen skal vise **200 kroner brukt** og **2 100 kroner igjen**.

Kontroller at endring av kategori eller dato flytter beløpet til riktig oversikt, og at sletting oppdaterer summene.

Håndter penger med en konsekvent tallrepresentasjon og avrunding. Ikke skjul negative budsjettavvik som om brukeren fortsatt har penger igjen.

Unngå at språkbytte endrer beløp eller valuta.

### Skritt og daglig fremgang

Undersøk hvordan skritt faktisk registreres i prosjektet.

Ikke presenter manuell registrering som automatisk måling. Ikke vis oppdiktede skrittall når en integrasjon mangler.

Dersom automatisk import finnes, må tillatelser, feilsituasjoner og mulige dobbeltellinger undersøkes.

Kontroller dagsgrenser, månedsskifter og tidssoner. En ny dag skal ikke slette gårsdagens historikk.

Brukeren skal forstå forskjellen mellom dagens registreringer, historiske data og eventuelle mål.

## 11. Forbedre designet uten å ødelegge appens identitet

Appen skal se moderne, ryddig og bevisst utformet ut, ikke som et generisk AI-dashboard.

Bevar eksisterende visuell identitet der den fungerer. Forbedre typografi, avstander, hierarki, konsistens og brukervennlighet.

Bruk mine eksisterende design- og animasjonsskills dersom de finnes i prosjektmiljøet, blant annet `noah-elite-web-art-director` / Visual Craft 3 og relevante skills fra Emil Kowalski. Les de faktiske instruksjonene før bruk. Ikke påstå at du har brukt en skill som ikke er tilgjengelig.

Prioriter mobilopplevelsen. Kontroller små skjermer, lange tekster, tastaturet, dialogvinduer, bunnavigasjon og viktige handlingsknapper.

Engelske og norske tekster skal begge passe uten å bli klippet eller ødelegge oppsettet.

Sørg for tydelige fokusmarkeringer, forståelige knappenavn, tilstrekkelig kontrast og bruk med skjermleser der plattformen støtter det.

Animasjoner skal være rolige og nyttige. Respekter innstillinger for redusert bevegelse.

**Vanlige feilrettinger og forbedringer innenfor eksisterende design kan gjennomføres direkte. Dersom du foreslår et større redesign, skal du først vise tre faktiske designbilder, la meg velge retning og vente på godkjenning før du koder redesignet.**

Dette skal ikke stoppe uavhengig arbeid med feilretting, språk og dataintegrasjoner.

## 12. Lagring, sikkerhet og oppgradering

Eksisterende brukerdata skal bevares når appen oppgraderes.

Lag nødvendige databasemigreringer med en tydelig plan for testing og tilbakeføring. Ikke bruk sletting av data som en snarvei for å få ny kode til å fungere.

Kontroller at innstillinger, matlogger, budsjettdata og skritt fortsatt finnes etter omstart, oppdatering og ny innlogging der dette er relevant.

Dersom appen har flere brukere, må tilgang til data kontrolleres på serversiden eller i den faktiske dataløsningen. Ikke stol på at en bruker-ID sendt fra klienten er tilstrekkelig.

Test at én bruker ikke kan lese eller endre en annen brukers data.

Hold hemmelige nøkler utenfor klientkode, repository og logger. Dokumenter nødvendige miljøvariabler i en trygg eksempelfil uten virkelige hemmeligheter.

Ikke send personlige matlogger, økonomidata eller identifiserende informasjon til eksterne matdatabaser når et vanlig produktsøk er tilstrekkelig.

Undersøk hvilke personvernopplysninger og brukerfunksjoner den faktiske distribusjonen krever. Beskriv reell databehandling, ikke en generell mal som ikke stemmer med appen.

Ikke erklær appen juridisk godkjent bare fordi den har fått en personverntekst.

## 13. Test hele brukerreisen, ikke bare at koden bygger

Bruk prosjektets eksisterende testverktøy der de er egnet. Legg til tester for ny funksjonalitet og viktige feilrettinger.

Kjør bygg, relevante kodekontroller og automatiserte tester. Undersøk også appen visuelt og gjennom faktiske brukerhandlinger der verktøyene er tilgjengelige.

### Obligatoriske språktester

Test førstegangsoppstart med pålitelig Norge-indikasjon og engelsk systemspråk: standardspråket skal bli norsk.

Test en pålitelig landindikasjon utenfor Norge og norsk systemspråk: standardspråket skal bli engelsk.

Test ukjent land, manuelt engelskvalg i Norge, manuelt norskvalg utenfor Norge, omstart, oppgradering og bytte mellom kontoer.

Test at et forsinket landsvar ikke overstyrer et manuelt språkvalg.

### Obligatoriske mattester

Test norske og engelske søkeord, råvarer, merkevarer, drikke, ingen treff, manglende næringsverdier, feil fra én datakilde og manglende nett.

Test mengdeberegninger, lagring, redigering, sletting, favoritter og egen matvare.

Bruk kontrollerte testdata til beregningstester, og gjennomfør egne integrasjonstester mot de faktiske kildene. Skill tydelig mellom disse.

### Obligatoriske stabilitetstester

Test tom konto, konto med mye historikk, dårlig nett, dobbelttrykk, avbrutt lagring, månedsskifte og oppgradering fra eksisterende datamodell.

Test begge språk på relevante skjermstørrelser og i eventuelle eksisterende lyse og mørke temaer.

Ikke slå av tester, typesjekking eller validering bare for å få et grønt resultat.

**«Koden bygger» er ikke det samme som «appen er klar til lansering».**

Hvis du ikke kan gjennomføre en test i miljøet, skal du markere den som ikke gjennomført og forklare hva som mangler.

## 14. Leveranse og godkjenning før lansering

Oppdater prosjektets relevante dokumentasjon med oppsett, miljøvariabler, datakilder, språklogikk, migreringer og kjente begrensninger.

Lag en oversiktlig sjekkliste for versjon 1.0 og en endringslogg som beskriver faktiske endringer.

Klargjør versjonsinformasjon og nødvendige byggfiler for den distribusjonsformen prosjektet bruker.

Skill mellom arbeid som er implementert, arbeid som er testet og arbeid som faktisk er klart for produksjon.

Sluttrapporten skal inneholde hva du har rettet, hvordan kalorisøket fungerer, hvordan standardspråket velges, hvilke tester som er kjørt, og hvilke problemer eller avklaringer som gjenstår.

Ikke beskriv appen som ferdig dersom det fortsatt finnes åpne P0-feil eller obligatoriske P1-krav som ikke fungerer.

Hvis du mangler en API-nøkkel, ekstern konto eller tilgang, skal du forklare nøyaktig hva som mangler uten å late som integrasjonen er testet. Fortsett samtidig med alt arbeid som ikke er blokkert.

**Ikke publiser appen offentlig, aktiver betalte tjenester eller gjennomfør irreversible produksjonsendringer før jeg har godkjent det.**

Start nå med å undersøke prosjektet, gi meg en kort oversikt over de viktigste funnene og gjennomfør deretter forbedringene i en fornuftig rekkefølge. Hold meg oppdatert med korte, konkrete meldinger underveis.

**Målet er en stabil og gjennomført Arc by Nortivo 1.0 med ekte matsøk, full norsk og engelsk støtte og et standardspråk som følger landregelen så langt plattformen faktisk gjør det mulig.**
