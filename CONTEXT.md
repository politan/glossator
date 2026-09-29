# Glossator

A browser extension that translates text the user selects on a web page and shows the result next to it, using the user's own translation-model account.

## Language

### On the page

**Selection**:
The text the user has highlighted on a web page and wants translated.
_Avoid_: fragment, highlight, snippet

**Selection Icon**:
The small button that appears next to a fresh Selection; clicking it opens the Bubble.
_Avoid_: trigger, translate button

**Bubble**:
The panel shown on the page next to the Selection that displays its Translation.
_Avoid_: popup, tooltip, overlay

### In the browser chrome

**Toolbar Popup**:
The panel opened from the extension's toolbar icon, used to change the Language Pair and reach Settings.
_Avoid_: popup (on its own), menu

**Settings**:
The extension's own page where the user stores the API Key and default preferences.
_Avoid_: options, preferences page

### Translating

**Translation**:
The model's rendering of a Selection in the Target Language, revealed progressively as it streams in.
_Avoid_: result, output

**Language Pair**:
The Source Language and Target Language used for a Translation, written `EN -> PL`.
_Avoid_: direction, locale

**Source Language**:
The language the Selection is written in; either a concrete language or Auto.

**Auto**:
A Source Language setting meaning "work out the language of the Selection instead of assuming one".
_Avoid_: detect, any

**Target Language**:
The language the Selection is translated into.

**Fallback Language**:
The language used instead of the Target Language when an Auto Selection turns out to already be in the Target Language, so one Language Pair covers both directions.
_Avoid_: secondary language, reverse language

**Surrounding Context**:
The paragraph around a Selection, sent alongside it only when the user opts in, to help the model resolve ambiguous words.
_Avoid_: background, page context

**Glossary**:
The user's own list of Term Pairs that the model must follow, so recurring words are always translated the same way.
_Avoid_: dictionary, terminology list, word list

**Term Pair**:
One Glossary entry linking a term in one language to its fixed counterpart in another; it applies in both directions.
_Avoid_: entry, mapping, rule

**Style**:
The register the Translation should be written in, such as formal, casual, technical or a description of the user's own.
_Avoid_: tone, voice, formality

### Where Translations come from

**Provider**:
A configured place Glossator sends Selections to for Translation; several can be configured but exactly one is active.
_Avoid_: engine, backend, service, upstream (OpenRouter's own hosting companies are "upstreams", not Providers)

**Cloud Provider**:
A Provider run by a third party on the internet; today only OpenRouter.
_Avoid_: remote provider, online mode

**Local Provider**:
A Provider the user runs themselves and reaches through an OpenAI-compatible server, on their own machine or on a host they control.
_Avoid_: offline mode, private provider

**Preset**:
A ready-made starting configuration for a Local Provider matching a popular server such as Ollama or LM Studio.
_Avoid_: template, integration

**Model**:
A specific translation model offered by a Provider and chosen by the user.
_Avoid_: engine, LLM (on its own)

**Prompt Profile**:
The way Glossator phrases a translation request for a family of Models, picked automatically from the Model's name unless the user overrides it.
_Avoid_: template, prompt style

**Privacy Badge**:
The label in the Bubble's footer stating where the Selection was sent: Local (the user's machine or private network), Self-hosted (a user-controlled server on the public internet) or Cloud.
_Avoid_: indicator, status

**Strict Privacy Routing**:
The Cloud Provider setting, on by default, that only allows upstreams which neither retain nor train on the Selection.
_Avoid_: private mode, incognito

**API Key**:
The user's own credential for a Provider; required for a Cloud Provider, optional for a Local Provider. Glossator has no account or server of its own.
_Avoid_: token, secret, license
