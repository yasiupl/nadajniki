# Architektura

Ten dokument opisuje budowę strony: potok budowania, moduły przeglądarki, adresy URL, statystyki wejść, mapę i motyw. Format danych opisuje dokument [dane.md](dane.md).

## Przegląd

Strona jest statyczna. Serwer nie obsługuje zapytań użytkownika. Przeglądarka wczytuje plik z danymi wszystkich stacji. Wyszukiwanie, filtrowanie i analizy działają w przeglądarce.

Potok budowania:

```text
BIP UKE (bieżący wykaz) ──┐
                          ├─ fetch-data ─► data/ ─► build-data ─► dist/data/ ─┐
dane.gov.pl (archiwum) ───┘                                                    ├─ build-app ─► dist/
Plausible (opcjonalnie) ─────────────── fetch-stats ─► dist/data/popular.json ─┘
```

Polecenie `npm run build` uruchamia kolejno cztery skrypty:

1. `fetch-data` pobiera bieżący wykaz i poprzednie wydania do katalogu `data/`.
2. `build-data` przetwarza wydania i zapisuje pliki danych do katalogu `dist/data/`.
3. `fetch-stats` pobiera liczbę wyświetleń kart stacji. Skrypt działa tylko z kluczem API (interfejsu programistycznego) Plausible.
4. `build-app` buduje aplikację (webpack) do katalogu `dist/`. Webpack czyści katalog `dist/`, ale zostawia katalog `dist/data/`.

Jedyny kod serwera to funkcja cykliczna `scheduled-deploy`. Funkcja raz w miesiącu wywołuje deploy hook. Dzień przebudowy opisuje [README](../README.md).

## Moduły przeglądarki

Punkt wejścia to plik `src/app.js`. Ten plik łączy moduły: uruchamia mapę, wczytuje dane, przelicza filtry i obsługuje akcje użytkownika.

| Plik | Zadanie |
| --- | --- |
| `src/app.js` | Start aplikacji, przeliczanie filtrów, karta stacji i nakładki, tabela akcji, szuflady, motyw. |
| `src/js/config.js` | Stałe: token Mapbox, rodzaje sieci i ich kolory, rodzaje stacji, pasma, szerokości kanałów, jednostki UKE. |
| `src/js/data.js` | Wczytywanie i dekodowanie plików z katalogu `/data/`, indeks wyszukiwania, adresy stacji. |
| `src/js/filters.js` | Model filtrów, dopasowanie stacji, liczniki faset, zapis filtrów w adresie URL. |
| `src/js/query.js` | Parser zapytania wyszukiwarki i dopasowanie stacji do zapytania. |
| `src/js/format.js` | Formatowanie liczb, dat i częstotliwości. Szablon HTML, który escapuje wartości. |
| `src/js/store.js` | Stan aplikacji i magistrala zdarzeń. |
| `src/js/map.js` | Mapa Mapbox GL: źródła, warstwy, zaznaczenie, obszary obsługi, zdarzenia mapy. |
| `src/js/panel.js` | Panel: wybór widoku, renderowanie, pozycja przewijania, układ na komputerze i na telefonie. |
| `src/js/views/` | Widoki panelu: lista stacji, karta stacji, pasma i analiza, zmiany, elementy wspólne. |
| `src/js/filters-drawer.js` | Panel filtrów i pasek aktywnych filtrów. |
| `src/js/search.js` | Pole wyszukiwania z podpowiedziami. |
| `src/js/charts.js` | Wykresy w HTML i podpowiedź wykresów. |
| `src/js/router.js` | Adres URL: karta stacji, filtry, odsłony dla Plausible. |
| `src/js/export.js` | Pliki eksportu: CHIRP (CSV), SDR# (XML) i tabela CSV. |
| `src/js/export-dialog.js` | Okno eksportu: wybór stacji i formatu. |
| `src/js/favorites.js` | Ulubione stacje zapisane w `localStorage`. |
| `src/js/theme.js` | Motyw: automatyczny, jasny albo ciemny. |
| `src/js/ui.js` | Komunikaty, schowek, pobieranie plików. |

Moduły `config.js`, `format.js`, `query.js` i `filters.js` nie używają DOM (Document Object Model). Testy jednostkowe sprawdzają te moduły w Node.js.

### Stan i zdarzenia

Obiekt `state` w pliku `store.js` przechowuje filtry, wynik filtrowania, liczniki faset, bieżący widok, nakładkę i motyw. Nakładka przykrywa zakładkę panelu. Są trzy nakładki:

- `detail`: karta stacji,
- `pick`: lista stacji w miejscu kliknięcia,
- `probe`: wynik narzędzia „Zasięg w punkcie”.

Narzędzie „Zasięg w punkcie” ustawia filtr `point`. Widok `probe` pokazuje wynik filtrowania od stacji najbliższej punktu. Zmiana zakładki ukrywa widok, ale filtr zostaje. Przycisk zamknięcia w widoku i przycisk w pasku aktywnych filtrów usuwają filtr.

Mapa zgłasza zdarzenia przez funkcję `emit()`:

| Zdarzenie | Znaczenie |
| --- | --- |
| `map:ready` | Mapa wczytała pierwszy styl. |
| `map:move` | Widok mapy się zmienił. |
| `map:style` | Mapa wczytała nowy styl po zmianie motywu. |
| `station:open` | Użytkownik kliknął jedną stację. |
| `pick` | Użytkownik kliknął miejsce z kilkoma stacjami. |
| `probe` | Użytkownik wybrał punkt dla narzędzia „Zasięg w punkcie”. Aplikacja ustawia filtr punktu. |

### Renderowanie i akcje

Widoki zwracają kod HTML z szablonu `html`. Szablon escapuje wstawiane wartości, więc tekst z wykazu UKE nie może wstawić kodu HTML do strony.

Panel renderuje się najwyżej raz na klatkę animacji (funkcja `scheduleRender()`). Panel zapamiętuje pozycję przewijania każdej zakładki.

Przyciski mają atrybut `data-action`. Jeden detektor kliknięć w pliku `app.js` wywołuje funkcję z tabeli `actions`. Listy wyboru mają atrybut `data-change`. Formularz zakresu częstotliwości ma atrybut `data-submit`.

## Adresy URL

Adres URL zapisuje trzy rzeczy:

| Część adresu | Zawartość | Przykład |
| --- | --- | --- |
| Ścieżka | Karta stacji: identyfikator i opis. Aplikacja czyta tylko identyfikator. | `/stacja/5312bf5fc9-pkp-polskie-linie-kolejowe-s-a-krakow-mydlniki-kmd` |
| Parametry zapytania | Filtry. | `?q=pkp&typ=A&f=150-151` |
| Część po znaku `#` | Widok mapy: przybliżenie, szerokość i długość geograficzna. Tę część obsługuje Mapbox. | `#12/50.06/19.94` |

Parametry filtrów:

| Parametr | Filtr | Wartości |
| --- | --- | --- |
| `q` | Zapytanie wyszukiwarki | tekst |
| `typ` | Rodzaj sieci | kody rozdzielone przecinkiem, np. `A,C` |
| `pasmo` | Pasmo | `vhf-low`, `vhf-mid`, `vhf`, `uhf`, `other` |
| `f` | Częstotliwość albo zakres w MHz | `148.0125`, `148-149` |
| `kanal` | Szerokość kanału w kHz | `6.25`, `12.5`, `20`, `25`, `other` |
| `kat` | Kategoria operatora | klucze z pliku `scripts/lib/categories.mjs` |
| `urzad` | Jednostka UKE | `DC`, `OKR` i inne kody |
| `operator` | Operator | pełna nazwa operatora |
| `stan` | Stan w wykazie | `nowe`, `zmienione`, `usuniete` |
| `wydanie` | Wydanie dla filtra stanu | data `RRRR-MM-DD` |
| `wygasa` | Pozwolenie wygasa w ciągu N miesięcy | `6`, `12`, `24` |
| `ulubione` | Tylko ulubione stacje | `1` |
| `punkt` | Zasięg w punkcie: stacje, których obszar obsługi obejmuje punkt | `50.06617,19.93107` (szerokość, długość) |

Lista ulubionych jest zapisana w przeglądarce. Link z parametrem `ulubione=1` pokazuje ulubione stacje osoby, która otwiera link.

Serwer musi kierować adresy `/stacja/*` do pliku `index.html`. Pliki `vercel.json` i `netlify.toml` mają tę regułę. Serwer deweloperski ma opcję `historyApiFallback`.

Jeśli bieżące wydanie nie ma stacji z adresu, aplikacja wczytuje historię zmian:

- Przeniesiona stacja otwiera się pod nowym identyfikatorem. Aplikacja poprawia adres.
- Usunięta stacja otwiera się z informacją o wydaniu, w którym zniknęła.
- Nieznany identyfikator daje komunikat. Aplikacja zmienia adres na stronę główną.

## Statystyki wejść

Plausible liczy odsłony ścieżek. Aplikacja zmienia ścieżkę tak, że każde otwarcie karty stacji daje jedną odsłonę:

| Zdarzenie | Zmiana adresu | Odsłona |
| --- | --- | --- |
| Otwarcie karty z listy albo z mapy | `pushState` | Plausible liczy odsłonę automatycznie. |
| Zmiana karty na inną kartę | `replaceState` | Aplikacja wysyła odsłonę (`plausible('pageview')`). |
| Wejście z linku | brak | Plausible liczy odsłonę przy wczytaniu strony. |
| Poprawka adresu (opis, nowy identyfikator) | `replaceState` | Brak odsłony. |
| Zamknięcie karty otwartej z listy | `history.back()` | Plausible liczy powrót na stronę główną. |
| Zamknięcie karty otwartej z linku | `replaceState` | Brak odsłony. |

Filtry i widok mapy zmieniają adres przez `replaceState`, więc nie dają odsłon.

Skrypt `fetch-stats` sumuje odsłony według identyfikatora stacji. Odsłony starego identyfikatora przeniesionej stacji skrypt dodaje do nowego identyfikatora.

## Mapa

Mapa używa Mapbox GL, stylów `light-v11` i `dark-v11` oraz odwzorowania Merkatora.

| Warstwa | Źródło | Zawartość |
| --- | --- | --- |
| `stations` | `stations` | Stacje, które spełniają filtry. Kolor oznacza rodzaj sieci. |
| `station-labels` | `stations` | Częstotliwość (od przybliżenia 12) i operator (od przybliżenia 14). |
| `station-heat` | `stations` | Gęstość stacji. |
| `coverage-fill`, `coverage-line` | `coverage` | Obszary obsługi stacji, które spełniają filtry. |
| `selection-fill`, `selection-line`, `selection-point` | `selection` | Zaznaczona stacja i jej obszar obsługi. |

Stan obiektu mapy (`feature-state`) oznacza stację: `selected` (otwarta karta) i `hover` (kursor). Znacznik punktu narzędzia „Zasięg w punkcie” to obiekt `Marker` z Mapbox GL.

Obszar obsługi to koło o promieniu z pozwolenia. Mapa rysuje koła jako wielokąty, bo warstwa typu `circle` przycina duże koła na granicach kafelków. Mapa rysuje najwyżej 8000 obszarów (stała `COVERAGE_LIMIT` w pliku `map.js`). Przy większej liczbie stacji mapa wybiera stacje najbliżej środka mapy.

Panel zasłania część mapy. Aplikacja ustawia margines mapy (`setPadding`), więc środek mapy i dopasowanie widoku uwzględniają panel.

## Eksport

Przycisk „Eksport” jest na liście stacji, w wyniku narzędzia „Zasięg w punkcie” i w karcie stacji. Okno eksportu pozwala wybrać stacje i format pliku.

Zakresy stacji:

- ta stacja (tylko z karty stacji),
- stacje w widoku mapy,
- stacje w zasięgu wybranego punktu,
- ulubione stacje,
- wszystkie stacje, które spełniają filtry.

Zakresy „W zasięgu punktu” i „Ulubione” są zawsze na liście. Bez punktu albo bez ulubionych zakres jest nieaktywny, a okno podaje powód. Okno otwarte z widoku „Zasięg w punkcie” zaznacza zakres punktu. Okno otwarte z karty stacji zaznacza tę stację.

Formaty:

| Format | Zawartość |
| --- | --- |
| CHIRP (CSV) | Jeden kanał na częstotliwość nadawczą, najwyżej 1000 kanałów (`CHIRP_LIMIT`). Każdy kanał ma `Duplex` = `off`, więc radiotelefon nie nadaje na tym kanale. Nazwa kanału to skrót nazwy operatora, np. „PKP PLK”. Tryb `FM` dla kanałów 20 kHz i szerszych, `NFM` dla węższych. Plik nie ma znacznika BOM i nie ma polskich znaków. |
| SDR# (XML) | Jedna pozycja na częstotliwość nadawczą i operatora. |
| Tabela CSV | Jeden wiersz na stację, wszystkie dane stacji. Separator to średnik. Plik ma znacznik BOM, żeby Excel rozpoznał kodowanie UTF-8. |

## Kolory i motyw

Kolory rodzajów sieci są w pliku `src/js/config.js`. Paleta ma osobne wartości dla motywu jasnego i ciemnego. Najliczniejsze rodzaje sieci (A, C, F) mają kolory, które są najlepiej rozróżnialne.

Kolory interfejsu to tokeny CSS w pliku `src/style.scss`. Atrybut `data-theme` na elemencie `<html>` wybiera motyw:

- `data-theme="light"`: motyw jasny,
- `data-theme="dark"`: motyw ciemny,
- brak atrybutu: motyw z ustawienia systemu (`prefers-color-scheme`).

Moduł `theme.js` zapisuje wybór w `localStorage`. Skrypt w elemencie `<head>` ustawia atrybut przed pierwszym rysowaniem strony. Mapa zmienia styl razem z motywem.

## Service worker

Service worker działa tylko w wersji produkcyjnej.

- Service worker zapisuje pliki aplikacji w pamięci podręcznej przeglądarki.
- Pliki z katalogu `/data/` service worker pobiera najpierw z sieci. Kopię z pamięci podręcznej używa tylko bez połączenia.
- Nawigacja do adresów `/stacja/*` dostaje plik `index.html` z pamięci podręcznej.

## Gdzie zmienić

| Zmiana | Miejsce |
| --- | --- |
| Kategorie operatorów | `scripts/lib/categories.mjs` |
| Rodzaje sieci, kolory, pasma, szerokości kanałów | `src/js/config.js` |
| Liczba wydań w historii zmian | zmienna środowiskowa `HISTORY_MONTHS` |
| Odległość przeniesienia stacji | stała `MOVE_DISTANCE` w `scripts/lib/history.mjs` |
| Obszar poprawnych współrzędnych | stała `AREA` w `scripts/lib/stations.mjs` |
| Limit obszarów obsługi na mapie | stała `COVERAGE_LIMIT` w `src/js/map.js` |
| Kolory interfejsu | tokeny CSS w `src/style.scss` |

## Testy

Polecenie `npm test` uruchamia testy jednostkowe (wbudowany moduł testów Node.js):

- `test/data-pipeline.test.mjs`: czytnik XLSX, parsery wartości, grupowanie stacji, sygnatury, historia zmian, przeniesienia, współrzędne.
- `test/search-filters.test.mjs`: parser zapytania, dopasowanie stacji, filtry i fasety, filtr ulubionych, filtr punktu, zapis filtrów w adresie URL, formatowanie, ścieżki stacji.
- `test/export.test.mjs`: nazwy kanałów CHIRP, plik CHIRP (kanały tylko do odbioru, krok strojenia, tryb, limit kanałów), pliki SDR# i CSV.

Testy nie sprawdzają interfejsu w przeglądarce. Po zmianie interfejsu uruchom `npm run serve` i sprawdź stronę w przeglądarce.
