#!/usr/bin/env node

const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')
const glob = require('glob')

// Configuration
const IMAGE_QUALITY = {
  webp: 85,
  jpg: 85,
  avif: 80,
}

const SIZES = {
  thumbnail: 150,
  small: 400,
  medium: 800,
  large: 1200,
  xlarge: 1920,
}

async function optimizeImage(inputPath, outputDir) {
  const filename = path.basename(inputPath, path.extname(inputPath))
  const stats = await fs.stat(inputPath)
  const originalSize = stats.size

  console.log(
    `Processing: ${inputPath} (${(originalSize / 1024 / 1024).toFixed(2)}MB)`
  )

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true })

  // Get image metadata
  const image = sharp(inputPath)
  const metadata = await image.metadata()
  const { width, height } = metadata

  const results = []

  // Generate responsive sizes
  for (const [sizeName, maxWidth] of Object.entries(SIZES)) {
    // Skip if original is smaller than target size
    if (width <= maxWidth) continue

    const aspectRatio = height / width
    const newHeight = Math.round(maxWidth * aspectRatio)

    // Generate WebP version
    const webpPath = path.join(outputDir, `${filename}-${sizeName}.webp`)
    await sharp(inputPath)
      .resize(maxWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY.webp })
      .toFile(webpPath)

    const webpStats = await fs.stat(webpPath)
    results.push({
      format: 'webp',
      size: sizeName,
      width: maxWidth,
      file: webpPath,
      fileSize: webpStats.size,
    })

    // Generate fallback JPEG version
    const jpgPath = path.join(outputDir, `${filename}-${sizeName}.jpg`)
    await sharp(inputPath)
      .resize(maxWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: IMAGE_QUALITY.jpg,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(jpgPath)

    const jpgStats = await fs.stat(jpgPath)
    results.push({
      format: 'jpg',
      size: sizeName,
      width: maxWidth,
      file: jpgPath,
      fileSize: jpgStats.size,
    })
  }

  // Generate original size in WebP
  const webpOrigPath = path.join(outputDir, `${filename}-original.webp`)
  await sharp(inputPath)
    .webp({ quality: IMAGE_QUALITY.webp })
    .toFile(webpOrigPath)

  const webpOrigStats = await fs.stat(webpOrigPath)
  results.push({
    format: 'webp',
    size: 'original',
    width: width,
    file: webpOrigPath,
    fileSize: webpOrigStats.size,
  })

  // Generate blur placeholder (base64)
  const placeholder = await sharp(inputPath)
    .resize(20, Math.round(20 * (height / width)))
    .blur(10)
    .webp({ quality: 20 })
    .toBuffer()

  const placeholderBase64 = `data:image/webp;base64,${placeholder.toString(
    'base64'
  )}`

  // Calculate total savings
  const totalNewSize = results.reduce((sum, r) => sum + r.fileSize, 0)
  const savings = (
    ((originalSize - totalNewSize) / originalSize) *
    100
  ).toFixed(1)

  console.log(`  ✓ Generated ${results.length} versions`)
  console.log(
    `  ✓ Saved ${savings}% (${(originalSize / 1024).toFixed(0)}KB → ${(
      totalNewSize / 1024
    ).toFixed(0)}KB)`
  )

  return {
    original: inputPath,
    originalSize,
    results,
    placeholder: placeholderBase64,
    savings,
  }
}

async function processDirectory(inputDir, outputDir) {
  const pattern = path.join(inputDir, '**/*.{jpg,jpeg,png,JPG,JPEG,PNG}')
  const files = glob.sync(pattern)

  console.log(`Found ${files.length} images to optimize in ${inputDir}\n`)

  const allResults = []

  for (const file of files) {
    const relativePath = path.relative(inputDir, file)
    const outputPath = path.join(outputDir, path.dirname(relativePath))

    try {
      const result = await optimizeImage(file, outputPath)
      allResults.push(result)
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error.message)
    }

    console.log('') // Empty line between images
  }

  // Generate manifest file
  const manifest = {
    generated: new Date().toISOString(),
    images: allResults.map((r) => ({
      original: path.relative(process.cwd(), r.original),
      placeholder: r.placeholder,
      sources: r.results.map((res) => ({
        format: res.format,
        size: res.size,
        width: res.width,
        path: path.relative(process.cwd(), res.file),
      })),
    })),
  }

  const manifestPath = path.join(outputDir, 'image-manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  // Summary
  const totalOriginal = allResults.reduce((sum, r) => sum + r.originalSize, 0)
  const totalOptimized = allResults.reduce(
    (sum, r) => sum + r.results.reduce((s, res) => s + res.fileSize, 0),
    0
  )
  const totalSavings = (
    ((totalOriginal - totalOptimized) / totalOriginal) *
    100
  ).toFixed(1)

  console.log('\n=== Optimization Complete ===')
  console.log(`Total images processed: ${allResults.length}`)
  console.log(`Original size: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`)
  console.log(`Optimized size: ${(totalOptimized / 1024 / 1024).toFixed(2)}MB`)
  console.log(`Total savings: ${totalSavings}%`)
  console.log(`Manifest saved to: ${manifestPath}`)
}

// Main execution
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: node optimize-images.js <input-dir> <output-dir>')
    console.log(
      'Example: node optimize-images.js public/assets/images public/optimized'
    )
    process.exit(1)
  }

  const [inputDir, outputDir] = args

  // Check if sharp is installed
  try {
    require('sharp')
  } catch (error) {
    console.error('Sharp is not installed. Installing now...')
    const { execSync } = require('child_process')
    execSync('npm install sharp glob', { stdio: 'inherit' })
  }

  await processDirectory(inputDir, outputDir)
}

main().catch(console.error)
