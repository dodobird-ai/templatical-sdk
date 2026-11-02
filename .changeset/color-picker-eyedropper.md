---
"@templatical/editor": minor
---

Color pickers get an eyedropper. In browsers with the EyeDropper API (Chromium), every picker that shows the wheel also shows a "Pick from screen" button; the colour the author clicks on screen is applied as `#rrggbb`, like a wheel pick, and Escape cancels without changing anything. The button is hidden where the API is missing and never offered on a locked palette (`colors.allowCustom: false`, or a custom-block field with `allowCustom: false`). New translation key `colorPicker.pickFromScreen` in every locale.
