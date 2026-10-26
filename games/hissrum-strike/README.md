# Hissrum Strike — Cartridge Strike: Miniature Edition

En separat **spelbar FPS-spin-off** inuti originalmodellen `Hissrum12_V5_med_39_objekt.glb` från `capstere/jedi`.

**Spelet är fristående från Layout Studio V5.** Ingen av studions befintliga filer, exporter eller scenarioskrivningar ändras av denna variant.

## Starta

1. Öppna repositoryts webbserver (GitHub Pages från repo-roten eller kör från repositoryts rot med `python3 -m http.server 8000`).
2. Gå till `/games/hissrum-strike/` (lokalt `http://localhost:8000/games/hissrum-strike/`).
3. Välj Endless eller Classic, svårighetsgrad och vapen och starta.

**Spelarens perspektiv är skala 1:6**: en 1,7 spel-enheter hög spelare motsvarar ungefär 28 cm i hissrummets meterkoordinater. GLB-filen skalas sex gånger i spelvärlden; originalmodellen ändras aldrig.

### Spel

- **Endless**: fem Analysts (du + fyra botar) mot fem Counter Analysts; automatisk respawn, fritt stridsscenario.
- **Classic**: 5 mot 5 i rundor med samma bomb-/gisslanmekanik som ursprungliga Cartridge Strike. Startkapitalet höjt så valt vapen kan köpas i startfasen.
- Samma Cartridge Strike-komponenter för spelregler, vapen, träffar, AI-beteende, reaktioner och svårighet; en separat karta, renderer och kontroller.
- Dator: **WASD**, mus, **R** ladda, **1–4** utrustning, **Shift** smyg, **Ctrl** huka, **Space** hoppa, **E** interagera, **B** köp (Classic), **Esc** paus.
- Mobil: vänster rörelseplatta, svep på höger sida för sikte, knappar för skott, omladdning, hopp och interaktion.

Det är **lokalt botspeleläge, inte nätverksmultiplayer**.

## Modell och kollision

Rummet laddas direkt från repositoryts enda originalfil:

`../../Hissrum12_V5_med_39_objekt.glb` (räknat från spelets index.html).

- Modellens faktiska trianglar bygger både Three.js Octree-kollisioner och projektilernas synlighets-/träfftester; inga handritade/osynliga kollisionsväggar läggs till.
- Gångbara celler härleds från de trianglar i modellen som representerar golvet. Navigationen behåller den största verkligt sammanhängande golvytan och verifierar alla passager med samma kollisionsvolym som spelarna.
- Spawns, bombplats och gisslan placeras dynamiskt på gångbar yta i själva hissrummet, inte i hisskabinens extra golvyta eller i artificiella korridorer. Kameran startar från rummets södra del och är riktad mot de verkliga CREFORM-vagnarna.
- Golvet bestäms av originalmodellens `base__trim`-referens (överkant 0 m), **inte** av GLB-scenens lägsta punkt (−0,19 m). Därmed spawnar spelaren på golvet istället för under golvytan. Originalmodellens hisskabin sträcker sig utanför rummet och påverkar inte spelområdets gränser.
- Kollisionsnavigeringen förberäknas vid laddning; efteråt återanvänds den. Mobilvyn har kompakt touchlayout och kartan visar verkliga vagnar, pallar och annat GLB-innehåll. Fyra skuggfria punktljus kompletterar scenens befintliga material; ingen dynamisk skuggkarta krävs.
- Vid ändringar i GLB-filen räknas alla kolliderare om. Utgå inte från att varje ny export alltid har ett korrekt identifierat golv: validera med spelet och kontrollerna nedan.

## Filstruktur

| Mapp/fil | Ändamål |
| --- | --- |
| `index.html`, `style.css` | Egen startskärm, HUD och mobilkontroller |
| `src/main.mjs` | Spelloop, rendering, botvisualisering, vapen, touch, karta |
| `src/world.mjs` | GLB-laddning, golvgeometri, Octree, collision/raycast |
| `src/navigation.mjs` | Gångbar graf, pathfinding och validerade spawnpunkter |
| `src/fps/` | Oförändrade kopior av Cartridge Strikes regelmotor/AI med minimal fysikadapter |
| `vendor/` | Yuka och Three.js GLTF-/Octree-/Capsule-helpers |
| `licenses/` | MIT-licenser och Riposte-attribution |
| `tests/` | Statisk verifiering och navigationstester |

## Beroenden och ursprung

Engine-code återanvänds från `capstere/cartridge-strike` main på **commit `477399f39e42b5938c497df0047dea7bb463ca13`**, game version 0.13.2. Filerna under `src/fps/` är förenliga med denna snapshot och bör hållas tydligt separerade från den nya kartadaptern.

Yuka och Three.js GLTFLoader/Capsule/Octree ingår lokalt med sina upphovsrättstexter. `three@0.180.0` importeras som fast version via jsDelivr; webbläsaren måste därför ha internet vid första laddningen. CSS-fonter hämtas från Google Fonts och faller tillbaka till systemfonter om de inte är nåbara. Modellen hämtas **från samma origin som spelet**, inte från ett CDN.

## Testning

```sh
node --test games/hissrum-strike/tests/*.test.mjs
find games/hissrum-strike/src -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

En Chromium-regression för både dator och telefon körs via GitHub Actions och verifierar golvhöjd, kamerariktning mot verkliga objekt, minimapsreferenser, bildkontrast, start och paus samt att touchknappar inte överlappar statusindikatorerna. Starta även i en riktig webbläsare och kontrollera minst: bild av de 39 objekten, mini-skala, skottträff, botars navigering runt vagnar och kartonger, respawn och att spelaren inte kan gå genom väggar eller lämna den exporterade golvytan. Testera desktop och mobil. Rekonstruerad 3D-geometri är endast spelmiljö och är inte underlag för verkliga säkerhets- eller flödesbeslut.

## Cartridge Strike-karaktärer (nya)

De enkla cylinderfigurerna har ersatts med de **verkliga, riggade Quaternius Operator-modellerna** från Cartridge Strike:

- `assets/characters/quaternius-operator-male.glb` och `quaternius-operator-female.glb` är identiska originalfiler från `capstere/cartridge-strike` på commit `477399f39e42b5938c497df0047dea7bb463ca13`.
- Git SHA för male: `483f795326c96f7649ea41f44ca802c9cc87b8a5`. Git SHA för female: `df940658096e08872fe2867994fc3ecafa6f8dbb`.
- Licens: `licenses/quaternius-characters-CC0.txt`. Modellerna läses lokalt från `jedi`, **inte** över nätet från Cartridge Strike.
- `src/characters/character-library.mjs` återanvänder Cartridge Strikes skelettkloning, avatarplagg och originalklipp för idle, gång, sprint, hopp, hukning och omladdning. Geometri delas, separata animation-mixers används för varje bot.

## Golvtejp och flygläge (nya)

Original-GLB har upphöjd tejp som tidigare kolliderade med spelarens kapsel och skapade osynliga kanter. `src/collision-surfaces.mjs` identifierar tejp från objekt-/materialnamn. Renderaren fortsätter visa alla tejpremsor, medan `src/world.mjs` bygger en separat Octree från **endast solida originalmesh**; kartong, vägg, skåp, vagnar och tak behåller sina kollisionsytor. Du kan nu gå rakt över tejpen utan att hoppa.

**Flyg:** Tryck `F` på dator eller `FLYG` på mobil för att slå på/av fri 3D-svävning. WASD/joystick flyttar horisontellt, `Space`/`UPP` stiger och `Ctrl`/`NER` sjunker. Spelaren kan skjuta under flygning. Höjden hålls stilla när du släpper knapparna och normal gravitation återkommer vid avstängning. Flygande spelare är fortfarande begränsade av det riktiga rummets väggar och tak.

**Sniper rifle:** Välj `Scope 5` i startmenyn; det är samma originalvapen som i Cartridge Strike (5 skott, magasinfyllning 25 skott, 105 grundskada, lång räckvidd). Siktet ger ett 4× förstoringsläge, med `Z` eller hållen högermusknapp på dator respektive `SIKTE` på mobil. I zoomläge döljs vapnet till förmån för siktets riktmedel. `R`/`LADDA` laddar om som vanligt.

Automatiska kontroller verifierar SHA- och animationsmetadata för originalmodellerna, klassificering av tejp, rörelse upp/ner/hover, Scope 5-data, och webbläsarens flyg-/sniper-/mobilfunktioner.
