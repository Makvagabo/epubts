import createDOMPurify from 'dompurify';
import urlJoin from 'url-join';

import { Manifest } from './types';

export type ExecuteParams = {
  rawChapter: string;
  manifest: Manifest;
  contentPath: string;
  imageRoot?: string;
  linkRoot?: string;
};

export class ChapterCleaner {
  private static mockHost = 'https://mock.host';

  public static execute(params: ExecuteParams): string {
    const DOMPurify = createDOMPurify(window);

    const {
      rawChapter,
      manifest,
      contentPath,
      linkRoot = '',
      imageRoot = '',
    } = params;

    DOMPurify.addHook('uponSanitizeElement', (currentNode, data) => {
      if (
        data.tagName === 'img' &&
        currentNode instanceof Element &&
        'src' in currentNode.attributes
      ) {
        let parsedManifestHref: URL;
        let fullSourcePath: string;

        const currentNodeSrc = currentNode.getAttribute('src')?.trim();
        const parsedNodeSrc = currentNodeSrc
          ? new URL(currentNodeSrc, this.mockHost)
          : null;

        const element = Object.values(manifest).find(({ href }) => {
          if (!currentNodeSrc || !parsedNodeSrc) {
            return false;
          }

          parsedManifestHref = new URL(href, this.mockHost);
          fullSourcePath =
            contentPath && !parsedManifestHref.pathname.includes(contentPath)
              ? urlJoin(contentPath, parsedManifestHref.pathname)
              : parsedManifestHref.pathname;

          return fullSourcePath.includes(parsedNodeSrc.pathname);
        });

        if (element) {
          currentNode.setAttribute(
            'src',
            urlJoin(
              imageRoot,
              element.id,
              fullSourcePath!,
              parsedManifestHref!.search,
              parsedManifestHref!.hash,
            ),
          );
        } else {
          currentNode.remove();
        }
      }

      if (
        data.tagName === 'a' &&
        currentNode instanceof Element &&
        'href' in currentNode.attributes
      ) {
        let parsedManifestHref: URL;
        let fullSourcePath: string;

        const currentNodeHref = currentNode.getAttribute('href')?.trim();
        const parsedNodeHref = currentNodeHref
          ? new URL(currentNodeHref, this.mockHost)
          : null;

        const element = Object.values(manifest).find(({ href }) => {
          if (!currentNodeHref || !parsedNodeHref) {
            return false;
          }

          parsedManifestHref = new URL(href, this.mockHost);
          fullSourcePath =
            contentPath && !parsedManifestHref.pathname.includes(contentPath)
              ? urlJoin(contentPath, parsedManifestHref.pathname)
              : parsedManifestHref.pathname;

          return fullSourcePath.includes(parsedNodeHref.pathname);
        });

        if (element) {
          return currentNode.setAttribute(
            'href',
            urlJoin(
              linkRoot,
              element.id,
              fullSourcePath!,
              parsedManifestHref!.search,
              parsedManifestHref!.hash,
            ),
          );
        }

        if (currentNodeHref) {
          return currentNode.setAttribute(
            'href',
            urlJoin(
              '',
              parsedNodeHref!.pathname,
              parsedNodeHref!.search,
              parsedNodeHref!.hash,
            ),
          );
        }
      }
    });

    let processingChapter = DOMPurify.sanitize(rawChapter, {
      FORBID_TAGS: ['style', 'html', 'head', 'body'],
      ADD_ATTR: ['target'],
    });

    processingChapter = ChapterCleaner.minifyHTML(processingChapter);

    return processingChapter;
  }

  private static minifyHTML(html: string) {
    // remove comments
    let result = html.replace(/<!--[\s\S]*?-->/g, '');

    // collapse whitespace
    result = result.replace(/\s{2,}/g, ' ');

    // remove whitespace between tags
    result = result.replace(/>\s+</g, '><');

    return result.trim();
  }
}
