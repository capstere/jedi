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
