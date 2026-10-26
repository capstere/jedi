# V5 – utveckling

V5 utökar V4:s egenutvecklade WebGL2-renderare med en separat godshisskabin
och ett lokalt simulationslager. V3 och V4 ligger kvar i sina egna mappar.
Bascommit och branchunderlag finns i [BASELINE.md](BASELINE.md).

## Bygg och kör offline

Kör från `Hissrum12_3D_Layout_Planner_V5/`:

```sh
python3 source/package_html.py
```

Resultatet är `STARTA_HISSRUM_12_V5.html`. Byggskriptet använder Pythons
standardbibliotek och bäddar in JavaScript, CSS, modellmanifest, rummets GLB
och de redan konverterade NPC-modellerna. Öppna resultatet direkt med `file://`
i en WebGL2-webbläsare. Körningen saknar server, externa bibliotek, CDN,
modellnedladdningar, API-anrop och kontokrav.

NPC-konverteringen är en separat utvecklingsåtgärd. Den behöver originalets
officiella ZIP-fil och körs bara när personmodellerna ändras:

```sh
python3 source/build_npc_assets.py /sökväg/kenney_mini-characters.zip
python3 source/package_html.py
```

Se [modellkällor, licens och bearbetning](../assets/people/LAS_MIG.md).
`characters.compact.json` är redigerbar bearbetad mesh-, skelett- och
animationsdata; `npc-assets.js` är motsvarande genererade inbäddningsfil.
`provenance.json` anger källversion, filurval och SHA-256. Oanvända modeller
och animationsklipp levereras inte.

## Modulansvar

| Fil | Ansvar |
|---|---|
| `app.js` | Befintlig WebGL2-renderare, kameror, rundvandring, PNG-export och samordnad bildloop. |
| `planner-core.js`, `object-library.js`, `studio-core.js` | V4-objekt, geometri, stödytor, hierarkier, datavalidering och modellkontroller. |
| `planner.js`, `floor-tape.js` | Möblering, tejp, ångra/gör om, lokal lagring, A/B-layouter och JSON-/GLB-export. |
| `door.js` | V4:s befintliga högerblad, gångjärn, riktning och animation. |
| `elevator.js` | Uppskattad kabin, rum/kabin-portal, lampor, våningsindikator, visuellt resförlopp och valbart Web Audio-ljud. |
| `simulation-core.js` | Personer, 2D-navigation, individuella beteenden, MH, Chaos, möten, trafikdata och separat konfiguration. |
| `npc-assets.js`, `npc-renderer.js` | Fyra CC0-personer, ursprungliga animationsklipp, GPU-skinning, LOD, culling och katalogminiatyrer. |
| `simulation-ui.js`, `simulation-modes.js` | Personval, placering, dragning, paneler, följkamera, fotoläge, överlägg och scenariofiler. |
| `template.html`, `simulation.css` | Gränssnitt och simulationspanel; befintlig grundstil ligger i `styles.css` och `planner.css`. |

Kabinen läggs bakom den befintliga öppningen utan ändring av originalets
`Hissrum12_REKONSTRUERAT_V2.glb`. V4:s rörliga dörrblad återanvänds; inget
extra blad läggs ovanpå. Se [ELEVATOR.md](../ELEVATOR.md) för mått, portal och
geometri. Våning 3/5 är ett indikator- och dörrförlopp vid oförändrade
koordinater, inte en modell av andra byggnadsplan.

## Tillstånd och import/export

Möbleringen behåller `format: "hissrum12-v4-layout", version: 4`.
Den befintliga valideringen och versionsmigreringen läser V3 och V4.
V5 har egna localStorage-nycklar, `hissrum12.v5.current` och
`hissrum12.v5.variants`; V4:s sparade arbetskopia skrivs inte över.
Vid första öppningen är layouten tom. En senare öppning återläser V5:s
arbetskopia om den finns.

`PeopleSimulation` äger egna `people`, tillfälliga `props`, trafikdata och
beteendetillstånd. Modulen läser layoutens geometri via `getLayout()` men
ändrar inte `planner.objects`, historik eller autosparning. Varje ny
sidöppning börjar utan personer. En explicit användaråtgärd krävs för att
exportera eller importera simulationskonfiguration.

Två separata schemasignaturer används:

```js
{ format: "hissrum12-v5-simulation", version: 1, people, /* inställningar */ }
{ format: "hissrum12-v5-scenario", version: 1, simulation, elevator, /* valfri layout */ }
```

Personernas exporterade X/Z/yaw kommer från lagrade startpositioner.
Utseende, längd, individuellt pausläge, beteende, stationsreferenser,
no-go-zoner, hastighet, Chaos och maxantal ingår. Simulationskärnan validerar
data och prövar placeringarna före import. Scenarioimport prövar både layout
och personkonfiguration innan den aktiva layouten byts. Import startar inte
uppspelning automatiskt. För överföring av destinations- och zonreferenser
bör scenariot även innehålla möbleringen.

Pågående gångvägar, tillfälliga leveranser, kaoskartonger, slumpgeneratorns
läge, trafikdata och statistik ingår inte i sparade konfigurationer.
Återställ pausar, tömmer tillfälligt innehåll och återför startpositionerna;
valda inställningar behålls. Hissljud behöver en användarhandling även efter
inläsning.

GLB-exporten innehåller rum, kabin, synliga möbler och tejp samt dörren i
aktuell pose. Den är statisk: NPCs, tillfälliga simulationsföremål, pratbubblor,
heatmap och animationer exporteras inte. PNG avbildar de synliga canvaslagren,
inklusive simuleringen. Redigerbara personer sparas i scenario-JSON.

## Navigation, animation och prestanda

Navigationen använder 18 cm grid, A*, hörnkontroll, raka genvägar med
friutrymmeskontroll och rörelsekontroll längs hela steget. Personradien är
0,28 m. Fasta installationer, möbler i kroppshöjd, dörrblad, valda no-go-zoner
och blockerande Chaos-föremål påverkar gångbarheten. Slutna tejpzoner använder
en konservativ omslutande rektangel. Markerade fria passager blir inte
automatiskt no-go.

Layoutändringar invaliderar navigeringen. Griden byggs om vid förändrad
geometri med begränsad kontrollfrekvens, medan dörrens aktuella vinkel
kontrolleras löpande. Personer har olika faser och hastigheter, små sidsteg
och regler för att lämna plats. Om fri passage saknas väntar de och försöker
planera om; det är ingen fullständig fysik- eller folkmassesimulator.
En möbel som placeras över en person får personen att stanna och visa ett
meddelande, inte hoppa genom hindret.

Kenney-modellernas sju leder skinnas på GPU. Geometri och material delas per
utseende/detaljnivå; förflyttning bygger inte om mesh. En andra geometrinivå
förenklar kroppen men behåller huvudets positioner. Culling sker före
ritning, och avlägsna figurer får lägre animationsfrekvens. Automatisk
kvalitet kan minska karaktärsdetaljen vid långsamma bildrutor. Högst tolv
personer kan finnas; användaren kan begränsa nya tillägg till fyra eller åtta.

Simulationsuppdateringen arbetar i tidssteg separat från geometribyggandet.
När inga personer finns körs ingen personuppdatering; utan annan aktiv
kamera-/dörranimation behålls rendering vid behov. Renderaren erbjuder
`dispose()` för GPU-resurser och `diagnostics()` för aktuell ritkostnad.

Idle, gång, ja-/nej-gester, interaktion, plockning och bärpose kommer från
de sju dokumenterade originalklippen. Mjuk svängning, telefonens huvudlutning
och dansrytm är procedurala tillägg. MH bär en synlig påse och lämnar fyra
temporära V4-påsar; vagnskjutning, handkontakt/IK och produktionsfysik ingår inte.
Fotoläget fryser personerna och låter användaren exportera PNG utan att lämna
läget.

## Riktad verifiering

Kör relevanta kontroller från projektmappen efter ändring:

```sh
node tests/elevator.test.cjs
node tests/npc-assets.test.cjs
node tests/simulation.test.cjs
```

`tests/browser-v5.cjs` är den samlade webbläsarkontrollen.
`tests/npc-renderer-smoke.cjs` kan isolera skelettanimation och geometri vid assetändring.
Browserkontrollerna behöver lokalt installerad Playwright och Chrome;
`PLAYWRIGHT_MODULE` och `CHROME_PATH` anger sökvägar. Dessa verktyg är enbart
utvecklingsverktyg och följer inte med som runtimeberoenden. Läs
[TESTRAPPORT.md](../TESTRAPPORT.md) för leveransens faktiskt genomförda kontroller.

Rummets mått, dörrantaganden, navigation och heatmap är visuellt
planeringsunderlag. Ingen trafik-, ergonomi- eller säkerhetscertifiering
görs. [DOOR_AND_CARTRIDGE.md](DOOR_AND_CARTRIDGE.md) beskriver den privata
Cartridge-geometrin; människornas CC0-licens ändrar inte projektets krav på
privat distribution.
