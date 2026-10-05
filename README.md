# nadajniki

[![Netlify Status](https://api.netlify.com/api/v1/badges/c0bd9134-1540-47c5-b785-6cce698465f8/deploy-status)](https://app.netlify.com/sites/nadajniki/deploys) [![Ręczna aktualizacja danych](https://github.com/yasiupl/nadajniki/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/yasiupl/nadajniki/actions/workflows/main.yml)

![mapa](https://repository-images.githubusercontent.com/209359790/38e0ad00-6704-11ea-9dc2-9f2d9670effa)

https://nadajniki.yasiu.pl/

Mapa pokazuje stacje z wykazu pozwoleń radiowych UKE dla klasycznych sieci radiokomunikacji ruchomej lądowej (RRL).

Źródła danych:

- bieżący wykaz: [BIP UKE](https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html),
- poprzednie wydania: [archiwum dane.gov.pl](https://dane.gov.pl/dataset/1070),
- legenda wykazu: [PDF w BIP UKE](https://bip.uke.gov.pl/download/gfx/bip/pl/defaultaktualnosci/140/9/96/_legenda_do_wykazu_rrl.pdf).

## Funkcje

- **Karta stacji.** Karta pokazuje częstotliwości (nadawanie, odbiór, szerokość kanału), parametry anteny, rekordy wykazu, pozwolenia, operatora i lokalizację. Karta pokazuje też stacje na tej samej częstotliwości, historię zmian i liczbę wyświetleń.
- **Lista stacji.** Lista pokazuje stacje w widoku mapy. Listę można sortować i eksportować do SDR# (XML) albo do CSV.
- **Link do stacji.** Adres `/stacja/<id>-<opis>` otwiera kartę stacji. Część `<opis>` jest tylko dla czytelnika.
- **Wyszukiwarka.** Wyszukiwarka działa w przeglądarce, bez serwera. Składnię opisuje tabela poniżej.
- **Filtry.** Filtry obejmują rodzaj sieci, pasmo, zakres częstotliwości, szerokość kanału, kategorię operatora, jednostkę UKE, wygasanie pozwolenia i stan w wykazie. Adres URL zapisuje filtry, więc link do widoku z filtrami też działa.
- **Pasma.** Widok pasma pokazuje histogram zajętości i listę częstotliwości nadawczych.
- **Analiza.** Wykresy pokazują rozkłady dla stacji, które spełniają filtry: rodzaje sieci, pasma, szerokości kanałów, największe sieci, kategorie, wygasanie pozwoleń i jednostki UKE.
- **Zmiany.** Widok porównuje kolejne wydania wykazu: stacje nowe, usunięte, zmienione i przeniesione.
- **Warstwy mapy.** Mapa pokazuje obszary obsługi, gęstość stacji i etykiety częstotliwości. Narzędzie „Zasięg w punkcie” pokazuje stacje, których obszar obsługi obejmuje wybrany punkt.
- **Wygląd.** Strona ma tryb automatyczny, jasny i ciemny. Przycisk na pasku górnym przełącza tryb jasny i ciemny. Menu ma wszystkie trzy tryby. Tryb automatyczny przyjmuje ustawienie systemu lub przeglądarki. Przeglądarka zapamiętuje wybór.

Składnia wyszukiwarki:

| Zapytanie | Wynik |
| --- | --- |
| `pkp kraków` | Stacje, które mają wszystkie słowa (operator, nazwa, lokalizacja, pozwolenie, kategoria). |
| `"fraza"`, `-słowo` | Dokładny fragment tekstu, wykluczenie słowa. |
| `148.0125`, `148.01` | Częstotliwość albo początek częstotliwości w MHz. |
| `148-149` | Zakres częstotliwości w MHz. |
| `typ:A,C` | Rodzaj sieci. |
| `erp>10`, `r>20`, `h>30` | Moc ERP w dBW, promień obszaru obsługi w km, wysokość anteny w m. |
| `kanal:25` | Szerokość kanału w kHz. |

## Dane

Polecenie `npm run fetch-data` pobiera dane do katalogu `data/`:

- bieżący wykaz z BIP UKE do `data/current/`,
- poprzednie wydania z archiwum dane.gov.pl do `data/archive/`.

Skrypt zapisuje pobrane archiwa i przy następnym uruchomieniu nie pobiera ich ponownie. Jeśli BIP UKE nie działa, bieżącym wydaniem jest najnowsze wydanie z archiwum.

Polecenie `npm run build-data` przetwarza wydania i zapisuje pliki do `dist/data/`:

| Plik | Zawartość |
| --- | --- |
| `stations.json` | Skrócone rekordy wszystkich stacji. Aplikacja wczytuje ten plik przy starcie. |
| `details/XX.json` | Pełne rekordy stacji. `XX` to dwa pierwsze znaki identyfikatora stacji. |
| `history.json` | Zmiany między wydaniami, stacje usunięte i przekierowania identyfikatorów. |
| `popular.json` | Liczba wyświetleń kart stacji (tylko z kluczem API Plausible). |

Zasady przetwarzania:

- Stacja to wszystkie rekordy jednego operatora w jednym punkcie.
- Identyfikator stacji to początek skrótu SHA-1 z nazwy operatora i współrzędnych. Identyfikator jest taki sam w kolejnych wydaniach.
- Skrypt porównuje kolejne wydania. Stacja jest nowa, usunięta, zmieniona albo przeniesiona.
- Zmiana ma aspekty: częstotliwości, pozwolenie, parametry techniczne i urządzenia.
- Przeniesiona stacja ma tego samego operatora, położenie w odległości do 2 km i wspólne pozwolenie albo te same częstotliwości. UKE poprawia wtedy współrzędne. Stary identyfikator przekierowuje na nowy.
- Skrypt ujednolica zapis liczb (`9.3000000000000007`, `3,7`). Bez tego porównanie wydań pokazuje fałszywe zmiany.
- Skrypt poprawia zamienione współrzędne. Współrzędne poza Polską skrypt oznacza jako błąd w wykazie. Mapa nie pokazuje takiej stacji.

Format plików i algorytm historii zmian opisuje dokument [docs/dane.md](docs/dane.md).

## Statystyki wejść

Plausible liczy odsłony adresów `/stacja/<id>`. Raport „Top Pages” pokazuje więc wejścia na każdą stację. Raport „Entry Pages” pokazuje wejścia z linków.

Z kluczem API Plausible polecenie `npm run fetch-stats` zapisuje plik `popular.json`. Karta stacji pokazuje wtedy liczbę wyświetleń, a widok „Analiza” pokazuje najczęściej oglądane stacje. Bez klucza skrypt nic nie robi i strona działa bez statystyk.

## Wdrożenie

Projekt działa na Vercel i na Netlify. Polecenie `npm run build` pobiera dane UKE, przetwarza je, pobiera statystyki i buduje stronę do katalogu `dist/`. Mapa używa danych z `dist/data/`, więc budowanie nie wysyła już tilesetu do Mapbox.

Konfiguracja platform:

- Vercel: plik `vercel.json` i funkcja `api/scheduled-deploy.mjs` (Vercel Cron).
- Netlify: plik `netlify.toml` i funkcja `netlify/functions/scheduled-deploy.mjs` (Scheduled Function).

Oba pliki konfiguracji kierują adresy `/stacja/*` do `index.html`.

Zmienne środowiskowe:

| Zmienna | Opis |
| --- | --- |
| `HISTORY_MONTHS` | Liczba poprzednich wydań do historii zmian. Wartość domyślna: `12`. Wartość `0` wyłącza historię. |
| `PLAUSIBLE_API_KEY` | Klucz API Plausible (Stats API). Bez klucza strona nie pokazuje liczby wyświetleń. |
| `PLAUSIBLE_URL` | Adres instancji Plausible. Wartość domyślna: `https://plausible.yasiu.pl`. |
| `PLAUSIBLE_SITE_ID` | Domena strony w Plausible. Wartość domyślna: `nadajniki.yasiu.pl`. |
| `PLAUSIBLE_PERIOD` | Okres statystyk. Wartość domyślna: `30d`. |
| `DEPLOY_HOOK_URL` | Adres deploy hooka. Funkcja cykliczna wywołuje ten adres w dniu przebudowy. |
| `CRON_SECRET` | Tylko Vercel. Vercel wysyła tę wartość w nagłówku `Authorization`. Funkcja odrzuca wywołania bez tej wartości. |

Zmienne `MAPBOX_UPLOAD_KEY` i `MAPBOX_USER` nie są już potrzebne. Usuń je z ustawień platform.

Dzień przebudowy to 26. dzień miesiąca. Jeśli 26. dzień miesiąca nie jest dniem roboczym, dzień przebudowy to następny dzień roboczy. Funkcja uwzględnia soboty, niedziele i ustawowe dni wolne od pracy w Polsce. Cron uruchamia funkcję codziennie od 26. do 29. dnia miesiąca. Funkcja wywołuje deploy hook tylko w dniu przebudowy.

Workflow GitHub Actions `.github/workflows/main.yml` pozwala ręcznie wywołać deploy hook. Workflow używa sekretu repozytorium `DEPLOY_HOOK_URL`.

## Praca lokalna

1. Zainstaluj zależności: `npm install`.
2. Pobierz dane: `npm run fetch-data`.
3. Przetwórz dane: `npm run build-data`.
4. Uruchom serwer deweloperski: `npm run serve`. Strona działa pod adresem http://localhost:9000.
5. Uruchom testy: `npm test`.

## Dokumentacja

- [docs/architektura.md](docs/architektura.md): potok budowania, moduły przeglądarki, adresy URL, statystyki wejść, mapa, motyw i testy.
- [docs/dane.md](docs/dane.md): źródła danych, przetwarzanie wykazu, historia zmian i format plików danych.
