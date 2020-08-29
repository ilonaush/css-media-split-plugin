const schema = {
  type: "object",
  properties: {
    exclude: {
      "type": "array",
      "items": {
        "instanceof": "RegExp"
      },
      "minItems": 0
    },
    mediaUnit: {
      "type": "string"
    },
    queries: {
      "type": "object",
    },
    injectInHTML: {
      type: "string",
      "enum": ["all", "chunks", "none"]
    },
    shouldMakeSourceUnblocking: {
      type: "boolean"
    }
  },
  additionalProperties: false,
  required: ["queries"]
};

module.exports = schema;
