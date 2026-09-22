# Lokal bygging og forhåndsvisning

Kjør fra prosjektroten med Node.js; ingen pakkeinstallasjon er nødvendig.

```powershell
node scripts/build-locales.mjs
node --test tests/*.test.mjs
node scripts/serve.mjs
```

Bygget leser de engelske kildesidene i `dist` og ordbøkene `assets/site-copy.json` og `assets/portal-copy.json`. Det genererer `/nb/` og `/en/` for forside, produkter, support, admin og personvern. Kun markert tekst og attributter oversettes; skjemaverdier, nøstede elementer og delte ressurser bevares. Manglende kildefiler eller oversettelser stopper bygget før nye filer skrives. Kjør bygget på nytt etter endring av kilder eller ordbøker; ikke rediger de genererte sidene direkte.

Forhåndsvisningen åpnes på `http://127.0.0.1:4399`. Valgfri port: `node scripts/serve.mjs --port 4400`. Den starter bare når kommandoen kjøres direkte. Testene åpner ingen serverport. De eldre rutene viser engelsk kilde uten automatisk videresending. Manglende sider returnerer 404, og alle lokale supportfunksjoner returnerer 503 med en tydelig forklaring: ingen e-post sendes og ingen sak opprettes.

`netlify/edge-functions/language.js` håndterer bare de fem eldre GET/HEAD-rutene i drift. Gyldig `?lang=nb/en` vinner over språkcookie, deretter kan Netlifys landkode `NO` velge bokmål. Ukjent land gir engelsk. Den bruker ingen GPS eller eksterne geo-API-er. Videresendingen er 307 og skal ikke caches. Eksisterende søkeparametere bevares bortsett fra `lang`; fragmenter sendes ikke til serveren og håndteres av nettleseren.

Rutene er deklarert direkte i funksjonen. Dette følger Netlifys [API](https://docs.netlify.com/build/edge-functions/api/), [deklarasjoner](https://docs.netlify.com/build/edge-functions/declarations/) og [veiledning om caching](https://docs.netlify.com/build/edge-functions/optional-configuration/). Lokal enhetstest verifiserer funksjonslogikken; Netlifys faktiske geosignal og deploy må testes separat. Ingen av kommandoene over publiserer nettstedet.
