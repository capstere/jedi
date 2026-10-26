# Kort testrapport – V5

Verifierad 2026-10-20. Bascommit: `73f44e821d722a5a33b9b2628f6f1c466b088b66`.
Offline-HTML: **4,526,699 byte** (cirka 4.53 MB), SHA-256 `2100b5a5780a2be1a65d8357bf01be25bd88a30cd97a848d1e11f9c75874ca45`.

## Resultat

- **12/12 riktade kärnkontroller**: navigering och hinder, mötande personer i 80 cm passage, ändrad möblering, båda dörrriktningarna, MH och fyra separata påsar, Chaos, no-go inklusive sluten tejpzon, heatmap, versionsvalidering, möte/dans, licensierad modellgeometri och kabin. Se `tests/CORE_REPORT.txt`.
- **8/8 koncentrerade webbläsarscenarier**: V4-redigering/format/export, hiss, NPC-kontroller/klipp, omplanering, sparandeseparation, MH-flöde, Chaos/heatmap och 12 personer. Chrome 155.0.8059.85, lokal `file://`, nätverket avstängt.
- Efter den visuella kontrollen anpassades planvyn så hela kabinen får plats, och fotoläget fick en egen PNG-knapp. Riktad slutkontroll verifierade detta, verklig dragning av en person och uppdaterad startposition, PNG-export med dolda menyer samt återupptagen simulering när fotoläget lämnas.
- Den sista HTML-filen laddades separat med 0 personer: pausad simulering, ingen simulationsuppdatering i tomgång, nya möbler uppdaterar MH-destinationer direkt. Inga WebGL-fel, sidfel eller externa nätverksanrop.
- CC0-figurerna har även ett isolerat WebGL-test: verklig skillnad mellan animationsposer, culling, lägre geometri-LOD, resursdelning och fyra visuellt granskade modeller.

V4-kontrollen omfattar samtliga 26 katalogtyper som data, faktisk katalogplacering, dragning, rotation, måttändring, ångra/gör om, låda på vagn, väggmontering, golvtejp, parametrisk CREFORM, JSON-import/export, V3-migrering, PNG och GLB med hisskabin. A/B-jämförelse och mätning återanvänder V4:s oförändrade funktioner; de har inte fått en separat ny manuell genomgång i V5.

## Prestandastickprov

Med **12 NPCs och 10 möbler** samlades 120 verkliga bildruteintervall: median **16,7 ms**, p95 **16,8 ms** i den använda Chrome-miljön. Tolv personer ritades på LOD-nivån för avstånd, åtta delade modell-/LOD-resurser fanns, WebGL-felkod 0. Detta är ett kort lokalt stickprov, inte ett löfte om 60 FPS på alla datorer eller en långtidstest av alla vyer.

Ett separat 24-bilders renderprov med 12 personer och tre möbler, inklusive `gl.finish`, gav median 0,3 ms och p95 0,4 ms. Dessa värden ska inte förväxlas med total bildrutefrekvens. På svagare enheter kan maxantalet sättas till fyra och detaljnivån till låg.

## Begränsningar och spårbarhet

Hisskabinen är uppskattad, personerna är stiliserade minikaraktärer, och rörelsekontrollen är tvådimensionell och konservativ. Telefonpose, svängning och dans har procedurala inslag. Ingen riktig våningsplansgeometri eller vagnskjutande MH levereras. GLB är en statisk möbleringsexport; personer och tillfälliga simulationsföremål sparas i explicit scenario-JSON och syns i PNG.

Originalets rum innehåller fortfarande 15 854 trianglar, varav samma 2 528 hör till det rörliga dörrbladet. Kabinen lägger till 2 116 trianglar. Original-GLB, V3 och V4 är oförändrade.

`tests/BROWSER_REPORT.json` redovisar kontrollerna och respektive testad HTML-hash. De första tre scenarierna kördes före tillägget av slutna tejpzoner; resterande på uppdaterad fil. Endast berörda tester kördes om. Två testskriptfel (stängd exportsektion och en konsumerad rutt-array) rättades i testet. `FINAL_VISUAL_REPORT.json` gäller planvy/fotoläge/dragning/prestanda; `FINAL_IDLE_REPORT.json` gäller exakt levererad HTML. Ingen fullständig omkörning för rent dokumentära ändringar.

Projektet har inte publicerats publikt. Endast en privat utvecklingsbranch och draft PR används.
