# nadajniki

[![Netlify Status](https://api.netlify.com/api/v1/badges/c0bd9134-1540-47c5-b785-6cce698465f8/deploy-status)](https://app.netlify.com/sites/nadajniki/deploys) [![Ręczna aktualizacja danych](https://github.com/yasiupl/nadajniki/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/yasiupl/nadajniki/actions/workflows/main.yml)

![mapa](https://repository-images.githubusercontent.com/209359790/38e0ad00-6704-11ea-9dc2-9f2d9670effa)

https://nadajniki.netlify.app/

Mapa wyświetlająca dane z wykazu pozwoleń radiowych dla klasycznych sieci radiokomunikacji ruchomej lądowej UKE.

Dane:
https://dane.gov.pl/dataset/1070

Legenda:
https://archiwum.uke.gov.pl/files/?id_plik=6730

## Wdrożenie

Projekt działa na Vercel i na Netlify. Polecenie `npm run build` pobiera dane UKE, przetwarza je, wysyła tileset do Mapbox i buduje stronę do katalogu `dist/`.

Konfiguracja platform:

- Vercel: plik `vercel.json` i funkcja `api/scheduled-deploy.mjs` (Vercel Cron).
- Netlify: plik `netlify.toml` i funkcja `netlify/functions/scheduled-deploy.mjs` (Scheduled Function).

Zmienne środowiskowe:

| Zmienna | Opis |
| --- | --- |
| `MAPBOX_UPLOAD_KEY` | Token Mapbox z uprawnieniem `uploads:write`. |
| `MAPBOX_USER` | Nazwa użytkownika Mapbox. Wartość domyślna: `yasiu`. |
| `DEPLOY_HOOK_URL` | Adres deploy hooka. Funkcja cykliczna wywołuje ten adres w dniu przebudowy. |
| `CRON_SECRET` | Tylko Vercel. Vercel wysyła tę wartość w nagłówku `Authorization`. Funkcja odrzuca wywołania bez tej wartości. |

Dzień przebudowy to 26. dzień miesiąca. Jeśli 26. dzień miesiąca nie jest dniem roboczym, dzień przebudowy to następny dzień roboczy. Funkcja uwzględnia soboty, niedziele i ustawowe dni wolne od pracy w Polsce. Cron uruchamia funkcję codziennie od 26. do 29. dnia miesiąca. Funkcja wywołuje deploy hook tylko w dniu przebudowy.

Workflow GitHub Actions `.github/workflows/main.yml` pozwala ręcznie wywołać deploy hook. Workflow używa sekretu repozytorium `DEPLOY_HOOK_URL`.
