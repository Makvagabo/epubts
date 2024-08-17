import Epub_old from "epub_old";
import {readFileSync} from 'fs';

describe('EPub', () => {
  let epubFile: File;

  beforeAll(() => {
    const _epubFileData = readFileSync('./Henry James - The Death of the Lion.epub');
    epubFile = new File([epubFile], 'Henry James - The Death of the Lion.epub');
  })

  it('can open epub file', () => {
    const epub = new Epub_old(epubFile);
    epub.on('end', () => {
      expect(epub.metadata.title).toEqual('The Death of the Lion');
      expect(epub.version).toEqual('3.0');
    });
    epub.parse();
  });

  it('opens header', () => {
    const epub = new Epub_old(epubFile);
    epub.on('end', () => {
      expect(epub.flow[1]['media-type']).toEqual('application/xhtml+xml');
      expect(epub.flow[1].id).toEqual('pg-header');

      epub.getChapterRaw(epub.flow[1].id, (data, _err) => {
        expect(data).toMatch(/^<\?xml.*/);
      })
    });
    epub.parse();
  });
});
