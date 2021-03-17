# Hivescript

An open standard for Hive based apps.

- `Apps` - URL format and canonical linking schemes
- `BadActors` - accounts mischiefs or phishing attempts
- `BadDomains` - phishing domains

# How to use this package

`yarn add @hiveio/hivescript`

## Canonical linking

On Hive, content is stored in blockchain and same information is accessible via different websites and services built on Hive. Canonical linking to origin of post is important for entire ecosystem to thrive. 

Here is an example on how to do it in few simple lines: 

```
  import apps from "@hiveio/hivescript/apps.json";

  let scheme = `${default_domain}/{category}/@{username}/{permlink}`;

  // get app information from post json
  const app = post.json_metadata.app;

  if (app) {
    const identifier = app.split("/")[0];

    if (apps[identifier]) {
      scheme = apps[identifier].url_scheme;
    }
  }
  // return proper canonical link for post
  const canonicalLink = scheme
    .replace("{category}", entry.category)
    .replace("{username}", entry.author)
    .replace("{permlink}", entry.permlink);
    
```

## Bad actors

Bad actors, list of account that is mostly created with intention to take advantage of user mistype. Sometimes simple misspell can direct funds into wrong accounts, this list contain those reported accounts.

This section could be part of wallet page in your Dapp where user enters account name to transfer funds to.

```
  import badActors from '@hiveio/hivescript/bad-actors.json';

  if (badActors.includes(to_account)) {
    console.warn("Use caution sending to this account. Please double check your spelling for possible phishing.");
  }

```


## Bad domains

Phishing domains, list of phishing domains, we recommend Dapp/frontend developers check external link clicks and warn users about potential phishing domains.

This section could be part of content rendering or external link clicking event listener in your web/mobile/desktop apps.

```
  import badDomains from '@hiveio/hivescript/bad-domains.json';

  const regex = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/

  external_link = external_link.match(regex)[1]

  if (badDomains.includes(external_link)) {
    console.warn("Security alert! Site ahead contains malware / Suspected phishing page.");
  }

```