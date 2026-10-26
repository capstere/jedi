# Hissrum 12 — projektöversikt

Repositoryt innehåller både originalets **Hissrum 12 Layout Studio V5** och en fristående FPS-variant.

## Startpunkter

- **[Spela Hissrum Strike (miniatyr-FPS)](games/hissrum-strike/index.html)** — Cartridge Strike-spelmotor i `Hissrum12_V5_med_39_objekt.glb`, 5 mot 5 botar, mobil- och datorstyrning. [Speldokumentation](games/hissrum-strike/README.md).
- **[Öppna Hissrum 12 Layout Studio V5](STARTA_HISSRUM_12_V5.html)** — befintlig layoutstudio, oförändrad.
- **[Utvecklingsdokumentation för originalstudion](README_UTVECKLING.md)** — studions V5-version.
- **[Modellmanifest](model_manifest.json)** — information om föregående rekonstruerade basmodell.

Original-GLB, scenariofiler och V5:s tidigare källkod ligger kvar på sina befintliga platser för att undvika brutna länkar och befintliga offlinepaket. Den nya spelvarianten ligger samlad under `games/hissrum-strike/` och refererar till GLB-filen vid repo-roten, så modellen inte dupliceras.

För webbkörning: publicera repo-roten via GitHub Pages eller kör `python3 -m http.server 8000` från repo-roten. Spelets ES-moduler och GLB kan inte öppnas säkert direkt via `file://`. Originalstudions självständiga HTML kan däremot fortfarande öppnas offline.
