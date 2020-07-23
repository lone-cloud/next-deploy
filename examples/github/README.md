Deployments to [GitHub Pages](#https://pages.github.com/) work strictly for static sites, but still possess most of the advantages of using Next.js such as automatic page pre-loading.

An up-to-date Static-Site Generation implementation of https://www.nidratech.com and its deployment using Next Deploy can be found at: https://github.com/nidratech/nidratech.com

The key part is its `next.config.js` configuration:

```javascript
module.exports = {
  engine: 'github',
  debug: true,
  domain: 'www.nidratech.com',
};
```
