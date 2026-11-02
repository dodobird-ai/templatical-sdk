---
title: Styling
description: Block-Stile, Abstände, Sichtbarkeit und Einstellungen auf Template-Ebene in Templatical.
---

# Styling

Jeder Block in Templatical trägt eine Eigenschaft `styles` für Layout und Erscheinungsbild sowie `visibility` für viewport-spezifische Kontrolle.

## BlockStyles

Die Schnittstelle `BlockStyles` steuert Padding und Hintergrund.

```ts
interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}
```

```ts
import { createParagraphBlock } from '@templatical/types';

const block = createParagraphBlock({
  content: '<p>Styled text</p>',
});

block.styles = {
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
  backgroundColor: '#f0f9ff',
};
```

## SpacingValue

Padding verwendet den Typ `SpacingValue` mit vier Richtungswerten in Pixeln.

```ts
interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

Alle vier Eigenschaften sind erforderlich. Verwenden Sie `0` für Seiten, die keinen Abstand benötigen:

```ts
block.styles = {
  padding: { top: 0, right: 16, bottom: 0, left: 16 },
};
```

## Absatzabstand

Ein Paragraph-Block mit mehr als einem `<p>` setzt die Abstände dazwischen über `paragraphSpacing` in px. Lassen Sie das Feld weg, um den Standardwert `8` zu verwenden; `0` setzt die Absätze ohne Abstand aneinander.

```ts
const block = createParagraphBlock({
  content: '<p>First.</p><p>Second.</p>',
  paragraphSpacing: 16,
});
```

Die Arbeitsfläche und die exportierte E-Mail wenden diesen Wert identisch an – der Abstand, den Sie im Editor sehen, ist der Abstand, der versendet wird. Betroffen ist nur der Raum *zwischen* Absätzen innerhalb eines Blocks; der Raum um den Block herum ist `styles.padding`, und ein Block mit einem einzelnen Absatz hat gar keinen inneren Abstand.

Listenabstände sind nicht konfigurierbar: MJML setzt für `ul`/`ol`/`li` nichts zurück, daher dienen diese Werte dazu, die Standardwerte der E-Mail-Clients festzunageln, und nicht dazu, gestaltet zu werden.

## Block-Sichtbarkeit

Die Eigenschaft `visibility` auf jedem Block steuert, ob er bei jedem Breakpoint gerendert wird.

```ts
interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}
```

Beide sind standardmäßig `true`. Setzen Sie einen Breakpoint auf `false`, um den Block bei dieser Größe auszublenden:

```ts
// Nur auf dem Desktop anzeigen
block.visibility = {
  desktop: true,
  mobile: false,
};
```

Dies ist nützlich, um unterschiedliche Inhalte bei unterschiedlichen Bildschirmgrößen anzuzeigen -- zum Beispiel eine detaillierte Tabelle auf dem Desktop und eine vereinfachte Liste auf dem Mobilgerät.

## Einstellungen auf Template-Ebene

Neben einzelnen Blockstilen hat das Template selbst globale Einstellungen, die das Gesamtlayout beeinflussen.

| Einstellung | Typ | Beschreibung |
|---------|------|-------------|
| `width` | `number` | Template-Inhaltsbreite in px (typischerweise 600) |
| `backgroundColor` | `string` | Äußere Hintergrundfarbe hinter dem Template |
| `textColor` | `string` | Standard-Textfarbe, die jeder Textblock (Title, Paragraph, Menu, Table) erbt, sofern der Block keine eigene Farbe oder Inline-Textfarbe setzt. Standard: `#1a1a1a`. |
| `linkColor` | `string` | Dokumentweite Linkfarbe für jeden Link (Rich-Text und Menu). Optional – wenn nicht gesetzt, erben Links die umgebende Textfarbe. Eine block- oder elementspezifische Farbe überschreibt weiterhin. |
| `linkUnderline` | `boolean` | Ob Body-Links (Rich-Text) unterstrichen werden. Standard: `true`. Buttons und Menu-Elemente behalten ihre eigene text-decoration. |
| `fontFamily` | `string` | Standard-Schriftfamilie für alle Blöcke |
| `locale` | `string` | BCP-47-Inhaltssprache (`<html lang>`). Bei einem leeren Template Standard `en` |
| `direction` | `'ltr' \| 'rtl'` | Schreibrichtung. Ungesetzt folgt der Inhaltssprache |
| `preheaderText` | `string` | Vorschauzeile im Posteingang |
| `darkColors` | `TemplateDarkColors` | Optionale Farben für Empfänger, deren Mail-App im Dunkelmodus ist. Siehe [Dark-Mode-Farben](#dark-mode-farben). |

Diese werden über die `init()`-Konfiguration des Editors oder durch direkte Änderung des Template-JSON konfiguriert:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  content: {
    settings: {
      width: 640,
      backgroundColor: '#f8fafc',
      textColor: '#1a1a1a',
      linkUnderline: true,
      locale: 'en',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    blocks: [],
  },
});
```

Einzelne Blöcke können die `fontFamily` auf Template-Ebene überschreiben, indem sie ihre eigene `fontFamily`-Eigenschaft setzen. Wenn ein Block keine Schriftfamilie angibt, erbt er von den Template-Einstellungen.

Die Textfarbe funktioniert genauso: Textblöcke (Title, Paragraph, Menu, Table) erben `textColor` aus den Template-Einstellungen, und jeder Block, der seine eigene Farbe setzt, überschreibt sie. Passen Sie den Dokument-Standard über `init({ templateDefaults: { textColor } })` an.

Links folgen derselben Kaskade: Setzen Sie eine Dokument-`linkColor`, um allen Links (Rich-Text und Menu) eine Farbe zu geben, oder lassen Sie sie ungesetzt, damit Links die umgebende Textfarbe erben. `linkUnderline` (standardmäßig aktiv) unterstreicht Body-Links – Buttons und Menu-Elemente behalten ihre eigene text-decoration. Eine block- oder elementspezifische Farbe (z. B. die Farbe eines Menu-Elements) überschreibt weiterhin die Dokument-Linkfarbe. Einzelne Rich-Text-Links können im Link-Dialog auch eine eigene Farbe erhalten, die die Dokument-Linkfarbe überschreibt – und da die Farbe am Link selbst sitzt, passt die Unterstreichung dazu.

## Dark-Mode-Farben

Manche Mail-Apps gestalten eine E-Mail um, wenn der Empfänger den Dunkelmodus nutzt. Setzen Sie `darkColors` am Template, an einer Section, einem Title, einem Paragraph oder einem Button, um die Farben für diesen Fall zu wählen. Ein weggelassenes Feld behält seine helle Farbe. Im Editor liegen die Farben in einer Gruppe **Dunkelmodus** in den Einstellungen dieser Blöcke und in der Darstellungs-Karte der Template-Einstellungen.

| Wo | Feld | Ersetzt im Dunkelmodus |
|----|------|------------------------|
| Template (`settings.darkColors`) | `backgroundColor` | Den E-Mail-Hintergrund |
| | `textColor` | Den Text jedes Titels und Absatzes |
| | `linkColor` | Links in Titeln und Absätzen |
| Section | `backgroundColor` | Den Hintergrund der Section (gilt nicht für einen Hero) |
| Title, Paragraph | `backgroundColor` | Den Hintergrund des Blocks |
| | `textColor` | Den Text des Blocks, einschließlich Inline-Textfarben und Links |
| Button | `backgroundColor` | Die Füllung des Buttons |
| | `textColor` | Die Beschriftung des Buttons |

Die eigene `textColor` eines Blocks hat Vorrang vor der des Templates, und die `linkColor` des Templates hat für Links Vorrang vor beiden.

```ts
const content = {
  settings: {
    ...settings,
    darkColors: { backgroundColor: '#121212', textColor: '#e8e8e8', linkColor: '#8ab4f8' },
  },
  blocks: [
    createButtonBlock({
      text: 'Jetzt kaufen',
      url: 'https://example.com',
      darkColors: { backgroundColor: '#8ab4f8', textColor: '#000000' },
    }),
  ],
};
```

Der Renderer macht daraus CSS, nie Inline-Styles: Jedes Element erhält eine Klasse nach Rolle und Farbe, etwa `tpl-dark-text-e8e8e8`, und ein `<mj-style>` im Head enthält die Regeln, alle mit `!important`:

- innerhalb von `@media (prefers-color-scheme: dark)`, das Apple Mail und Outlook für Mac anwenden;
- beschränkt auf `[data-ogsc]` (Text) und `[data-ogsb]` (Hintergründe), die Attribute, die Outlook.com und die Outlook-Apps beim Umfärben einer E-Mail setzen.

Outlook für Windows wendet keines von beiden an.

Ein Template ohne Dark-Mode-Farben wird genau wie bisher gerendert: ohne Klassen und ohne zusätzliches `<mj-style>`.

Der Renderer fügt kein `<meta name="color-scheme">` und keine CSS-Eigenschaft `color-scheme` hinzu: Ob eine Mail-App die E-Mail umfärben darf, entscheiden Sie. Die Gmail-Apps ignorieren diese Regeln und färben selbst um, es sei denn, Ihre E-Mail widerspricht dem mit `<meta name="color-scheme" content="light only">` im Head. Apple Mail dunkelt eine E-Mail nicht mehr selbst ab, sobald sie `color-scheme: light dark` deklariert; eine solche E-Mail sollte daher Dark-Mode-Farben für Hintergründe und Text setzen.

Die Dunkelmodus-Vorschau des Editors zeigt die Dark-Mode-Farben dort, wo sie gesetzt sind, und sonst die hellen Farben. Ein Template ganz ohne Dark-Mode-Farben wird stattdessen mit invertierten Farben gezeigt, so wie manche Mail-Apps eine E-Mail ohne eigenes dunkles Design abdunkeln.
