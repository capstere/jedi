# Proaktiva flygpatruller i Hissrum Strike

Bas: `4711ebb7c32624752d4f7cdeb4dd2db4d0a55cae` (efter PR #15).

## Spelförändring

Botarnas aktiva flygläge använder nu `air-patrol.mjs` när den riktiga rummodellens gränser och navigeringsnoder finns. De tidigare flygreglerna är kvar för icke-agila lägen och enklare kartadaptrar. Spelarens flygkontroller ändras inte.

- **Initiativ:** varje ledig bot kan påbörja spaning utan att först behöva se en fiende. Starter sprids i tiden och de som väntat längst får nästa lediga flygplats. Högst fyra botar flyger samtidigt, som tidigare.
- **Högre:** målband ungefär 6–10 spelvärldsenheter över golvet, med lägre alternativ under låga hinder. Uppåtriktad kontroll och kapselprov längs stigningen hindrar botar från att planera rakt genom hyllor/tak.
- **Längre:** avsiktliga flygsträckor prioriterar 12–24 spelvärldsenheter, med kortare reservrutter där möbler kräver det. Botarna håller fast vid ett delmål i stället för att växla små sidosteg kring samma fiende. En normal patrull varar 14–18,8 simuleringssekunder före säker landning.
- **Överlevnad genom beteende:** nyligen träffade, skadade eller omladdande botar prioriterar avstånd och undanmanöver i luften. De tvingas inte längre omedelbart ned på golvet enbart på grund av låg hälsa. Hälsa, rustning, vapenskada, spelarsikte och reaktionstider är oförändrade.
- **Fairness och prestanda:** endast egna synminnen eller färska lagrapporter används som fiendekunskap. Ingen teleportation eller allvetande målföljning. Varje ruttval har högst 320 kapselkontroller och max åtta dyra kandidater per höjd; omplanering begränsas till minst 1,1 sekunder mellan försök. Verklig rörelse och kroppskollisioner ägs fortfarande av `Game.moveActor`/`moveBody` och GLB-adaptern.
- **Uppdrag:** bombbärare, eskortrörelser och brådskande interaktioner har fortsatt företräde. En säker fri vertikal landningsväg måste hittas innan boten sjunker genom möblernas höjd.

## Verifiering

`tests/high-flight.test.mjs` innehåller nio deterministiska tester för initiativ, höjd, räckvidd, planeringsbudget, tak, blockerade rutter, gammal/otillåten målinformation, undanmanöver, flygplatser och respawn.

`tests/high-flight-browser.cjs` laddar original-GLB:n med spelets egna importer i Chromium. Testet kör 45 sekunders kollisionsstyrd patrullering samt tre par 30-sekunders matcher i den riktiga Game-klassen (Normal, Endless, Vector C, seeds 21/42/83, ingen skjutande mänsklig spelare). Den gamla flyggrenen jämförs med den nya på samma geometri, vapen och hälsa. Dödssiffrorna loggas som ett litet beteendeprov, inte som garanti för alla matcher eller fysiska telefoner.

Lokalt prov med samma geometri (endast texturer utelämnade i Node, alla positionsdata/trianglar bevarade): 900 giltiga kollisionsstickprov, nio olika botar tog initiativ, högst fyra samtidigt, topphöjd 9,45 och största förflyttning från start 39,58. De tre jämförbara matcherna gav 22/20/20 botdödsfall före respektive 16/15/14 efter ändringen. Browser- och fullständiga desktop/mobil-checkar krävs i CI före merge; lokala siffror ersätter inte dem.

Originalstudion och GLB-filen är oförändrade. Inga nya menyer eller spelarknappar.
