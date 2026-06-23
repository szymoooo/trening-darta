# 🎯 DartPro – Aplikacja do Treningu Darta

Mobilna aplikacja webowa do zarządzania treningami darta z rozgrywką online, meczem 501/301/701, profilami zawodników i inteligentnym systemem podpowiedzi checkout.

🌐 **Live demo:** [szymoooo.github.io/trening-darta](https://szymoooo.github.io/trening-darta)

---

## 📱 O aplikacji

DartPro to pełna aplikacja PWA (Progressive Web App) działająca w przeglądarce mobilnej. Można ją dodać do ekranu głównego telefonu jak natywną apkę. Dane przechowywane są w chmurze (Supabase) — wyniki widoczne na każdym urządzeniu po zalogowaniu.

---

## ✨ Funkcje

### 🔥 Rozgrzewka (Warmup Timer)
- Karta zawsze widoczna jako pierwsza na liście głównej
- Odliczanie z domyślnym czasem 10 minut (zakres 10–60 min, co 5 min)
- Animowany pierścień SVG z wizualnym postępem
- Podświetlenie ostatnich 5 sekund + trzytonal sygnał zakończenia
- Pauza / wznów / zatrzymaj — bez zapisywania sesji do historii

---

### 🎯 Treningi

Ćwiczenia konfigurowane przez admina. Obsługiwane typy:

| Typ | Opis | Przyciski | Punktacja |
|-----|------|-----------|-----------|
| **Shanghai** | 3 lotki na każdą liczbę | Pudło / S / D / T | wartość × mnożnik; bonus za S+D+T |
| **Doublesy** | 1 lotka na każdy double | Pudło / D | 50 pkt za double; bonus za Bull |
| **Sections** | Sekcje planszy po kolei | Pudło / Sąsiedni / Trafiony | 0 / 1 / 5 pkt |
| **Sector Focus** | Wybrany sektor, stałe mnożniki | Pudło / S / D / T | 0 / 1 / 2 / 3 pkt (niezależnie od sektora) |

**Dodatkowe funkcje treningowe:**
- Tarcza SVG z animowanym podświetleniem aktualnego celu
- Chipy rzutów (✗ / S / D / T) pokazujące każdą lotkę z osobna
- Animowany toast przy bonusie (Shanghai, Bull)
- Podsumowanie po sesji z breakdown per cel — dla każdego sektora widać kolejne rzuty i zdobyte punkty
- Historia postępu (ostatnie 5 sesji) i rekord osobisty
- **Następne ćwiczenie** — po zakończeniu automatycznie proponuje kolejne z listy dnia

---

### 🏹 Mecz 501 / 301 / 701

- Gra w dół od wybranego wyniku
- Dwa tryby wpisywania: suma serii (3 rzuty) lub każdy rzut osobno — ustawiane w profilu
- Podpowiedzi checkout od 170 do 2 pkt z preferencją ulubionych double zawodnika
- Tabela zakończeń — przycisk ℹ️ otwiera pełną listę możliwych checkoutów
- Historia rund z aktualnego meczu
- Kontynuacja przerwanego meczu po powrocie do aplikacji

---

### ⚔️ Gra Online (Multiplayer)

- Pokoje z kodem — host tworzy pokój i dostaje 4-literowy kod (np. `XK92`)
- Dołączanie — drugi gracz wpisuje kod i dołącza w kilka sekund
- Tury w czasie rzeczywistym — polling co 1.5 s aktualizuje wyniki u obu graczy
- Różne tryby wpisywania — każdy gracz może mieć własny tryb (seria / rzut po rzucie)
- Checkout hinty podczas własnej tury z uwzględnieniem ulubionych double
- Historia rund widoczna dla obu graczy
- Automatyczna wygrana gdy przeciwnik opuści pokój

---

### 👤 Profil zawodnika

- Imię, wiek, ulubiony zawodnik
- Marka i waga lotek
- Ulubione double — wybierane z listy, priorytetowo podpowiadane przy checkout
- Zdjęcie profilowe — upload z galerii lub aparat (max 5 MB, JPG/PNG/WebP)
- Tryb wpisywania wyników w meczu
- Statystyki: liczba sesji, rekord, streak

---

### 📊 Historia

- Zakładka **Treningi** — sesje pogrupowane po dniach z wynikami bazowymi i bonusami
- Zakładka **Mecze** — rozegrane mecze z liczbą rund, średnią serią i statusem (Wygrana / Przerwany / W toku)

---

### ⚙️ Panel Admina

- Dynamiczne reguły punktacji — dodajesz / usuwasz / edytujesz dowolne reguły dla każdego ćwiczenia
- Auto-zapis — zmiany zapisują się do bazy 800 ms po ostatniej edycji
- Włączanie / wyłączanie ćwiczeń przełącznikiem
- Dodawanie nowych ćwiczeń — 4 typy (Shanghai, Doublesy, Sections, Sector Focus), własne sektory i reguły
- Ranking zawodników z najlepszym wynikiem i streakiem

---

## 🔐 Konta

| Rola | Login | Hasło |
|------|-------|-------|
| Admin | *(dane u administratora)* | *(dane u administratora)* |
| Zawodnik | dowolny nick | własne hasło — tworzone przy pierwszym logowaniu |

Pierwsze logowanie = automatyczna rejestracja. Wpisz pseudonim i hasło — konto powstaje automatycznie.

---

## 🗄 Baza danych

Aplikacja używa Supabase (PostgreSQL + REST API + Storage).

| Tabela | Opis |
|--------|------|
| `users` | Konta zawodników z profilem i preferencjami |
| `exercises` | Ćwiczenia z dynamicznymi regułami punktacji (JSONB) |
| `sessions` | Sesje treningowe z wynikami |
| `throws` | Log rzutów per sesja |
| `matches` | Mecze solo 501/301/701 |
| `match_rounds` | Rundy w meczu solo |
| `rooms` | Pokoje do gry online |
| `room_rounds` | Rundy w grze online |

---

## 📱 Instalacja na telefonie (PWA)

**iPhone / iPad:** Safari → przycisk Udostępnij → „Dodaj do ekranu głównego"

**Android:** Chrome → menu ⋮ → „Dodaj do ekranu głównego"

Po dodaniu aplikacja działa jak natywna — pełny ekran, własna ikona 🎯, bez paska przeglądarki.

---

## 🚀 Wdrożenie

Cała aplikacja to jeden plik `index.html`. Działa na GitHub Pages bez żadnego serwera.

1. Wgraj `index.html` do repozytorium
2. Wejdź w **Settings → Pages → Source: main / root**
3. Dostępna pod adresem `https://[nick].github.io/[repo]`

---

## 🛠 Technologie

- **Frontend:** Vanilla JS, CSS custom properties, SVG (tarcza generowana matematycznie)
- **Backend:** Supabase — PostgreSQL + REST API + Storage
- **Hosting:** GitHub Pages
- **PWA:** Web App Manifest z ikoną osadzoną w base64

---

## 📁 Struktura

```
/
├── index.html   ← cała aplikacja (HTML + CSS + JS, ~3300 linii)
└── README.md
```

---

## 📋 Historia zmian

### Aktualna wersja
- ⚔️ Multiplayer online z pokojem i kodem dołączenia
- 🎯 Interaktywna tarcza SVG z animowanym podświetleniem celu
- 📊 Breakdown rzutów w podsumowaniu — chipy per cel z punktacją
- ⏱️ Warmup Timer z odliczaniem, SVG ringiem i sygnałem zakończenia
- ▶️ Automatyczne przejście do następnego ćwiczenia po sesji
- 💡 Podpowiedzi checkout 2–170 pkt z uwzględnieniem ulubionych double
- 👤 Profil z avatarem, sprzętem i preferencjami
- 🏹 Mecz 501/301/701 z historią rund i kontynuacją
- 📈 Historia treningów i meczów w osobnych zakładkach
- 🔒 Sesja 8 h z auto-logowaniem przy powrocie do apki
- ⬅️ Obsługa systemowego przycisku back (Android / iOS)
- 🎨 Custom modale — bez brzydkich nagłówków przeglądarki
- 💾 Auto-zapis punktacji w panelu admina
- 📱 PWA z własną ikoną na ekranie głównym
