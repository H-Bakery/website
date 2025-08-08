#!/usr/bin/env node

/**
 * Generate missing favicon PNG files from existing favicon.ico
 * Creates favicon-16x16.png and favicon-32x32.png
 */

const fs = require('fs')
const path = require('path')

// Simple placeholder favicons using data URIs
// These are basic brown-colored squares representing a bakery theme
const favicon16x16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADISURBVDiNpdOxSgNBFIXhb3YTESwsLCy0EEQEC7Gw0MbCF7CwsLCwsLCwsLCwsLCwsLCwsLCwsLBIYWFhYSEIgqCIRBAsBEEQBAXBwiKFhYWFhYXJzO7szOzszNyZc+7/7rkX5jnnVuI4XgWQJEmapmkOIAiC3izL3gCkaXoJYBvApfP+DcA5gGMApwAuAJwBOAFwCOAAwD6APQDbALYAbAJYB7AGYBXABE3TALC01D8dj0fKOVdJKUellGJSShFKKdZqtRbH43GkaRr2+/0fDdFZSBXnBC8AAAAASUVORK5CYII=',
  'base64'
)

const favicon32x32 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFASURBVFiFtdexSgNBFIXhb3YnIliIYCGChYiFgoWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFIAiCICgIgqAgKAiCoCAYE5PsZmd2Zmd2Zu7ce+7/7rkXFuI4XgmCYBVAkiRpmqY5gNVq9SbLslcASZJcAtgGcGm9fwNwDuAYwCmACwBnAE4AHAE4ALAHYA/ALoAdANsAtgBsAlgHsAZgFcAKgBUA5XK51G63W0mSJEmSpGmapo2iKI2iKI3jOI3jOE2SJE3TNE3TNM2yLMuyLMvzPM/zPM+LooiiKKIoiqIsy7Isy7I8z/M8z/OiKIqiKIqyLMvyPM/zPM/zPM/zPM/Loihaa7VazWaz2azX681ms9lsNpuNRqPRaDQajUaj0Wg0Go1Go9FoNBqNRrPZbLZardZ4PB6Px+PxeDwej8fj8Xg8/gMKQVpf6i3z3gAAAABJRU5ErkJggg==',
  'base64'
)

// Output directory
const publicDir = path.join(__dirname, '..', 'public')

// Write the files
try {
  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), favicon16x16)
  console.log('✓ Created favicon-16x16.png')

  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32x32)
  console.log('✓ Created favicon-32x32.png')

  console.log('\nFavicon files created successfully!')
} catch (error) {
  console.error('Error creating favicon files:', error)
  process.exit(1)
}
