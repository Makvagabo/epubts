// noinspection ALL

import { describe, expect, it } from 'vitest';

import { ChapterCleaner, ExecuteParams } from './chapterCleaner.ts';

describe('ChapterCleaner', () => {
  describe('links', () => {
    it.each([
      {
        testCase: 'replaces link when it matches an entry in the manifest',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
            item2: {
              href: 'content/chapter2.html',
              id: 'chap2',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter: '<p>Read <a href="chapter1.html">Chapter 1</a></p>',
        },
        expectedOutput:
          '<p>Read <a href="root/chap1/content/chapter1.html">Chapter 1</a></p>',
      },
      {
        testCase:
          'replaces link with fragment when it matches an entry in the manifest',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html#section1',
              id: 'chap1',
              mediaType: '',
            },
            item2: {
              href: 'content/chapter2.html',
              id: 'chap2',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter:
            '<p>Go to <a href="chapter1.html#section1">Section 1</a></p>',
        },
        expectedOutput:
          '<p>Go to <a href="root/chap1/content/chapter1.html#section1">Section 1</a></p>',
      },
      {
        testCase:
          'does not replace link when it does not match any entry in the manifest',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
            item2: {
              href: 'content/chapter2.html',
              id: 'chap2',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter: '<p>Visit <a href="chapter3.html">Chapter 3</a></p>',
        },
        expectedOutput: '<p>Visit <a href="chapter3.html">Chapter 3</a></p>',
      },
      {
        testCase: 'handles empty href attribute gracefully',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter: '<p>Empty link <a href="">No Chapter</a></p>',
        },
        expectedOutput: '<p>Empty link <a href="">No Chapter</a></p>',
      },
      {
        testCase: 'replaces multiple links correctly',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
            item2: {
              href: 'content/chapter2.html',
              id: 'chap2',
              mediaType: '',
            },
            item3: {
              href: 'content/chapter3.html',
              id: 'chap3',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter: `
      <p>Links:
        <a href="chapter1.html">Chapter 1</a>,
        <a href="chapter2.html">Chapter 2</a>,
        <a href="chapter4.html">Chapter 4</a>
      </p>
    `,
        },
        expectedOutput: `<p>Links: <a href="root/chap1/content/chapter1.html">Chapter 1</a>, <a href="root/chap2/content/chapter2.html">Chapter 2</a>, <a href="chapter4.html">Chapter 4</a></p>`,
      },
      {
        testCase: 'replaces link regardless of attribute formatting',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter:
            "<p>Link format <a href = 'chapter1.html'>Chapter 1</a></p>",
        },
        expectedOutput:
          '<p>Link format <a href="root/chap1/content/chapter1.html">Chapter 1</a></p>',
      },
      {
        testCase: 'replaces link when href value is unquoted',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter:
            '<p>Unquoted href <a href=chapter1.html>Chapter 1</a></p>',
        },
        expectedOutput:
          '<p>Unquoted href <a href="root/chap1/content/chapter1.html">Chapter 1</a></p>',
      },
      {
        testCase:
          'replaces link correctly when it contains additional attributes',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter:
            '<p><a class="link" href="chapter1.html" target="_blank">Chapter 1</a></p>',
        },
        expectedOutput:
          '<p><a target="_blank" href="root/chap1/content/chapter1.html" class="link">Chapter 1</a></p>',
      },
      {
        testCase: 'replaces link with query parameters correctly',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html?version=1',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: 'root/',
          rawChapter: '<p><a href="chapter1.html?version=1">Chapter 1</a></p>',
        },
        expectedOutput:
          '<p><a href="root/chap1/content/chapter1.html?version=1">Chapter 1</a></p>',
      },
      {
        testCase: 'handles empty contentPath gracefully',
        params: {
          manifest: {
            item1: { href: 'chapter1.html', id: 'chap1', mediaType: '' },
          },
          contentPath: '',
          linkRoot: 'root/',
          rawChapter: '<p>Read <a href="chapter1.html">Chapter 1</a></p>',
        },
        expectedOutput:
          '<p>Read <a href="root/chap1/chapter1.html">Chapter 1</a></p>',
      },
      {
        testCase: 'handles empty linkroot gracefully',
        params: {
          manifest: {
            item1: {
              href: 'content/chapter1.html',
              id: 'chap1',
              mediaType: '',
            },
          },
          contentPath: 'content',
          linkRoot: '',
          rawChapter: '<p>Read <a href="chapter1.html">Chapter 1</a></p>',
        },
        expectedOutput:
          '<p>Read <a href="chap1/content/chapter1.html">Chapter 1</a></p>',
      },
    ] as Array<{
      testCase: string;
      params: ExecuteParams;
      expectedOutput: string;
    }>)('$testCase', ({ params, expectedOutput }) => {
      expect(ChapterCleaner.execute(params)).toBe(expectedOutput);
    });
  });

  describe('images', () => {
    it.each([
      {
        testCase: 'should return the same chapter when there are no image tags',
        params: {
          manifest: {},
          contentPath: '',
          imageRoot: '',
          rawChapter: '<p>This is a chapter without images.</p>',
        },
        expectedOutput: '<p>This is a chapter without images.</p>',
      },
      {
        testCase: 'should replace image tags with images in the manifest',
        params: {
          manifest: {
            img1: {
              href: 'content/image1.jpg',
              id: 'img1',
              mediaType: 'image/jpeg',
            },
          },
          contentPath: 'content',
          imageRoot: '/images/',
          rawChapter: '<p>Image: <img src="image1.jpg"></p>',
        },
        expectedOutput:
          '<p>Image: <img src="/images/img1/content/image1.jpg"></p>',
      },
      {
        testCase: 'should remove image tags not in the manifest',
        params: {
          manifest: {
            img1: {
              href: 'content/image1.jpg',
              id: 'img1',
              mediaType: 'image/jpeg',
            },
          },
          contentPath: 'content',
          imageRoot: '/images/',
          rawChapter: '<p>Image: <img src="image2.jpg"></p>',
        },
        expectedOutput: '<p>Image: </p>',
      },
      {
        testCase: 'should handle empty rawChapter gracefully',
        params: {
          manifest: {},
          contentPath: '',
          imageRoot: '',
          rawChapter: '',
        },
        expectedOutput: '',
      },
      {
        testCase:
          'should handle multiple images with some present in the manifest',
        params: {
          manifest: {
            img1: {
              href: 'content/image1.jpg',
              id: 'img1',
              mediaType: 'image/jpeg',
            },
          },
          contentPath: 'content',
          imageRoot: '/images/',
          rawChapter: '<p><img src="image1.jpg"><img src="image2.jpg"></p>',
        },
        expectedOutput: '<p><img src="/images/img1/content/image1.jpg"></p>',
      },
    ] as Array<{
      testCase: string;
      params: ExecuteParams;
      expectedOutput: string;
    }>)('$testCase', ({ params, expectedOutput }) => {
      const { manifest, contentPath, imageRoot, rawChapter } = params;
      expect(
        ChapterCleaner.execute({
          rawChapter,
          manifest,
          contentPath,
          imageRoot,
        }),
      ).toBe(expectedOutput);
    });
  });
});
