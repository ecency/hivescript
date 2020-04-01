# hivescript

An open JSON standard for Hive based apps.

### Account json_metadata

- `name`: max. length 20 chars.
- `about`: max. length 160 chars.
- `location`: max. length 30 chars.
- `website`: valid `https://` URL with max. length 100 chars.
- `profile_image`: avatar image URL, preferably square-cropped with a minimum size of 230 x 230 pixels.
- `cover_image`: cover image URL.

```json
{
  "profile": {
    "name": "Alice",
    "about": "Hive on",
    "location": "New York",
    "website": "https://hive.io/",
    "profile_image": "https://hive.io/opengraph.png",
    "cover_image": "https://hive.io/opengraph.png"
  }
}
```
