# Changelog

All notable changes to this project will be documented in this file.

## [2.13.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.12.0...2.13.0) (2026-06-10)

### Features

* **plugin:** add ARIA roles and keyboard navigation across the UI ([7b2727e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/7b2727ea0c65b77a2fc023cfcc1d8d36f926a0e9)), closes [#110](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/110)
* **plugin:** add moving average overlay and trend indicators ([a4e3e9d](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a4e3e9daee3ac81740dc946b19f711ce9e9bc33b)), closes [#101](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/101) [#21](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/21) [#101](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/101)
* **plugin:** anchor the trend arrow to the title and add a trend row ([1e3f595](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1e3f5959dca32bac5fca75858535f0b380920993))
* **plugin:** export charts as PNG and displayed data as CSV ([c112bb5](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c112bb51641daa49bdd312d4b6ed704aca36173d)), closes [#102](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/102)
* **plugin:** polish animations across cards and the capture carousel ([fa49a23](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/fa49a232ef185513dc5df7171222378e6202f7ab)), closes [#111](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/111)

### Bug Fixes

* **plugin:** keep date editor values on the local calendar day ([c5f354a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c5f354a6aa714acff35d6fa1f4f848a77363bbc4)), closes [#94](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/94)
* **plugin:** keep heatmap legend visible while scrolling ([9f433c4](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/9f433c46a73aaecfa31ca1b88d1ae7f4d4909004))
* **plugin:** keep heatmap streak stats visible while scrolling ([5585753](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/558575340af0399eca52bed7515237d7bf78b4dc))
* **plugin:** keep reference lines visible outside the data range ([949a094](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/949a094546645aa1058a46b79d4c014dda257af0))
* **plugin:** let the visualization options column scroll in the popover ([4eeef9c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/4eeef9cc1b8ca1b7aa901c325f0f39e17597eac5))
* **plugin:** pin legend and trend/streak rows to the card bottom ([1902e42](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1902e42dacd6457d3d26cda5bf64af56b861e4a3))
* **plugin:** prevent stale chart instances after rapid re-renders ([d6eeb05](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/d6eeb05bbc007981c455f0d498d4ff19de48727f))
* **plugin:** resolve batch capture provider by most recent interaction ([c7e5637](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c7e563733f4bc01a32664ad4c169592f7297fa06)), closes [#96](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/96)
* **plugin:** show a single tooltip on the trend indicator ([917e785](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/917e785b3f260d1fe56b477d6e2095b2eaf4268f))
* **plugin:** stop leaking viewport listeners on grid view re-renders ([c93106d](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c93106d09f32e3c75a19304e72d0b94b9ccbb7cd)), closes [#93](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/93)
* **plugin:** stop spurious render cache invalidation after GC ([94799b6](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/94799b63ac9484174d8e5d58c2a6396f434965a8)), closes [#95](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/95)
* **plugin:** use the Obsidian-styled tooltip on the trend indicator ([ef1f2fb](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/ef1f2fb0643247dbac6f3873635f4fb13da79622))

## [2.12.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.11.0...2.12.0) (2026-06-10)

### Features

* **plugin:** add capture today command ([f439a6a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/f439a6a854ce5519774334960db8a81ec7c29072)), closes [#105](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/105)
* **plugin:** respect reduced motion preference and restore focus rings ([b2abd9f](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/b2abd9f973c6ee9a328d9986b858af7f35e81345)), closes [#109](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/109)
* **plugin:** show streak stats on heatmaps ([be5048a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/be5048a123193258573d79c1114c0651b1b389d8)), closes [#87](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/87) [#100](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/100)

### Bug Fixes

* **plugin:** flush pending grid view edits before re-render teardown ([6f6df20](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/6f6df205276a1f99ddcc0aa6be68a4af56deddae)), closes [#90](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/90)
* **plugin:** render missing chart values as gaps instead of zeros ([40188fa](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/40188fac192f07e5b4694f4f5cd668f11cce8470)), closes [#92](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/92)
* **plugin:** validate capture modal auto-saves and surface save failures ([e1447aa](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/e1447aaa20cd714406c4ccc76bfecf70ca48d492)), closes [#91](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/91)

## [2.11.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.10.0...2.11.0) (2026-06-02)

### Features

* **plugin:** support sum aggregation for chart visualizations ([25a0eeb](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/25a0eebed909e52680c195cad07182a9f36a03b2)), closes [#89](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/89)

## [2.10.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.9.0...2.10.0) (2026-06-02)

### Features

* **all:** added option to hide header buttons ([c42fe2f](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c42fe2f50dfcdc25ccd2d8794770501b63b77d21)), closes [#88](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/88)

### Bug Fixes

* **all:** fixed heatmap colors ([a3f4644](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/a3f464496ed9cd8ba4dfc5b53c94ebc38d0b5a05)), closes [#87](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/87)

## [2.9.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.8.1...2.9.0) (2026-05-19)

### Features

* **all:** automatically show newest data in heatmap visualizations ([8fe44f8](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/8fe44f83d827ef04446c25ba80f5019c38b0d657))

## [2.8.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.8.0...2.8.1) (2026-05-18)

### Bug Fixes

* **all:** fixed issue with previous year data colors in heatmaps ([645d972](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/645d9729f9db0964f112c1e78d64381baa337383))

## [2.8.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.7.4...2.8.0) (2026-05-18)

### Features

* **all:** enable reordering charts in the Life Tracker base view ([861ddc9](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/861ddc9dfcdb2428dc9355f076cbf3604fd00e19))

## [2.7.4](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.7.3...2.7.4) (2026-05-16)

### Bug Fixes

* **plugin:** update view option type definition ([#84](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/84)) ([695cd94](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/695cd94d931e98508d821a0a9b7740854cf77b39))

## [2.7.3](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.7.2...2.7.3) (2026-05-15)

### Bug Fixes

* **plugin:** filter null/undefined from multi-value property parsing ([cfd6610](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/cfd6610b346552c755606dbab6c1ffa127fd241a)), closes [#83](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/83)

## [2.7.2](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.7.1...2.7.2) (2026-05-14)

## [2.7.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.7.0...2.7.1) (2026-05-13)

## [2.7.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.6.2...2.7.0) (2026-05-13)

### Features

* **all:** added docs ([3ad0787](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/3ad0787ce660ce535d9b6b8c2dbccd2bc18202e3))
* **all:** added release notes update ([5cf6acb](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/5cf6acb2bf9bc1974df51d928a65eafb904eaf79))
* **all:** added support for hiding individual charts when there is an overlay ([2323c2c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/2323c2cdee6d3306f0232927e27e98ba726bd3f9)), closes [#71](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/71)
* **all:** updated release script ([71511da](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/71511daf0c430ab07e1b6b8d0c5b1c7fbc9c09bf))
* **all:** updated scripts ([81dd38e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/81dd38e2c2a0d49a93654e2a6a5c89cf4d7bd2d0))

## [2.6.2](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.6.1...2.6.2) (2026-01-30)

### Features

* **all:** added release and validate scripts ([f941b68](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/f941b6800121c216928861f3d0740031cffa4da6))
## [2.6.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.6.0...2.6.1) (2026-01-30)

### Features

* **all:** isolated styles and removed tw reset ([c1f9059](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c1f9059f13ff490895d07d0e76508b332027b756))
## [2.6.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.5.0...2.6.0) (2026-01-05)

### Features

* **all:** added support for value mappings ([83c0434](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/83c0434fd50749080992b4a14dfe09da60d996fd)), closes [#75](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/75)
## [2.5.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.4.0...2.5.0) (2026-01-03)

### Features

* **all:** added reference line support in visualization customizations ([faef43e](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/faef43e96523eeb1c0ddaaecd0862570f93bb252))
* **all:** added support for reference lines on visualizations with multiple properties ([0a042e8](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/0a042e89a5d02a7c3a5c508f71a4ceeadcc5c8cc))

### Bug Fixes

* **all:** fixed issue with maximizing charts with multiple props ([5d4d2c2](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/5d4d2c271dc75ad49da267d195e6faa86f7d588c))
## [2.4.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.3.0...2.4.0) (2026-01-03)

### Features

* **all:** add better support for lists. The values are now considered in isolation and aggregated correctly ([933f5b3](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/933f5b31c5fe1311ff74a8d81cb8a1931b8ef6d3))

### Bug Fixes

* **all:** fixed broken test ([bf3db4a](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/bf3db4ade3ec67171303afc1dc395550afbaae2a))
## [2.3.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.2.1...2.3.0) (2025-12-22)

### Features

* **all:** added support for creating visualizationss with multiple properties ([c33ee52](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/c33ee52f9858dd93ff9ac05bc71e51972b4970bf)), closes [#68](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/68)
## [2.2.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.2.0...2.2.1) (2025-12-20)

### Bug Fixes

* **all:** fixed default state for show empty values ([0a0f59c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/0a0f59ca342dec5fc0375357ba5a5b2309eadd4b))
## [2.2.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.1.0...2.2.0) (2025-12-17)
## [2.1.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/2.0.0...2.1.0) (2025-12-17)

### Features

* **all:** enabled adding multiple visualizations for the same property ([5518bca](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/5518bca34deb86a2d598860071279a29ca9b3b82)), closes [#51](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/51)
## [2.0.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.9.0...2.0.0) (2025-12-16)

### Features

* **all:** enabled changing the time frame for the life tracking grid (base view options) ([39ab134](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/39ab134b1dc85bcbe97179479cf3c6b443c8f110))

### Bug Fixes

* **all:** filtered the dataset given to the bulk processing command ([1180217](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/1180217c1fa355aa3f12d988c3e371d39cc4078a))
## [1.9.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.8.1...1.9.0) (2025-12-16)

### Features

* **all:** enabled changing the time frame for the life tracker view ([671c6d1](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/671c6d1cad8b06257758036774474df751f50bf8))
* **all:** improved visualizations resizing based on available space ([ee0c7a3](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/ee0c7a3ad02fe51fb94560f675301787af9d3bba))

### Bug Fixes

* **all:** removed visualization as soon as a property is removed from the life tracker view ([3511f83](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/3511f830542f7e572f116e3fde3ebfa8df24e0f1))
## [1.8.1](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.8.0...1.8.1) (2025-12-16)

### Features

* **all:** enabed copying an existing property definition ([51c1817](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/51c18170bc1f6fd3985f8466cca77f01e859bdea)), closes [#20](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/20)
## [1.8.0](https://github.com/dsebastien/obsidian-life-tracker-base-view/compare/1.7.0...1.8.0) (2025-12-16)

### Features

* **all:** added more per-visualization customization options for heatmaps ([cd46c57](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/cd46c57245d4e33c17f8222460eec5e7bc8f7527))
* **all:** enabled customizing visualization colors ([e3bee7c](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/e3bee7c6a6f428220dac28e3ca027269c259793b))

### Bug Fixes

* **all:** better handled color customization for boolean pie and doughtnut charts ([01f5cfd](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/01f5cfdb5eccba4bed5fe2e9983082b077c84054))
* **all:** fixed tooltip display for heatmaps ([fefc112](https://github.com/dsebastien/obsidian-life-tracker-base-view/commit/fefc112980c3fc83b4c138e39ba0c67521c6bd60))
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













