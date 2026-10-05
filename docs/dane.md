# Dane

Ten dokument opisuje źródła danych, przetwarzanie wykazu, historię zmian i format plików w katalogu `dist/data/`. Budowę aplikacji opisuje dokument [architektura.md](architektura.md).

## Źródła

| Źródło | Zawartość | Użycie |
| --- | --- | --- |
| [BIP UKE](https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html) (Biuletyn Informacji Publicznej Urzędu Komunikacji Elektronicznej) | Bieżący wykaz pozwoleń radiowych RRL (radiokomunikacja ruchoma lądowa). Każda jednostka UKE ma osobny plik XLSX. | Bieżące wydanie. |
| [dane.gov.pl, zbiór 1070](https://dane.gov.pl/dataset/1070) | Archiwum. Każde wydanie to jedno archiwum ZIP z plikami XLSX. | Poprzednie wydania do historii zmian. Zapasowe źródło bieżącego wydania. |
| [Legenda wykazu](https://bip.uke.gov.pl/download/gfx/bip/pl/defaultaktualnosci/140/9/96/_legenda_do_wykazu_rrl.pdf) (PDF) | Opis kolumn i kodów. | Nazwy rodzajów sieci, rodzajów stacji i jednostek UKE. |

UKE publikuje nowe wydanie co miesiąc, zwykle około 25. dnia miesiąca. Data wydania jest w nazwach plików, np. `dc_-_stan_na_2026-09-25.xlsx` albo `DC_2026-08-25.xlsx`.

## Pobieranie

Skrypt `scripts/fetch-data.mjs` wykonuje te kroki:

1. Pobiera pliki XLSX ze strony BIP UKE do katalogu `data/current/`.
2. Pobiera listę zasobów zbioru 1070 z API dane.gov.pl.
3. Pobiera archiwa ZIP od najnowszego do plików `data/archive/<id zasobu>.zip`. Skrypt nie pobiera ponownie archiwum, które jest już w katalogu.
4. Czyta datę wydania z nazw plików w archiwum. Pomija wydanie z datą bieżącego wydania albo późniejszą. Pomija też powtórzoną datę.
5. Kończy pobieranie, gdy ma `HISTORY_MONTHS` poprzednich wydań (domyślnie 12).
6. Zapisuje opis wydań do pliku `data/releases.json`.

Jeśli BIP UKE nie działa, bieżącym wydaniem jest najnowsze wydanie z archiwum. Jeśli archiwum nie działa, strona powstaje bez historii zmian.

Przykład pliku `data/releases.json`:

```json
{
  "current": {
    "date": "2026-09-25",
    "source": "bip.uke.gov.pl",
    "files": ["data/current/dc_-_stan_na_2026-09-25.xlsx", "data/current/obi_-_stan_na_2026-09-25.xlsx"]
  },
  "archive": [
    { "date": "2026-08-25", "source": "dane.gov.pl", "resource": "2546284", "zip": "data/archive/2546284.zip" }
  ]
}
```

## Odczyt arkuszy

Moduł `scripts/lib/xlsx.mjs` czyta pliki XLSX bez zewnętrznego parsera XML. Moduł rozpakowuje plik biblioteką fflate. Potem czyta wspólne teksty i komórki arkuszy wyrażeniami regularnymi.

Moduł `scripts/lib/stations.mjs` przypisuje kolumny do pól według nagłówka. Moduł usuwa z nagłówka polskie znaki, spacje i interpunkcję. Wynik musi zaczynać się od znanego prefiksu, np. nagłówek `Dł geo` daje `dlgeo`, czyli pole `lon`. Jeśli moduł nie rozpozna nagłówka, używa układu kolumn z legendy.

Pola rekordu:

| Pole | Kolumna wykazu |
| --- | --- |
| `permit` | Nr referencyjny (numer pozwolenia) |
| `expiry` | Ważna do |
| `name` | Nazwa stacji |
| `stationType` | Rodzaj stacji (FB, FS, ML, MO) |
| `networkType` | Rodzaj sieci (A, B, C, D, E, F, L, P, Q, R, T) |
| `lon`, `lat` | Długość i szerokość geograficzna |
| `radius` | Promień obszaru obsługi [km] |
| `location` | Lokalizacja stacji |
| `erp` | ERP (maksymalna zastępcza moc promieniowania) [dBW] |
| `azimuth`, `elevation` | Azymut i elewacja wiązki [°] |
| `polarization`, `gain` | Polaryzacja, zysk anteny [dB] |
| `antennaHeight`, `groundHeight` | Wysokość anteny nad terenem [m], wysokość terenu n.p.m. [m] |
| `hChar`, `vChar` | Kody charakterystyki anteny (poziom, pion) |
| `tx`, `rx` | Częstotliwości nadawcze i odbiorcze [MHz] |
| `txSpan`, `rxSpan` | Szerokości kanałów nadawczych i odbiorczych [kHz] |
| `op`, `opAddress` | Operator i adres operatora |
| `office` | Kod jednostki UKE z nazwy pliku (DC, OBI, OKR i inne) |

## Normalizacja i poprawki

Kolejne wydania zapisują te same wartości w różny sposób. Bez normalizacji porównanie wydań pokazuje tysiące fałszywych zmian. Wykaz zawiera też błędy we współrzędnych.

| Problem | Przykład | Poprawka |
| --- | --- | --- |
| Zapis liczb | `9.3000000000000007`, `9.300000000000001`, `3,7` | Liczba zaokrąglona do 5 miejsc po przecinku: `9.3`, `3.7`. |
| Listy częstotliwości | `148.01250, 150.20000` | Liczby bez zbędnych zer: `148.0125, 150.2`. |
| Data ważności | liczba seryjna Excela `47254` | Data `2029-05-16`. |
| Brak współrzędnych | `00E00'00"` | Puste współrzędne. |
| Zamienione kolumny | szerokość `19E27'14"`, długość `51N47'32"` | Zamiana kolumn według liter kierunku. |
| Zamienione wartości | szerokość 19,45°, długość 51,79° | Zamiana wartości, jeśli wynik leży w Polsce. |
| Współrzędne poza Polską | szerokość 5,07° (brak cyfry) | Stacja bez położenia na mapie. Pole `badLocation` zapisuje współrzędne z wykazu. |

Kontrola używa obszaru: szerokość 48,5°–56°, długość 13,5°–25°. Obszar obejmuje polską strefę Bałtyku z morskimi farmami wiatrowymi. Granice są w stałej `AREA` w pliku `scripts/lib/stations.mjs`.

## Stacje

Stacja to wszystkie rekordy jednego operatora w jednym punkcie. Rekord opisuje stację stałą (FB) albo grupę stacji ruchomych (ML, MO). Rekord grupy stacji ruchomych ma zwykle współrzędne stacji stałej, z którą grupa współpracuje. Dlatego oba rekordy trafiają do tej samej stacji.

Klucz stacji ma postać `<klucz operatora>|<długość>|<szerokość>`:

- Klucz operatora to nazwa operatora bez wielkich liter, spacji i interpunkcji. Dzięki temu `Sp. z o. o.` i `sp. z o.o.` to ten sam operator.
- Współrzędne mają 4 miejsca po przecinku.
- Rekordy bez współrzędnych tworzą jedną stację operatora z kluczem `<klucz operatora>|-`.

Identyfikator stacji to pierwsze 10 znaków skrótu SHA-1 klucza. Identyfikator zależy tylko od klucza, więc jest taki sam w kolejnych wydaniach. Przy kolizji skrypt wydłuża identyfikator.

Skrypt usuwa powtórzone rekordy w stacji. Operator dostaje kategorię z wyrażeń regularnych w pliku `scripts/lib/categories.mjs`. Operator bez dopasowania, który ma ponad 100 stacji, dostaje własną kategorię. Pozostali operatorzy trafiają do kategorii „Małe sieci” albo „Pojedyncze stacje”.

## Historia zmian

Moduł `scripts/lib/history.mjs` porównuje kolejne wydania, od najstarszego. Moduł przechowuje w pamięci tylko dwa sąsiednie wydania.

Sygnatura stacji ma cztery aspekty:

| Aspekt | Zawartość |
| --- | --- |
| `f` | Częstotliwości nadawcze i odbiorcze. |
| `p` | Numery pozwoleń i daty ważności. |
| `t` | Parametry techniczne: rodzaj stacji, ERP, promień, azymut, elewacja, polaryzacja, zysk, wysokości, charakterystyki, szerokości kanałów. |
| `u` | Urządzenia: rodzaje i nazwy stacji oraz liczba rekordów. |

Stan stacji w wydaniu:

- **Nowa**: poprzednie wydanie nie ma tego identyfikatora.
- **Usunięta**: to wydanie nie ma tego identyfikatora.
- **Zmieniona**: co najmniej jeden aspekt sygnatury jest inny niż w poprzednim wydaniu.
- **Przeniesiona**: para stacji (usunięta, nowa) ma tego samego operatora, odległość do 2 km i wspólne pozwolenie albo te same częstotliwości. Tak wygląda poprawka współrzędnych przez UKE.

Przeniesiona stacja przejmuje historię i datę pojawienia się poprzedniego identyfikatora. Stary identyfikator trafia do tabeli przekierowań. Odległość przeniesienia to stała `MOVE_DISTANCE`.

Zdarzenia stacji w pliku `history.json`:

| Zdarzenie | Znaczenie |
| --- | --- |
| `[data, "a"]` | Nowa stacja. |
| `[data, "r"]` | Stacja usunięta. |
| `[data, "c", aspekty, dodane, usunięte]` | Zmiana. Aspekty to litery z tabeli sygnatury, np. `"fp"`. |
| `[data, "m", poprzedni id, odległość w m, aspekty, dodane, usunięte]` | Przeniesienie. |

Listy „dodane” i „usunięte” zawierają częstotliwości w MHz. Te listy są tylko w zdarzeniach, których aspekty zawierają `f`.

## Pliki wyjściowe

### stations.json

Plik zawiera wszystkie stacje bieżącego wydania. Aplikacja wczytuje ten plik przy starcie.

| Klucz | Zawartość |
| --- | --- |
| `version` | Wersja formatu (`2`). |
| `release` | Data bieżącego wydania. |
| `source` | Źródło bieżącego wydania: `bip.uke.gov.pl` albo `dane.gov.pl`. |
| `generated` | Czas przetworzenia w milisekundach od 1970-01-01. |
| `releases` | Daty wszystkich wydań, od najstarszego. |
| `fields` | Nazwy pól rekordu stacji, w kolejności. |
| `detailFields` | Nazwy pól rekordów w plikach `details/XX.json`. |
| `operators` | Tabela operatorów: `[nazwa, adres, kategoria]`. |
| `categories` | Kategorie: `{ "key": klucz, "name": nazwa }`. |
| `permits` | Tabela numerów pozwoleń. |
| `stations` | Rekordy stacji: tablice w kolejności `fields`. |

Pola rekordu stacji:

| Pole | Zawartość |
| --- | --- |
| `id` | Identyfikator stacji. |
| `operator` | Numer operatora w tabeli `operators`. |
| `lat`, `lon` | Współrzędne w stopniach albo `null` (stacja bez położenia na mapie). |
| `names` | Nazwy stacji stałych, najwyżej 5. Nazwy grup stacji ruchomych są tylko w plikach szczegółów. |
| `location` | Lokalizacja stacji. |
| `networkTypes` | Kody rodzajów sieci, np. `"AC"`. |
| `stationTypes` | Kody rodzajów stacji rozdzielone spacją, np. `"FB ML MO"`. |
| `tx` | Częstotliwości nadawcze w MHz, rosnąco. |
| `rx` | Częstotliwości odbiorcze w MHz albo `0`, jeśli są takie same jak `tx`. |
| `bandwidths` | Szerokości kanałów w kHz. |
| `erp`, `radius`, `antennaHeight` | Największa wartość z rekordów: ERP w dBW, promień obszaru obsługi w km, wysokość anteny w m. |
| `expiry` | Najwcześniejsza data ważności pozwolenia. |
| `permits` | Numery pozwoleń w tabeli `permits`. |
| `office` | Kod jednostki UKE. |
| `units` | Liczba rekordów stacji. |
| `badLocation` | Współrzędne spoza Polski z wykazu, `[szerokość, długość]`, albo `0`. |
| `since` | Data wydania, w którym stacja się pojawiła. Pusty tekst: stacja jest już w najstarszym wydaniu historii. |
| `changed` | Data ostatniej zmiany albo przeniesienia. Pusty tekst: brak zmian w okresie historii. |

### details/XX.json

Plik zawiera pełne rekordy stacji, których identyfikator zaczyna się od znaków `XX`. Aplikacja wczytuje plik przy otwarciu karty stacji.

Format: `{ "<id>": [[wartości w kolejności detailFields], ...] }`. Wartości to teksty po normalizacji.

### history.json

| Klucz | Zawartość |
| --- | --- |
| `release` | Data bieżącego wydania. |
| `releases` | Podsumowanie wydań: `{ date, stations, added, removed, changed, moved }`. Najstarsze wydanie ma tylko pola `date` i `stations`. |
| `fields` | Pola rekordu stacji usuniętej: pola z `stations.json` bez `since` i `changed`, z polem `removed` na końcu. |
| `operators` | Tabela operatorów stacji usuniętych: `[nazwa, adres]`. |
| `removed` | Stacje usunięte w okresie historii. Pole `permits` zawiera numery pozwoleń, a nie numery w tabeli. Pole `removed` to data wydania, w którym stacja zniknęła. |
| `aliases` | Przekierowania: `{ "<stary id>": "<nowy id>" }`. |
| `events` | Zdarzenia: `{ "<id>": [zdarzenie, ...] }`. |

### popular.json

Plik powstaje tylko z kluczem `PLAUSIBLE_API_KEY`.

Format: `{ "period": "30d", "generated": <czas>, "stations": { "<id>": [osoby, odsłony] } }`.

## Rozmiary i czas

Dane dla wydania z 25.09.2026 (23 201 stacji, historia z 12 poprzednich wydań):

| Plik | Rozmiar | Po kompresji Brotli |
| --- | --- | --- |
| `stations.json` | 4,5 MB | 0,74 MB |
| `history.json` | 0,9 MB | 0,15 MB |
| `details/XX.json` (256 plików) | 58 kB na plik | 7 kB na plik |

Przetworzenie 13 wydań trwa około minuty. Archiwa zajmują około 85 MB. Pobranie archiwów w czystym środowisku trwa około minuty.
