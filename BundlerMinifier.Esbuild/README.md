# BundlerMinifier.Esbuild

NuGet package for bundling and minifying files defined in `bundleconfig.json` using [esbuild](https://esbuild.github.io/).

![BundlerMinifier.Esbuild](https://raw.githubusercontent.com/VS-Open/BundlerMinifier.Esbuild/main/img/bundler-minifier-esbuild-85px.png)

## Getting Started

1. **Installation**

   Install the package via NuGet:

   ```shell
   dotnet add package BundlerMinifier.Esbuild
   ```

2. **Configuration**

   Create a `bundleconfig.json` file in your project to define your bundle settings. You can also create multiple bundle config files by following the pattern `bundleconfig*.json`.

   Example `bundleconfig.json`:

   ```json
   [
     {
       "outputFileName": "wwwroot/js/site.min.js",
       "inputFiles": [
         "wwwroot/js/site.js",
         "wwwroot/js/utilities.js"
       ]
     }
   ]
   ```

3. **Usage**

   After configuring your bundle, simply compile your project to bundle and minify the specified files.
