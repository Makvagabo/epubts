import JSZip from "jszip";

export class FileNotFoundError extends Error {}
export class FileReadError extends Error {}

// Mock zipfile using pure-JS adm-zip:
export class ZipFile {
  private constructor(private filename: string, private zip: JSZip, public names: string[], public count: number) {
  };

  public readFile(name: string, callback: (data: string | null, err?: Error) => void) {
    const file = this.zip.file(name);

    if (file === null) {
      callback(null, new FileNotFoundError('File not found: ' + this.filename));
      return;
    }

    file.async('string')
      .then((value) => callback(value))
      .catch((reason) => callback(null, new FileReadError(reason)));
  };

  public static async openZipFile(arraybuffer: ArrayBuffer, filename: string) {
    const jszip = new JSZip();
    await jszip.loadAsync(arraybuffer);
    const names = Object.keys(jszip.files);
    const count = names.length;

    return new ZipFile(filename, jszip, names, count);
  }
}