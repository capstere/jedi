# Hissrum Strike — Cartridge Strike: Miniature Edition

En separat **spelbar FPS-spin-off** inuti originalmodellen `Hissrum12_V5_med_39_objekt.glb` från `capstere/jedi`.

**Spelet är fristående från Layout Studio V5.** Ingen av studions befintliga filer, exporter eller scenarioskrivningar ändras av denna variant.

## Starta

1. Öppna repositoryts webbserver (GitHub Pages från repo-roten eller kör från repositoryts rot med `python3 -m http.server 8000`).
2. Gå till `/games/hissrum-strike/` (lokalt `http://localhost:8000/games/hissrum-strike/`).
3. Välj Endless eller Classic, svårighetsgrad och vapen och starta.

**Spelarens perspektiv är skala 1:10**: en 1,7 spel-enheter hög spelare motsvarar ungefär 17 cm i hissrummets meterkoordinater. GLB-filen skalas 10 gånger i spelvärlden; originalet ändras aldrig.

### Spel

- **Endless**: fem Analysts (du + fyra botar) mot fem Counter Analysts; automatisk respawn, fritt stridsscenario.
- **Classic**: 5 mot 5 i rundor med samma bomb-/gisslanmekanik som ursprungliga Cartridge Strike. Startkapitalet höjt så valt vapen kan köpas i startfasen.
- Samma Cartridge Strike-komponenter för spelregler, vapen, träffar, AI-beteende, reaktioner och svårighet; en separat karta, renderer och kontroller.
- Dator: **WASD**, mus, **R** ladda, **1–4** utrustning, **Shift** smyg, **Ctrl** huka, **Space** hoppa, **E** interagera, **B** köp (Classic), **Esc** paus.
- Mobil: kompakt vänster rörelseplatta, svep på höger sida för sikte, knappar för skott, omladdning, hopp och interaktion. Pausknappen längst ner är separat klickbar.

Det är **lokalt botspeleläge, inte nätverksmultiplayer**.

## Modell och kollision

Rummet laddas direkt från repositoryts enda originalfil:

`../../Hissrum12_V5_med_39_objekt.glb` (räknat från spelets index.html).

- Modellens faktiska trianglar bygger både Three.js Octree-kollisioner och projektilernas synlighets-/träfftester; inga handritade/osynliga kollisionsväggar läggs till.
- **Viktig koordinatregel:** Source-GLB:s `floor__floor` ligger runt Y=0 meter medan `base__trim` sticker 19 cm *under* golvet. Nollställ därför aldrig spelarens position med GLB-modellens lägsta Y. Den buggen orsakade tidigare en kamera under rummet.
- Spelplanens X/Z-utsträckning, minikarta och spawnpunkter beräknas från `floor__floor`, inte objekt som ligger utanför rummet. Spelaren börjar i rummets centrala gång och tittar mot den blå godshissen.
- Gångbara celler härleds från de trianglar i modellen som representerar golvet. Navigationen behåller den största verkligt sammanhängande golvytan och verifierar alla passager med samma kollisionsvolym som spelarna.
- Spawns, bombplats och gisslan placeras dynamiskt på gångbar yta i samma rum, inte i artificiella rum eller korridorer.
- Kollisionsnavigeringen förberäknas vid laddning; efteråt återanvänds den. Grafikkvalitet och skärmupplösning begränsas på mobil; ingen dynamisk skuggkarta krävs.
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

Det obligatoriska Chromium-testet på CI öppnar **original-GLB:n** i desktop- och iPhone-viewport, verifierar golvets referenshöjd och spelarens kameraposition, mäter ljus/kontrast i renderade skärmbilder, kontrollerar mobilknapparnas storlek och kör paus/återupptagning med mus respektive touch. Skärmbilder laddas upp som GitHub Actions-artefakter.

Starta även i webbläsare och kontrollera minst: bild av de 39 objekten, mini-skala, skottträff, botars navigering runt vagnar och kartonger, respawn och att spelaren inte kan gå genom väggar eller lämna den exporterade golvytan. Testera desktop och mobil. Rekonstruerad 3D-geometri är endast spelmiljö och är inte underlag för verkliga säkerhets- eller flödesbeslut.
