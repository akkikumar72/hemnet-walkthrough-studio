# Local typefaces

Instrument Serif, Geist and JetBrains Mono are bundled from the Google Fonts CSS API. Roboto is bundled from the official [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/roboto) for walkthrough video captions. They are used under the included SIL Open Font License files.

- `roboto-OFL.txt`: Roboto variable, weights 100–900, used at 400 and 500 in video captions.
- `geist-OFL.txt`: Geist 400, 500 and 600.
- `instrumentserif-OFL.txt`: Instrument Serif regular and italic.
- `jetbrainsmono-OFL.txt`: JetBrains Mono 400.

Font registration is in `../fonts.css`; family selection is in `../tokens.css`. No font provider is contacted at runtime.
