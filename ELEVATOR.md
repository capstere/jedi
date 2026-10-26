# Godshissen i V5

V5 lägger till en separat, lokalt genererad godshisskabin bakom hissöppningen. Den ursprungliga V2-GLB-filen och V4:s `door.js` är oförändrade. Inga privata modeller eller externa bibliotek behövs för kabinen.

## Mått och originalgeometri

Kabinen har uppskattade fria planmått **2,84 × 2,85 m** och höjden **2,90 m**. Koordinaterna är x −0,38…2,46 m, z −6,65…−3,80 m. Måtten är en visuell planeringsmodell och har inte verifierats mot den verkliga hisskabinen. Våningsvalet ändrar ingen byggnadsgeometri.

Det högra dörrbladet från V4 är den enda rörliga dörren. Dess befintliga gångjärn `(2,44; 0; −3,755)` och konfigurerbara öppningsriktning återanvänds. Det vänstra bladet ligger kvar stängt. Ingen extra innerdörr är tillagd eftersom dess verkliga utförande är okänt.

GLB-inspektionen visade att `north__paint` består av fem väggvolymer som redan lämnar hissöppningen fri: x −0,46…2,54 m och y 0…2,91 m. Därför behövs **ingen kapning, borttagning eller maskning av den skanningsbaserade rumsmodellen**. Golvet fortsätter bakom den befintliga tröskeln och kan ses genom öppningen.

## Utförande och funktioner

- Mörkt plåtgolv med geometriskt durkmönster och plåtskarvar.
- Metallväggar, vertikala skarvar, skyddslister, hörnprofiler och synliga infästningar.
- Tak med två långsträckta armaturer; taket döljs i öppen översikt och planvy.
- Panel med upphöjda knappar och digital sifferindikator för plan 3 eller 5.
- Belysning på/av, med materialbaserad ljusverkan i den befintliga renderaren.
- Valbart lokalt syntetiserat dörr-/ankomstljud via Web Audio. Det aktiveras först när användaren väljer ljud och kräver inga ljudfiler.
- Förstapersons- och NPC-passage genom det högra dörrbladet när dörren är tillräckligt öppen. Även det roterade bladets faktiska segment kontrolleras, i båda riktningarna.

Våningsval stänger dörren, visar en kort resa på indikatorn och öppnar den igen efter ankomst om den var öppen före resan. Detta är **en visuell illusion**. Kabinen flyttas inte, och inga andra våningsplan simuleras. Ljusen är emissiva material och enkel toning, inte en ny realtidsmodell för belysning. Kontrollerna är illustrativa och utgör inte en säkerhetscertifierad hiss- eller passagekontroll.

## Integration

`source/elevator.js` laddas efter `planner-core.js` och före `app.js`. Den registrerar egna material i `LayoutCore.MATS`.

```js
const elevator = createFreightElevator({
  gl, U, whiteTexture, door, state, invalidate, toast
});
```

Anropa `elevator.draw3D()` efter rummets meshpass, `elevator.drawHUD(ctx, project, state.mode)` efter basens planritning och `elevator.tick(time)` i renderloopen. `tick()` returnerar `true` när en resa behöver en ny bildruta. `draw3D` kan ta `{mode, roof, eye}` för en annan kameravy. Geometrierna delas och GPU-resurserna återanvänds mellan bildrutorna. De byggs om vid byte av våningssiffra eller belysningsläge, aldrig när kameran eller personer flyttas. `dispose()` frigör buffertar, VAO:er och ljudresurser.

`canWalk(x,z,radius,from?)` kontrollerar unionen rum/kabin, höger portal och det faktiska dörrbladet. Möbler och fasta installationer kontrolleras av befintlig planner och navigation. Det valfria `from` möjliggör kontroll av hela förflyttningen. `FreightElevatorGeometry.isNavigable` och `doorwayBlocked` erbjuder samma rena funktioner till navigationsgriden.

`exportGeometry()` ger vanliga `{mat,p,n,uv}`-batcher med världskoordinater för en statisk GLB-export. `snapshot()`/`restore()` hanterar våningssiffra och belysning; ett sparat ljudval återaktiverar inte automatiskt webbläsarljud utan en användarhandling.

## Riktad verifiering

Kör `node tests/elevator.test.cjs`. Testet kontrollerar ändliga koordinater, batchformat, portalens båda dörrriktningar, stängd vänster dörr, rörelse utan hopp genom väggen, våningssekvens, återställning och att originalväggen lämnar öppningen fri. Kabinen innehåller **2 116 trianglar i 16 batcher** inklusive durkplåtens verkliga geometri. Det är ett tillägg till originalrummet, inte en ersättning för dess geometri.
