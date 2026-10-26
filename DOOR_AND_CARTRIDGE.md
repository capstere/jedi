# Hissdörr och privat Cartridge-geometri

## Dörrbladets ursprung och antaganden

Den ursprungliga `model/Hissrum12_REKONSTRUERAT_V2.glb` är oförändrad. `door.js` separerar sammanhängande triangeldelar i minnet. Endast det högra hissdörrbladets panel, fönster, beslag, skyltar och dörrstängare flyttas; karm, tröskel, vänster dörrblad och fasta kontroller ligger kvar. Samma vertexbuffert används för fast och rörlig del. Ingen ny panel läggs ovanpå den stängda.

Rummets 15 854 trianglar behålls. 2 528 befintliga trianglar i åtta materialgrupper följer dörrbladet. Gångjärnsaxeln antas vara `(2,44; 0; -3,755)` meter. Synliga rekonstruerade beslag stöder höger/östra gångjärnssidan. Råskanningen finns inte i detta repository och har inte kunnat användas för oberoende verifiering. Öppningsriktningen antas vara in i rummet och kan vändas i gränssnittet. Mekaniska länkar och dörrstängare följer bladet stelt; ingen mekanisk eller säkerhetsmässig simulering görs.

`createLiftDoor()` erbjuder `setAngle(0…90, animate)`, `setDirection(1|-1)`, `snapshot()`, `restore()`, `sweepPolygon()` och `exportRoomGLB(binary)`. Exportfunktionen kopierar GLB-data och bakar aktuell visuell vinkel i berörda koordinater och normaler. GLB får statisk dörrpose; JSON behåller redigerbara dörrvärden. Övriga rumskoordinater är identiska.

## Cartridge: privat statisk härledning

Referensen granskades på `capstere/onboard` main-commit `6067233c23ba63a04e8d0a8e1ccb7a3adbd62906`. Granskade filer:

- `src/fps/cartridge-v11.mjs`
- `src/fps/cartridge-props.mjs`
- `assets/fps/cartridge-v11.provenance.json`

`source/cartridge-mesh.js` innehåller ett statiskt uttag av den stängda far-modellen: 491 trianglar och fyra materialbatcher. De ursprungliga buffergeometrierna har skapats med källprojektets egna byggare vid utveckling, inte genom återritning från fotografier. Varken Three.js, SPEL-motorn eller QC-källan ingår i applikationens runtime. Den kurvade etikettens yta behålls som neutral vit yta; SPEL-etikettens texturatlas ingår inte.

Modellens yttermått är ca 42,113 × 47,296 × 59,590 mm (bredd × djup × höjd). Native meterskala används. Källspelets visuella 1,35-förstoring och tre-exemplars påse används inte. Layoutstudions påse innehåller tio transformerade exemplar i gemensamma materialbatcher. Smådetaljer är förenklade för rummets skala; ingen högupplöst inspektionsmodell eller adaptiv LOD-växling levereras för enskilda cartridges.

`model/cartridge-v11.provenance.json` bevarar originalets provenance och beskriver V4-härledningen. Originalkällan är `capstere/the@890d9e62e133390d74e2415cd02eb920f47c4fad`. Geometrin är **private-development-only** och **publicDistributionApproved: false**. Three.js MIT-licens gäller biblioteket och ger inte distributionsrätt till modellen. Denna V4, offline-HTML, GLB-exporter och härledda assets ska hållas privata. Privat draft PR är leveransformen; ingen merge eller offentlig publicering görs.

## Riktad kontroll

Kör `node tests/door.test.cjs` från projektet. Kontrollen bekräftar att alla ursprungliga trianglar fördelas exakt en gång, att den högra blå panelen följer med, att båda riktningarna och återställning fungerar, samt att export vid 90 grader lämnar alla fasta vertexkoordinater oförändrade. Den ersätter inte en visuell jämförelse med det verkliga rummet.
