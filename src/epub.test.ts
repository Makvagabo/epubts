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

  it('opens chapter with content', async () => {
    const epub = await Epub.load(epubFile);
    const chapter = await epub.getChapter('pg-footer');
    expect(chapter).toMatch(/^<section.*/);
  });

  it('opens image', async () => {
    const epub = await Epub.load(epubFile);
    const image = await epub.getImage('id-6989820804442268709');
    expect(image.mediaType).toEqual('image/jpeg');
    expect(image.content.length).toEqual(2062);
  });

  it('retrieves files', async () => {
    const epub = await Epub.load(epubFile);
    const file = await epub.getFile('item2');
    expect(file.mediaType).toEqual('text/css');
    expect(file.content).toMatch(/^@charset "utf-8";.*/);
  });

  it('checks for DRM', async () => {
    const epub = await Epub.load(epubFile);
    expect(await epub.hasDRM()).toBeFalsy();
  });
});
