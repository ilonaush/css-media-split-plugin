const postcss = require("postcss");
const EntryMediaStorage = require("./mediaStorage");
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
    this.options = Object.assign(defaultOptions, options || {});
    validateOptions(schema, this.options, configuration || {});
    this.shouldIncludeOnlyChunks = options.injectInHTML === "chunks";
    this.shouldMakeSourceUnblocking = options.shouldMakeSourceUnblocking;
  }

  insertCSSInHTML (compilation, pluginArgs, head) {
    let formattedChunks = [];

    if (this.shouldIncludeOnlyChunks) {
      formattedChunks = (((pluginArgs || {}).plugin || {}).options || {}).chunks || [];
    }

    const extracted = this.generateHTMLLinkTags(compilation, formattedChunks);
    const initial = this.shouldMakeSourceUnblocking ? this.getSourceAssetsWithMediaAttributes(compilation, pluginArgs[head]) : pluginArgs[head];

    return Object.assign({}, pluginArgs, {
      [head]: [...initial, ...extracted],
    });
  }

  generateHTMLLinkTags (compilation, formattedChunks) {
    let extracted = [];
    const assetsArr = this.getFilteredAssets(compilation.assets) || [];

    for (const assetFilename of assetsArr) {
      const shouldBeIncluded = !this.shouldIncludeOnlyChunks || formattedChunks.find(a => assetFilename.includes(a));

      if (shouldBeIncluded) {

        const media = (compilation["media"] || {})[assetFilename];

        if (media && typeof media === "string") {
          extracted.push({
            tagName: 'link',
            selfClosingTag: false,
            voidTag: true,
            attributes: {
              href: (compilation.outputOptions.publicPath || "") + assetFilename,
              rel: 'stylesheet',
              media: media
            }
          });
        }
      }
    }

    return extracted;
  }

  getSourceAssetsWithMediaAttributes(compilation, links) {
    const newLinks = [...links];
    for (const link of newLinks) {
      const attributes = link.attributes || {};
      const media = (compilation["media"] || {})[attributes.href.slice(1)];
      if (media) {
        link.attributes = {
          ...attributes,
          media: media.value || "",
          onload: media.onload || ""
        }
      }
    }
    return newLinks;
  }

  checkIfAssetExcluded (asset) {
    const {exclude = []} = this.options;
    if (!exclude.length) {
      return false;
    }

    return !!exclude.find((e) => e.test(asset));
  }

  setNonBlockingMediaToSourceAsset (compilation, asset) {
    compilation["media"] = compilation["media"] || {};
    compilation["media"][asset] = {};
    compilation["media"][asset].value = "none";
    compilation["media"][asset].onload = "this.media='all'";
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

                this.setNonBlockingMediaToSourceAsset(compilation, asset);
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
            return this.insertCSSInHTML(compilation, pluginArgs, "head");
          })
        } else {
          HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(
            PLUGIN_NAME, (data, cb) => {
              cb(null, this.insertCSSInHTML(compilation, data, "headTags"))
            }
          )
        }
      })
    }
  }
};
