import Epub from "epub";
import {readFileSync} from 'fs';

describe('EPub', () => {
  let epubFile: File;

  beforeAll(() => {
    const epubFileData = readFileSync('./Henry James - The Death of the Lion.epub');
    epubFile = new File([epubFileData.buffer], 'Henry James - The Death of the Lion.epub');
  })

  it('can open epub file', async () => {
    const epub = await Epub.load(epubFile);
    expect(epub.metadata.title).toEqual('The Death of the Lion');
    expect(epub.version).toEqual('3.0');
  });

  it('opens header', async () => {
    const epub = await Epub.load(epubFile);
    expect(epub.spine.contents[1].mediaType).toEqual('application/xhtml+xml');
    expect(epub.spine.contents[1].id).toEqual('pg-header');

    const chapter = await epub.getRawChapter(epub.spine.contents[1].id);
    expect(chapter).toMatch(/^<\?xml.*/);
  });
});
