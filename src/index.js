const postcss = require("postcss");
const EntryMediaStorage = require("./MediaStorage");
const PostCSSMediaQueryPlugin = require('./plugin');
const validateOptions = require('schema-utils');
const safeRequire = require('safe-require');
const HtmlWebpackPlugin = safeRequire('html-webpack-plugin');
const schema = require("./schema");

const PLUGIN_NAME = "CSSMediaSplitPlugin";

const configuration = {name: PLUGIN_NAME};

const CSS_REGEX = /\.css/;


module.exports = class CSSMediaSplitPlugin {
  constructor(options) {
    const defaultOptions = {
      injectInHTML: "all",
      mediaUnit: "px",
      exclude: [],
    };
    this.options = Object.assign(defaultOptions, options);
    validateOptions(schema, this.options, configuration);
    this.shouldIncludeOnlyChunks = options.injectInHTML === "chunks";
  }

  insertCSSInHTML (compilation, pluginArgs) {
    let extracted = [];
    const chunks = pluginArgs.chunks.map((c) => c.names).flat();
    const assetsArr = this.getFilteredAssets(compilation.assets);
    for (const assetFilename of assetsArr) {

      if (!this.shouldIncludeOnlyChunks || (this.shouldIncludeOnlyChunks && chunks.find(a => assetFilename.includes(a)))) {

        const media = (compilation["media"] || {})[assetFilename];

        if (media) {
          extracted.push({
            tagName: 'link',
            selfClosingTag: false,
            voidTag: true,
            attributes: {
              href: compilation.outputOptions.publicPath + assetFilename,
              rel: 'stylesheet',
              media: media
            }
          });
        }
      }
    }



    return Object.assign({}, pluginArgs, {
      head: [...pluginArgs.head, ...extracted],
    });
  }

  checkIfAssetExcluded (asset) {
    const {exclude = []} = this.options;
    if (!exclude.length) {
      return false;
    }

    return !!exclude.find((e) => e.test(asset));
  }

  addAsset (assets, assetName, content="") {
    assets[assetName] = {
      source: function () {
        return content;
      },
      size: function () {
        return content.length;
      },
    };
  }

  addMediaToCompilation (compilation, newFilename, queryname) {
    const {mediaUnit, queries} = this.options;
    const queryValue = Object.keys(queries).find(q => queries[q] === queryname);
    compilation["media"] = compilation["media"] || {};
    compilation["media"][newFilename] = `(max-width: ${queryValue}${mediaUnit})`;
  }

  getFilteredAssets(assets) {
    const assetsArr = Object.keys(assets);
    return assetsArr.filter(asset => CSS_REGEX.test(asset) && !this.checkIfAssetExcluded(asset));
  }


  apply(compiler) {
    const {mediaUnit, queries, injectInHTML, rule} = this.options;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {

      compilation.hooks.optimizeChunkAssets.tapAsync(PLUGIN_NAME, (assets, callback) => {
        const assetsArr = this.getFilteredAssets(compilation.assets);

        for (const asset of assetsArr) {
          const source = compilation.assets[asset].source();
          const mediaStorage = new EntryMediaStorage();

          postcss(PostCSSMediaQueryPlugin({
            queries,
            addMedia: mediaStorage.addMedia.bind(mediaStorage),
            mediaUnit,
            rule
          })).process(source, {from: undefined})
            .then((result) => {

              Object.keys(mediaStorage.mediaCollection).forEach(queryname => {
                const {css} = mediaStorage.getMedia(queryname);

                const assetNamePos = asset.indexOf(".css");
                const assetName = asset.substring(0, assetNamePos);
                const newFilename = queryname.replace(/\[name]/, assetName);

                this.addAsset(compilation.assets, newFilename, css);
                this.addAsset(compilation.assets, asset, result.css);
                this.addMediaToCompilation(compilation, newFilename, queryname);
              });

              callback();
            })
            .catch(err => {
              console.error(err);
              callback();
            })
        }
      });

    });


    if (injectInHTML !== "none") {
      if (!HtmlWebpackPlugin) {
        throw new Error("You have provided injectInHTML options other than 'none' and HtmlWebpackPlugin were not found to inject assets into HTML. Install HtmlWebpackPlugin first.");
      }
      compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
        const htmlWebpackPluginAlterAssetTags = compilation.hooks.htmlWebpackPluginAlterAssetTags;
        if (htmlWebpackPluginAlterAssetTags) {
          compilation.hooks["htmlWebpackPluginAlterAssetTags"].tap(PLUGIN_NAME, (pluginArgs) => {
            return this.insertCSSInHTML(compilation, pluginArgs);
          })
        }
      })
    }
  }
};
