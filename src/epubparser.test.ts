// noinspection XmlUnresolvedReference

import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { defaults as xml2jsDefaults, Parser } from 'xml2js';

import EPubParser from './epubparser.js';
import { Manifest, Metadata } from './types.js';

async function parse(content: string): Promise<any> {
  return await new Parser(xml2jsDefaults['0.1']).parseStringPromise(content);
}

describe('EPubParser', () => {
  it('parses content file to Epub_old', async () => {
    const dummyContentFileContent =  readFileSync('./src/dummyContent.opf').toString();
    await EPubParser.parseContentFileToEPub(dummyContentFileContent, null, '');
  });

  describe('getTagNames', () => {
    it('returns tag names', async () => {
      const parsedXml = await parse('<metadata><publisher>test</publisher><dc:creator>test</dc:creator></metadata>');
      expect(EPubParser.getTagNames(parsedXml)).toEqual(['publisher', 'dc:creator']);
    });
  });

  describe('getCleanTagName', () => {
    it('removes prefixes', async () => {
      expect(EPubParser.getCleanTagName('dc:creator')).toEqual('creator');
    });
  });

  describe('getFirstStringValueFromNode', () => {
    it('returns value from single value node', async () => {
      const parsedXml = await parse('<publisher>test</publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('test');
    });

    it('returns empty string when there is no node', async () => {
      const parsedXml = await parse('<publisher></publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('');
    });

    it('returns first string value from node list', async () => {
      const parsedXml = await parse('<publisher>test1</publisher><publisher>test2</publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('test1');
    });

    it('returns empty string value from node list when first list entry is empty', async () => {
      const parsedXml = await parse('<publisher></publisher><publisher>test2</publisher>')
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('');
    });
  });

  describe('parseMetaNode', () => {
    it('parses meta node for cover', async () => {
      const parsedXml = await parse('<metadata><meta name="cover" content="id-4342825810081545813"/></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({cover: 'id-4342825810081545813'});
    });

    it('parses meta nodes with name and content attributes', async () => {
      const parsedXml = await parse('<metadata><meta><random name="john" content="doe"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: 'doe'});
    });

    it('parses meta nodes with name only', async () => {
      const parsedXml = await parse('<metadata><meta><random name="john"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: undefined});
    });

    it('parses meta nodes with property attribute', async () => {
      const parsedXml = await parse('<metadata><meta><foo property="john">doe</foo></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: 'doe'});
    });

    it('ignores partial data in meta nodes', async () => {
      const parsedXml = await parse('<metadata><meta><foo property="john"/><bar content="doe"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({});
    });
  });

  describe('parseAndSetCreatorNodeData', () => {
    it('parses creator node', async () => {
      const parsedXml = await parse('<creator>John Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'John Doe'});
    });

    it('parses creator node with file-as attribute', async () => {
      const parsedXml = await parse('<creator opf:file-as="Doe, John">John Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'Doe, John'});
    });

    it('parses creator node with multiple creator nodes', async () => {
      const parsedXml = await parse('<creator>John Doe</creator><creator>Jane Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'John Doe'});
    });

    it('parses creator node with multiple creator nodes and file-as attribute', async () => {
      const parsedXml = await parse('<metadata><creator opf:file-as="Doe, John">John Doe</creator><creator>Jane Doe</creator></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml['creator'], metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'Doe, John'});
    });

    it('parses creator node with multiple creator nodes and file-as attribute when first node has no file-as', async () => {
      const parsedXml = await parse('<metadata><creator>Jane Doe</creator><creator opf:file-as="Doe, John">John Doe</creator></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml['creator'], metadata);
      expect(metadata).toEqual({creator: 'Jane Doe', creatorFileAs: 'Jane Doe'});
    });
  });

  describe('parseAndSetIdentifierNodeData', () => {
    it('parses ISBN', async () => {
      const parsedXml = await parse('<dc:identifier opf:scheme="ISBN">978-3-16-148410-0</dc:identifier>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml, metadata);
      expect(metadata).toEqual({ISBN: '978-3-16-148410-0'});
    });

    it('parses UUID', async () => {
      const parsedXml = await parse('<dc:identifier id="uuid">urn:uuid:978-3-16-148410-0</dc:identifier>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml, metadata);
      expect(metadata).toEqual({UUID: '978-3-16-148410-0'});
    });

    it('parses UUID with multiple identifier nodes', async () => {
      const parsedXml = await parse('<metadata><dc:identifier opf:scheme="ISBN">978-3-16-148410-1</dc:identifier><dc:identifier id="uuid">urn:uuid:978-3-16-148410-0</dc:identifier></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml['dc:identifier'], metadata);
      expect(metadata).toEqual({ISBN: '978-3-16-148410-1', UUID: '978-3-16-148410-0'});
    });
  });

  describe('parseManifestNode', () => {
    const dummyPath = 'OEBPS'

    it('parses manifest items with id to list', async () => {
      const parsedXml = await parse('<manifest><item id="01"/><item id="02"/></manifest>');
      const manifest = EPubParser.parseManifestNode(parsedXml, dummyPath);
      expect(manifest).toEqual({
        '01': { id: '01', href: '', mediaType: '' },
        '02': { id: '02', href: '', mediaType: '' }
      });
    });

    it('parses manifest items with href', async () => {
      const parsedXml = await parse('<manifest><item id="01"/><item id="02" href="OEBPS/test.css"/></manifest>');
      const manifest = EPubParser.parseManifestNode(parsedXml, dummyPath);
      expect(manifest).toEqual({
        '01': {id: '01', href: '', mediaType: ''},
        '02': {id: '02', href: 'OEBPS/test.css', mediaType: ''}});
    });

    it('parses manifest items with href and content path', async () => {
      const parsedXml = await parse('<manifest><item id="01"/><item id="02" href="test.css"/></manifest>');
      const manifest = EPubParser.parseManifestNode(parsedXml, dummyPath);
      expect(manifest).toEqual({
        '01': {id: '01', href: '', mediaType: ''},
        '02': {id: '02', href: 'OEBPS/test.css', mediaType: ''}
      });
    });

    it('parses manifest items with media-type', async () => {
      const parsedXml = await parse('<manifest><item id="01"/><item id="02" media-type="text/plain"/></manifest>');
      const manifest = EPubParser.parseManifestNode(parsedXml, dummyPath);
      expect(manifest).toEqual({
        '01': {id: '01', href: '', mediaType: ''},
        '02': {id: '02', href: '', mediaType: 'text/plain'}});
    });
  });

  describe('parseSpineNode', () => {
    it('parses spine node', async () => {
      const manifest: Manifest = {
        '01': {href: 'OEBPS/01.html', id: '01', mediaType: 'text/html'},
        '02': {href: 'OEBPS/02.html', id: '02', mediaType: 'text/html'}
      };
      const parsedXml = await parse('<spine><itemref idref="01"/><itemref idref="02"/></spine>');
      const spine = EPubParser.parseSpineNode(parsedXml, manifest);
      expect(spine).toEqual({contents: [
        {id: '01', href: 'OEBPS/01.html', mediaType: 'text/html'}, {id: '02', href: 'OEBPS/02.html', mediaType: 'text/html'}
        ]
      });
    });

    it('parses spine node with only one node', async () => {
      const manifest: Manifest = {
        '01': {href: 'OEBPS/01.html', id: '01', mediaType: 'text/html'},
        '02': {href: 'OEBPS/02.html', id: '02', mediaType: 'text/html'}
      };
      const parsedXml = await parse('<spine><itemref idref="01"/></spine>');
      const spine = EPubParser.parseSpineNode(parsedXml, manifest);
      expect(spine).toEqual({contents: [{id: '01', href: 'OEBPS/01.html', mediaType: 'text/html'}]});
    });

    it('parses spine node with toc', async () => {
      const manifest: Manifest = {
        'ncx2': {href: 'OEBPS/ncx2.html', id: 'ncx2', mediaType: 'text/html'},
        '01': {href: 'OEBPS/01.html', id: '01', mediaType: 'text/html'},
        '02': {href: 'OEBPS/02.html', id: '02', mediaType: 'text/html'}
      };
      const parsedXml = await parse('<spine toc="ncx2"><itemref idref="01"/><itemref idref="02"/></spine>');
      const spine = EPubParser.parseSpineNode(parsedXml, manifest);
      expect(spine).toEqual(
        {
          toc: {id: 'ncx2', href: 'OEBPS/ncx2.html', mediaType: 'text/html'},
          contents: [
            {id: '01', href: 'OEBPS/01.html', mediaType: 'text/html'},
            {id: '02', href: 'OEBPS/02.html', mediaType: 'text/html'}
          ]
        }
      );
    });
  });

  describe('parseTOC', () => {
    const dummySingleNodeToc = `
      <?xml version='1.0' encoding='UTF-8'?>
      <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
        <navMap>
          <navPoint id="np-1" playOrder="1">
            <navLabel>
              <text>The Project Gutenberg eBook of Cranford</text>
            </navLabel>
            <content src="1037185563159831936_394-h-0.htm.xhtml#pg-header-heading"/>
          </navPoint>
        </navMap> 
      </ncx>
      `

    const dummyMultiNodeToc = `
      <?xml version='1.0' encoding='UTF-8'?>
      <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
        <navMap>
          <navPoint id="np-1" playOrder="1">
            <navLabel>
              <text>The Project Gutenberg eBook of Cranford</text>
            </navLabel>
            <content src="1037185563159831936_394-h-0.htm.xhtml#pg-header-heading"/>
          </navPoint>
          <navPoint id="np-2" playOrder="12">
            <navLabel>
              <text>CRANFORD</text>
            </navLabel>
            <content src="1037185563159831936_394-h-0.htm.xhtml#pgepubid00000"/>
          </navPoint>
        </navMap> 
      </ncx>
      `

    const dummyRecursiveToc = `
      <?xml version='1.0' encoding='UTF-8'?>
      <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
        <navMap>
          <navPoint id="np-1" playOrder="1">
            <navLabel>
              <text>The Project Gutenberg eBook of Cranford</text>
            </navLabel>
            <content src="1037185563159831936_394-h-0.htm.xhtml#pg-header-heading"/>
            <navPoint id="np-11" playOrder="3">
              <navLabel>
                <text>CHAPTER VII. VISITING</text>
              </navLabel>
              <content src="1037185563159831936_394-h-9.htm.xhtml#pgepubid00009"/>
            </navPoint>
          </navPoint>
        </navMap> 
      </ncx>
      `

    it('parses single navPoint with text and order', async () => {
      const parsedXml = await parse(dummySingleNodeToc);
      const toc = await EPubParser.parseTOC({}, parsedXml, 'OEBPS');
      expect(toc).toEqual([{
        level: 0,
        order: 1,
        title: 'The Project Gutenberg eBook of Cranford',
        href: '1037185563159831936_394-h-0.htm.xhtml#pg-header-heading',
        id: 'np-1'
      }]);
    });

    it('parses single navPoint and fills with manifest info', async () => {
      const parsedXml = await parse(dummySingleNodeToc);
      const dummyManifest: Manifest = {
        'np-1': {
          href: 'OEBPS/1037185563159831936_394-h-0.htm.xhtml#pg-header-heading', mediaType: 'text/html', id: 'np-1'
        }
      }
      const toc = await EPubParser.parseTOC(dummyManifest, parsedXml, 'OEBPS');
      expect(toc).toEqual([{
        level: 0,
        order: 1,
        title: 'The Project Gutenberg eBook of Cranford',
        href: 'OEBPS/1037185563159831936_394-h-0.htm.xhtml#pg-header-heading',
        id: 'np-1',
        mediaType: 'text/html'
      }]);
    });

    it('parses single navPoint and skips fill with manifest info when no match is found', async () => {
      const parsedXml = await parse(dummySingleNodeToc);
      const dummyManifest: Manifest = {
        'np-1': {href: 'somedifferentlink.html', id: 'np-1', mediaType: 'text/html'}
      }
      const toc = await EPubParser.parseTOC(dummyManifest, parsedXml, 'OEBPS');
      expect(toc).toEqual([{
        level: 0,
        order: 1,
        title: 'The Project Gutenberg eBook of Cranford',
        href: '1037185563159831936_394-h-0.htm.xhtml#pg-header-heading',
        id: 'np-1'
      }]);
    });

    it('parses multiple navPoints', async () => {
      const parsedXml = await parse(dummyMultiNodeToc);
      const toc = await EPubParser.parseTOC({}, parsedXml, 'OEBPS');
      expect(toc).toEqual([
        {
          level: 0,
          order: 1,
          title: 'The Project Gutenberg eBook of Cranford',
          href: '1037185563159831936_394-h-0.htm.xhtml#pg-header-heading',
          id: 'np-1'
        },
        {
          level: 0,
          order: 12,
          title: 'CRANFORD',
          href: '1037185563159831936_394-h-0.htm.xhtml#pgepubid00000',
          id: 'np-2'
        }
      ]);
    });

    it('parses recursive navPoints', async () => {
      const parsedXml = await parse(dummyRecursiveToc);
      const toc = await EPubParser.parseTOC({}, parsedXml, 'OEBPS');
      expect(toc).toEqual([
        {
          level: 0,
          order: 1,
          title: 'The Project Gutenberg eBook of Cranford',
          href: '1037185563159831936_394-h-0.htm.xhtml#pg-header-heading',
          id: 'np-1'
        },
        {
          level: 1,
          order: 3,
          title: 'CHAPTER VII. VISITING',
          href: '1037185563159831936_394-h-9.htm.xhtml#pgepubid00009',
          id: 'np-11'
        }
      ]);
    });
  });
});
