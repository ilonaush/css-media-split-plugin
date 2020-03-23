const postcss = require("postcss");

function parseMaxWidthRule (query) {
  let resolution = "";
  let unit = "";
  let rule = "";

  if (/\(max-width: \d+[a-zA-Z]+\)$/.test(query)) {
    const parts = query.split(":");
    resolution = (parts[1].match(/\d+/) || "")[0];
    unit = (parts[1].match(/[a-zA-Z]+/) || "")[0];
    rule = parts[0].replace("(", "");
  }

  return {
    resolution,
    unit,
    rule
  }
}


module.exports = postcss.plugin("PostCSSMediaQueryPlugin", (params) => {
  return (root) => {
    root.walkAtRules('media', atRule => {
      const query = atRule.params;
      const {unit, resolution, rule} = parseMaxWidthRule(query);
      const queries = Object.keys(params.queries);
      const queryname = rule.includes("max-width") && unit === params.mediaUnit && queries.find((q) => parseInt(q) >= parseInt(resolution));

      if (queryname) {
        const css = postcss.root().append(atRule).toString();
        params.addMedia(params.queries[queryname], css, query);
        atRule.remove();
      }
    });
  }
});



