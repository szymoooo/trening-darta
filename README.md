# 🎯 DartPro – Aplikacja do Treningu Darta

Mobilna aplikacja webowa do zarządzania treningami darta. Działa w przeglądarce bez żadnego backendu – wystarczy jeden plik `index.html`.

## 🎮 Ćwiczenia (domyślne)

1. **Shanghai 10–15** – 3 lotki na liczby 10–15. Single=1pkt, Double=2pkt, Treble=3pkt. Shanghai (S+D+T) = bonus +100 pkt!
2. **Double 1–20 + BULL** – 1 lotka na każdy double. Double=50pkt. Bull=50pkt+50pkt bonusu=100pkt.
3. **Shanghai 15–20** – 3 lotki na liczby 15–20. Taka sama punktacja jak ćwiczenie 1.

## ⚙️ Panel Admina

- Dodawanie nowych ćwiczeń (Shanghai lub Doublesy)
- Włączanie / wyłączanie ćwiczeń przełącznikiem
- Edycja nazwy, opisu i zasad każdego ćwiczenia
- Usuwanie ćwiczeń
- Ranking wszystkich zawodników

## 📊 Panel Zawodnika

- Historia sesji pogrupowana po dniach
- Wykres postępu (ostatnie 5 sesji)
- Streak (ile dni z rzędu trenujesz)
- Rekord osobisty
- Powiadomienie o Shanghai i Bull bonus podczas treningu

## 🗄 Przechowywanie danych

Dane zapisywane są lokalnie w `localStorage` przeglądarki. Każdy użytkownik musi korzystać z **tej samej przeglądarki i urządzenia** aby widzieć swoje wyniki. Jeśli potrzebujesz synchronizacji między urządzeniami – rozważ dodanie backendu (np. Firebase).

## 📁 Struktura plików

```
/
└── index.html   ← cała aplikacja w jednym pliku
└── README.md
```
