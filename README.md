# LanguageTool-Plugin für Joplin

Rechtschreib- und Grammatikprüfung für Joplin-Notizen über LanguageTool. Voreingestellt ist die **kostenlose öffentliche API** (https://api.languagetool.org); alternativ kann in den Einstellungen ein **eigener Server** hinterlegt werden (z. B. https://languagetool.example.org) – dann bleiben die Prüftexte im eigenen Netz.

Basiert in Teilen auf [tito21/joplin-langugetool](https://github.com/tito21/joplin-langugetool) (MIT), wurde aber für den aktuellen CodeMirror-6-Editor von Joplin neu entwickelt.

## Funktionen

- **Notiz prüfen**: Befehl `LanguageTool: Notiz prüfen` über das Werkzeuge-Menü, die Symbolleiste (Schaltfläche bei Bedarf über Rechtsklick auf die Symbolleiste → Anpassen einblenden) oder die Befehlspalette (Strg+Umschalt+P).
- **Hervorhebungen im Editor**: Rechtschreibfehler (rote Wellenlinie), Grammatik-/Zeichensetzungsfehler (orange Wellenlinie), Stilhinweise (graue gepunktete Linie). Der Mauszeiger über einer Fundstelle zeigt die Fehlermeldung.
- **Korrekturvorschläge per Rechtsklick**: Rechtsklick auf eine hervorgehobene Stelle zeigt im Kontextmenü Korrekturvorschläge, „Wort immer ignorieren" und „Regel deaktivieren".
- **Ergebnisdialog**: Die manuelle Prüfung öffnet zusätzlich eine Übersicht aller Fundstellen mit Meldung, Vorschlägen und Regel.
- **Automatische Prüfung** (optional, standardmäßig aus): prüft einige Sekunden nach dem letzten Tastendruck. Hinweis: Dabei wird der Notiztext automatisch an den Server übertragen.
- **Markdown-freundlich**: Markdown-Syntax (Überschriften, Links, Codeblöcke, Tabellen …) wird vor der Prüfung ausgeblendet, damit sie nicht als Fehler gemeldet wird. Die Positionen der Fundstellen bleiben exakt erhalten.
- **Eigenes Wörterbuch** und **deaktivierte Regeln/Kategorien** (in den Plugin-Einstellungen, kommagetrennt).

## Voraussetzungen

- Joplin **ab Version 3.1.1** mit dem **Markdown-Editor** (CodeMirror 6, seit Joplin 3.4 der Standard-Editor; in Joplin 3.1–3.3 ggf. in den Einstellungen aktivieren).
- Der Rich-Text-Editor (WYSIWYG) wird nicht unterstützt.
- Ein erreichbarer LanguageTool-Endpunkt: voreingestellt die öffentliche API `https://api.languagetool.org/v2/check` (getestet, LanguageTool 6.9-SNAPSHOT, API v1) oder die eigene Instanz (getestet mit LanguageTool 6.8, z. B. `https://languagetool.example.org/v2/check`).

## Installation

1. Datei `publish/de.osz2.languagetool.jpl` aus diesem Paket herunterladen bzw. aus dem Release herunterladen.
2. In Joplin: **Werkzeuge → Einstellungen → Erweiterungen → Zahnrad → „Aus Datei installieren"** und die `.jpl`-Datei auswählen.
3. Joplin neu starten.
4. In den Einstellungen unter **LanguageTool** die Server-URL prüfen (voreingestellt: `https://api.languagetool.org/v2/check`; eigene Instanz einfach dort eintragen).

Alternative Installation direkt aus dem Quellcode (für Entwicklung):

```bash
npm install
npm run dist
```

(Dies setzt Node.js und npm voraus.)

Die fertige `.jpl` liegt dann in `publish/`. Zum lokalen Testen kann man in Joplin unter **Werkzeuge → Einstellungen → Erweiterungen → Entwicklung** den Quellcode-Ordner als Entwicklungs-Plugin eintragen.

## Bedienung

1. Notiz öffnen und mit Markdown-Editor bearbeiten.
2. **Strg+Umschalt+P** → „LanguageTool: Notiz prüfen" (oder Werkzeuge-Menü / Symbolleistenschaltfläche).
3. Fehler werden farbig unterstrichen. **Live-Prüfung:** Bereits beim Tippen wird geprüft – standardmäßig 1 Sekunde nach der letzten Eingabe und während durchgehender Eingabe spätestens alle 5 Sekunden (abschaltbar). **Rechtsklick** auf eine Fundstelle zeigt die Meldung und die Korrekturvorschläge an.
4. Einen **Korrekturvorschlag auswählen** – er wird direkt in den Notiztext übernommen (seit v1.1.0). Auch im **Ergebnisdialog** sind Vorschläge seit v1.2.0 klickbar: Die Korrektur wird angewendet und der Dialog zeigt danach die verbleibenden Fehler.
5. Über das Rechtsklickmenü lassen sich Wörter ins eigene Wörterbuch aufnehmen oder einzelne Regeln deaktivieren; die Notiz wird danach automatisch neu geprüft.

## Einstellungen

| Einstellung | Standard | Beschreibung |
|---|---|---|
| Server-URL | `https://api.languagetool.org/v2/check` | öffentliche Gratis-API oder eigene Instanz |
| Sprache | `auto` | z. B. `de-DE`, `en-US` oder `auto` |
| Muttersprache | `de-DE` | verbessert Regeln für typische Fehler |
| Automatisch prüfen | an | Prüfung bereits beim Tippen (ca. 2 s nach letzter Eingabe) |
| Wartezeit | 1000 ms | Verzögerung nach Eingabepause (beim Tippen spätestens alle 5 s) |
| Markdown-Syntax ausblenden | an | weniger Fehlalarme |
| Deaktivierte Regeln / Kategorien | leer | kommagetrennte IDs |
| Eigenes Wörterbuch | leer | komma- oder zeilengetrennt |
| Benutzername / API-Schlüssel | leer | nur für Instanzen mit Zugangsbeschränkung |

## Technische Hinweise und Grenzen

- **Öffentliche Gratis-API:** anonyme Nutzung ist auf ca. 20 Anfragen pro Minute begrenzt. Die Live-Prüfung sendet höchstens eine Anfrage pro Sekunde Eingabepause bzw. alle 5 Sekunden während des Tippens – bei sehr langen ununterbrochenen Eingaben kann das Limit erreicht werden, die API lehnt dann vorübergehend Anfragen ab. Eigene Instanz oder Premium-Account (Benutzername/API-Schlüssel in den Einstellungen) heben das Limit. Bei Meldung eines Limits lässt sich die Live-Prüfung in den Einstellungen abschalten.
- Die Server-URL wird automatisch normalisiert: Fehlende Schemata (https://), überzählige Schrägstriche und der übliche Pfad `/v2/check` werden ergänzt – `https://languagetool.example.org` funktioniert also genauso wie `https://languagetool.example.org/v2/check`. Eigene Pfade (z. B. hinter einem Reverse-Proxy) bleiben unverändert.
- Die Netzwerkkommunikation läuft ausschließlich zwischen Joplin und dem konfigurierten Server – es gibt keinen automatischen Fallback auf andere Dienste. **Hinweis Datenschutz:** Bei Verwendung der öffentlichen API werden die geprüften Textabschnitte an die Server von languagetool.org übertragen. Für sensible Notizen die eigene Instanz eintragen.
- Prüfergebnisse sind an den Text gebunden, für den sie erzeugt wurden: Ändert sich der Notiztext oder wird die Notiz gewechselt, werden veraltete Ergebnisse verworfen und nicht mehr angewendet.
- **Korrekturen sind ergebnisgebunden abgesichert (seit v1.1.0):** Jedes Prüfergebnis erhält ein eindeutiges Ergebnis-Token, das bei jeder Textänderung, nach dem Verwerfen der Hervorhebungen und durch jedes neuere Prüfergebnis entwertet wird. Eine Korrektur wird nur angewendet, wenn Notiz, Text und Token noch zum Prüfergebnis passen – veraltete Korrekturen werden abgelehnt. Zusätzlich prüft das Plugin synchron, ob der zu ersetzende Text unverändert ist, und korrigiert nur innerhalb der Dokumentgrenzen.
- Notizen werden nur bis 30000 Zeichen geprüft (Standard-Limit von LanguageTool, serverseitig über `maxCheckLength` konfigurierbar).
- Rechtsklick-Korrekturvorschläge und der Ergebnisdialog sind Desktop-Funktionen. Auf Joplin Mobile stehen sie derzeit nicht zur Verfügung.
- Bekanntes Limitat: Wörter direkt nach Markdown-Listenpunkten oder Checkboxen können von LanguageTool fälschlich als Groß-/Kleinschreibungsfehler (Regel DE_CASE) gemeldet werden, weil Listenpunkte bei der Prüfung ausgeblendet werden. Über das Kontextmenü lässt sich die Regel zwar deaktivieren – das wirkt dann aber global für alle Notizen, was nicht empfehlenswert ist.
- Das Plugin wurde gegen die öffentliche API (api.languagetool.org, LanguageTool 6.9-SNAPSHOT) und gegen LanguageTool 6.8 auf die eigene Instanz getestet; ein Laufzeittest in der Joplin-GUI stand bei Erstellung noch aus (siehe Abschnitt „Status“).

## Status

Build und Paketierung geprüft, die automatisierten Content-Script-Integrationstests sind bestanden, der API-Aufruf wurde gegen die öffentliche API (api.languagetool.org) und früher gegen LanguageTool 6.8 auf die eigene Instanz verifiziert. Ein Laufzeittest in der Joplin-GUI (Hervorhebungen, Kontextmenü, Einstellungen) steht noch aus – Feedback ist willkommen.

## Lizenz

MIT – siehe LICENSE. Die Dateien `webpack.config.js`, `api/` und `GENERATOR_DOC.md` stammen aus dem offiziellen Joplin-Plugin-Template (generator-joplin, MIT).
