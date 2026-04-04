# Din Demokrati

Din Demokrati är en Astro-baserad webbplats som gör det enklare att följa lagförslag, propositioner, utskottsbehandling och omröstningar i Sveriges riksdag.

## Syfte

Projektet är byggt för att presentera riksdagsdata på ett mer begripligt och lättillgängligt sätt än rådata från Riksdagens öppna API.

Målet är att användaren snabbt ska kunna:

- se aktuella lagförslag
- följa hur ett enskilt förslag rör sig genom lagprocessen
- läsa relaterade dokument
- se voteringar och utskottsförslag
- få en tydligare bild av vad som händer i riksdagen

## Tech stack

- Astro
- TypeScript
- Cloudflare Workers
- Riksdagens öppna data

## Projektstruktur

```text
src/
  components/     UI-komponenter
  layouts/        Layouts
  lib/            Datahämtning och domänlogik
  pages/          Routes / sidor
  styles/         Global styling