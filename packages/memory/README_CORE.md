# Memory Pack

This is the core of the Vertesia memory Pack library.
It defines the memory pack commands and provide an API to build and read memory packs.

A memory pack is an indexed tar file containing a `metadata.json` and other random files (images, documents, text files etc.). The `metadata.json` file is defining the properties of a memory pack. The metadata is used to describe the memory and the other files in the tar can be used to hold the additional content you need in order to create a context for the interaction with a target LLM.

To build a memory pack you must use the memory pack API or the `memo` application provided by `@vertesia/memory-cli` package. The tar contains a special file named `.index` which is used to index the tar content so that the tar entries can be quickly extracted from the tar without needing to untar the entire content.

## Memory Pack Recipe

A recipe is a typescript file that is used to build a memory pack.
The recipe can contain any javascript code but it must use the builtin commands to create the memory TAR file.

A memory pack recipe has the following structure:

```js
import { copy, ... other commands ... } from "@vertesia/memory-commands";

// You can optionally extend an existing memory pack
await from("path/to/memory.tar")

/** then you can build the memory tar content using builtin commands
 * You can either use the built-in commands or `exec` to run a shell command
 */

// ... Your commands here ...

/**
 * At the end of the file you must export the memory pack metadata.
 * This is a JSON object which holds the properties to be used when creating LLM interactions.
 */
export default {
    someProperty: "hello",
    ...
}
```

## Memory Pack Commands

The only dependency you need to import in your recipe ts file is the `@vertesia/memory-commands` package. This package contains all the built-in commands which are grouped in two categories: execution commands and content loading commands:

### Context commands

1. **vars** - Get the build user variables
2. **tmpdir** - Get or create a temporary directory for use while building
3. **getBuilder** - Get the builder instance.

### Execution commands

1. **from** - Extends an existing memory pack (a tar file)
2. **exec** - Execute a shell command.
3. **copy** - Copy a file to the tar. The file content can be transformed using the built-in transformers. See the [copy command](#copy) for more details.
4. **copyText** - Copy an inline text or string variable as a tar entry.
5. **build** - Build an external recipe.

### Content loading commands

These commands can be used to fetch content from files. The result is returned as a variable which will only fetch the content when used. All these commands supports globs as argument to fetch content from multiple files. When a glob is used the result will always be an array of variables.

1. **content** - fetch the text content from a text file.
2. **json** - fetch a JSON object from a json file.
3. **pdf** - extract the text content from a PDF file.
4. **docx** - extract the text content from a Docx file.
5. **media** - Load an image with an optional conversion. The image is exported as base64 text, when the variable is referenced in the exported memory metadata.

#### vars

**Signature:** `vars (): Record<string,any>`

A command that returns the user variables which were specified when invoking the memory pack build.
These variables can be used to parametrize the recipe. When using the `memo` cli application (i.e. `@vertesia/memory-cli`) you can pass vars to the recipe by using command line parameters which starts with a `--var-` prefix.

**Example:** `--var-language fr` will produce a property `language` with a value of `'fr'`.

**Usage:**

```js
import { vars } from '@vertesia/memory-commands';

const { language } = vars();
```

#### tmpdir

**Signature:** `tmpdir (): string`

Get or create a temporary directory. If the directory was not yet created it will be created and its path returned.

If created, the temporary directory will be automatically removed at the end of the build.

**Usage:**

```js
import { tmpdir } from '@vertesia/memory-commands';

const wd = tmpdir();

await exec(`ls -al > ${wd}/text.txt`);
```

### getBuilder

**Signature:** `getBuilder (): Builder`

Get the instance of the builder which is used to build the current recipe ts file.

### from

**Signature:** `from (location: string, options?: FromOptions): void`

The from command load an existing memory pack tar as a source of the current pack being built. You can filter which files and metadata properties will be included from the source tar by specifying a `files` filter and a metadata properties `projection`.

The `from` command is an asynchronous operation so you need to `await` for its completion.

The shape of the `FromOptions` is:

```ts
{
    files?: string[];
    projection?: Record<string, boolean | 0 | 1>;
}
```

The `files` filter is an array of globs as supported by the [micromatch](https://www.npmjs.com/package/micromatch) library. You can either include files using globs expressions or files by prepending the glob expression with an `!` character.

The `projection` is an object which map keys to a truthy or falsy value. You can either use false or true to exclude or include properties not both.

_Example:_

```js
import { vars, from } from '@vertesia/memory-commands';
await from('./memory-source.tar', {
    files: ['images/*.png'],
    projection: {
        name: true,
        language: true,
    },
});
// export a new metadata object
export default {
    theme: vars.theme || 'dark',
};
```

The memory pack built above will contain all the `images/*.png` files from the source tar and the metadata JSON object will contain the `name` and `language` properties from the source memory pack metadata and will add a new metadata property named `theme`.

### exec

**Signature:** `exec (cmd: string, options?: ExecOptions): Promise<void | string>`

Execute a shell command. You can execute a pipe of shell commands or use stdout redirection at the end of the command:

The `exec` command is asynchronous so you need to use await when invoking it. If no output redirection is specified then the output will be returned as a string from the `exec()` function

**Example:**

```javascript
import { tmpdir, exec } from '@vertesia/memory-commands';
const wd = tmpdir();
const output = await exec('cat some/file | wc -l');
await exec(`cat some/file | wc -l > ${wd}out.txt`);
```

### copy

**Signature:** `copy (location: SourceSpec, path: string, options?: CopyOptions): void`

This command will copy the content of a file to a tar entry specified by the `path` argument.
The `location` argument specify from source from where the content is copied.
It may be either a `string` or a `ContentSource` object. ContentSource objects are returned by any of the [Content Loading Commands](#content-loading-commands).

If location is a string it will be expected to point to a file path or to a glob expression.
If a glob expression is used the the `copy` operation will copy the content of all the matching files. You can, in that case, specify a path rewrite expression as the `path` argument.

You can transform the file content when copying it to the tar by using the `options` argument. The shape of the options is:

```ts
export interface CopyOptions {
    media?: {
        max_hw?: number;
        format?: 'jpeg' | 'png';
    };
    extractText?: boolean | string;
}
```

You can convert images by specifying a max height or width and / or an output image format. For documents like pdf or docx you can specify `extractText: "pdf" | "docx" | boolean`. If true is specified the type of text extraction will be guessed from the file extension.

**Example:**

```js
import { exec, copy, tmpdir } from '@vertesia/memory-commands';
const wd = tmpdir();
await exec(`cat some/file > ${wd}/out.txt`);
copy(`${wd}/out.txt`, 'out.txt');
copy('./my-project/src/**/*.ts', './my-project/src!sources/*');
```

The rewrite expression in the example above `./my-project/src!sources/*` means: strip the prefix `./my-project/src` from he copied file and prefix the remaining od the path with the value `sources/`.

#### Path rewrite expressions

A path rewrite expression is composed of two parts:

1. an optional prefix separated by a `!` character from the rest of the path. If present this prefix will be removed from the matched path.
   If no prefix is specified then the entire directory part of the matched path will be removed.
2. A mandatory suffix which is describing how to rewrite the matched path. The suffix may contain either a wildcard `*` which will be replaced with the matched path (without the removed prefix), either a combination of the following variables:
    - `%n` - the file name without the extension
    - `%e` - the extension
    - `%f` - the file name including the extension
    - `%d` - the directory path (not including the removed prefix)
    - `%i` - the 0 based index of the file in the matched array of files.

**Examples:**

```js
// copy all .ts files flattened in the sources directory (the directory structure is not preserved)
copy('work/docs/project1/src/**/*.ts', 'sources/*');
// copy all .ts files  in the sources directory and recreate the subdirectories structure inside src/
copy('work/docs/project1/src/**/*.ts', 'work/docs/project1/src!sources/*');
// Remove the work/ prefix and preserver the same subdirectories structure including images/
// and replace the file extension with .png
copy('work/images/**/*.png', 'work!%d/%n.jpeg');
// Copy all images inside a images/ folder without preserving subdirectories and append the index of the image
copy('work/images/**/*.png', 'images/%n-%i.%e');
```

In the last example for the matched files: `work/images/header/home.png` and `work/images/footer/logo.png` the result will be: `images/home-0.png`, `images/logo-1.png`

### copyText

**Signature:** `copyText (text: string, path: string): void`

This command will create a new entry in the target memory pack tar using the content you specified through the `text` argument. The tar entry path is specified by the `path` argument.

```js
import { exec, copyText } from '@vertesia/memory-commands';
const content = await exec(`cat some/file`);
copyText(content.trim(), 'content.txt');
```

### build

**Signature:** `build (recipePath: string, options?: BuildOptions): void`

Build a memory pack from a recipe file. You can use this command if you need to build multiple memory packs.

The `BuildOptions` options have the following shape:

```ts
export interface BuildOptions {
    indent?: number;
    /**
     * the path to save the output. Defaults to 'memory.tar'.
     * If no .tar extension is present it will be added
     */
    out?: string;

    /**
     * If set, suppress logs. Defaults to false.
     */
    quiet?: boolean;

    /**
     * If true, compress the output (tar or json) with gzip. Defaults to false.
     */
    gzip?: boolean;

    /**
     * Vars to be injected into the script context as the vars object
     */
    vars?: Record<string, any>;

    /**
     * Optional publish action
     * @param file
     * @returns the URI of the published memory
     */
    publish?: (file: string, name: string) => Promise<string>;
}
```

**Usage:**

```js
import { build, tmpdir } from '@vertesia/memory-commands';
const wd = tmpdir();
await build('./some/recipe.ts', { out: `${wd}}/child-memory` });
```

### content

**Signature:** `content (location: string, encoding?: BufferEncoding): ContentObject | ContentObject[]`

If the location is a glob expression then an array of `ContentObject` is returned. A `ContentObject` implements `ContentSource` so it can be used as the location argument of the copy operation.
The actual content of a file is only fetched (and transformed) only when the ContentObject is used: either a method of the object is used, either it is assigned to a value of a metadata property.

The `content` command simply load the content of the given file(s) as a text using an optional encoding. The default encoding is "utf-8".

### json

**Signature:** `json (location: string) => ContentObject | ContentObject[]`

Load a JSON object from a json file. When assigned as a metadata property the content will by transformed in a JSON object.

### pdf

**Signature:** `pdf (location: string) => PdfObject | PdfObject[]`

Load a PdfObject form a pdf file. When assigned as a metadata property the PdfObject is transformed to the text representation of the PDF.

**Example:**

```js
import { pdf } from '@vertesia/memory-commands';

const doc = pdf('./my-doc.pdf');

export default {
    textContent: doc,
};
```

In the example above the PDF text will be extracted from the pdf and injected as the textContent property ion the memory pack metadata.

### docx

Load a DocxObject form a docx file. When assigned as a metadata property the DocxObject is transformed to the text representation of the Docx.

**Signature:** `docx (location: string) => DocxObject | DocxObject[]`

### media

**Signature:** `json (location: string, options?: MediaOptions) => MediaObject | MediaObject[]`

Load a MediaObject form a docx file. When assigned as a metadata property the MediaObject is transformed to text representation of the image which is the base64 encoded image.

The media command accepts an additional argument which has the shape:

```
export interface MediaOptions {
    max_hw?: number;
    format?: "jpeg" | "png";
}
```

You can thus convert the image before using it.

**Example:**

```js
import { pdf } from '@vertesia/memory-commands';

const images = media('./images/*.jpeg');

export default {
    images: images,
};
```

In the example above the an array of images encoded as base64 will be injected in the `images` property pf the memory pack metadata.

### Custom commands

To create custom commands you have 2 options. Either you write the command in as a command line application and invoke it through the `exec` command, either you write a javascript function, package it in an external library and the import it in the recipe ts file.

Here is a template of custom command functions:

```js
import { getBuilder } from "@vertesia/memory-commands";
import fs from "node:fs";

export myCommand(message:string) {
    const wd = builder.tmpdir();
    // this is the current instance of the builder being used to build the memory pack.
    const builder = getBuilder();
    // you can add a variable in the build vars:
    builder.vars.greeting = 'hello world!';
    // or write a file named greeting.txt in the current build tmpdir
    fs.writeFileSync(`${wd}/greeting.txt`, "hello world!", "utf-8");
    // or create a tar entry named greeting.txt
    builder.copyText("hello world!", "greeting.txt");
    // refer to Builder API for other operations.
}
```

## Examples

### Release Highlights

This example builds a memory pack with the information on which issues were fixed between to commit SHA.

```js
import { copy, copyText, exec, tmpdir, vars } from "@vertesia/memory-commands";

const { start, end } = vars();
if (!start || !end) {
    console.error("Please provide start and end tags using --var-start and --var-end");
    process.exit(1);
}

const wd = tmpdir();

console.log(`Retrieving issues between ${start}and ${end}...`)
// Get list of commit logs containing '#' between the two tags and extract unique issue numbers
const issue_numbers = await exec(`git log ${start}..${end} --oneline | grep -o '#[0-9]\\+' | sed 's/#//' | sort -u`) as string;

for (const issue of issue_numbers.trim().split("\n")) {
    console.log(`Processing issue #${issue}`)
    const issue_content = await exec(`gh issue view ${issue}`) as string;
    copyText(issue_content, `issues/${issue}.txt`);
}

console.log("Generating diff");
await exec(`git diff --submodule=diff ${start}...${end} > ${wd}/range_diff.txt`)
copy(`${wd}/range_diff.txt`, "range_diff.txt");

export default {
    from_version: start,
    release_version: end,
}
```
