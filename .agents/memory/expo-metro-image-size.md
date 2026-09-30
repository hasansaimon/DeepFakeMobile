---
name: Expo Metro image sizing
description: Compatibility constraint between Expo SDK 54's Metro asset loader and secure image-size 2.x overrides.
---

Expo SDK 54's Metro 0.83 asset loader passes image file paths to image-size's old synchronous API. The secure image-size 2.x line accepts bytes through the package root and loads paths asynchronously through the image-size/fromFile subpath, so a direct major-version override breaks Expo asset bundling.

**Why:** The workspace needs the patched image-size line for dependency security, but Expo 54 must remain in its supported SDK family; upgrading Metro or Expo broadly would introduce unnecessary compatibility risk.

**How to apply:** When keeping Expo 54 and overriding Metro's image-size dependency to 2.x, patch Metro's asset loader to use imageSizeFromFile for path inputs while retaining the root byte API for zipped assets.