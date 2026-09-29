<p align="center">
  <img src="assets/logo.svg" alt="" width="96" height="96" />
</p>

<h1 align="center">Glossa</h1>

<p align="center">
  Translate selected text in a small bubble, right where you are reading.<br />
  Runs on a local LLM on your own machine, or on your own OpenRouter key. No Google, no account, no server of ours.
</p>

<p align="center">
  <a href="https://github.com/politan/glossa/actions/workflows/ci.yml"><img src="https://github.com/politan/glossa/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="https://github.com/politan/glossa/releases/latest"><img src="https://img.shields.io/github/v/release/politan/glossa?sort=semver" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/politan/glossa" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/Brave%20%7C%20Chrome%20%7C%20Edge-Manifest%20V3-3b5bdb" alt="Chromium, Manifest V3" />
</p>

<!-- Demo GIF goes here once the first release is recorded. -->

## Why Glossa

Most translation extensions send everything you select to a translation company. Glossa does not have a backend at all. You choose where your text goes:

| Where                            | What leaves your computer                                        | Setup                 |
| -------------------------------- | ---------------------------------------------------------------- | --------------------- |
| **Local** (Ollama, LM Studio, …) | Nothing. The model runs on your machine or your private network. | Install a local model |
| **OpenRouter** (your own key)    | The selected text, routed only to hosts that do not retain it.   | Paste an API key      |

Every translation shows a small badge saying which one was used. Glossa never switches from local to cloud on its own.

## Features

- **Translate a selection in place.** Right-click → _Translate with Glossa_, press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>, or turn on the optional icon that appears next to selected text.
- **Streaming output.** The translation appears as the model writes it.
- **Local LLMs first.** Presets for [Ollama](https://ollama.com), [LM Studio](https://lmstudio.ai), [llama.cpp](https://github.com/ggml-org/llama.cpp) and [Jan](https://jan.ai), plus any OpenAI-compatible server. Ollama works without touching `OLLAMA_ORIGINS`.
- **Dedicated translation models.** Defaults to Tencent's [Hy-MT2](https://huggingface.co/tencent/Hy-MT2-30B-A3B) on OpenRouter, and speaks the prompt formats of Hy-MT and Google's [TranslateGemma](https://ollama.com/library/translategemma) as well as general chat models.
- **Auto-detect with a way back.** Set `Auto → Polish` with English as the fallback: English text becomes Polish, Polish text becomes English.
- **Optional surrounding context** for ambiguous words, off by default.
- **Private by default.** OpenRouter requests use zero-data-retention routing, the API key never reaches web pages, and there is no history or telemetry.
- **Light and dark**, following your system. Interface in English and Polish.
- **Minimal permissions.** Installing does not ask for access to all websites; only the optional selection icon does.

## Install

Glossa is not in the Chrome Web Store yet.

1. Download `glossa-<version>-chrome.zip` from the [latest release](https://github.com/politan/glossa/releases/latest) and unzip it.
2. Open `brave://extensions` (or `chrome://extensions`, `edge://extensions`).
3. Turn on **Developer mode** and click **Load unpacked**. Pick the unzipped folder.

Settings open automatically after install.

## Set up a local model (most private)

With [Ollama](https://ollama.com):

```sh
ollama pull translategemma:4b
```

In Glossa's settings add a server with the **Ollama** preset, enter `translategemma:4b` as the model and click **Test connection**.

Recommended local models:

| Model                                      | Size    | Notes                                      |
| ------------------------------------------ | ------- | ------------------------------------------ |
| `translategemma:4b`                        | ~3.3 GB | Good start for laptops, 50+ languages      |
| `translategemma:12b`                       | ~8.1 GB | Noticeably better quality                  |
| `hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M`      | ~4.6 GB | Dedicated MT model, 38 languages           |
| `hf.co/tencent/Hy-MT2-30B-A3B-GGUF:Q4_K_M` | ~18 GB  | Best local quality, needs a strong machine |

Any address on `localhost` or your private network is labelled **Local**. A server elsewhere on the internet is labelled **Self-hosted**; Glossa asks for permission to reach it when you save it.

## Set up OpenRouter (easiest)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and add a few dollars of credit. The translation models are cheap: Hy-MT2 costs about $0.30 per million output tokens.
2. Paste the key in Glossa's settings and click **Save and check**.

Built-in model choices:

| Model                    | Notes                                                          |
| ------------------------ | -------------------------------------------------------------- |
| `tencent/hy-mt2-30b-a3b` | Default. Dedicated translation model                           |
| `tencent/hy-mt2-7b`      | Smaller Hy-MT2                                                 |
| `tencent/hy-mt2-1.8b`    | Cheapest                                                       |
| `google/gemma-4-31b-it`  | Open weights, served by independent hosts only. More languages |

You can enter any other OpenRouter model ID. The built-in list never includes models that send text to Google.

**Strict privacy routing** (on by default) adds `provider.data_collection: "deny"` and `provider.zdr: true` to every request, so OpenRouter only uses hosts that neither store nor train on your text.

## Languages

The language list follows the model:

- **Hy-MT2:** 38 languages and variants, including Traditional Chinese, Cantonese, Tibetan and Uyghur.
- **TranslateGemma:** about 50 languages, including Nordic, Baltic and South Slavic ones, Swahili and Zulu.
- **General models:** all of the above.

Polish and English always sit at the top.

## Troubleshooting

**Ollama answers 403 Forbidden.** Glossa rewrites the `Origin` header of its own requests so Ollama accepts them. If that ever stops working, allow the extension explicitly and restart Ollama:

```sh
# macOS
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
# Linux (systemd): add Environment="OLLAMA_ORIGINS=chrome-extension://*" to the ollama service
```

**LM Studio does not answer.** Turn on **Enable CORS** in LM Studio's server settings.

**The first translation takes long.** Local servers load the model into memory on first use. Glossa waits up to two minutes and shows _Loading model…_ meanwhile.

**Nothing happens on a page.** Browsers do not allow extensions on their own pages (`brave://`, the Web Store). Glossa also skips the icon inside text fields; use the shortcut or the right-click menu there.

## Development

Requires Node 24 and pnpm (via Corepack).

```sh
pnpm install
pnpm dev        # launches a browser with the extension and live reload
pnpm verify     # format check, lint, svelte-check, tests, build
pnpm zip        # .output/glossa-<version>-chrome.zip
```

Built with [WXT](https://wxt.dev), [Svelte 5](https://svelte.dev) and TypeScript. The vocabulary lives in [CONTEXT.md](CONTEXT.md) and design decisions in [docs/adr](docs/adr). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
