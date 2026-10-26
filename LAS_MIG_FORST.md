# Hissrum 12 – Layout Studio V5.0.1

**Korrigerad version:** scenarioimport och återställning av grafiknivå.
Se [korrigering och testresultat](PATCH_V5_0_1.md). Filnamnet nedan är oförändrat.

Öppna **`STARTA_HISSRUM_12_V5.html`** i en webbläsare med WebGL2, exempelvis
Chrome eller Edge. Filen innehåller rum, modeller, animationer och gränssnitt.
Den behöver ingen server, installation, inloggning eller internetanslutning.

Första gången är rummet omöblerat och innehåller **0 personer**. Därefter kan
webbläsaren återläsa din lokalt sparade möblering. Personer återkommer bara när
du själv läser in ett sparat scenario. V4 finns kvar i sin egen projektmapp.

## Kom igång med människor

1. Öppna **Simulation**, eller välj **SIMULATION → PEOPLE** i objektkatalogen.
2. Välj en figur och klicka på en fri golvyta. Du kan också dra från katalogen.
3. Lägg gärna till tre eller fyra personer och tryck **Starta**.
4. Välj **0,5×, 1×, 2× eller 4×**. **Pausa** stoppar både beteende och animation.

Klicka på en person i rummet eller i personlistan. Ändra utseende, längd,
beteende eller namn i panelen. **Fri vandring**, **Stillastående** och
**Material Handler** är separata beteenden; utseendet kan väljas oberoende.
**Pausa individen** låter övriga fortsätta.

Dra en person för att ange en ny startposition. Pilar flyttar 10 cm och
Shift + pil 1 cm; startfältens X/Z anges i meter. **Duplicera** och **Ta bort**
finns i panelen. **Återställ** pausar simuleringen, återför personerna till
deras startpositioner och rensar tillfälliga föremål, trafikdata och statistik.
Din vanliga möblering påverkas inte.

## Öppna hissen och leverera material

Under **Rum & mått** styr du samma högra hissdörr som i V4: stängd, 45°, 90°
eller valfri vinkel. Öppningsriktningen är valbar. Med dörren öppen syns
godshissens golv, metallväggar, skyddslister, armaturer och våningsindikator.
Välj **Rundvandring** och använd WASD/pilar för att gå genom öppningen.

Kabinen är uppskattad till **2,84 × 2,85 × 2,90 m**. Knapparna **Våning 3**
och **Våning 5** visar en kort resa med dörrsekvens och indikator. Resan är en
visuell illusion: kabinen ligger kvar och inga andra våningsplan modelleras.
Belysning och lokalt syntetiserat hissljud kan slås på eller av.

För en Material Handler-demonstration:

1. Placera exempelvis en CREFORM-vagn, låda eller annan upphämtningsstation,
   eller rita en namngiven zon.
2. Välj den under **Simulation → Material Handler → Upphämtningsstation**.
3. Tryck **Starta leverans från hissen**. En ny MH börjar i kabinen.
4. Tryck **Öppna hissdörren**. Personen väntar om dörren eller vägen är blockerad.
5. MH går till stationen, lämnar fyra tillfälliga Sample Point-påsar, visar
   **”4 påsar!”** och återvänder till hissen.

Destination måste väljas; saknas den visas ett meddelande. Leveransen är ett
förenklat exempel med bäranimation. Varje påse återanvänder V4:s geometri.
**Återställ** tar bort levererade påsar. Det finns ingen vagnskjutande MH-variant.

## Kaizen och trafik

**KAIZEN CHAOS** är avstängt från början. Aktivera det för telefonpauser,
pratbubblor och tillfälligt felplacerade kartonger. Kartonger kan bara lämnas i
markerade, tillgängliga zoner. Stäng av läget för att ta bort kaoskartongerna,
eller använd **Återställ** för att rensa hela simuleringens tillfälliga innehåll.
Återställ behåller dina inställningar, så avmarkera Chaos före nästa normala körning.

**Kaizen-möte** samlar tre till fem aktiva, fritt vandrande personer om en
tillräckligt stor fri yta finns. **Dance Break** ger en kort danspaus.

Under **People Traffic Heatmap** kan du visa trafik i planvyn, pausa
datainsamlingen och återställa den separat. Blått, grönt, gult och rött visar
ökande relativ vistelsetid i rutorna; även uppehåll bidrar. Gångsträcka och
väntetid visas för den aktuella simuleringen.

Rita ett område i **5S & bygg** och välj det under **No-go-zoner för personer**
om det ska vara förbjudet att gå där. Även slutna tejpzoner kan väljas.
En vanlig markering för fri passage är fortsatt gångbar tills du väljer den
som no-go.

## Möblera, följ och fotografera

V4:s objektkatalog, CREFORM Builder, väggmontering, separata lådor, stödytor,
golvtejp, mätning och A/B-jämförelse finns kvar. Planvyn passar för exakt
placering. Välj stödyta i objektpanelen för lådor och påsar; innehåll följer
med sin vagn. Shift-klick markerar flera möbler. Ångra/gör om hör till
möbleringen, inte personernas simulerade rörelser.

Välj **Följ person** för en mjuk tredjepersonskamera. **Sluta följa**, Esc eller
ett nytt kameraval avslutar följningen. **Fotoläge** pausar personerna och
döljer menyerna; kameravalen är kvar. Använd **Spara bild · PNG** i fotoläget eller
**Spara bild** i normalvyn. Esc lämnar fotoläget; simuleringen återupptas om
den kördes när du gick in.

## Spara rätt sorts fil

| Val | Innehåll |
|---|---|
| Lokal autosparning / lokal variant | Möbler, tejp, mått, zoner och dörrläge. Inga personer eller kaosobjekt. |
| **Layouter → Exportera layout · JSON** | Redigerbar möblering i kompatibelt V4-format. V3- och V4-layouter kan importeras. |
| **Simulation → Prestanda & scenarier → Spara scenario · JSON** | Personernas startpositioner, utseenden, beteenden, destinationer och simulationsinställningar. Sparas bara på ditt uttryckliga val. |
| **Ta med möbleringen vid export** | Bäddar även in layouten i scenariot. Välj detta när stationer och no-go-zoner ska följa med till en annan dator. |
| **Spara bild / Spara bild · PNG** | Den aktuella vyn, inklusive synliga personer, tillfälliga föremål och visat analyslager. |
| **3D med objekt** | Statisk GLB med rum, hisskabin, synliga möbler, tejp och dörrens aktuella läge. Personer, tillfälliga föremål och interaktiva animationer ingår inte. |

Scenarier använder versionshanterat V5-format, version 1. De sparar
startkonfigurationen, inte en återupptagbar pågående rörelse, leverans eller
heatmap. Ett scenario utan medföljande möblering behöver samma stations- och
zonreferenser i den layout som är öppen. Lokal webbläsarlagring är ingen
filbackup; exportera JSON för att behålla eller flytta ditt arbete.

## Avgränsningar

Figurerna är stiliserade **Kenney Mini Characters**, inte anatomiskt exakta
människor. Idle och gång använder licensierade originalklipp. Svängning,
telefonpose och dans innehåller dokumenterade procedurala förenklingar.
Källa, CC0-licens och bearbetning finns i [modellinformationen](assets/people/LAS_MIG.md).

Rörelser använder en 2D-grid och förenklade hinder med personradie 0,28 m.
Personer väntar om det saknas plats att passera; flyttar du en möbel direkt
över en person stannar den tills hindret eller personen flyttas. Slutna
tejpzoner förenklas till omslutande rektanglar vid no-go-kontroll.

Välj fyra personer och låg detalj under **Prestanda & scenarier** på en svagare
enhet. Automatisk detalj anpassar figurernas rendering; högsta valbara antal
är tolv. Detta är en leksimulering för layoutdiskussion, inte en validerad
trafik-, ergonomi- eller säkerhetsanalys. Håll projektet privat eftersom
Cartridge-materialet har separata distributionsbegränsningar.

## Exempelscenarier

Läs in följande via **Simulation → Prestanda & scenarier → Läs in**:

- `examples/V5_01_Liv_i_5S_rummet.json`: fyra kollegor och ett möblerat 5S-förslag.
- `examples/V5_02_MH_upphamtning.json`: MH i kabinen med CREFORM-station som destination.
- `examples/V5_03_Kaizen_Chaos.json`: fyra kollegor, markerade ytor och Chaos aktiverat.

Scenarierna läses in pausade. Tryck Starta när du vill se rörelserna. Vanliga V4-layoutfiler i samma katalog läses via Layouter → Importera.

Separat applåd-/vinkanimation, vagnskjutande MH och klickbara knappar direkt på 3D-panelen är inte levererade. Hissens fungerande våningsknappar finns i sidopanelen.
