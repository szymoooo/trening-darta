# 🎯 DartPro – Aplikacja do Treningu Darta

> Mobilna aplikacja webowa do zarządzania treningami darta z rozgrywką online, mecz 501/301/701, profilami zawodników i inteligentnym systemem podpowiedzi checkout.

**🌐 Live demo:** [szymoooo.github.io/trening-darta](https://szymoooo.github.io/trening-darta)

---

## 📱 O aplikacji

DartPro to pełna aplikacja PWA (Progressive Web App) działająca w przeglądarce mobilnej. Można ją dodać do ekranu głównego telefonu jak natywną apkę. Dane przechowywane są w chmurze (Supabase) — wyniki widoczne na każdym urządzeniu po zalogowaniu.

---

## ✨ Funkcje

### 🎯 Treningi
- **3 domyślne ćwiczenia** konfigurowane przez admina
- **Shanghai 10–15** — 3 lotki na każdą liczbę, bonus +100 pkt za Shanghai (S+D+T)
- **Double 1–20 + BULL** — 1 lotka na każdy double, 50 pkt za double, bonus 50 pkt za Bull
- **Shanghai 15–20** — identyczna punktacja jak Shanghai 10–15
- **Auto-przejście** — po każdym rzucie automatycznie przeskakuje do następnego celu bez klikania
- **Tarcza SVG** — interaktywna tarcza na dole ekranu z animowanym podświetleniem aktualnego celu
- **Bonusy** — animowany toast przy Shanghai i trafieniu Bull
- **Historia sesji** z wykresem postępu (ostatnie 5 sesji) i rekordem osobistym

### 🏹 Mecz 501 / 301 / 701
- Gra w dół od wybranego wyniku
- Klawiatura numeryczna do wpisywania wyników serii
- **Dwa tryby wpisywania:** suma serii (3 rzuty) lub każdy rzut osobno — ustawiane w profilu
- **Podpowiedzi checkout** od 170 do 2 pkt z preferencją ulubionych double zawodnika
- Tabela zakończeń — przycisk ℹ️ otwiera pełną listę możliwych checkoutów w okolicach aktualnego wyniku
- Historia rund z aktualnego meczu
- Kontynuacja przerwanego meczu po powrocie do aplikacji

### ⚔️ Gra Online (Multiplayer)
- **Pokoje z kodem** — host tworzy pokój i dostaje 4-literowy kod (np. `XK92`)
- **Dołączanie** — drugi gracz wpisuje kod i dołącza w kilka sekund
- Tury w czasie rzeczywistym — polling co 1.5s aktualizuje wyniki u obu graczy
- Różne tryby wpisywania — każdy gracz może mieć własny tryb (seria / rzut po rzucie)
- Checkout hinty podczas własnej tury z uwzględnieniem ulubionych double
- Historia rund widoczna dla obu graczy
- Automatyczna wygrana gdy przeciwnik opuści pokój

### 👤 Profil zawodnika
- Imię, wiek, ulubiony zawodnik
- Marka i waga lotek
- **Ulubione double** — wybierane z listy, priorytetowo podpowiadane przy checkout
- **Zdjęcie profilowe** — upload z galerii lub aparat (max 5 MB, JPG/PNG/WebP)
- Tryb wpisywania wyników w meczu
- Statystyki: liczba sesji, rekord, streak

### 📊 Historia
- **Zakładka Treningi** — sesje pogrupowane po dniach z wynikami bazowymi i bonusami
- **Zakładka Mecze** — rozegrane mecze z liczbą rund, średnią serią i statusem (Wygrana / Przerwany / W toku)

### ⚙️ Panel Admina
- Dynamiczne reguły punktacji — dodajesz/usuwasz/edytujesz dowolne reguły dla każdego ćwiczenia
- Auto-zapis — zmiany zapisują się do bazy 800ms po ostatniej edycji
- Włączanie/wyłączanie ćwiczeń przełącznikiem
- Dodawanie nowych ćwiczeń — typ Shanghai lub Doublesy, własne sektory i reguły
- Ranking zawodników z najlepszym wynikiem i streakiem

---

## 🔐 Konta

| Rola | Login | Hasło |
|------|-------|-------|
| Admin | " "| " " |
| Zawodnik | dowolny nick | własne hasło — tworzone przy pierwszym logowaniu |

> Pierwsze logowanie = automatyczna rejestracja. Wpisz pseudonim i hasło — konto powstaje automatycznie.

---

## 🗄 Baza danych

Aplikacja używa **Supabase** (PostgreSQL + REST API + Storage).

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

**iPhone / iPad:**
Safari → przycisk Udostępnij → „Dodaj do ekranu głównego"

**Android:**
Chrome → menu ⋮ → „Dodaj do ekranu głównego"

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
- **Backend:** [Supabase](https://supabase.com) — PostgreSQL + REST API + Storage
- **Hosting:** GitHub Pages
- **PWA:** Web App Manifest z ikoną osadzoną w base64

---

## 📁 Struktura

```
/
├── index.html   ← cała aplikacja (HTML + CSS + JS)
└── README.md
```

---

## 📋 Changelog

### Aktualna wersja
- ⚔️ Multiplayer online z pokojem i kodem dołączenia
- 🎯 Interaktywna tarcza SVG z animowanym podświetleniem celu
- 💡 Podpowiedzi checkout 2–170 pkt z uwzględnieniem ulubionych double
- 👤 Profil z avatarem, sprzętem i preferencjami
- 🏹 Mecz 501/301/701 z historią rund i kontynuacją
- 📊 Historia treningów i meczów w osobnych zakładkach
- 🔒 Sesja 8h z auto-logowaniem przy powrocie do apki
- ⬅️ Obsługa systemowego przycisku back (Android/iOS)
- 🎨 Custom modals — bez brzydkich nagłówków przeglądarki
- 💾 Auto-zapis punktacji w panelu admina
- 📱 PWA z własną ikoną na ekranie głównym
