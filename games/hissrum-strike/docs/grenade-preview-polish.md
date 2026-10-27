# Avgränsad putsning: granatvisning

## Spelarnytta

Granatens streckade kastguide visas inte när spelaren sitter i Cartridge-bilen. När spelaren lämnar fordonet med granaten vald kommer guiden tillbaka direkt. Paus, död, tomt granatlager och avstängd förhandsvisning döljer också guiden. Redan kastade granater fortsätter däremot att synas.

## Mindre onödigt renderingsarbete

- En positionsbuffer och en streckningsbuffer skapas vid start och återanvänds under hela visningens livstid. `computeLineDistances()` skapar inte längre en ny Three.js-attributbuffer vid varje uppdatering.
- Oförändrade Float32-koordinater flaggar inte om GPU-attributen för uppladdning. Nya riktningar, positioner och ändrade kollisionsresultat uppdaterar fortfarande guiden.
- Den auktoritativa kastfysiken och kollisionskontrollen körs vid samma befintliga intervall, högst fyra gånger per simulerad sekund. Ingen cache gör antaganden om att hinder förblir stilla.
- Den tillfälliga listan över aktiva granat-ID:n återanvänds. Utgångna granatmodeller återgår till återanvändningspoolen innan nya modeller efterfrågas samma bildruta.
- Högst tolv inaktiva granatmodeller sparas, även mellan omstarter. Aktiva granater begränsas inte av poolstorleken. `dispose()` frigör delade resurser exakt en gång vid fullständig avveckling.
- Tomma eller felaktiga banor döljs utan att rita gamla linjer. Återställd matchklocka lämnar inte guiden väntande på föregående rundas tid.

## Tester

Sex rena Node-tester verifierar Float32-precision, strecklängder, kapacitet, invalid data, tank-/pausregler och överensstämmelse med den oförändrade granatfysiken. Den riktade Three.js-kontrollen använder spelets riktiga version, inte en grafikkopia: 600 identiska uppdateringar håller attributidentitet och version oförändrade; 100 återställningar återanvänder samma granatmesh. Testet jämför strecklängder mot originalets Three.js-algoritm och kontrollerar också byte av granattyp, poolgräns, paus/fortsätt och destruktion.

`node --test games/hissrum-strike/tests/*.test.mjs`

`node games/hissrum-strike/tests/grenade-view-browser.cjs`

Det riktade Chromium-testet körs före det befintliga fullständiga speltestet med original-GLB i dator- och mobilvy. Arbetsräkningarna visar mindre allokerings- och uppladdningsarbete, inte en uppmätt FPS- eller batterivinst på en fysisk telefon.

Ingen ändring av kastlängd, skada, studs, säkring, granatkostnad, AI, fordonets spelregler, original-GLB eller Layout Studio.
