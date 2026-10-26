# Människomodeller och animationer

Fyra egna fiktiva rollfigurer använder **Kenney Mini Characters 1.0** som
modellkälla. Originalpaketet är skapat 2024-07-17. Exakt paketlicens finns i
`LICENSE-KENNEY.txt`: Creative Commons Zero, CC0 1.0. Licensen granskades både på
[Kenneys officiella paketsida](https://kenney.nl/assets/mini-characters) och i den
nedladdade ZIP-filens `License.txt` den 2026-10-20.

`provenance.json` redovisar originalens filnamn, SHA-256, arkivets nedladdningsadress,
version, datum, bearbetning och vilka animationsklipp som behållits. Ingen
modell, logotyp eller grafik från The Sims används.

## Urval och optimering

- `colleague-a`: originalet `character-female-f.glb`, längre frisyr.
- `colleague-b`: `character-male-a.glb`, kort hår, glasögon och grön vardagsklädsel.
- `colleague-c`: `character-female-e.glb`, labbrock och uppsatt hår.
- `material-handler`: `character-male-e.glb`, glasögon och gula arbetsdetaljer.

Modellerna är medvetet lekfulla minikaraktärer. Användarens valda kroppslängd
skalar höjden. Horisontell skala är 0,62 av den proportionella höjdskalan för att
passa rummets planeringsskala. De är inte anatomiska personalmodeller.

Den optimerade fulla geometrin omfattar 710–788 trianglar per figur. Alla
modellernas sju ursprungliga skelettleder och de exakta ursprungliga vikterna
behålls. Palettbilden bakas till vertexfärger, så ingen textur behöver laddas
eller avkodas i webbläsaren. Samma geometri delas av alla personer med samma
utseende. En verklig andra geometrinivå klustrar kroppens vertexpositioner;
huvud, ögon och glasögon bevaras för igenkänning. Se aktuella polygonantal i
`provenance.json`.

WebGL2-koden skinnar på GPU med sju benmatriser per individ. Inget Three.js,
spelmotorramverk, CDN eller nätverksanrop används. Osynliga personer gallras
bort före teckning. Låg detaljnivå och figurer på avstånd samplar animation med
12 Hz, nära figurer med 30 Hz och hög kvalitet med 45 Hz; navigering kan fortsätta med sin
egen uppdateringstakt. Rörelserna har individuella faser.

Även Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
och [Ultimate Modular Characters](https://quaternius.com/packs/ultimatemodularcharacters.html)
granskades på uppdragets angivna officiella sidor. Inga filer därifrån används:
Kenneys betydligt mindre modeller och inbyggda klipp undviker både stora paket
och retargeting i den här leveransen.

## Verkliga klipp och förenklingar

Originalklippen `idle`, `walk`, `emote-yes`, `emote-no`, `interact-right`,
`holding-both` och `pick-up` ingår. Bara dessa sju klipp levereras. Originalets
LINEAR-nyckelrutor behålls och rotationskvaternioner interpoleras med kortaste
vägens slerp.

Idle och gång använder originalets animationer. En blick omkring använder
`emote-no`, en gest använder `emote-yes` och material i händerna använder
`holding-both`. Svängning följer navigeringens mjuka kroppsrotation ovanpå
idle. Telefonposen lägger till en enkel huvudlutning. Dance Break lägger
procedural arm-, torso- och hopprytm ovanpå originalets gest. Det finns inget
originalklipp för dans eller telefon i det levererade urvalet; dessa är tydligt
förenklade rörelser. Inga animationsklipp har hämtats från andra spel.

## Reproducera konverteringen

Hämta arkivet från den dokumenterade officiella adressen och kontrollera
SHA-256 mot `provenance.json`. Kör från V5-mappen:

```sh
python3 source/build_npc_assets.py /sökväg/kenney_mini-characters.zip
node tests/npc-assets.test.cjs
```

Konverteraren använder bara Pythons standardbibliotek. Den skriver
`characters.compact.json`, den inbäddningsbara `source/npc-assets.js`, exakt
ursprungslicens och provenance. JSON-filen är den bearbetade, redigerbara
mesh-/skelett-/animationskällan; oanvända delar av originalarkivet ingår inte.

CC0 tillåter spridning av just dessa människomodeller. Projektet som helhet
ska ändå hållas privat enligt uppdraget, eftersom det också innehåller
separat privat Cartridge-material.
