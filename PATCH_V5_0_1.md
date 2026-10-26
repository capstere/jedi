# Hissrum 12 – V5.0.1: korrigering och egen provkörning

## Starta

Packa upp i en **ny mapp** och öppna `STARTA_HISSRUM_12_V5.html`.
Versionsmärket i övre listen visar **V5.0.1**. Startfilens namn behålls för att
Windows-genvägen fortfarande ska fungera. Inga nya runtimeberoenden har tillkommit.

Spara dina viktiga layouter och scenarier som JSON från den gamla versionen innan
du byter. Lokal webbläsarlagring är inte en filbackup och kan bero på filens plats.
Gamla layout- och scenarioformat behålls; ingen filkonvertering behövs.

## Rättat

**1. Scenarioimporten kontrollerar rätt dörrläge.** När scenariot innehåller en
layout används dess validerade dörrvinkel och öppningsriktning redan i
förkontrollen. När ingen layout följer med används den aktuella fysiska
animationsvinkeln, inte ett framtida animationsmål. Äldre, rena annoteringsimporter
bevarar befintlig möblering och dörr. Därmed gör förkontrollen och den verkliga
inläsningen samma placeringsbedömning.

Felet reproducerades i den uppladdade originalversionen: ett giltigt scenario med
öppen dörr kunde avvisas; ett ogiltigt scenario med stängd dörr kunde först godkännas
och sedan misslyckas **efter** att layouten bytts. Båda fallen är nu rättade och
regressionstestade. Detta är en riktad korrigering, inte ett generellt löfte om
återställning vid exempelvis enhets- eller grafikfel.

**2. Sparad grafiknivå läses tillbaka.** Automatisk, Låg och Hög återställs både i
renderingsinställningen och i listan i gränssnittet, och följer med vid ny export.
Adaptiv detaljhistorik återställs när nivån väljs. Saknas visningsinställningen i en
äldre fil behålls den nuvarande nivån. Ogiltiga grafikvärden avvisas innan layouten
ändras.

Endast `source/simulation-ui.js` innehåller ändrad funktionskod.
`source/template.html` har en uppdaterad titel och versionsetikett. Hisskabin,
figurer, animationer, navigering, 26 objekttyper, rumsmodell, CREFORM, golvtejp och
licens-/provenancefiler är oförändrade. Den fristående HTML-filen är ombyggd från
källkoden. GitHub har inte ändrats.

## Vad som faktiskt provkörts

| Kontroll | Resultat |
|---|---|
| Befintliga Node-kontroller för geometri, modeller, dörr, hiss, layout och simulering | 34 av 34 passerade |
| Befintliga V5-webbläsarscenarier | 8 av 8 passerade, fördelat på två körningar |
| Riktade import- och kompletterande gränssnittskontroller | 11 av 11 passerade |

De åtta V5-scenarierna omfattar verkliga klick och dragningar, pallredigering,
ångra/gör om, låda på CREFORM-vagn, väggmontering, golvtejp, CREFORM Builder,
JSON-import/export, PNG, GLB med hisskabin, dörröppning, rundvandring in i hissen,
figurer och animationer, paus, hinderomplanering, separat scenariosparande,
MH-leverans med fyra tillfälliga påsar, Chaos/heatmap och tolv samtidiga figurer.

De elva kompletterande kontrollerna täcker bland annat felaktigt/giltigt dörrläge,
båda öppningsriktningarna, tre grafiknivåer, ogiltig grafikinställning, äldre filer,
samtliga tre exempelscenarier, den faktiska filväljaren, A/B med bibehållen kamera,
tvåpunktsmätning och fotoläge med PNG-export och återupptagen simulering.

Inga JavaScript-sidfel, WebGL-fel eller externa HTTP-anrop observerades i de
slutförda kontrollerna. Förhandsbilden `previews/V5_0_1_Verifierad_oversikt.png`
exporterades med appens eget PNG-verktyg under den sista kontrollen.

### Testmiljöns begränsningar

Kört i Chromium 144 med riktig WebGL2-rendering via ANGLE/SwiftShader, Xvfb och
avstängt webbläsarnätverk. Testmiljön blockerar direkt `file://`-navigering. Därför
laddades **hela den byggda HTML-filens innehåll direkt i webbläsaren** i stället.
Ingen appfunktion eller 3D-renderare ersattes med en mock.

Direkt dubbelklick på Windows, beständig localStorage vid filöppning och fysisk
iPhone/Safari är **inte verifierade i denna granskning**. Inlineprovkörningen
ändrar inte det fristående paketets startkrav. Inga internetberoenden har lagts till.

Första längre webbläsarkörningen avbröts av körmiljöns tidsgräns efter sex godkända
scenarier. De två återstående kördes separat och passerade. Både avbrottsrapport
och omkörning finns kvar. De åtta integrationstesterna använder samma rättade
JavaScript, men HTML-hashen föregår den sista kosmetiska versionsetiketten. Alla
elva slutkontroller gäller exakt den levererade HTML-hashen.

Codex ursprungliga `TESTRAPPORT.md` och rapportfiler är historik för V5.0.0.
Denna korrigerings rapportsammanställning finns i `tests/PATCH_V5_0_1_SUMMARY.json`.
Originalversionens byggmetadata finns i `source/BUILD_INFO_V5_0_0.json`.

## Reproducera kontrollerna

Från projektmappen, med Python 3 och Node:

```sh
python source/package_html.py
node --test tests/core.test.cjs tests/geometry-v4.test.cjs tests/v4-core.test.cjs tests/door.test.cjs tests/elevator.test.cjs tests/npc-assets.test.cjs tests/simulation.test.cjs
node tests/browser-v5-import.cjs
node tests/browser-v5.cjs
```

Webbläsartesterna behöver Playwright som utvecklingsverktyg. `CHROME_PATH` och
`PLAYWRIGHT_MODULE` kan ange redan installerade verktyg. På den använda Linuxmiljön
kördes testerna med `SMOKE_LOAD_MODE=inline`, `SMOKE_HEADLESS=0`,
`SMOKE_SOFTWARE_GL=1` och `xvfb-run -a`. Standardläget i testerna är fortfarande
`file://`. `SMOKE_OUTPUT` väljer separat rapportmapp; `--only=namn,namn` begränsar
V5-integrationskörningen till berörda scenarier.

## Avgränsning

Inga nya funktioner eller grafiska ombyggnader ingår. Kabinmått och personrörelser
är fortfarande illustrativa, inte verifierade byggnads-/trafik-/säkerhetsdata.
Paketet ska hållas privat enligt befintliga Cartridge-villkor.
