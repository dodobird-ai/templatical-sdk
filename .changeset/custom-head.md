---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

Add a custom head to template settings: `settings.customHeadCss` and `settings.customHeadTags`, edited in a new Custom head card of the Settings tab. The renderer emits the tags inside an `<mj-raw>` and the CSS inside an `<mj-style>`, last in `<mj-head>`, so a meta tag or an Outlook conditional comment reaches the compiled `<head>` (MJML strips a bare head comment) and the CSS wins ties with the built-in rules. Unset or blank fields add nothing: a template without a custom head renders byte for byte as before.

A value that could break the MJML document or run code is left out of the render whole and named in a `console.warn`: CSS containing `<`; tags with `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`, document-structure tags or any `<mj-*>` tag, an `on*` attribute, a URL attribute outside the editor's link schemes, or a comment or tag that never closes. The panel shows the same reason as the author types and stores the value as typed. `checkCustomHeadCss` and `checkCustomHeadTags` (`@templatical/types`) return the verdict for hosts, and `getTagAttrNames` joins the HTML scanning helpers. The editor canvas never applies author head content.

Both fields join `templateSettings.fields`; leave them out to hide the card. The schema in `@templatical/template-tools` and `@templatical/ai-kit` lists them. Keep every `@templatical/*` package on the same version.
