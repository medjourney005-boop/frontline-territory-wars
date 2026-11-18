# FRONTLINE Territory Wars V18 — Online 1v1

Deze versie heeft een **echte Node.js-webserver**, kamercodes en een **server-authoritative realtime 1-tegen-1-wedstrijd**. De oorspronkelijke V17-singleplayergame staat ongewijzigd in `public/solo-v17.html`.

## Direct lokaal spelen (Windows/Mac/Linux)

1. Installeer **Node.js 20 of nieuwer** via https://nodejs.org/.
2. Pak deze ZIP uit op je computer.
3. Open een terminal in de map `frontline-v18-online` en voer uit:

   ```bash
   npm start
   ```

4. Open in je browser **http://localhost:3000**.
5. Klik **Kamer aanmaken**. Open op dezelfde computer een tweede browser of apparaat dat de server kan bereiken en kies **Kamer joinen**. Vul de code in. Beide spelers klikken **Gereed**; de host klikt **Start gevecht**.

Op een tweede apparaat in hetzelfde wifi-netwerk gebruik je het lokale IP-adres van de computer, bijv. `http://192.168.1.5:3000` in plaats van `localhost` (alleen een voorbeeldadres). Windows Firewall moet inkomende verbindingen toestaan.

**Let op:** als de Node.js-server niet draait, werkt de online multiplayer niet. De bestaande V17-singleplayergame is wel te openen als lokaal HTML-bestand.

## Via internet spelen

Publiceer **de hele map** bij een Node.js-hostingprovider die WebSockets ondersteunt (zoals Render, Railway, Replit of een VPS). Configureer:

- **Start command:** `npm start`
- **Node:** 20+
- **Poort:** de host moet de `PORT`-omgevingsvariabele doorgeven (de server gebruikt die automatisch).
- **HTTPS:** ingeschakeld bij de hostingprovider. De website gebruikt dan automatisch `wss://`.

De host geeft je een **publieke HTTPS-URL**. Beide spelers openen diezelfde URL. Een gewone statische HTML-hosting zonder server is **niet voldoende**. De server is niet door ChatGPT gehost, dus er wordt hier geen fictieve publieke link verstrekt.

## Multiplayermogelijkheden

- **Privérooms** met unieke `FT-######`-code, host, twee spelers, gereedknoppen en te delen uitnodigings-URL.
- **1v1 zonder AI** — blauw en rood krijgen dezelfde startcredits, dezelfde inkomstenregels en drie startsoldaten.
- **10 slagvelden** uit V17; vier te veroveren posten, basis HP en 30 seconden eindbezetting.
- **Classic** en **Realistic Game** met **No Vision** en **No Munition**, los van elkaar instelbaar. Beide spelers hebben dezelfde instellingen.
- **Militair materieel**: infanterie, machinegunners, grenadiers, tanks, artillerie, transporttrucks, verkenners, mobiele neptanks.
- **Bouwen**: muren, zandzakken, geschutstorens, mijnenveld (100 breed, 20 credits), kazernes, tankfabrieken, reparatiedepots, radar en bunker.
- **Specials**: luchtaanval, helikopterdropping, generaal toewijzen, transporttrucks in-/uitladen.
- **Munitie**: kan in No Munition opraken; gele ring geeft voorraad weer. Bevoorrading en volledige HP-healing na **3 seconden onafgebroken contact** met eigen transporttruck.
- **No Vision**: server filtert onontdekte vijanden **voordat** hij de data naar een speler stuurt; verhulde neptanks zien eruit als echte tanks tot een verkenner ze herkent. Beide kampen hanteren dezelfde detectieregels.
- **Reconnect**: bij wegvallende verbinding pauzeert de server de match en wordt de eigen kamer via een privésessietoken hersteld. Bewaar de privécode; deel alleen de publieke kamercode met anderen.
- **Geen externe JavaScript-afhankelijkheden**: de server gebruikt uitsluitend de ingebouwde Node.js-modules.

## Besturing

| Actie | Bediening |
|---|---|
| Selecteren | Tik op eigen eenheid; sleep een selectiebox voor meerdere |
| Verplaatsen | Selecteer groep; klik of tik op de bestemming |
| Aanvallen | Rechtsklik op een zichtbaar vijandelijk doelwit; op mobiel: knop `Aanvallen` |
| Nieuwe eenheid | Kies links type; klik binnen je spawnzone |
| Max. tien rekruteren | Ctrl bij plaatsing of mobiele knop `10× rekruteren` |
| Bouwen en mijnen | Kies gebouw; klik in eigen gebied |
| Muur/mijnen draaien | Q / E of draaiknoppen |
| Munitie bevoorraden | Rij je transporttruck tegen de eenheid aan en houd 3 seconden contact |

## Testen

```bash
npm test
```

Dit test de kernregels en een echte WebSocket-verbinding met twee spelers.

## Afbakening

Dit is de **eerste multiplayer-implementatie** en geen byte-voor-byte port van de V17-singleplayer-engine. De publieke gameplay-elementen zijn opnieuw geïmplementeerd in een centrale server, zodat beide spelers dezelfde stand krijgen. Niet alle V17-details hebben al volledige parity (bijvoorbeeld de precieze A*-routeoptimalisatie, de singleplayer-AI en permanente carrièredata voor generaals). Voor serieuze publieke uitrol zijn onder meer extra loadtests, moderatie, servermonitoring en eventueel opslag van sessies nodig. De rooms staan voorlopig in RAM en gaan verloren wanneer de server herstart.
