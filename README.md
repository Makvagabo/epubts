# epubts

A typescript ePub loader library for the browser. Works on browser File objects.

# Usage

```typescript
// Load Epub singleton
import Epub from 'epubts';
// Load your file
const epub = await Epub.load(epubFile);
// Get the items ids of the content
const spineItemIds = epub.spine.contents.map((item) => item.id);
// Load chapter data
const chapterData = await epub.getChapter(spineItemIds[0]);
```

# Acknowledgements

This project is based on the [epub](https://github.com/julien-c/epub) js node library.

# License

MIT License
