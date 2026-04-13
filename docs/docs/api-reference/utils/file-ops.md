---
title: File Operations
sidebar_position: 7
---

# File Operations

File system utilities for managing output files, format detection, path manipulation, and template management.

```ts
import {
  MANIM_VERSION,
  isMP4Format,
  isGIFFormat,
  guaranteeExistence,
  seekFullPathFromDefaults,
  addExtensionIfNotPresent,
  getTemplateNames,
} from "manim-ts";
```

## Version

### `MANIM_VERSION: string`

The version string of the manim-ts port. Tracks the Python Manim version it was ported from.

```ts
console.log(MANIM_VERSION);
// => "0.18.0" (or similar)
```

## Format Detection

These functions check the output format based on file extension or configuration. They are used by the rendering pipeline to determine the correct encoder and container format.

### `isMP4Format(format: string): boolean`

Returns `true` if the format string indicates an MP4 container.

```ts
isMP4Format("mp4");  // => true
isMP4Format("gif");  // => false
```

### `isGIFFormat(format: string): boolean`

Returns `true` if the format string indicates a GIF output.

```ts
isGIFFormat("gif");  // => true
isGIFFormat("mp4");  // => false
```

### `isWebMFormat(format: string): boolean`

Returns `true` if the format string indicates a WebM container.

### `isMOVFormat(format: string): boolean`

Returns `true` if the format string indicates a MOV (QuickTime) container.

### `isPNGFormat(format: string): boolean`

Returns `true` if the format string indicates a PNG image sequence.

```ts
isPNGFormat("png");  // => true
```

## File Utilities

### `writeToMovie(config: any): boolean`

Determines whether the current configuration should produce a video file (as opposed to a PNG sequence or live preview).

```ts
if (writeToMovie(config)) {
  // Set up ffmpeg encoding pipeline
} else {
  // Output individual frames
}
```

### `guaranteeExistence(path: string): string`

Ensures a directory exists, creating it (and any parent directories) if necessary. Returns the path.

```ts
const outputDir = guaranteeExistence("/output/videos/1080p60");
// Directory now exists, even if it didn't before
```

### `guaranteeEmptyExistence(path: string): string`

Ensures a directory exists and is empty. If it exists with contents, those are removed. If it does not exist, it is created.

```ts
const tempDir = guaranteeEmptyExistence("/tmp/manim-frames");
// Directory exists and is empty
```

:::caution
This function deletes all contents of the directory if it already exists. Use with care.
:::

## Path Utilities

### `seekFullPathFromDefaults(fileName: string, defaultDir?: string, extensions?: string[]): string | null`

Searches for a file by name, checking the default directory and common extensions. Returns the full path if found, or `null` if not found.

```ts
// Search for "my_scene" with common video extensions
const path = seekFullPathFromDefaults("my_scene", "/output/videos", [
  ".mp4", ".mov", ".webm"
]);
// => "/output/videos/my_scene.mp4" (if it exists)
```

### `addExtensionIfNotPresent(fileName: string, extension: string): string`

Appends a file extension if the filename does not already have one.

```ts
addExtensionIfNotPresent("scene", ".mp4");
// => "scene.mp4"

addExtensionIfNotPresent("scene.mp4", ".mp4");
// => "scene.mp4" (unchanged)

addExtensionIfNotPresent("scene.mov", ".mp4");
// => "scene.mov" (different extension, unchanged)
```

## Template Utilities

Template functions manage scene template files that can be used as starting points for new projects.

### `getTemplateNames(): string[]`

Returns a list of available template names.

```ts
const templates = getTemplateNames();
// => ["default", "presentation", "three_d", ...]
```

### `getTemplatePath(templateName: string): string`

Returns the file system path to a template by name.

```ts
const path = getTemplatePath("default");
// => "/path/to/templates/default.ts"
```

### `copyTemplateFiles(templateName: string, targetDir: string): void`

Copies template files to a target directory. Used for scaffolding new manim-ts projects.

```ts
copyTemplateFiles("default", "/my-project/src");
// Copies template files into the target directory
```

## Output Directory Structure

When rendering scenes, manim-ts organizes output files in a structured directory tree:

```
media/
  videos/
    <SceneName>/
      <quality>/          # e.g., 1080p60, 720p30
        <SceneName>.mp4   # Final video
        partial_movie_files/
          <hash>.mp4      # Individual animation segments
  images/
    <SceneName>/
      <SceneName>.png     # Last frame captures
  tex/
    <hash>.svg            # Cached TeX renders
```

The file operation utilities manage creation and cleanup of this directory structure.
