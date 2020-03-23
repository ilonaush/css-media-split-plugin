class EntryMediaStorage {

  constructor () {
    this.mediaCollection = [];
  }

  getMedia(key) {
    const css = this.mediaCollection[key].map(data => data.css).join('\n');
    const query = this.mediaCollection[key][0].query;

    return { css, query };
  }

  addMedia (key, css, query) {
    if (!Array.isArray(this.mediaCollection[key])) {
      this.mediaCollection[key] = [];
    }
    this.mediaCollection[key].push({ css, query });
  }
}

module.exports = EntryMediaStorage;
