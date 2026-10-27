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

## Ljud, blod, fantasidvärgar och flygande botar (uppdatering)

Den här versionen återanvänder Cartridge Strikes egna effekt- och ljudsystem. Originalmodellen av Hissrum 12 och Layout Studio V5 är orörda.

### Ljud och blod

- Originalets `src/fps/audio.mjs` är infogat lokalt som `src/audio.mjs`. Ljudet är **positionsbaserat**: egna skott, botarnas skott, steg, metallträffar, omladdningar och explosioner hörs på olika avstånd. Ocklusion bakom rummets riktiga GLB-väggar dämpar ljud.
- Femton original-Kenney CC0-filer ligger i `assets/audio/` som OGG med verifierade Git blob-SHA från Cartridge Strike på commit `477399f39e42b5938c497df0047dea7bb463ca13`. Fjorton korta ljud har dessutom lokala MP3-kopior för iPhone Safari; ambient industrial hum skapas i Web Audio direkt. Kodstigen faller tillbaka till syntetiserade effekter om en viss codec saknas.
- Licens- och ursprungsinformation finns i `licenses/kenney-impact-sounds-CC0.txt` och `licenses/kenney-sci-fi-sounds-CC0.txt`. Ljudfilerna laddas från **jedi**, inte från en extern spelserver.
- Web Audio startas endast vid en spelstart/återupptagning eller ett ljudknappstryck, så iOS-kravet på aktiv användargest följs. Ljud är **på som standard** och kan stängas av med `M` eller knappen **LJUD/TYST** i spelet.
- Cartridge Strikes `CombatEffects` + instanserade FX-batcher ger korta blodpartiklar, verklighetsbaserade blodmärken på golv/vägg och projektilträffar/hylsor. Instanspoolerna är begränsade för att minimera lagg. I startmenyn kan du välja **På / Mindre / Av** för blod; mobil börjar med `Mindre`.

### Åtta fantasidvärgar

Originalsystemet `ActionVisuals` är portat från Cartridge Strike, inklusive de fem olikfärgade dvärgmallarna, deras kläder/skägg och gånganimationer. Som standard vandrar **åtta** självständiga fantasidvärgar på den sammanhängande, verkligt gångbara hissrumsgolvet. De har kollision mot originalmodellens hinder och kan träffas om `wanderers` är aktiverat. Ett val i startmenyn stänger av eller slår på dem.

### Botarnas flygning

Samtliga AI-botar kan **välja att flyga** i omgångar. Under en flightplan styr deras befintliga Yuka/Cartridge Strike-AI horisontell navigation och sikte, medan `src/fps/bot-flight.mjs` styr höjd. Botsvaret kontrolleras mot samma GLB-capsule-kollisioner som spelaren; inga teleporteringar eller borttagna väggar används. Högst fyra botar flyger samtidigt för att bibehålla mobilprestanda.

- Botar lyfter utspritt i tid, stiger till en begränsad nivå, kan fortsätta skjuta och sväva under strid, och flyger ned till en verifierad gångbar nod för landning.
- De lämnar ett diskret luftspår, får en ring på minimapen medan de flyger och genererar enkla start-/landningsljud.
- Uppdrag som bombplantering/desarmering och eskort prioriterar landning. Flygning kan stängas av separat i startmenyn.
- Spelarens egna tangenter är oförändrade: `F` / `FLYG`, `Space` / `UPP` och `Ctrl` / `NER`.

### Test

`node --test games/hissrum-strike/tests/*.test.mjs` kontrollerar modellfiler, licensierade ljud och MP3-fallback, åtta separerade dvärgpositioner, botflygningens uppstigning/svävning/landning och samtliga tidigare kollisionsprov. Den utökade Chromiumtesten kör det verkliga spelet på dator och iPhone-viewport, bekräftar dekodade ljud, 3D-dvärgar, botflyg samt blodpartiklar och pauskontroller.

## Taktiskt smartare botar

Hissrum Strike använder nu Yuka för grundläggande navigering och perception, plus ett litet taktiskt beslutsstöd (`src/fps/tactical-ai.mjs`) som känner till **verkliga kollisionsytor och gångvägar från V5-modellen**.

- **Skydd:** skadade och omladdande botar söker sig till gångbara platser där vagnar, hyllor eller väggar faktiskt bryter fiendens skottlinje. De går aldrig genom modellen eller till en plats utan giltig gångväg.
- **Flankering:** vissa botar försöker komma in från sidan till en synlig fiende, andra försvarar vinkel eller ger understöd. De undviker att stå i samma trånga passage som en lagkamrat.
- **Lagobservationer:** botar delar endast de senaste rapporterade positionerna från verkliga synobservationer, och dessa upphör att gälla efter några sekunder. De får ingen information om osedda spelares nuvarande positioner.
- **Elddisciplin:** botarna skjuter inte full fart med dålig riktning eller medan de springer på längre håll. Befintlig skada, reaktionstid, ammunition, sikt genom rök och svårighetsgrad gäller fortfarande.
- **Flygning som taktiskt verktyg:** när en flankare upptäckt en fiende kan boten använda en giltig högre skjutvinkel, men inte flyga genom hinder. Högst två botar flyger samtidigt, och skadade eller uppdragsupptagna botar håller sig hellre på marken.
- **Prestanda:** planeringen sker med begränsat antal verkliga golvnoder, max sju navigeringskontroller per beslut och ett kort taktiskt åtagande som förhindrar omplanering för varje bildruta.

Taktisk AI är aktiv som standard i Hissrum Strike, men originalet Cartridge Strike och Hissrum 12 Layout Studio påverkas inte. Testerna i `tests/tactical-ai.test.mjs` kontrollerar skydd, flankering, aktuell lagobservation, fördelning mellan lagkamrater, begränsade sökningar och taktisk flygning. Fulla browser-smoke-testet körs även i mobilvy.

## Originalvapen, händer och dödsanimationer

Hissrum Strike använder nu **samma förstapersonsmodeller för vapen och händer** som Cartridge Strike, hämtade från originalrepositoryts `main` på commit `a94b5dd1f87c7a080a97f020052c882271ab14ba`.

- `src/weapon-kit/` innehåller de originalskrivna vapengeometrierna (`model-primitives.mjs`), de riggade Quaternius CC0-händerna för P9, P12 och CR4 (`strike-kit-models/hands.mjs`, `authored-hand-data.mjs`), handmaterial, animationer för omladdning och den ursprungliga förstapersonsrörelsen.
- Övriga vapen såsom Vector C, AR-47, hagelgevär, Scope 5 och kniv använder originalens egna detaljerade 3D-modeller med monterade handskar, inte tidigare improviserade lådformer.
- `src/weapon-kit/weapon-view.mjs` är en tunn adapter som använder **befintlig Game-klass för ammunition, skada och träffar**. Den ursprungliga 60° vapenkameran renderas med separat djupbuffert ovanpå hissrummets scen, så väggar inte klipper händerna.
- `src/characters/death-animation.mjs` spelar upp den överförda karaktärens riktiga `Death01`-klipp. Döda botar ligger kvar en stund i stället för att bara försvinna, och efter egen död syns spelarens fall ur ett kort tredjepersonsperspektiv innan kameraläget byts till en levande lagkamrat.
- `src/navigation.mjs` fördelar Analyst- och Counter-spawnpunkterna med bred separation i samma verkligt sammanhängande GLB-golv. Varje teams fem startplatser sprids ut, inte klustras kring ett enda hörn. Ingen ny osynlig vägg tillkommer.

Tillhörande Quaternius CC0-licens och andra originallicenser är bevarade under `licenses/`. De importerade vapenkällfilerna är spelvisualiseringar och inte teknisk vapendokumentation. Automatiska tester verifierar importerade modeller, faktisk fördelning över golvet och dödsanimationsuppspelning i Chromium samt i mobilstorlek.


## v7 — mobil autoeld, progressiv rekyl och fältarsenal

På pekskärm är automatisk eld standard och skjutknappen dold för kulvapen. Siktets exakta stråle måste träffa en levande, synlig fiende inom vapnets räckvidd. Väggar, rök, lagkamrater, gisslan och dvärgar blockerar avfyrningen. Ingen automatisk siktning används. Inställningen kan ändras före start eller i pausmenyn och sparas lokalt. Manuellt läge visar skjutknappen igen. Datorn behåller musavfyrning.

Scope 5 kräver 0,32 sekunders sammanhängande sikte på samma fiende före automatisk avfyrning. Låsningen bryts vid förlorad sikt, byte av mål/vapen, paus, död eller omladdning. Automatisk halvautomatisk eld följer vapnets skottintervall och ammunition.

Rekylen är Riposte-inspirerad, inte en exakt kopia. Både dator och mobil får kameraryck och stigande rekyl under salvor. Kamera och verklig skottstråle använder samma rekylvinkel. Kort paus återhämtar rekyl och spridning; nedåtsikte kan kompensera.

KÖP / B öppnar en fältarsenal under aktiva Classic- och Endless-rundor. Den lokala botmatchen pausas under köp. Vapen, rustning och granater kostar krediter; otillräckliga krediter, fulla fack och redan utrustat vapen nekas utan debitering. Kill-belöning är fortsatt 300 krediter. Endless fyller inte längre på hela kreditpotten vid respawn när arsenalen används. Spelaren får köpa båda lagens gevär; botarnas befintliga köp- och uppdragsregler bevaras.

G / GRANAT väljer eller växlar granat. Granater kastas alltid manuellt (KASTA-knappen visas även med autoeld). Spelarens kasthastighet är 17 i stället för 9 spelvärldsenheter per sekund; botarnas granater behåller originalhastigheten. Den valfria kastbanan använder samma gravitation, kollisionsstrålar, studsar och säkringstid som riktig grenadfysik. Synliga granatprojektiler ingår.

Upp till fyra botar kan flyga samtidigt, med längre flygpass, kortare markpauser, höjdbyten och sidoförflyttning kring faktiskt observerade mål. Korta stilla intervall ger utrymme att sikta och skjuta. Rummets kollisioner gäller fortfarande och uppdragsbärare/skadade botar återgår till marken.

Nya modulgränser: `src/fps/aim-controls.mjs`, `recoil.mjs`, `grenade-ballistics.mjs` och `src/grenade-view.mjs`. `tests/arsenal-v7.test.mjs` täcker siktspärrar, sniperfördröjning, återarmning, rekyl/återhämtning, betalning, granatfysik och flygning. Browser-smoke verifierar även pausinställning, dold/manuell knapp, faktiskt automatiskt skott i original-GLB:n och köp på dator/mobil.

## Stridsfeedback från Riposte (v8)

Fyra konkreta förbättringar gör striden mer läsbar utan att ändra träffar, skada,
botarnas beslut, rekyl eller köpbalans:

1. **Träffar, huvudträffar och elimineringar** får olika riktmärken och kort text.
   Befintliga matchhändelser för double/triple elimination, sviter och assist
   visas som små poängnotiser. De betyder matchpoäng, inte extra butikskrediter.
2. **Riktad skadeindikator** visar varifrån den senaste verkliga träffen kom.
   Upp till fyra indikeringar lagras i 1,6 simuleringssekunder; den sparade
   träffpositionen följer aldrig fienden efter skottet.
3. **Lagkamratsmarkörer**: turkosa chevroner och närliggande namn hjälper dig
   känna igen ditt lag. Dolda lagkamrater markeras svagare, fiender får inga
   markörer. Markörerna döljs när du är utslagen eller använder kikarsiktet.
4. **Resultattavla** med elimineringar, dödsfall, assist, poäng och egen bästa
   svit: tryck **Tab** eller på matchklockan. Tavlan pausar den lokala botmatchen
   och kan även öppnas från matchens slutskärm. Omladdningsmätare och varning för
   låg ammunition följer vapnets verkliga omladdningstid och magasininnehåll.

Lagmarkörer och stridsfeedback kan stängas av i start-/pausmenyn; valen sparas
lokalt. Inga nya knappar läggs över mobilens siktyta. Se
`licenses/hissrum-v8-NOTICE.md` för granskade Riposte-filer och licensavgränsning.
Alla V7-funktioner (autoeld, progressiv rekyl, arsenal, granatbana, flygande botar)
är bevarade. `tests/combat-readability.test.mjs` verifierar åtkomst till faktisk
spelstatistik, inga poäng på vänlig/odödlig träff, riktning, tidsgränser och
begränsade buffertar. Fulla real-GLB browser-testet provar även mobilens tavla,
inställningar och omladdningsmätare.


## Cartridge-pansarvagn (v9)

En egen modellerad vit Cartridge-bil med blå pansarkjol, larvband och ett rörligt
kanontorn står på en gulmarkerad plats i minimapen. Den riktiga GLB-modellen,
Layout Studio och allt tidigare innehåll är oförändrat.

Gå fram till bilen och tryck **E** eller **KÖR**. Kör framåt/bakåt med **W/S**,
sväng med **A/D**; på telefon används vänster joystick. Mus/högersvep riktar
kanontornet oberoende av chassit. Skjut med musknappen eller **KANON** och bromsa
med **Space/BROMS**. **E/LÄMNA** placerar dig på en kontrollerad fri plats bredvid
bilen. Flygning, handvapen och butiken används först när du lämnat fordonet.

Bilen har **900 pansarpoäng**, reducerar vanlig kulskada och skyddar föraren.
Kanonens ammunition är obegränsad med **1,15 s** mellan skotten. Den träffar
verkliga kroppar och hinder; explosionen går inte genom väggar. Kör över
oskyddade fiender med fart för att slå ut dem. Lagkamrater, gisslan och skyddade
nyspawnade spelare blockeras i stället för att bli överkörda.

Förstörd bil får en bränd modell och ett torn som kastas upp och faller ned.
Föraren dör genom samma träff-/poäng-/Death01-system som vanlig strid. Efter
**12 simuleringssekunder** återkommer en ny bil med fullt pansar på exakt samma
ursprungliga parkeringsplats. Den väntar om någon står där. Paus fryser timern.

Death01 har även fått en tydligare träffreaktion, riktad lutning och ett
läsbart fall för vanliga skott, huvudträffar och kraftigare träffar. Kroppar i
luften faller ned till en kontrollerad yta. Spelarens död visas kort i
tredjeperson; den som skjuter ser motståndarens verkliga fall, inte en extra
poänganimation som ändrar spelresultatet.

`src/fps/cartridge-tank.mjs` äger all fordonsfysik/skada/livscykel.
`src/tank-view.mjs` visar modellen och effekter med fasta pooler.
`tests/cartridge-tank.test.mjs` testar collision, fiendepåkörning, vänligt skydd,
kanon, pansar, vanlig Game-poängräkning, fordonsförstörelse och fast respawn.

## Avgränsad putsning: touch och HUD (v10)

- En aktiv pekare per touchkontroll. Ett andra finger kan inte ta över styrspaken
  eller släppa någon annans nedtryckta knapp. Avbruten pekning och förlorad
  pointer capture nollställer rörelse/eld. Paus, butik, resultattavla och ändrad
  skärmstorlek avslutar gamla gester; fortsättning kräver en ny beröring.
- En liten radiell dödzon i styrspaken tar bort mikrorörelser nära mitten.
  Diagonal rörelse är fortfarande normaliserad. Styrplattans mått läses en gång
  per gest, inte vid varje pointermove.
- Elimineringsloggen återanvänder fem DOM-rader och uppdaterar bara ändrad text,
  färgklass eller synlighet. Oförändrad logg orsakar inga DOM-skrivningar.
- Minimapens spelarpil använder heading för alla tre hörn; tidigare använde
  två hörn flyghöjden. Pilen vrider sig nu utan att deformeras när man flyger.
- Preferensen för reducerad rörelse läses från en återanvänd MediaQueryList
  i stället för att skapa en ny i varje vapenbildruta.

Tester: `input-hud-polish.test.mjs` mäter antal layoutläsningar/DOM-skrivningar
samt kontrollerar pekarägande, avbrott, dödzon och pilens geometri.
`input-hud-browser.cjs` provar riktiga Chromium-touchhändelser och capture loss
mot det laddade spelet. Dessa testresultat är inte ett påstående om viss FPS
på fysisk iPhone. Vapenbalans, kartans kollisioner och Cartridge-bilen är bevarade.

Pekarhanteringen följer W3C Pointer Events (`https://w3c.github.io/pointerevents/`)
och `lostpointercapture`-livscykeln.
