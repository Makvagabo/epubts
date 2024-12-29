import { Manifest } from './types.js';

export class ChapterCleaner {
  public cleanChapter(
    rawChapter: string,
    manifest: Manifest,
    contentPath: string,
    imageroot: string,
    linkroot: string,
  ): string {
    // no multi line matches in JS regex!
    rawChapter = this.removeLinebreaks(rawChapter);
    rawChapter = this.keepOnlyBodyContents(rawChapter);
    rawChapter = this.removeScriptBlocks(rawChapter);
    rawChapter = this.removeStyleBlocks(rawChapter);
    rawChapter = this.removeOnEventHandlers(rawChapter);
    rawChapter = this.removeImages(
      rawChapter,
      manifest,
      contentPath,
      imageroot,
    );
    rawChapter = this.replaceLinks(rawChapter, manifest, contentPath, linkroot);
    rawChapter = this.bringBackLinebreaks(rawChapter);
    return rawChapter;
  }

  public bringBackLinebreaks(rawChapter: string): string {
    return rawChapter.replace(/\u0000/g, '\n').trim(); // eslint-disable-line no-control-regex
  }

  public removeImages(
    rawChapter: string,
    manifest: Manifest,
    contentPath: string,
    imageroot: string,
  ) {
    const keys = Object.keys(manifest);
    return rawChapter.replace(
      /(\ssrc\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g,
      (_match, offset, str, groups) => {
        const img = [contentPath, str].join('/').trim();
        let element;

        for (let i = 0, len = keys.length; i < len; i++) {
          if (manifest[keys[i]].href == img) {
            element = manifest[keys[i]];
            break;
          }
        }

        // include only images from manifest
        if (element) {
          return offset + imageroot + element.id + '/' + img + groups;
        } else {
          return '';
        }
      },
    );
  }

  public replaceLinks(
    rawChapter: string,
    manifest: Manifest,
    contentPath: string,
    linkroot: string,
  ): string {
    const keys = Object.keys(manifest);
    return rawChapter.replace(
      /(\shref\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g,
      (_match, offset, str, groups) => {
        const linkparts = str && str.split('#');
        let link = linkparts.length
          ? [contentPath, linkparts.shift() || ''].join('/').trim()
          : '';
        let element;

        for (let i = 0, len = keys.length; i < len; i++) {
          if (manifest[keys[i]].href.split('#')[0] == link) {
            element = manifest[keys[i]];
            break;
          }
        }

        if (linkparts.length) {
          link += '#' + linkparts.join('#');
        }

        // include only images from manifest
        if (element) {
          return offset + linkroot + element.id + '/' + link + groups;
        } else {
          return offset + str + groups;
        }
      },
    );
  }

  public removeOnEventHandlers(rawChapter: string) {
    return rawChapter.replace(
      /(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/g,
      function (_match, a, b, c) {
        return a + 'skip-' + b + c;
      },
    );
  }

  public removeStyleBlocks(rawChapter: string) {
    return rawChapter.replace(
      /<style[^>]*?>(.*?)<\/style[^>]*?>/gi,
      function (_o, _s) {
        return '';
      },
    );
  }

  public removeScriptBlocks(rawChapter: string): string {
    return rawChapter.replace(
      /<script[^>]*?>(.*?)<\/script[^>]*?>/gi,
      function (_o, _s) {
        return '';
      },
    );
  }

  public keepOnlyBodyContents(rawChapter: string): string {
    const match = rawChapter.match(/<body[^>]*?>(.*)<\/body[^>]*?>/i);
    return match ? match[1] : rawChapter;
  }

  public removeLinebreaks(rawChapter: string): string {
    return rawChapter.replace(/\r?\n/g, '\u0000');
  }
}

export default new ChapterCleaner();
