import {ZipFile, FileNotFoundError} from "./zipfile.js";
import { readFileSync } from 'fs';
import {vi} from 'vitest';

describe('ZipFile', () => {
  let file: Buffer;

  beforeAll(() => {
    file = readFileSync('./test.zip');
  })

  it('extracts names and count', async () => {
    const zf = await ZipFile.openZipFile(file, './test.zip');
    expect(zf.names).toEqual(['file1.txt', 'file2.txt']);
    expect(zf.count).toEqual(2);
  });

  it('returns an error when reading a non-existant file', async () => {
    const zf = await ZipFile.openZipFile(file, './test.zip');
    const callback = vi.fn();
    zf.readFile('doesnotexist.txt', callback);

    expect(callback.mock.calls[0][0]).toBeNull();
    expect(callback.mock.calls[0][1]).toBeInstanceOf(FileNotFoundError);
  });

  it('reads file contents', async () => {
    const zf = await ZipFile.openZipFile(file, './test.zip');
    zf.readFile('file2.txt', (data, _err) => {
      expect(data).not.toBeNull();
      expect(data!.toString()).toEqual('Hello World!');
    });
  });
});