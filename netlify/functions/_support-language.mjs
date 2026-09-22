import { json } from './_utils.mjs';

const messages = {
  en: {
    BAD_REQUEST: 'The request could not be read.', INVALID_FIELDS: 'Complete the fields with a valid email and message.',
    FORBIDDEN: 'Open this page on the Nortivo website and try again.', ACCESS_REQUIRED: 'Confirm your email to open this ticket.',
    INVALID_ACCESS: 'This link is invalid or has expired. Request a new link.', TOO_MANY_REQUESTS: 'Too many attempts. Please try again later.',
    NOT_FOUND: 'This ticket is no longer available.', UNAVAILABLE: 'Support is temporarily unavailable. Please try again.',
    METHOD_NOT_ALLOWED: 'Method not allowed.', NOT_SIGNED_IN: 'Not signed in.',
    REQUEST_ACCEPTED: 'If the details match a ticket, we will send a link to that email address. Check your inbox and spam folder.',
  },
  nb: {
    BAD_REQUEST: 'Forespørselen kunne ikke leses.', INVALID_FIELDS: 'Fyll ut feltene med en gyldig e-postadresse og melding.',
    FORBIDDEN: 'Åpne siden på Nortivos nettsted og prøv igjen.', ACCESS_REQUIRED: 'Bekreft e-postadressen din for å åpne saken.',
    INVALID_ACCESS: 'Lenken er ugyldig eller har utløpt. Be om en ny lenke.', TOO_MANY_REQUESTS: 'For mange forsøk. Prøv igjen senere.',
    NOT_FOUND: 'Denne saken er ikke lenger tilgjengelig.', UNAVAILABLE: 'Support er midlertidig utilgjengelig. Prøv igjen.',
    METHOD_NOT_ALLOWED: 'Metoden er ikke tillatt.', NOT_SIGNED_IN: 'Du er ikke logget inn.',
    REQUEST_ACCEPTED: 'Hvis opplysningene stemmer med en sak, sender vi en lenke til e-postadressen. Sjekk innboksen og søppelposten.',
  },
};

export function language(value) { return value === 'nb' ? 'nb' : 'en'; }
export function message(locale, code) { return messages[language(locale)][code] || messages[language(locale)].UNAVAILABLE; }
export function errorResponse(status, code, locale, headers = {}) { return json(status, { error: message(locale, code), code }, headers); }
