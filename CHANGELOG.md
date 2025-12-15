## [1.7.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.6.0...1.7.0) (2025-12-15)

### Features

* **all:** enabled using default values in the data entry modal ([f103c41](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/f103c410facc7ec36a35736a18dfd246b981c75a))
* **all:** made the grid responsive (becomes a cards view on mobile) ([d73b435](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/d73b435176b0dd3442524877ff1958f6a5f9bb6b))
## [1.6.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.5.0...1.6.0) (2025-12-15)

### Features

* **all:** added support for rendering visualizations for formulas ([a313a66](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a313a661c5d84e0206244f6964a23f941eed0ad6))
* **all:** added support for rendering visualizing properties (eg file tags as a cloud) ([0c860ff](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/0c860ff6805cf7f9dd9abeb0a5dca0ff3f78fd6f))
* **all:** better handled different chart types and fixed rendering ([3f2294e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/3f2294ed45c4514931588bc69accb4ba9358146f))
* **all:** enabled reordering property definitions ([c0e3607](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c0e3607e7eb8451df947fd95c9d4bf6769407caf))
* **all:** harmonized label generation across all chart types ([0901709](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/0901709d92bf37cd9ceefaf4194ad0218b12f60a))
* **all:** normalized chart sizes ([5b02b7d](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/5b02b7dd52f288f0148be24c592b107da585165e))
* **all:** reduced the number of visualization re-renders after configuration or data changes ([1d1771c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1d1771c5cc717f3839805c6f00859bc2e7a1fd4c))
* **all:** removed the card height setting in the Life Tracker Base view ([07a13ea](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/07a13eafdcae278a90fbae5bdc1c9cdfd453f1b8))

### Bug Fixes

* **all:** added some delay to validations in the grid to avoid losing input focus too quickly ([928c998](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/928c9982a359bba509e994da6da581a3c66fb15b))
* **all:** fixed issue where the visualization context menu did not reflect the current state ([457fe92](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/457fe925f0635f1024f8b9611ec3e8f8ca0dda09)), closes [#38](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/38)
* **all:** fixed label positioning for timeline chart ([a46ab1f](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a46ab1f35e2b74403432bf96b49d0dec4025a8c0))
* **all:** fixed labels for timeline charts ([bacce60](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/bacce60578df992e84104aabc6f908f045b19b77))
* **all:** stop animations when maximizing/minimizing charts ([56e9a61](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/56e9a61037bfb1082085e9e1e902d41f00a53c31))
* **all:** the cached data is now updated correctly when base data changes ([3d25480](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/3d25480687c9ffa6c7d8fdecc870bb13b5060c38))
## [1.5.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.4.0...1.5.0) (2025-12-14)

### Features

* **all:** added mobile support for the data entry modal ([fb9ceef](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/fb9ceefc8053cef60eb1c83ab52a41c1d250fc24))
## [1.4.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.3.0...1.4.0) (2025-12-14)

### Features

* **all:** better handle the date anchor setting and add support for more date/time formats ([b8b4c6a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/b8b4c6acbc4c2c8bccc6329ed39ddb428d003332))
* **all:** display boolean values more nicely (True|False instead of true|false) ([b4ab3bc](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/b4ab3bc2f71e879c8c68f0ca70725542478ed907))
* **all:** improved performances of the Life Tracker view ([546256e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/546256e523d2ec34f938e0797c2c35e99538d5cc))

### Bug Fixes

* **all:** fixed rendering of the property edition modal (space for slider vs space for input) ([a946f3a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a946f3ab25006f5a66efe47576798cb46ce9972e))
## [1.3.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.2.0...1.3.0) (2025-12-14)

### Features

* **all:** assigned colors based on value for boolean data ([87b1108](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/87b11086086447f9588197381251867d9068b291)), closes [#32](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/32)
* **all:** improved performances by limiting re-rendering ([1693b09](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1693b09fc641373dd921e228dad54189b34e72e0))
* **all:** improved rendering of line charts ([09ccb15](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/09ccb15320e3501cd0d0a30237472a38f278e3f4))

### Bug Fixes

* **all:** improved rendering of heatmap visualizations (fixed misalignment) ([4cf4841](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4cf48419cb2532f905703dd42b9c067d5c49c9f4))
## [1.2.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.1.1...1.2.0) (2025-12-13)

### Features

* **all:** added batch mode support for the command and modal ([bb8eb22](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/bb8eb2272784dc3a5247c0088bbc4eda4f2d374a))
* **all:** added capture command and a new grid base view type ([2b3ade0](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/2b3ade0bb65738780a48c8d3e584e21c3ff71b31))
* **all:** enhanced handling of empty/null values in visualizations (new setting) ([a1c8fff](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a1c8ffff5e928de812dc0cf914e04a02c32dc774))
* **all:** improved navigation across properties with the modal ([a38ce9a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a38ce9a64329578a1b16697d4ad3681cdfb16ecb))
* **all:** improved validation in modal and grid. Only valid values may be entered now ([905c769](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/905c76912b4cd209a3ae09955340c5905abc951e))

### Bug Fixes

* **all:** fixed bug where the heatmap color did not changed according to the setting ([d94e746](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/d94e74671c13952339ee8b558df654f0551cb5fe))
## [1.1.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.1.0...1.1.1) (2025-12-12)

### Bug Fixes

* **all:** fixed issue where after minimizing a maximized card, another was maximized ([08eb94e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/08eb94e53625249c26552efe4e7ee31aca12383a)), closes [#11](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/11)
* **all:** fixed the release workflow to name the tags correctly ([34cd4d5](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/34cd4d5ad241b64c16b5c00abe0569578be562e6))
## [1.1.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.0.0...1.1.0) (2025-12-12)

### Features

* **all:** avoid fully recreating the base view when grid settings are changed (eg number of columns) ([e1747d7](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/e1747d75aff92445e19d7722ff0bbb088e78d5db))
* **all:** renamed the plugin (wider scope) ([cb4832c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/cb4832cd9855f48d7975729ee3d2bad785b40584))
## [1.0.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/0.2.0...1.0.0) (2025-12-12)

### Bug Fixes

* **all:** fix matching between columns and global visualization presets ([c16932a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c16932a4c003770c47f79d8cb87ee0396cae943b))
## [0.2.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/0.1.0...0.2.0) (2025-12-12)

### Features

* **all:** added new visualization types ([4c3af8a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4c3af8ae6d1371beed3aa2e193a2a3058cbf6c27))

### Bug Fixes

* **all:** fix issue with settings update ([34b81eb](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/34b81ebd1637c1dbaf47bb700c7767d5f4310dc7))
## [0.1.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1e4cacab4c98354c4e36114638c3e4463f8ae651...0.1.0) (2025-12-12)

### Features

* **all:** adapt visualizations based on date granularity ([4c1eaa8](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4c1eaa8fde70ba1860855418647d0b911714122b))
* **all:** added github ci and release workflows ([834e301](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/834e3014f900a1f4ff3e8a72ed8a465fb1abc03e))
* **all:** added plugin shell ([1e4caca](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1e4cacab4c98354c4e36114638c3e4463f8ae651))
* **all:** added release scripts ([fe6078b](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/fe6078b04d7201111edaf093c457342f3a1eaa1a))
* **all:** added setting for the animation duration ([7a20356](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/7a20356995cbff56b8ec1d72e790f56bc2cfb400))
* **all:** handle copying the assets in the build script and also copying the required files ([c8a89c1](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c8a89c16180fba73668a66e115a60bb58419c278))
* **all:** improve the display and controls ([f5c890a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/f5c890a8b0d79585b90b5f1cd2467d6644a5da29))
* **all:** improved animations (show values over time) ([a30a8a1](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a30a8a12ecc85ac6b8dc4bf67aaee37b2b61eabf))
* **all:** initial implementation (vibe-coded) ([d6dd100](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/d6dd10058362926e84738276f6677baf9affe85c))
* **all:** removed animations for heatmaps (nok) ([1178a1f](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1178a1ffe084166921f56e08c4d1f77126a9fe5c))
* **all:** updated build to also take care of the CSS with Tailwind ([4091553](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4091553d491051d4d8874438555fa49f8d0787ae))
* **build:** handle copying manifest.json and versions.js in the build script ([4aff9ff](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4aff9ff22ea4b9ccb6a735e56e6db3d499b91948))
