##### The plugin is still in development :) So use it with caution.

###Usage

```
const CSSMediaSplitPlugin = require('css-media-split-plugin');

module.exports = {
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: '[name].js'
  },
  plugins: [
    new CSSMediaSplitPlugin({
        queries: {
            "500": "mobile.css",
            "768": "tablet.css"
        },
        exclude: [/home/]
    }));
  ]
}
```

Following code will create separate files for each css module with corresponding media queries. Currently plugin supports only `max-width` media rule. The queries object keys are the upper limit for file, so if the query is `max-width: 320px`, it will be also included in `mobile.css` file.



### Options 
There are several additional properties which can customize css media splitting:

Name | Type | Default | Description | Required
------------ | ------------- | ------------- | ------------- | -------------
mediaUnit |{String} | "px" | unit which should be processed by plugin | -
injectInHTML | "none"/ "chunks" / "all" | "all" | sets the way generated filed injected into HTML file. Requires HTMLWebpackPlugin to be installed. "None" - doesn't inject files in html; "all" - injects all created files; "chunks" - adds only chunks which are mentioned in HTMLWebpackPlugin options. The files are inserted in head with media attribute. | -
exclude | array of {RegExp} | [] | Array of regular expressions that should be used to omit splitting specific files into different media css files | -
queries | {Object} | - | Object where the keys are the numeric values for `max-width` property and the values are file names. Placeholder `[name]` can be used to replace chunk name.| +
