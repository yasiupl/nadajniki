// Kategorie operatorów. Pierwsze dopasowanie wyrażenia wygrywa.
// Operator bez dopasowania dostaje własną kategorię (powyżej progu), "Małe sieci" albo "Pojedyncze".
export const NETWORK_SIZE_THRESHOLD = 100

export const CATEGORIES = [
    { key: 'higher_education', name: 'Szkoły wyższe', match: /\buniwersytet|\bpolitechnik|\bakademi|\bszkoła wyższa/ },
    { key: 'national_forrest', name: 'Lasy Państwowe', match: /\bnadleśnictwo|\bnadlesnictwo|\blasy|\blasów/ },
    { key: 'national_park', name: 'Parki narodowe', match: /(\bpark).*(\bnarodowy)/ },
    { key: 'road', name: 'Drogi', match: /\bdróg|\bdrogi|\bautostrad/ },
    { key: 'city_guard', name: 'Straż miejska', match: /(\bstraż).*(\bmiejsk)/ },
    { key: 'firefighter', name: 'Straż pożarna', match: /(\bstraż).*(\bpożar)|\bpożar/ },
    { key: 'volounteer_med', name: 'Pogotowie ochotnicze', match: /(\bochotnicz).*(\bpogotow)/ },
    { key: 'airmed', name: 'Pogotowie lotnicze', match: /(\blotnicz).*(\bpogotow)/ },
    { key: 'med', name: 'Pogotowie ratunkowe', match: /\bpogotowi|\bszpital|\bopieki|\bopieka|\bnfz |\b zoz |\bratownictw|\bmedycyna/ },
    { key: 'sport', name: 'Sport', match: /\bsport|\bbieg/ },
    { key: 'transportation', name: 'Taxi, komunikacja miejska', match: /\bkomunikacja|\bkomunikacji|\bkomunikacyj|\btramwaj|\bautobus|\btaxi|\btaksówk|\btransport|\bprzewoźnik|\bprzewóz osób/ },
    { key: 'railroad', name: 'Kolej', match: /\bpkp|\bkolej|\brail|\b db / },
    { key: 'water_supply', name: 'Wodociągi', match: /\bwodocią|\bwoda|\bwodno|\bwodo/ },
    { key: 'waste', name: 'Odpady', match: /\bodpad|\butyliza|\boczyszcza|\bkanaliza/ },
    { key: 'water_managment', name: 'Gospodarka wodna', match: /\bgospodarki wodnej|(\bgospodar).*(\bwod)/ },
    { key: 'heat_plant', name: 'Ciepłownie', match: /\bciepło|\bciepła|\bcieplne|\bcieplna/ },
    { key: 'power_plant', name: 'Elektrownie', match: /\belektrow|\benergety/ },
    { key: 'gas', name: 'Gazownictwo', match: /\bgazociąg|\bgazownictw/ },
    { key: 'extraction', name: 'Wydobywanie', match: /\bkghm|\bkopalni|\bgórnict|\bwęgiel/ },
    { key: 'common', name: 'Gminy', match: /\bgmina|\bgminy|\bgminna/ },
    { key: 'county', name: 'Powiaty', match: /\bpowiat|\bstarost/ },
    { key: 'city', name: 'Miasta', match: /\bmiasto|\bmiasta|\bmiejski|(\burząd).*(\bmiejsk|\bmiast)|\bprezydent|\bburmistrz/ },
    { key: 'voivodeship', name: 'Województwa', match: /\bwojewoda|\bwojewództwo/ },
    { key: 'security', name: 'Ochrona', match: /\bochrony|\bochrona|\bsecur|\bprotec|\bsolid|\bdetektyw|\b997|\bmienie|\bmienia|\binterwencj/ },
    { key: 'air', name: 'Lotnictwo', match: /\bairport|\blotnis|\blotnicz/ },
    { key: 'port', name: 'Porty', match: /\bport|\bmorski/ },
    { key: 'culture', name: 'Kultura', match: /\bmuzeum|\bmuzea|\bteatr|\bfilharmon|\bkultur/ },
    { key: 'bank', name: 'Banki', match: /\bbank/ },
    { key: 'lotos', name: 'Lotos', match: /\blotos/ },
    { key: 'small', name: 'Małe sieci' },
    { key: 'single', name: 'Pojedyncze stacje' }
]
