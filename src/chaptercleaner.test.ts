import ChapterCleaner from './chaptercleaner.js';

describe('ChapterCleaner', () => {
  describe('keepOnlyBodyContents', () => {
    it('only keeps body contents', () => {
      const result = ChapterCleaner.keepOnlyBodyContents('<html><head></head><body>test</body></html>');
      expect(result).toEqual('test');
    });
  });

  describe('removeScriptBlocks', () => {
    it('removes script blocks', () => {
      const result = ChapterCleaner.removeScriptBlocks('<script>test</script>');
      expect(result).toEqual('');
    });

    it('removes multiple script blocks', () => {
      const result = ChapterCleaner.removeScriptBlocks('<script src="test.js">test1</script><p>foo<p/><script>test2</script>');
      expect(result).toEqual('<p>foo<p/>');
    });
  });
});