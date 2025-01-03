# epubts

A typescript ePub loader library for the browser. Works on browser File objects.

# Usage

```typescript
// Load Epub singleton
import Epub from 'epubts';
// Load your file
const epub = await Epub.load(epubFile);
// Get the items ids of the content
const spineItemIds = epub.spine.contents.map(item => item.id);
// Load chapter data
const chapterData = await epub.getChapter(spineItemIds[0]);
```

# Publishing

After making all changes and updating the [CHANGELOG.md](CHANGELOG.md) file, run the following commands:

```bash
yarn publish --new-version 0.2.0
```

Where `0.2.0` is the new version number. Note: this will create a git commit and tag. The tag name is the version number
without any prefix as configured in the `.yarnrc` file. The format of the commit message is also specified in the `.yarnrc`.

# Acknowledgements

This project is based on the [epub](https://github.com/julien-c/epub) js node library.

# License

MIT License
